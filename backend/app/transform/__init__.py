"""Step 2: raw documents -> observations, one source at a time."""
from ..db import Conn
from ..schemas import TransformResult
from ..services import observations
from .base import Doc
from .parsers import PARSERS


def run_source(conn: Conn, source_id: str) -> TransformResult:
    parser = PARSERS.get(source_id)
    if parser is None:
        return TransformResult(source=source_id, parser=None, errors=["No parser registered for this source yet."])
    name = f"{parser.__module__}.{parser.__name__}"
    with conn.transaction():
        # One transform per source at a time; a run started later waits and then sees all documents.
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (source_id,))
        docs = [Doc(**r) for r in conn.execute(
            "SELECT id, url, fetched_at, content_type, content FROM raw_documents WHERE source_id = %s ORDER BY id",
            (source_id,))]
        if not docs:
            return TransformResult(source=source_id, parser=name)
        ids = [d.id for d in docs]
        try:
            out = parser(docs)
            observations.check(conn, out.roles, out.observations)
        except Exception as e:  # parser bug or invalid output: keep the old numbers, flag the documents
            msg = f"{type(e).__name__}: {e}"[:2000]
            conn.execute("UPDATE raw_documents SET status = 'error', error = %s, parsed_at = now() WHERE id = ANY(%s)",
                         (msg, ids))
            return TransformResult(source=source_id, parser=name, documents=len(docs), errors=[msg])
        observations.write(conn, source_id, out.roles, out.observations, replace=True)
        failed = {k: v for k, v in out.failed.items() if k in ids}
        conn.execute("UPDATE raw_documents SET status = 'parsed', error = NULL, parsed_at = now() WHERE id = ANY(%s)",
                     ([i for i in ids if i not in failed],))
        with conn.cursor() as cur:
            cur.executemany("UPDATE raw_documents SET status = 'error', error = %s, parsed_at = now() WHERE id = %s",
                            [(v[:2000], k) for k, v in failed.items()])
    return TransformResult(source=source_id, parser=name, documents=len(docs), observations=len(out.observations),
                           errors=[f"document {k}: {v}" for k, v in failed.items()])


def run_all(conn: Conn) -> list[TransformResult]:
    return [run_source(conn, r["id"]) for r in conn.execute("SELECT id FROM sources ORDER BY id")
            if r["id"] in PARSERS]
