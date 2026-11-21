"""Raw store: the ingestion team uploads documents; parsers turn them into numbers."""
import hashlib
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from psycopg.types.json import Jsonb

from .. import db, transform
from ..auth import require_token
from ..db import Conn, get_conn, iso
from ..schemas import RawSourceStatus, RawUploadRequest, RawUploadResult, TransformResult
from ..services import observations
from ..transform.parsers import PARSERS

router = APIRouter(dependencies=[Depends(require_token)])
log = logging.getLogger(__name__)


def _transform_in_background(source_id: str) -> None:
    try:
        with db.connect() as conn:
            r = transform.run_source(conn, source_id)
        if r.errors and r.parser:
            log.warning("transform %s: %s", source_id, "; ".join(r.errors))
    except Exception:
        log.exception("transform %s failed", source_id)


@router.post("/raw", response_model=RawUploadResult)
def upload(req: RawUploadRequest, background: BackgroundTasks, conn: Conn = Depends(get_conn)) -> RawUploadResult:
    """Stores documents as they are. The same content for the same source is stored only once."""
    s = req.source
    rows = []
    for d in req.documents:
        canonical = json.dumps(d.content, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        rows.append((s.id, d.url, d.fetchedAt, d.contentType, Jsonb(d.content),
                     hashlib.sha256(canonical.encode()).hexdigest()))
    with conn.transaction():
        observations.upsert_source(conn, s.id, s.name, s.url, max(d.fetchedAt for d in req.documents))
        received = 0
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(
                    """INSERT INTO raw_documents (source_id, url, fetched_at, content_type, content, sha256)
                       VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (source_id, sha256) DO NOTHING""", row)
                received += cur.rowcount
    if received and s.id in PARSERS:
        background.add_task(_transform_in_background, s.id)
    return RawUploadResult(source=s.id, received=received, duplicates=len(rows) - received)


@router.get("/raw/status", response_model=list[RawSourceStatus])
def status(conn: Conn = Depends(get_conn)) -> list[RawSourceStatus]:
    rows = conn.execute(
        """SELECT s.id, s.name,
                  count(*) FILTER (WHERE r.status = 'pending') AS pending,
                  count(*) FILTER (WHERE r.status = 'parsed')  AS parsed,
                  count(*) FILTER (WHERE r.status = 'error')   AS error,
                  max(r.received_at) AS last_received, max(r.parsed_at) AS last_parsed
           FROM sources s JOIN raw_documents r ON r.source_id = s.id
           GROUP BY s.id, s.name ORDER BY s.name""").fetchall()
    return [RawSourceStatus(sourceId=r["id"], name=r["name"], hasParser=r["id"] in PARSERS, pending=r["pending"],
                            parsed=r["parsed"], error=r["error"],
                            lastReceivedAt=iso(r["last_received"]) if r["last_received"] else None,
                            lastParsedAt=iso(r["last_parsed"]) if r["last_parsed"] else None) for r in rows]


@router.post("/transform", response_model=list[TransformResult])
def run_transform(source: str | None = None, conn: Conn = Depends(get_conn)) -> list[TransformResult]:
    """Re-runs the parsers (all sources with a parser, or one). Runs automatically after each upload."""
    if source is not None:
        if not conn.execute("SELECT 1 FROM sources WHERE id = %s", (source,)).fetchone():
            raise HTTPException(404, f"Unknown source: {source}")
        return [transform.run_source(conn, source)]
    return transform.run_all(conn)
