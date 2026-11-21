"""Storage for the normalised MarketItem records (docs/market-item.schema.json)."""
from typing import Any

from psycopg.types.json import Jsonb

from ..db import Conn
from ..schemas import MarketItem

_COLUMNS = ("source_id, id, category, categories, title, summary, metrics, payload, tags, region, "
            "source_name, source_url, url, published_at, fetched_at")
_PLACEHOLDERS = ", ".join(["%s"] * 15)
_UPDATE = """category = EXCLUDED.category, categories = EXCLUDED.categories, title = EXCLUDED.title,
            summary = EXCLUDED.summary, metrics = EXCLUDED.metrics, payload = EXCLUDED.payload,
            tags = EXCLUDED.tags, region = EXCLUDED.region, source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url, url = EXCLUDED.url, published_at = EXCLUDED.published_at,
            fetched_at = EXCLUDED.fetched_at"""

SELECTION = """id, category, categories, title, summary, metrics, tags, region, source_name,
               source_url, url, published_at, fetched_at"""


def upsert_items(conn: Conn, source_id: str, items: list[MarketItem]) -> int:
    """Insert or update by (source_id, id). Call inside a transaction."""
    if not items:
        return 0
    rows = [
        (source_id, item.id, item.category, item.categories, item.title, item.summary,
         Jsonb(item.metrics), Jsonb(item.payload) if item.payload is not None else None,
         item.tags, item.region, item.source_name, item.source_url, item.url,
         item.published_at, item.fetched_at)
        for item in items
    ]
    with conn.cursor() as cur:
        cur.executemany(
            f"""INSERT INTO market_items ({_COLUMNS}) VALUES ({_PLACEHOLDERS})
                ON CONFLICT (source_id, id) DO UPDATE SET {_UPDATE}""", rows)
    return len(rows)


def delete_missing(conn: Conn, source_id: str, keep_ids: list[str]) -> int:
    """Drop records that disappeared from the source. Call inside a transaction."""
    return conn.execute("DELETE FROM market_items WHERE source_id = %s AND NOT (id = ANY(%s))",
                        (source_id, keep_ids)).rowcount


def read_items(conn: Conn, *, category: str | None = None, region: str | None = None,
               source: str | None = None, q: str | None = None, order: str = "published_at",
               limit: int = 100, offset: int = 0) -> list[MarketItem]:
    where: list[str] = []
    params: list[Any] = []
    if category:
        where.append("%s = ANY(categories)")
        params.append(category)
    if region:
        where.append("region = %s")
        params.append(region.upper())
    if source:
        where.append("source_id = %s")
        params.append(source)
    if q:
        where.append("(title ILIKE %s OR summary ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    sort = "published_at DESC NULLS LAST, fetched_at DESC" if order == "published_at" else "fetched_at DESC"
    rows = conn.execute(
        f"SELECT {SELECTION} FROM market_items {clause} ORDER BY {sort}, id LIMIT %s OFFSET %s",
        (*params, limit, offset)).fetchall()
    return [MarketItem(**{**dict(row), "metrics": dict(row["metrics"] or {}), "categories": list(row["categories"]),
                          "tags": list(row["tags"] or [])}) for row in rows]


def count_items(conn: Conn, source_id: str) -> int:
    row = conn.execute("SELECT count(*) AS n FROM market_items WHERE source_id = %s", (source_id,)).fetchone()
    return int(row["n"])
