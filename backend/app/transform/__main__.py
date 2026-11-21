"""Re-run parsers, e.g. after changing one:  uv run python -m app.transform [source-id ...]"""
import sys

from .. import db
from . import run_all, run_source

with db.connect() as conn:
    db.init(conn)
    results = [run_source(conn, s) for s in sys.argv[1:]] if sys.argv[1:] else run_all(conn)
for r in results:
    print(f"{r.source}: {r.documents} documents -> {r.observations} observations"
          + (f"  ERRORS: {'; '.join(r.errors)}" if r.errors else ""))
if not results:
    print("No source with a registered parser.")
