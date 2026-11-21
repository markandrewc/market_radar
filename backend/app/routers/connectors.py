"""Connector sources: sources.yaml applied to the database, plus manual reload.

Read endpoints are public; writing (reload, later sync) uses INGEST_TOKEN.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..auth import require_token
from ..db import Conn, get_conn, iso
from ..schemas import ConnectorDefaults, ConnectorList, ConnectorSource, ReloadResult
from ..services import connectors
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
