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
# Shared secret for write endpoints (DELETE /api/sources/{id}, POST /api/connectors/*). Not set -> disabled.
INGEST_TOKEN = os.environ.get("INGEST_TOKEN") or None
# Declarative data sources (docs/ADDING_SOURCES.md). Point this at a Railway volume,
# e.g. /data/sources.yaml; the baked copy seeds a fresh volume on first start.
SOURCES_FILE = Path(os.environ.get("SOURCES_FILE") or REPO / "sources.yaml")
SOURCES_DEFAULT_FILE = Path(os.environ.get("SOURCES_DEFAULT_FILE") or REPO / "sources.yaml")

# --- Level 2: e-mailed briefings (docs/REPORTS.md) ---------------------------
# Resend HTTP API. Without a key every send is recorded as a dry run and the
# preview in the app still works, so the demo never depends on the provider.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") or None
REPORT_FROM = os.environ.get("REPORT_FROM") or "Market Radar <onboarding@resend.dev>"
REPORT_REPLY_TO = os.environ.get("REPORT_REPLY_TO") or None
# Absolute links in the e-mail (unsubscribe, "open dashboard"). Empty = relative links.
PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
# Safety valve for the public subscribe endpoint.
REPORTS_DAILY_CAP = int(os.environ.get("REPORTS_DAILY_CAP", "100"))
# Week/month boundaries are compared in this time zone, so DST never shifts a send.
REPORT_TIMEZONE = os.environ.get("REPORT_TIMEZONE") or "Europe/Zurich"
# Optional LLM polish: only the wording of a bullet is rewritten. All three set = active.
LLM_BASE_URL = (os.environ.get("LLM_BASE_URL") or "").rstrip("/")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or None
LLM_MODEL = os.environ.get("LLM_MODEL") or None
