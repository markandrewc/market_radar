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
# One provider is used per deployment: brevo (HTTP API), smtp (any relay, e.g.
# Brevo's SMTP relay) or resend. MAIL_PROVIDER overrides the automatic choice;
# without any credentials every send is recorded as a dry run, so a demo never
# depends on a provider.
MAIL_PROVIDER = (os.environ.get("MAIL_PROVIDER") or "").strip().lower()
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") or None
BREVO_API_KEY = os.environ.get("BREVO_API_KEY") or None
SMTP_HOST = os.environ.get("SMTP_HOST") or None
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER") or None
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD") or None
SMTP_STARTTLS = (os.environ.get("SMTP_STARTTLS") or "1").strip().lower() not in {"0", "false", "no"}
REPORT_FROM = os.environ.get("REPORT_FROM") or "Market Radar <onboarding@resend.dev>"
REPORT_REPLY_TO = os.environ.get("REPORT_REPLY_TO") or None
# Absolute links in the e-mail (unsubscribe, "open dashboard"). Empty = relative links.
PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
# Safety valve for the public subscribe endpoint.
REPORTS_DAILY_CAP = int(os.environ.get("REPORTS_DAILY_CAP", "100"))
# Week/month boundaries are compared in this time zone, so DST never shifts a send.
REPORT_TIMEZONE = os.environ.get("REPORT_TIMEZONE") or "Europe/Zurich"
# --- LLM explanations (docs/LLM.md) -----------------------------------------
# OpenAI-compatible provider. `LLM_PROVIDER` picks the preset (deepseek, openai,
# custom); `LLM_BASE_URL` / `LLM_MODEL` override it. Without a key, explanations
# are disabled and the app falls back to the deterministic reading.
LLM_PROVIDER = (os.environ.get("LLM_PROVIDER") or "deepseek").strip().lower()
LLM_BASE_URL = (os.environ.get("LLM_BASE_URL") or "").rstrip("/")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or None
LLM_MODEL = os.environ.get("LLM_MODEL") or None
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "20"))
LLM_MAX_OUTPUT_TOKENS = int(os.environ.get("LLM_MAX_OUTPUT_TOKENS", "700"))
# Global daily budget: once reached, explanations answer with the deterministic reading.
LLM_DAILY_TOKEN_CAP = int(os.environ.get("LLM_DAILY_TOKEN_CAP", "200000"))
LLM_RATE_PER_MIN = int(os.environ.get("LLM_RATE_PER_MIN", "6"))
LLM_RATE_PER_DAY = int(os.environ.get("LLM_RATE_PER_DAY", "100"))
# Default explanation language; a request may override it.
LLM_LANGUAGE = (os.environ.get("LLM_LANGUAGE") or "en").strip().lower()
