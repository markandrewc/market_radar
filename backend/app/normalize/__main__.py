"""Step 2 from the command line:  uv run python -m app.normalize [source-id ...]

Reads the raw folder (MARKET_RADAR_RAW_DIR, default <repo>/.market-radar/raw) and writes to DATABASE_URL.
"""
import sys

from .. import config, db
from . import ManifestError, run

try:
    with db.connect() as conn:
        db.init(conn)
        results = run(conn, only=set(sys.argv[1:]) or None)
except ManifestError as e:
    sys.exit(str(e))

print(f"Raw folder: {config.RAW_DIR}")
for r in results:
    if r.status == "parsed":
        parts = []
        if r.observations:
            parts.append(f"{r.observations} values")
        if r.items:
            parts.append(f"{r.items} items")
        detail = ", ".join(parts) or "no data"
    else:
        detail = {"no_parser": "no parser yet, skipped"}.get(r.status, r.error)
    print(f"  {r.source:40} {r.status:15} {detail}")
if any(r.status == "error" for r in results):
    sys.exit(1)
