"""Direct write of already aggregated numbers (no parser needed). One request = one source, one transaction."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_token
from ..db import Conn, get_conn
from ..schemas import IngestRequest, IngestResult
from ..services import observations

router = APIRouter(dependencies=[Depends(require_token)])


@router.post("/ingest", response_model=IngestResult)
def ingest(req: IngestRequest, conn: Conn = Depends(get_conn)) -> IngestResult:
    s = req.source
    try:
        fetched_at = datetime.fromisoformat(s.fetchedAt)
    except ValueError:
        raise HTTPException(422, ["source.fetchedAt: not an ISO 8601 date/time"])
    try:
        observations.check(conn, req.roles, req.observations)
    except observations.InvalidObservations as e:
        raise HTTPException(422, e.errors[:50])
    with conn.transaction():  # all or nothing
        observations.upsert_source(conn, s.id, s.name, s.url, fetched_at)
        observations.write(conn, s.id, req.roles, req.observations, req.replace)
    return IngestResult(source=s.id, roles=len(req.roles), observations=len(req.observations))


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: str, conn: Conn = Depends(get_conn)) -> None:
    """Deletes the source with its raw documents and observations."""
    if not conn.execute("DELETE FROM sources WHERE id = %s", (source_id,)).rowcount:
        raise HTTPException(404, f"Unknown source: {source_id}")
