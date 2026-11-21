"""Settings from environment variables (see .env.example in the repo root)."""
import os
from pathlib import Path

# Postgres connection, e.g. postgresql://user:pass@localhost:5432/market_radar (Railway sets DATABASE_URL).
DATABASE_URL = os.environ.get("DATABASE_URL") or None
# Built frontend (npm run build writes to <repo>/dist). Served by FastAPI if it exists.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).resolve().parents[2] / "dist"))
# Shared secret for the write endpoints (/api/raw, /api/ingest, ...). Not set -> writing is disabled.
INGEST_TOKEN = os.environ.get("INGEST_TOKEN") or None
