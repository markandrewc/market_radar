"""Connector sources: sources.yaml applied to the database, plus manual reload.

Read endpoints are public; writing (reload, later sync) uses INGEST_TOKEN.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..auth import require_token
from ..db import Conn, get_conn, iso
from ..schemas import ConnectorDefaults, ConnectorList, ConnectorSource, MarketItem, ReloadResult, SyncSummary
from ..services import connectors
from ..services import items as item_store
from ..connectors import config as sources_config

router = APIRouter()


def _source(row) -> ConnectorSource:
    endpoints = list(row["endpoints"] or [])
    if not endpoints and row["endpoint"]:
        endpoints = [row["endpoint"]]
    return ConnectorSource(
        id=row["id"], name=row["name"], description=row["description"], sourceUrl=row["source_url"],
        categories=list(row["categories"]), adapterType=row["adapter_type"], endpoints=endpoints,
        refreshRate=row["refresh_rate"], refreshSeconds=row["refresh_seconds"], enabled=row["enabled"],
        inConfig=row["in_config"], authEnv=list(row["auth_env"] or []),
        filterKeywords=list(row["filter_keywords"] or []), licence=row["licence"], licenceUrl=row["licence_url"],
        lastSyncAt=iso(row["last_sync_at"]) if row["last_sync_at"] else None, lastError=row["last_error"])


@router.get("/connectors", response_model=ConnectorList)
def list_connectors(conn: Conn = Depends(get_conn)) -> ConnectorList:
    """Configured sources, the defaults from sources.yaml and whether the file changed since the last apply."""
    loaded = sources_config.load(sources_config.ensure_file())
    state = connectors.read_state(conn)
    rows = conn.execute("SELECT * FROM connector_sources ORDER BY name").fetchall()
    return ConnectorList(
        configFile=str(loaded.path) if loaded.path else "",
        configError=" | ".join(loaded.errors) or None,
        pendingChanges=state is None or state["config_sha256"] != loaded.sha256,
        appliedAt=iso(state["applied_at"]) if state and state.get("applied_at") else None,
        defaults=ConnectorDefaults(targetCities=loaded.defaults.target_cities,
                                   targetRoles=loaded.defaults.target_roles,
                                   policyKeywords=loaded.defaults.policy_keywords),
        sources=[_source(row) for row in rows])


@router.post("/connectors/reload", response_model=ReloadResult, dependencies=[Depends(require_token)])
def reload_config() -> ReloadResult:
    """Applies sources.yaml to the database, e.g. after editing a mounted volume."""
    with db.connect() as conn:
        loaded = sources_config.load(sources_config.ensure_file())
        if not loaded.usable:
            raise HTTPException(422, loaded.errors or ["sources.yaml could not be read"])
        result = connectors.apply_config(conn, loaded)
    return ReloadResult(added=result.added, updated=result.updated, disabled=result.disabled,
                        sourceCount=result.source_count, configSha256=result.config_sha256,
                        errors=result.errors)


@router.post("/connectors/sync", response_model=SyncSummary, dependencies=[Depends(require_token)])
def sync_connectors(source: str | None = None, due_only: bool = False) -> SyncSummary:
    """Fetches the configured sources and stores their normalised MarketItems.

    ``source`` limits the run to one id; ``due_only`` skips sources whose refresh_rate has not elapsed.
    """
    with db.connect() as conn:
        loaded = sources_config.load(sources_config.ensure_file())
        if not loaded.usable:
            raise HTTPException(422, loaded.errors or ["sources.yaml could not be read"])
        if source is not None and source not in loaded.by_id():
            raise HTTPException(404, f"Unknown source: {source}")
        state = connectors.read_state(conn)
        if state is None or state["config_sha256"] != loaded.sha256:
            connectors.apply_config(conn, loaded)  # edited file? sync what is in the file now
        return connectors.sync_all(conn, loaded, only=source, due_only=due_only)


@router.get("/items", response_model=list[MarketItem])
def list_items(category: str | None = None, region: str | None = None, source: str | None = None,
               q: str | None = None, order: str = "published_at", limit: int = 100, offset: int = 0,
               conn: Conn = Depends(get_conn)) -> list[MarketItem]:
    """Normalised records from all connectors (docs/market-item.schema.json)."""
    if category is not None and category.upper() not in sources_config.CATEGORIES:
        raise HTTPException(422, f"category must be one of {', '.join(sources_config.CATEGORIES)}")
    if order not in ("published_at", "fetched_at"):
        raise HTTPException(422, "order must be 'published_at' or 'fetched_at'")
    return item_store.read_items(
        conn, category=category.upper() if category else None, region=region, source=source, q=q,
        order=order, limit=max(1, min(limit, 1000)), offset=max(0, offset))
