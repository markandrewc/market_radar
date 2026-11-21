# Deployment auf Railway

Die App läuft dort als **ein** Service: FastAPI bedient die API (`/api/...`) **und**
liefert das gebaute React-Bundle aus (`dist/`). Die Daten liegen in einer
Railway-PostgreSQL-Datenbank. Gleicher Origin für Frontend und API heißt: kein CORS,
keine zweite Rechnung.

```
Railway-Projekt
├── market_radar (Web/API)  ← Dockerfile, uvicorn auf $PORT
│     ├── /api/...  FastAPI (Postgres via DATABASE_URL)
│     └── /         gebautes React-Bundle (SPA-Fallback auf index.html)
└── Postgres                ← DATABASE_URL
```

## Was im Repo dafür liegt

| Datei | Zweck |
| --- | --- |
| [`Dockerfile`](Dockerfile) | Stage 1 `node:24-alpine` baut das Frontend, Stage 2 `python:3.12-slim` + `uv` startet uvicorn |
| [`docker-compose.yml`](docker-compose.yml) | Lokale Umgebung wie auf Railway: App + PostgreSQL |
| [`backend/app/db.py`](backend/app/db.py) | psycopg-3-Verbindung, Schema-Anlage beim Start |
| [`backend/app/schema.sql`](backend/app/schema.sql) | Tabellen (idempotent, wird bei jedem Start angewendet) |
| [`.env.example`](.env.example) | Alle Variablen dokumentiert |
| [`.dockerignore`](.dockerignore) | hält `node_modules`, `dist`, `.venv`, Tests aus dem Image |

Ein `railway.json` gibt es bewusst nicht: Config as Code ist abgekündigt
(bestehende Dateien werden nur noch bis **1. Dez. 2026** gelesen, neue Services
können es nicht mehr aktivieren). Das `Dockerfile` wird automatisch erkannt,
Healthcheck-Pfad und Region sind zwei Klicks im Dashboard.

## Einrichten

1. **Postgres anlegen**: Im Projekt **+ New → Database → Add PostgreSQL**.
2. **Service deployen**: **+ New → GitHub Repo** → `markandrewc/market_radar`,
   Branch `main`. Im Build-Log erscheint `Using detected Dockerfile!`.
3. **Datenbank verbinden**: Beim Service **Variables → New Variable → Add
   Reference** → `Postgres` → `DATABASE_URL` (erscheint als
   `${{Postgres.DATABASE_URL}}`). Ohne diese Variable startet der Container
   nicht – er bricht mit `RuntimeError: DATABASE_URL is not set` ab.
4. **Healthcheck**: **Settings → Deploy → Healthcheck Path** = `/api/health`
   (Timeout 100 s genügt; der Endpoint prüft auch die DB-Verbindung).
5. **Ingest-Token**: Variable `INGEST_TOKEN` auf ein langes Zufallswort setzen
   (`openssl rand -hex 32`). Ohne Token antworten alle Schreib-Endpunkte
   (`/api/raw`, `/api/ingest`, `/api/transform`, `DELETE /api/sources/{id}`) mit `503`.
6. **Domain**: **Settings → Networking → Generate Domain** für `*.up.railway.app`
   oder **Custom Domain** mit CNAME.
7. **Region**: eine EU-Region wählen (z. B. `europe-west4`) für kurze Latenz in
   der Schweiz.

Der Port braucht keine Konfiguration: uvicorn bindet auf `$PORT` (Default 8080).

## Variablen

| Variable | Wann | Wirkung |
| --- | --- | --- |
| `DATABASE_URL` | von Postgres, per Referenz | Pflicht; ohne sie startet der Service nicht |
| `PORT` | von Railway gesetzt | Port von uvicorn |
| `INGEST_TOKEN` | selbst setzen | schaltet die Schreib-Endpunkte frei |
| `VITE_USE_MOCKS` | Build-Zeit, Default `1` | `1` = Frontend zeigt Mock-Daten (Demo), `0` = Frontend liest `/api` |

**`VITE_*` wirkt nur beim Build.** Vite ersetzt die Variable beim Bauen durch einen
festen Wert; nach jeder Änderung ist ein Redeploy nötig. Das Dockerfile deklariert
`ARG VITE_USE_MOCKS`, damit Railway den Wert als Build-Arg durchreicht.

## Datenbank

Das Schema wird bei jedem Start angewendet (`CREATE TABLE IF NOT EXISTS`, geschützt
durch einen Advisory Lock für parallel startende Worker) – es gibt keinen
Migrationsschritt und keine manuell vorzubereitende Datenbank. Neue Spalten in
Zukunft brauchen ein Migrationswerkzeug (z. B. Alembic), das Schema ist bisher
bewusst klein.

Tabellen: `sources`, `raw_documents` (JSONB-Rohdaten), `roles`, `observations`.

### Datenfluss – wichtig für den ersten Deploy

```
POST /api/raw  →  raw_documents (roh, dedupliziert per sha256)
                        ↓ automatisch nach dem Upload
                 Parser für die Quelle (backend/app/transform/parsers/)
                        ↓ ersetzt die Zahlen der Quelle
                  observations  →  GET /api/demand, /api/skills  →  Frontend
```

**Es ist noch kein Parser registriert** (`PARSERS = {}`). Hochgeladene Rohdaten
bleiben deshalb mit Status `pending` liegen und das Dashboard bleibt leer – das
ist der aktuelle Stand des Codes, kein Deployment-Fehler. Bis der erste Parser da
ist, lassen sich fertige Zahlen direkt über `POST /api/ingest` einspielen:

```sh
curl -X POST https://<deine-domain>/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "source": {"id": "itboard", "name": "IT-Board", "url": "https://example.org/itboard", "fetchedAt": "2026-11-21T08:00:00Z"},
    "roles": [{"id": "web-developer", "name": "Web Developer"}],
    "observations": [
      {"metric": "demand", "roleId": "web-developer", "period": "2026-10", "value": 120},
      {"metric": "demand", "roleId": "web-developer", "period": "2026-11", "value": 132},
      {"metric": "skill", "roleId": "web-developer", "skill": "React", "period": "2026-11", "value": 54, "base": 132}
    ]
  }'
```

Prüfen: `curl https://<deine-domain>/api/demand`. Ob Rohdaten angekommen sind:
`curl https://<deine-domain>/api/raw/status -H "Authorization: Bearer $INGEST_TOKEN"`.

Sinnvolle Reihenfolge für den ersten Deploy: erst deployen (Demo-Modus), dann
`VITE_USE_MOCKS=0` setzen und redeployen, sobald Zahlen in der DB liegen.

## Lokal testen

```bash
# A) wie auf Railway: App + PostgreSQL in Docker
docker compose up --build               # http://localhost:8080

# B) ohne Docker: eingebettetes Postgres für die Entwicklung
cd backend
uv sync
uv run python dev_db.py                 # gibt DATABASE_URL aus, läuft weiter
# zweites Terminal:
cd backend
export DATABASE_URL='<ausgegebene URL>'
INGEST_TOKEN=change-me uv run uvicorn app.main:app --reload --port 8787
# Frontend dazu (Repo-Root, drittes Terminal):
VITE_USE_MOCKS=0 npm run dev:web        # http://localhost:5173, /api/ -> :8787

# C) Tests (starten ein eigenes Wegwerf-Postgres, oder TEST_DATABASE_URL setzen)
cd backend && uv run pytest
# pgserver (Embedded-Postgres) hat nur Wheels bis Python 3.12:
#   uv sync --python 3.12 && uv run pytest --python 3.12
# Alternativ gegen ein vorhandenes Postgres:
#   TEST_DATABASE_URL=postgresql:///market_radar_test uv run pytest
```

## Troubleshooting

| Symptom | Ursache / Lösung |
| --- | --- |
| `RuntimeError: DATABASE_URL is not set` im Deploy-Log | Reference `${{Postgres.DATABASE_URL}}` beim Service fehlt |
| `503 Writing is disabled` | `INGEST_TOKEN` im Service setzen und redeployen |
| Dashboard leer, `raw/status` zeigt `pending` | Für die Quelle ist noch kein Parser registriert (siehe Kommentar in `backend/app/transform/parsers/__init__.py`); bis dahin `/api/ingest` nutzen |
| Seite zeigt „Demo data“, obwohl Daten in der DB liegen | `VITE_USE_MOCKS=0` setzen **und** redeployen (Build-Zeit-Variable) |
| Healthcheck schlägt fehl | Pfad `/api/health` eingetragen? Der Endpoint prüft die DB mit |
| `404` beim Neuladen von `/reports` | SPA-Fallback fehlt; FastAPI liefert ihn aus `dist/` – existiert `/app/dist` im Image? |
| `ModuleNotFoundError: psycopg` | Image ohne `uv sync` gebaut (siehe `Dockerfile`) |
| Alte Assets nach Deploy | Browser-Cache; einmal hart neu laden (Dateinamen sind gehasht) |
| Deploy-Log: `pgserver` fehlt | `pgserver` ist nur eine Dev-Abhängigkeit (`--no-dev` im Image) – erwartet |
| `uv sync`: `pgserver` „can't be installed … cp312" | pgserver hat nur Wheels bis Python 3.12 → `uv sync --python 3.12` |

## Wenn Frontend und API getrennt laufen sollen

Für mehr Unabhängigkeit lässt sich das Frontend als eigener statischer Service
(nginx) betreiben und `/api/` per Proxy an den FastAPI-Service weiterleiten
(Railway Private Networking, z. B. `market-radar-api.railway.internal:8080`).
Das frühere nginx-Setup wurde entfernt, weil ein Service hier einfacher ist;
bei Bedarf ist es schnell wiederhergestellt.
