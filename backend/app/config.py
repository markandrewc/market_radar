"""Settings from environment variables (see .env.example in the repo root)."""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# Postgres connection, e.g. postgresql://user:pass@localhost:5432/market_radar (Railway sets DATABASE_URL).
DATABASE_URL = os.environ.get("DATABASE_URL") or None
# Step 1 writes downloaded originals and latest.json here; step 2 reads them (same variable as scripts/*.mjs).
RAW_DIR = Path(os.environ.get("MARKET_RADAR_RAW_DIR") or REPO / ".market-radar" / "raw")
# Built frontend (npm run build writes to <repo>/dist). Served by FastAPI if it exists.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", REPO / "dist"))
# A source counts as out of date when we have not retrieved new data for this many days.
SOURCE_STALE_DAYS = int(os.environ.get("SOURCE_STALE_DAYS", "7"))
# Shared secret for write endpoints (DELETE /api/sources/{id}). Not set -> writing is disabled.
INGEST_TOKEN = os.environ.get("INGEST_TOKEN") or None
