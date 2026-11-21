"""Sources: link, dates, licence and health per source, so the team can check where every number comes from."""
from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_token
from ..db import Conn, get_conn
from ..schemas import SourceStatus
from ..services import source_health

router = APIRouter()


@router.get("/sources", response_model=list[SourceStatus])
def sources(conn: Conn = Depends(get_conn)) -> list[SourceStatus]:
    return source_health.statuses(conn)


@router.delete("/sources/{source_id}", status_code=204, dependencies=[Depends(require_token)])
def delete_source(source_id: str, conn: Conn = Depends(get_conn)) -> None:
    """Removes a source and its numbers from the database (the raw folder is not touched)."""
    with conn.transaction():
        conn.execute("DELETE FROM raw_files WHERE source_id = %s", (source_id,))
        if not conn.execute("DELETE FROM sources WHERE id = %s", (source_id,)).rowcount:
            raise HTTPException(404, f"Unknown source: {source_id}")
