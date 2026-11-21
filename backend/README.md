# Market Radar – Backend

FastAPI + SQLite. Antworten entsprechen `src/shared/types.ts`.

## Starten

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8787
```

Port 8787, weil der Vite-Proxy `/api/` dorthin weiterleitet (`npm run dev:web` im Repo-Root).
API-Doku: http://localhost:8787/docs

Tests: `uv run pytest`

## Endpunkte

| Methode | Pfad | Antwort |
|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` |
| GET | `/api/roles` | `Role[]` |
| GET | `/api/sources` | `SourceRef[]` |
| GET | `/api/demand?months=12` | `DemandResponse[]` |
| GET | `/api/skills?role=<id>` | `SkillsResponse` (404, wenn keine Daten) |

## Daten

SQLite unter `backend/data/market-radar.db` (anpassbar mit `DB_PATH`). Schema: `app/schema.sql`.
Jede Zahl gehört zu einer Quelle (`sources`), damit Name, Link und Stand immer mitgeliefert werden.
Noch gibt es keinen Import: Die Datenbank startet leer.

## Produktion

Wenn `dist/` existiert (`npm run build`), liefert FastAPI das Frontend gleich mit aus.
