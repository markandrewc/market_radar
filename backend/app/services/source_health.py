"""Health state of the pipeline sources, shared by `GET /api/sources` and `GET /api/overview`.

The rules live here once, so the Sources page and the home-page pulse cannot disagree:

- ``error``: the latest raw file of the source could not be read (the previous numbers stay);
- ``stale``: the latest download failed, or no new download happened for `SOURCE_STALE_DAYS`;
- ``ok``: everything else.
"""
from datetime import datetime, timedelta, timezone

from .. import config
from ..db import Conn, iso
from ..schemas import SourceStatus


def statuses(conn: Conn, now: datetime | None = None) -> list[SourceStatus]:
    """One `SourceStatus` per stored source, sorted by name (the answer of `GET /api/sources`)."""
    rows = conn.execute(
        """SELECT s.*, f.status AS file_status, f.error AS file_error, f.fetch_error
           FROM sources s
           LEFT JOIN LATERAL (SELECT status, error, fetch_error FROM raw_files
                              WHERE source_id = s.id ORDER BY processed_at DESC LIMIT 1) f ON true
           ORDER BY s.name""").fetchall()
    moment = now or datetime.now(timezone.utc)
    stale_before = moment - timedelta(days=config.SOURCE_STALE_DAYS)
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
                                datasetUrl=r["dataset_url"],
                                datasetModified=r["dataset_modified"].isoformat() if r["dataset_modified"] else None,
                                licence=r["licence"], licenceUrl=r["licence_url"], status=status, problem=problem))
    return out


def counts(conn: Conn, now: datetime | None = None) -> dict[str, int]:
    """`{"ok": n, "stale": n, "error": n}` for the overview pulse."""
    out = {"ok": 0, "stale": 0, "error": 0}
    for status in statuses(conn, now):
        out[status.status] += 1
    return out
