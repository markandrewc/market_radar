# Market Radar – Backend

FastAPI + SQLite. The API contract is in [docs/api.md](../docs/api.md).

## Run

```sh
cd backend
uv sync
INGEST_TOKEN=change-me uv run uvicorn app.main:app --reload --port 8787
```

Port 8787 because the Vite dev server proxies `/api/` there. Frontend against the real backend:
`VITE_USE_MOCKS=0 npm run dev:web` in the repo root. Without `VITE_USE_MOCKS=0` the frontend shows mock data.

Interactive API docs: http://localhost:8787/docs · Tests: `uv run pytest`

## Data

SQLite at `backend/data/market-radar.db` (override with `DB_PATH`), schema in `app/schema.sql`.
The database starts empty; the ingestion team fills it via `POST /api/ingest` (see docs/api.md).

## Production

If `dist/` exists (`npm run build`), FastAPI also serves the frontend.
