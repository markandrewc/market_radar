"""Applies sources.yaml to the database.

`connector_sources` is the persisted form of the YAML (one row per source, with a
config hash), `connector_state` remembers which file version was applied. The YAML
stays the source of truth: reload overwrites the rows, and sources removed from the
file are disabled instead of deleted - their market_items are history.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

from psycopg.types.json import Jsonb

from ..connectors import adapter_for
from ..connectors.base import apply_filters
from ..connectors.config import Defaults, LoadedConfig, SourceConfig
from ..db import Conn
from ..schemas import SyncResult, SyncSummary
from . import items as item_store

_COLUMNS = """id, name, description, source_url, categories, adapter_type, endpoint, endpoints,
              refresh_rate, refresh_seconds, enabled, auth_env, params, headers, filter_keywords,
              filter_regions, region, tags, field_map, items_path, pages, max_items, timeout,
              delimiter, licence, licence_url, config_hash, in_config, applied_at"""

_UPDATE = """name = EXCLUDED.name, description = EXCLUDED.description, source_url = EXCLUDED.source_url,
             categories = EXCLUDED.categories, adapter_type = EXCLUDED.adapter_type,
             endpoint = EXCLUDED.endpoint, endpoints = EXCLUDED.endpoints,
             refresh_rate = EXCLUDED.refresh_rate, refresh_seconds = EXCLUDED.refresh_seconds,
             enabled = EXCLUDED.enabled, auth_env = EXCLUDED.auth_env, params = EXCLUDED.params,
             headers = EXCLUDED.headers, filter_keywords = EXCLUDED.filter_keywords,
             filter_regions = EXCLUDED.filter_regions, region = EXCLUDED.region, tags = EXCLUDED.tags,
             field_map = EXCLUDED.field_map, items_path = EXCLUDED.items_path, pages = EXCLUDED.pages,
             max_items = EXCLUDED.max_items, timeout = EXCLUDED.timeout, delimiter = EXCLUDED.delimiter,
             licence = EXCLUDED.licence, licence_url = EXCLUDED.licence_url,
             config_hash = EXCLUDED.config_hash, in_config = true, applied_at = now()"""


@dataclass
class ApplyResult:
    added: int = 0
    updated: int = 0
    disabled: int = 0
    source_count: int = 0
    config_sha256: str = ""
    errors: list[str] = field(default_factory=list)


def _values(source) -> tuple:
    return (
        source.id, source.name, source.description, source.source_url, source.category,
        source.adapter_type, source.endpoint, source.endpoints or [],
        source.refresh_rate, source.refresh_seconds, source.enabled,
        source.auth_env, Jsonb(source.params), Jsonb(source.headers), source.filter_keywords,
        source.filter_regions, source.region, source.tags, Jsonb(source.field_map),
        source.items_path, source.pages, source.max_items, source.timeout,
        source.delimiter, source.licence, source.licence_url, source.hash,
    )


def apply_config(conn: Conn, loaded: LoadedConfig) -> ApplyResult:
    """Upsert every valid source and remember the applied file version.

    A file that cannot be read at all (missing, broken YAML) changes nothing: the
    previous sources stay active so a typo on a volume cannot wipe the configuration.
    """
    result = ApplyResult(errors=list(loaded.errors), config_sha256=loaded.sha256,
                         source_count=len(loaded.sources))
    if not loaded.usable:
        return result

    known = {row["id"] for row in conn.execute("SELECT id FROM connector_sources")}
    with conn.transaction():
        for source in loaded.sources:
            conn.execute(
                f"""INSERT INTO connector_sources ({_COLUMNS})
                    VALUES ({", ".join(["%s"] * 27)}, true, now())
                    ON CONFLICT (id) DO UPDATE SET {_UPDATE}""", _values(source))
            if source.id in known:
                result.updated += 1
            else:
                result.added += 1
        result.disabled = conn.execute(
            """UPDATE connector_sources SET in_config = false, enabled = false
               WHERE NOT (id = ANY(%s)) AND in_config""", ([s.id for s in loaded.sources],)).rowcount
        conn.execute(
            """INSERT INTO connector_state (id, config_file, config_sha256, source_count, errors, applied_at)
               VALUES (true, %s, %s, %s, %s, now())
               ON CONFLICT (id) DO UPDATE SET config_file = EXCLUDED.config_file,
                   config_sha256 = EXCLUDED.config_sha256, source_count = EXCLUDED.source_count,
                   errors = EXCLUDED.errors, applied_at = now()""",
            (str(loaded.path) if loaded.path else None, loaded.sha256, len(loaded.sources),
             Jsonb(result.errors)))
    return result


def read_state(conn: Conn) -> dict | None:
    row = conn.execute("SELECT * FROM connector_state WHERE id").fetchone()
    return dict(row) if row else None


def _last_sync(conn: Conn, source_id: str) -> datetime | None:
    row = conn.execute("SELECT last_sync_at FROM connector_sources WHERE id = %s", (source_id,)).fetchone()
    return row["last_sync_at"] if row else None


def is_due(source: SourceConfig, last_sync_at: datetime | None, now: datetime) -> bool:
    """refresh_rate decides; 'static' sources only run on an explicit sync."""
    seconds = source.refresh_seconds
    if seconds is None:
        return False
    return last_sync_at is None or (now - last_sync_at).total_seconds() >= seconds


def sync_source(conn: Conn, source: SourceConfig, defaults: Defaults, *, now: datetime | None = None) -> SyncResult:
    """Fetch one source, normalise it and replace its stored items. Never raises for source errors."""
    moment = now or datetime.now(timezone.utc)
    missing = [name for name in source.auth_env if not os.environ.get(name)]
    if missing:
        return SyncResult(source=source.id, adapter=source.adapter_type, skipped=True,
                          reason=f"missing env: {', '.join(missing)}")
    try:
        adapter = adapter_for(source.adapter_type)
        raw = adapter(source, defaults=defaults, fetched_at=moment)
    except Exception as exc:  # network, parsing, unknown adapter: keep the previous items
        message = f"{type(exc).__name__}: {exc}"[:2000]
        conn.execute("UPDATE connector_sources SET last_sync_at = now(), last_error = %s WHERE id = %s",
                     (message, source.id))
        return SyncResult(source=source.id, adapter=source.adapter_type, error=message)

    items = apply_filters(raw, source, defaults)[:source.max_items]
    with conn.transaction():
        stored = item_store.upsert_items(conn, source.id, items)
        if items:  # an empty payload keeps the existing records
            item_store.delete_missing(conn, source.id, [item.id for item in items])
        conn.execute("UPDATE connector_sources SET last_sync_at = now(), last_error = NULL WHERE id = %s",
                     (source.id,))
    return SyncResult(source=source.id, adapter=source.adapter_type, items=stored, replaced=bool(items),
                      reason=None if items else "empty payload, existing items kept")


def sync_all(conn: Conn, loaded: LoadedConfig, *, only: str | None = None, due_only: bool = False,
             now: datetime | None = None) -> SyncSummary:
    moment = now or datetime.now(timezone.utc)
    results: list[SyncResult] = []
    for source in loaded.sources:
        if only and source.id != only:
            continue
        if not source.enabled:
            results.append(SyncResult(source=source.id, adapter=source.adapter_type, skipped=True, reason="disabled"))
            continue
        if due_only and not is_due(source, _last_sync(conn, source.id), moment):
            results.append(SyncResult(source=source.id, adapter=source.adapter_type, skipped=True, reason="not due"))
            continue
        results.append(sync_source(conn, source, loaded.defaults, now=moment))
    return SyncSummary(results=results, items=sum(result.items for result in results),
                       errors=sum(1 for result in results if result.error))
