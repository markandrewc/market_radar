"""Write access for the ingestion team. One request = one source, applied in a single transaction."""
import secrets
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException

from .. import config
from ..db import get_conn
from ..models import IngestRequest, IngestResult

router = APIRouter()


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not config.INGEST_TOKEN:
        raise HTTPException(503, "Ingestion is disabled: set INGEST_TOKEN on the server.")
    expected = f"Bearer {config.INGEST_TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(401, "Missing or wrong token.")


@router.post("/ingest", response_model=IngestResult, dependencies=[Depends(require_token)])
def ingest(req: IngestRequest, conn: sqlite3.Connection = Depends(get_conn)) -> IngestResult:
    known = {r["id"] for r in conn.execute("SELECT id FROM roles")} | {r.id for r in req.roles}
    errors = []
    for i, o in enumerate(req.observations):
        if o.roleId not in known:
            errors.append(f"observations[{i}]: unknown roleId '{o.roleId}' (add it to 'roles')")
        if o.metric == "skill" and (not o.skill or o.base is None):
            errors.append(f"observations[{i}]: metric 'skill' needs 'skill' and 'base'")
        if o.metric == "demand" and o.skill:
            errors.append(f"observations[{i}]: metric 'demand' must not have 'skill'")
    if errors:
        raise HTTPException(422, errors[:50])

    s = req.source
    with conn:  # one transaction: all or nothing
        conn.execute(
            """INSERT INTO sources (id, name, url, fetched_at) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, fetched_at=excluded.fetched_at""",
            (s.id, s.name, s.url, s.fetchedAt))
        conn.executemany("INSERT INTO roles (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
                         [(r.id, r.name) for r in req.roles])
        if req.replace:
            conn.execute("DELETE FROM observations WHERE source_id = ?", (s.id,))
        conn.executemany(
            """INSERT INTO observations (source_id, metric, role_id, skill, period, value, base)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(source_id, metric, role_id, skill, period)
               DO UPDATE SET value=excluded.value, base=excluded.base""",
            [(s.id, o.metric, o.roleId, o.skill, o.period, o.value, o.base) for o in req.observations])
    return IngestResult(source=s.id, roles=len(req.roles), observations=len(req.observations))


@router.delete("/sources/{source_id}", status_code=204, dependencies=[Depends(require_token)])
def delete_source(source_id: str, conn: sqlite3.Connection = Depends(get_conn)) -> None:
    with conn:
        if not conn.execute("DELETE FROM sources WHERE id = ?", (source_id,)).rowcount:
            raise HTTPException(404, f"Unknown source: {source_id}")
