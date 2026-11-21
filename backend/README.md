# Market Radar – Backend

FastAPI + Postgres. Pipeline and API contract: [docs/api.md](../docs/api.md).

## Run locally

You need a Postgres database. Without Docker or an install, start one for development:

```sh
cd backend
uv sync
uv run python dev_db.py          # prints DATABASE_URL, keep it running
```

In a second terminal, from the repo root:

```sh
export DATABASE_URL='<printed by dev_db.py>'   # or docker compose's DB, or Railway's
npm run pipeline                               # step 1: download originals, step 2: into the database
cd backend && uv run uvicorn app.main:app --reload --port 8787
```

Frontend against this backend: `VITE_USE_MOCKS=0 npm run dev:web` in the repo root.
Interactive API docs: http://localhost:8787/docs · Tests: `uv run pytest` (own throwaway Postgres).

## Pipeline

1. **Ingestion** (`scripts/stage-raw-sources.mjs`, `npm run ingest`): downloads the originals into the raw folder
   (`MARKET_RADAR_RAW_DIR`, default `<repo>/.market-radar/raw`) and writes `latest.json`.
2. **Normalization** (`app/normalize/`, `npm run normalize` or `uv run python -m app.normalize [source-id]`):
   one parser per source turns its latest file into observations and replaces that source's numbers.
   Results per file are kept in the `raw_files` table and drive the status on the Sources page.
3. **UI**: `/api/demand`, `/api/skills`, `/api/sources` read from the database.

Adding a source: download it in step 1, write a parser in `app/normalize/parsers/` (see `__init__.py` there),
add a test with a small real excerpt in `tests/fixtures/`.

## Production

FastAPI also serves the built frontend from `dist/` (see `DEPLOY.md`). The pipeline can run anywhere that reaches
the database: set `DATABASE_URL` to the Railway Postgres and run `npm run pipeline`.
