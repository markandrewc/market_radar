"""Applies sources.yaml to the database.

`connector_sources` is the persisted form of the YAML (one row per source, with a
config hash), `connector_state` remembers which file version was applied. The YAML
stays the source of truth: reload overwrites the rows, and sources removed from the
file are disabled instead of deleted - their market_items are history.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from psycopg.types.json import Jsonb

from ..db import Conn
from ..connectors.config import LoadedConfig

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
