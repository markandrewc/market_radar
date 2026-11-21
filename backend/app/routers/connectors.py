"""Connector sources: sources.yaml applied to the database, plus manual reload.

Read endpoints are public; writing (reload, later sync) uses INGEST_TOKEN.
"""
from __future__ import annotations

import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import db
from ..auth import require_token
from ..db import Conn, get_conn, iso
from ..schemas import (ConnectorConfigFile, ConnectorConfigUpdate, ConnectorDefaults, ConnectorList, ConnectorSource,
                       MarketItem, ReloadResult, SyncSummary)
from ..services import connectors
from ..services import items as item_store
from ..connectors import config as sources_config

router = APIRouter()

MAX_CONFIG_BYTES = 256 * 1024


def _source(row, item_count: int = 0) -> ConnectorSource:
    endpoints = list(row["endpoints"] or [])
    if not endpoints and row["endpoint"]:
        endpoints = [row["endpoint"]]
    return ConnectorSource(
        id=row["id"], name=row["name"], description=row["description"], sourceUrl=row["source_url"],
        categories=list(row["categories"]), adapterType=row["adapter_type"], endpoints=endpoints,
        refreshRate=row["refresh_rate"], refreshSeconds=row["refresh_seconds"], enabled=row["enabled"],
        inConfig=row["in_config"], authEnv=list(row["auth_env"] or []),
        filterKeywords=list(row["filter_keywords"] or []), licence=row["licence"], licenceUrl=row["licence_url"],
        lastSyncAt=iso(row["last_sync_at"]) if row["last_sync_at"] else None, lastError=row["last_error"],
        itemCount=item_count)


@router.get("/connectors", response_model=ConnectorList)
def list_connectors(conn: Conn = Depends(get_conn)) -> ConnectorList:
    """Configured sources, the defaults from sources.yaml and whether the file changed since the last apply."""
    loaded = sources_config.load(sources_config.ensure_file())
    state = connectors.read_state(conn)
    rows = conn.execute("SELECT * FROM connector_sources ORDER BY name").fetchall()
    counts = {row["source_id"]: row["n"] for row in
              conn.execute("SELECT source_id, count(*) AS n FROM market_items GROUP BY source_id")}
    return ConnectorList(
        configFile=str(loaded.path) if loaded.path else "",
        configError=" | ".join(loaded.errors) or None,
        pendingChanges=state is None or state["config_sha256"] != loaded.sha256,
        appliedAt=iso(state["applied_at"]) if state and state.get("applied_at") else None,
        defaults=ConnectorDefaults(targetCities=loaded.defaults.target_cities,
                                   targetRoles=loaded.defaults.target_roles,
                                   policyKeywords=loaded.defaults.policy_keywords),
        sources=[_source(row, counts.get(row["id"], 0)) for row in rows])


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
    """Normalised records from all connectors (docs/market-item.schema.json).

    ``source`` takes the connector id or the display name.
    """
    if category is not None and category.upper() not in sources_config.CATEGORIES:
        raise HTTPException(422, f"category must be one of {', '.join(sources_config.CATEGORIES)}")
    if order not in ("published_at", "fetched_at"):
        raise HTTPException(422, "order must be 'published_at' or 'fetched_at'")
    return item_store.read_items(
        conn, category=category.upper() if category else None, region=region, source=source, q=q,
        order=order, limit=max(1, min(limit, 1000)), offset=max(0, offset))


@router.get("/connectors/config", response_model=ConnectorConfigFile, dependencies=[Depends(require_token)])
def read_config() -> ConnectorConfigFile:
    """The sources.yaml currently in effect (e.g. on a mounted volume).

    Token-protected: the file contains no secrets itself, but it names the environment variables that hold them.
    """
    path = sources_config.ensure_file()
    if not path.is_file():
        raise HTTPException(404, f"{path} does not exist")
    raw = path.read_bytes()
    return ConnectorConfigFile(file=str(path), sha256=hashlib.sha256(raw).hexdigest(),
                               content=raw.decode("utf-8", errors="replace"))


@router.put("/connectors/config", response_model=ConnectorConfigUpdate, dependencies=[Depends(require_token)])
async def replace_config(request: Request) -> ConnectorConfigUpdate:
    """Replace sources.yaml and apply it in one step - the volume workflow without shell access.

    Validates first: a file with a broken block is rejected (`422`) and the old file stays in place.
    `persistent` says whether the target sits on a mounted volume (survives a redeploy).
    """
    raw = await request.body()
    if not raw.strip():
        raise HTTPException(422, ["empty body: send the YAML file as the request body"])
    if len(raw) > MAX_CONFIG_BYTES:
        raise HTTPException(413, f"config larger than {MAX_CONFIG_BYTES} bytes")

    path = sources_config.ensure_file()
    loaded = sources_config.parse(raw, path)
    if not loaded.usable or loaded.errors:
        raise HTTPException(422, loaded.errors or ["sources.yaml could not be parsed"])

    try:
        sources_config.write_file(path, raw)
    except OSError as exc:
        raise HTTPException(409, f"cannot write {path}: {exc}. Point SOURCES_FILE at a writable volume.") from exc

    with db.connect() as conn:
        result = connectors.apply_config(conn, loaded)
    persistent = bool(path.parent.exists()) and os.path.ismount(path.parent)
    return ConnectorConfigUpdate(file=str(path), sha256=loaded.sha256, added=result.added,
                                 updated=result.updated, disabled=result.disabled,
                                 sourceCount=result.source_count, errors=result.errors,
                                 persistent=persistent)
