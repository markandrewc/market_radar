"""Local Postgres without Docker or an install (dev only): uv run python dev_db.py

Starts Postgres with its data in ~/.market-radar-pg (override with DEV_PGDATA; the path must not contain spaces)
and prints the DATABASE_URL. Stops with Ctrl+C.
"""
import os
import signal
from pathlib import Path

import pgserver

data = Path(os.environ.get("DEV_PGDATA", Path.home() / ".market-radar-pg"))
if " " in str(data):
    raise SystemExit(f"Postgres cannot use a data folder with spaces: {data}. Set DEV_PGDATA.")
data.mkdir(parents=True, exist_ok=True)
srv = pgserver.get_server(data, cleanup_mode="stop")
print(f"DATABASE_URL='{srv.get_uri()}'\nRunning. Ctrl+C to stop.", flush=True)
try:
    signal.pause()
except KeyboardInterrupt:
    pass
finally:
    srv.cleanup()
