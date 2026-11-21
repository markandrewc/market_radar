"""Sources: link, dates, licence and health per source, so the team can check where every number comes from."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from .. import config
from ..auth import require_token
from ..db import Conn, get_conn, iso
from ..schemas import SourceStatus

router = APIRouter()


@router.get("/sources", response_model=list[SourceStatus])
def sources(conn: Conn = Depends(get_conn)) -> list[SourceStatus]:
    rows = conn.execute(
        """SELECT s.*, f.status AS file_status, f.error AS file_error, f.fetch_error
           FROM sources s
           LEFT JOIN LATERAL (SELECT status, error, fetch_error FROM raw_files
                              WHERE source_id = s.id ORDER BY processed_at DESC LIMIT 1) f ON true
           ORDER BY s.name""").fetchall()
    stale_before = datetime.now(timezone.utc) - timedelta(days=config.SOURCE_STALE_DAYS)
    out = []
    for r in rows:
        if r["file_status"] == "error":
            status, problem = "error", f"The latest file could not be read; showing older numbers. {r['file_error']}"
        elif r["fetch_error"]:
            status, problem = "stale", f"The latest download failed; showing older numbers. {r['fetch_error']}"
        elif r["fetched_at"] < stale_before:
            status, problem = "stale", f"No new download for more than {config.SOURCE_STALE_DAYS} days."
        else:
            status, problem = "ok", None
        out.append(SourceStatus(id=r["id"], name=r["name"], url=r["url"], lastFetchedAt=iso(r["fetched_at"]),
                                dataAsOf=r["data_as_of"].isoformat() if r["data_as_of"] else None,
                                licence=r["licence"], licenceUrl=r["licence_url"], status=status, problem=problem))
    return out


@router.delete("/sources/{source_id}", status_code=204, dependencies=[Depends(require_token)])
def delete_source(source_id: str, conn: Conn = Depends(get_conn)) -> None:
    """Removes a source and its numbers from the database (the raw folder is not touched)."""
    with conn.transaction():
        conn.execute("DELETE FROM raw_files WHERE source_id = %s", (source_id,))
        if not conn.execute("DELETE FROM sources WHERE id = %s", (source_id,)).rowcount:
            raise HTTPException(404, f"Unknown source: {source_id}")
