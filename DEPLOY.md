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
| [`sources.yaml`](sources.yaml) | Alle Datenquellen als Konfiguration (Anleitung: [docs/ADDING_SOURCES.md](docs/ADDING_SOURCES.md)) |
| [`backend/app/connectors/`](backend/app/connectors/) | Adapter `rest_api`, `rss_atom`, `csv_url` → `market_items` |
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
   (`openssl rand -hex 32`). Ohne Token antwortet der einzige Schreib-Endpunkt
   (`DELETE /api/sources/{id}`) mit `503`.
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
| `SOURCES_FILE` | optional | Pfad zu `sources.yaml`, z. B. `/data/sources.yaml` auf einem Volume |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | optional | Schlüssel für die Adzuna-Quelle; fehlen sie, wird die Quelle übersprungen |
| `RESEND_API_KEY` | optional | schaltet den E-Mail-Versand der Briefings frei; ohne Key wird jeder Versand als `dry_run` protokolliert (Vorschau funktioniert weiter) |
| `REPORT_FROM` | optional | verifizierter Absender, z. B. `Market Radar <radar@deine-domain.ch>`; ohne verifizierte Domain liefert Resend nur an die eigene Konto-Adresse |
| `REPORT_REPLY_TO` | optional | Antwortadresse im Briefing |
| `PUBLIC_BASE_URL` | für E-Mails nötig | absolute Links (Unsubscribe, Dashboard), z. B. `https://radar.example.ch`; leer = relative Links |
| `REPORTS_DAILY_CAP` | optional | Obergrenze für Versände pro Tag (Default 100), schützt das Resend-Kontingent |
| `REPORT_TIMEZONE` | optional | Zeitzone für Woche/Monat der Briefings, Default `Europe/Zurich` |
| `LLM_PROVIDER` | optional | `deepseek` (Default), `openai` oder `custom`; Preset für Base-URL und Modell |
| `LLM_API_KEY` | optional | schaltet „Explain simply“/„Ask“ und den Briefing-Feinschliff frei; ohne Key bleibt alles deterministisch |
| `LLM_MODEL` / `LLM_BASE_URL` | optional | überschreiben das Preset (z. B. Azure OpenAI, Mistral, Ollama) |
| `LLM_DAILY_TOKEN_CAP` / `LLM_RATE_PER_MIN` / `LLM_RATE_PER_DAY` | optional | Kosten- und Missbrauchsgrenzen; bei Erreichen Fallback bzw. `429` |
| `LLM_LANGUAGE` | optional | Standardsprache der Erklärung (`en`) |

**`VITE_*` wirkt nur beim Build.** Vite ersetzt die Variable beim Bauen durch einen
festen Wert; nach jeder Änderung ist ein Redeploy nötig. Das Dockerfile deklariert
`ARG VITE_USE_MOCKS`, damit Railway den Wert als Build-Arg durchreicht.

## Datenbank

Das Schema wird bei jedem Start angewendet (`CREATE TABLE IF NOT EXISTS`, geschützt
durch einen Advisory Lock für parallel startende Worker) – es gibt keinen
Migrationsschritt und keine manuell vorzubereitende Datenbank. Neue Spalten in
Zukunft brauchen ein Migrationswerkzeug (z. B. Alembic), das Schema ist bisher
bewusst klein.

Tabellen: `sources`, `roles`, `observations`, `raw_files` (welche Rohdatei wie verarbeitet wurde),
`connector_sources` + `connector_state` (angewandte `sources.yaml`) und `market_items` (normalisierte Records).

### Datenfluss – wichtig für den ersten Deploy

Daten kommen nur über die Pipeline in die Datenbank, nicht über die API (Details: [docs/api.md](docs/api.md)):

```
1. npm run ingest     → Originaldateien + latest.json im Raw-Ordner (.market-radar/raw)
2. npm run normalize  → Parser pro Quelle → Postgres (sources, roles, observations)
3. Frontend           → GET /api/demand, /api/skills, /api/sources
```

Der Railway-Container führt die Pipeline nicht selbst aus (das Laufzeit-Image hat kein Node und keinen
dauerhaften Raw-Ordner). Die Pipeline läuft dort, wo sie die Datenbank erreicht, z. B. lokal mit der öffentlichen
Verbindung der Railway-Postgres (**Postgres → Connect → Public Network**):

```sh
export DATABASE_URL='<öffentliche Railway-Postgres-URL>'
npm run pipeline
```

Prüfen: `curl https://<deine-domain>/api/sources` zeigt Quelle, Link, Stand und Status.

Für die Connector-Quellen aus `sources.yaml` gilt ein zweiter, unabhängiger Weg (Details im nächsten Abschnitt):

```
sources.yaml ──reload──▶ connector_sources
      │                       │ sync (Cron oder curl)
      └── Adapter ───────────▶ market_items ──▶ GET /api/items
```

Sinnvolle Reihenfolge für den ersten Deploy: erst deployen (Demo-Modus), Daten einspielen
(Pipeline und/oder Connector-Sync), dann `VITE_USE_MOCKS=0` setzen und redeployen.

## Quellen (sources.yaml)

Die Datei liegt im Image unter `/app/sources.yaml` und wird beim Start nach `connector_sources` übernommen.

**Variante A — Änderung über Git (Standard).** Block in [`sources.yaml`](sources.yaml) ergänzen, pushen, deployen.
Kein Code-Change, aber ein Redeploy.

**Variante B — Datei auf einem Railway-Volume.** Volume am Service anlegen (Mount-Pfad `/data`), Variable
`SOURCES_FILE=/data/sources.yaml` setzen, neu deployen. Beim ersten Start kopiert der Service seine mitgelieferte
Datei dorthin; `GET /api/connectors` zeigt danach `"configFile": "/data/sources.yaml"`.

Ändern **ohne Shell-Zugriff** — YAML hochladen, wird validiert und sofort angewandt:

```sh
curl -X PUT https://<deine-domain>/api/connectors/config \
  -H "Authorization: Bearer $INGEST_TOKEN" --data-binary @sources.yaml
# -> {file, sha256, added, updated, disabled, sourceCount, errors, persistent}
```

Aktuelle Datei zum Bearbeiten zurückholen:

```sh
curl -s https://<deine-domain>/api/connectors/config \
  -H "Authorization: Bearer $INGEST_TOKEN" | jq -r .content > sources.yaml
```

| Antwort | Bedeutung |
| --- | --- |
| `persistent: true` | Ziel liegt auf einem Mount — Änderung überlebt den nächsten Deploy |
| `persistent: false` | `SOURCES_FILE` zeigt nicht auf ein Volume; die Änderung ist beim Deploy weg |
| `422` | Datei ungültig — die alte Datei bleibt unverändert |
| `409` | Ziel nicht beschreibbar (Dateisystem read-only) |

Mit Shell geht es auch: `railway ssh`, Datei z. B. per `cat > /data/sources.yaml` ersetzen, danach
`POST /api/connectors/reload`. Im Image ist kein Editor installiert.

Ein Tippfehler ist nicht fatal: beim Start wird die Datei gelesen und nur geloggt; Probleme landen in
`GET /api/connectors` (`configError`), der zuletzt angewandte Stand bleibt aktiv.

**Synchronisieren.** Manuell:

```sh
curl -X POST "https://<deine-domain>/api/connectors/sync?due_only=true" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

Automatisch: zweiten Service aus demselben Repo anlegen, Start-Command überschreiben und Cron setzen:

| Einstellung | Wert |
| --- | --- |
| Custom Start Command | `.venv/bin/python -m app.connectors sync --due-only` |
| Cron Schedule | `*/30 * * * *` |

`refresh_rate` entscheidet, welche Quelle fällig ist (`static` nur mit ausdrücklichem Aufruf ohne `due_only`).
Eine neue Quelle braucht damit **keine** Code-Änderung und keinen neuen Job.

Prüfen:

```sh
curl -s https://<deine-domain>/api/connectors | jq '.sources[] | {id, enabled, itemCount, lastSyncAt, lastError}'
curl -s 'https://<deine-domain>/api/items?category=E&limit=3' | jq
```

Im Frontend erscheinen die Datensätze unter **Items** (`/items`), filterbar nach Kategorie, Kanton, Quelle und
Suchbegriff; die Filter stehen in der URL (`/items?category=E`). Voraussetzung: `VITE_USE_MOCKS=0` beim Build.

## Briefings per E-Mail (Level 2)

Die Seite **Reports** (`/reports`) zeigt eine Vorschau des Briefings und verschickt nach dem Abonnieren sofort
die erste Ausgabe. Regelmäßig verschickt ein **zweiter Cron-Service** aus demselben Image (kein In-Process-Job):

| Einstellung | Wert |
| --- | --- |
| Custom Start Command | `.venv/bin/python -m app.reports run --due` |
| Cron Schedule | `0 5 * * *` (täglich 05:00 UTC; gefällige Abos werden einmal pro ISO-Woche bzw. pro Monat verschickt) |

Nötige Variablen: `RESEND_API_KEY`, `REPORT_FROM` (verifizierter Absender), `PUBLIC_BASE_URL`; optional
`REPORT_REPLY_TO`, `REPORT_TIMEZONE`, `REPORTS_DAILY_CAP`. Aufbau, Grenzen und Datenschutz:
[docs/REPORTS.md](docs/REPORTS.md).

```sh
# lokal prüfen, ohne etwas zu verschicken:
cd backend
DATABASE_URL="$DATABASE_URL" .venv/bin/python -m app.reports preview --role it-support
DATABASE_URL="$DATABASE_URL" .venv/bin/python -m app.reports run --due
```

Ohne `RESEND_API_KEY` schreibt der Lauf `dry_run`-Zeilen in `report_sends` — der komplette Ablauf lässt sich
also ohne Provider demonstrieren. Die E-Mail-Adresse ist das einzige personenbezogene Datum; sie wird nur zum
Versand gespeichert und beim Abmelden mit dem Abo gelöscht.

Quellen, Zahlenstand und Abrufdatum setzt das Backend an jeden Punkt; der optionale LLM-Feinschliff
(`LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`) darf nur den Text umformulieren, die Quellenangabe hängt immer der
Code an. Details, Guardrails und Datenschutz: [docs/LLM.md](docs/LLM.md).

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
| Dashboard leer | Pipeline noch nicht gegen diese Datenbank gelaufen (`npm run pipeline`). `npm run normalize` zeigt pro Quelle `parsed`, `error` oder `no_parser` |
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
