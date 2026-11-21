"""Step 2: raw folder -> database.

Reads latest.json (written by step 1, scripts/stage-raw-sources.mjs), and for every source with a downloaded file
and a registered parser: checks the file's checksum, parses it, and merges the numbers into the history
(months in the new file are replaced, older months stay). A failing
parser keeps the previous numbers; the error is recorded and shown on the Sources page.
"""
import hashlib
import json
from datetime import date, datetime
from pathlib import Path

from .. import config
from ..db import Conn
from ..schemas import NormalizeResult
from ..services import observations
from .base import RawFile
from .parsers import PARSERS

MANIFEST = "latest.json"


class ManifestError(RuntimeError):
    pass


def load_manifest(raw_dir: Path) -> list[dict]:
    path = raw_dir / MANIFEST
    if not path.is_file():
        raise ManifestError(f"{path} not found. Run step 1 first: npm run ingest")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1 or not isinstance(data.get("sources"), list):
        raise ManifestError(f"{path}: unknown format (expected schema_version 1)")
    return data["sources"]


def _date(value) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _record(conn: Conn, f: RawFile, status: str, parser: str | None, count: int, error: str | None) -> None:
    conn.execute(
        """INSERT INTO raw_files (source_id, sha256, relative_path, fetched_at, fetch_error, status, parser,
                                  observations, error, processed_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
           ON CONFLICT (source_id, sha256) DO UPDATE SET relative_path = EXCLUDED.relative_path,
               fetched_at = EXCLUDED.fetched_at, fetch_error = EXCLUDED.fetch_error, status = EXCLUDED.status,
               parser = EXCLUDED.parser, observations = EXCLUDED.observations, error = EXCLUDED.error,
               processed_at = now()""",
        (f.source_id, f.sha256, f.meta.get("relative_path"), f.fetched_at, f.meta.get("error"), status, parser,
         count, error))


def run_entry(conn: Conn, raw_dir: Path, entry: dict) -> NormalizeResult:
    sid = entry.get("id")
    if not sid or not entry.get("relative_path") or not entry.get("sha256"):
        return NormalizeResult(source=sid or "?", status="not_downloaded",
                               error=entry.get("error") or "No file in the raw folder.")
    path = (raw_dir / entry["relative_path"]).resolve()
    f = RawFile(source_id=sid, path=path, sha256=entry["sha256"],
                fetched_at=datetime.fromisoformat(entry["fetched_at"]) if entry.get("fetched_at") else None,
                content_type=entry.get("content_type"), meta=entry)
    parser = PARSERS.get(sid)
    name = f"{parser.__module__.rsplit('.', 1)[-1]}.{parser.__name__}" if parser else None

    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (sid,))  # one run per source at a time
        if parser is None:
            _record(conn, f, "no_parser", None, 0, None)
            return NormalizeResult(source=sid, status="no_parser")
        if f.fetched_at is None:
            raise ManifestError(f"{sid}: fetched_at missing in {MANIFEST}")
        observations.upsert_source(
            conn, sid, entry.get("name") or entry.get("publisher") or sid,
            entry.get("report_url") or entry.get("source_url") or "", f.fetched_at,
            _date(entry.get("report_date")), entry.get("licence"), entry.get("licence_url"))
        try:
            if not path.is_relative_to(raw_dir.resolve()) or not path.is_file():
                raise FileNotFoundError(f"{entry['relative_path']} is missing in the raw folder")
            if hashlib.sha256(path.read_bytes()).hexdigest() != f.sha256:
                raise ValueError(f"{entry['relative_path']}: checksum does not match {MANIFEST}")
            out = parser(f)
            observations.check(conn, out.roles, out.observations)
        except Exception as e:  # keep the previous numbers, record why
            msg = f"{type(e).__name__}: {e}"[:2000]
            _record(conn, f, "error", name, 0, msg)
            return NormalizeResult(source=sid, status="error", parser=name, error=msg)
        observations.merge(conn, sid, out.roles, out.observations)
        conn.execute("UPDATE sources SET comparable_from = %s WHERE id = %s", (out.comparable_from, sid))
        _record(conn, f, "parsed", name, len(out.observations), None)
    return NormalizeResult(source=sid, status="parsed", parser=name, observations=len(out.observations))


def run(conn: Conn, raw_dir: Path | None = None, only: set[str] | None = None) -> list[NormalizeResult]:
    raw_dir = raw_dir or config.RAW_DIR
    return [run_entry(conn, raw_dir, e) for e in load_manifest(raw_dir) if not only or e.get("id") in only]
