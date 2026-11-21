# Market Radar – Backend

FastAPI + Postgres. API contract and data flow: [docs/api.md](../docs/api.md).

## Run locally

You need a Postgres database. Without Docker or an install, start one for development:

```sh
cd backend
uv sync
uv run python dev_db.py          # prints DATABASE_URL, keep it running
```

In a second terminal:

```sh
cd backend
export DATABASE_URL='<printed by dev_db.py>'   # or any Postgres, e.g. from Railway
INGEST_TOKEN=change-me uv run uvicorn app.main:app --reload --port 8787
```

Tables are created on start (`app/schema.sql`). Port 8787 because the Vite dev server proxies `/api/` there.
Frontend against the real backend: `VITE_USE_MOCKS=0 npm run dev:web` in the repo root.

Interactive API docs: http://localhost:8787/docs

Tests: `uv run pytest` (starts its own throwaway Postgres; or set `TEST_DATABASE_URL`).

## Data flow

1. **Raw store:** the ingestion team uploads documents to `POST /api/raw`. They land unchanged in `raw_documents`
   (JSONB).
2. **Transform:** a parser per source (`app/transform/parsers/`) turns all documents of that source into
   observations. Runs automatically after each upload; re-run with `uv run python -m app.transform [source-id]`.
3. **Read:** `/api/demand` and `/api/skills` compute the dashboard numbers from `observations`.

No parsers are registered yet; they need real sample documents. How to add one: see
`app/transform/parsers/__init__.py`.

## Production

If `dist/` exists (`npm run build`), FastAPI also serves the frontend. On Railway, add a Postgres service and set
`DATABASE_URL` and `INGEST_TOKEN` on the backend service.
