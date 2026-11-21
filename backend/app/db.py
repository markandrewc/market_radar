"""Postgres access via psycopg 3. One connection per request, autocommit; writes use explicit transactions."""
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from . import config

SCHEMA = Path(__file__).with_name("schema.sql")
Conn = psycopg.Connection


def connect() -> Conn:
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set (see backend/README.md).")
    return psycopg.connect(config.DATABASE_URL, autocommit=True, row_factory=dict_row, options="-c timezone=UTC")


def init(conn: Conn) -> None:
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(42)")  # several workers starting at once
        conn.execute(SCHEMA.read_text())


def get_conn() -> Iterator[Conn]:
    """FastAPI dependency."""
    with connect() as conn:
        yield conn


def iso(ts: datetime) -> str:
    """Timestamps go out as ISO 8601 in UTC, e.g. 2026-11-21T08:00:00Z."""
    return ts.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
