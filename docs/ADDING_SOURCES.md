# Eine Datenquelle hinzufügen — 1 Seite

Quellen sind Konfiguration, kein Code. Ein Block in [`sources.yaml`](../sources.yaml), dann
`reload` + `sync` — Backend und Frontend bleiben unverändert.

## Der Block (6 Zeilen)

```yaml
sources:
  - id: itboard
    name: "ITBoard Arbeitsmarkt"
    source_url: "https://www.itboard.ch/arbeitsmarkt"
    category: ["A"]
    adapter_type: "csv_url"
    endpoint: "https://www.itboard.ch/arbeitsmarkt/daten.csv"
```

`refresh_rate` fehlt hier absichtlich: Default ist `weekly`. Pflichtfelder sind `id`, `name`,
`source_url`, `category`, `adapter_type` und `endpoint` (oder `endpoints`).

| Feld | Bedeutung |
|---|---|
| `id` | stabil, kleingeschrieben (`a-z0-9._-`); Schlüssel für DB und API-Filter |
| `name` | erscheint im UI neben jeder Zahl (Provenienz) |
| `source_url` | Link zur Originalseite, die das Team prüfen kann |
| `description` | ein Satz für die Quellenübersicht |
| `category` | Liste aus `A`–`E`; die **erste** wird `MarketItem.category`, alle zusammen `categories` |
| `adapter_type` | `rest_api`, `rss_atom` oder `csv_url` |
| `endpoint` / `endpoints` | eine URL bzw. Liste (mehrere Feeds = eine Quelle) |
| `refresh_rate` | `daily` \| `weekly` \| `monthly` \| `yearly` \| `static` \| `6h` \| `2d` |
| `enabled` | `false` = konfiguriert, wird aber nicht synchronisiert (Default `true`) |

**Kategorien:** A = Nachfrage/Stellenmarkt · B = Skills · C = Arbeitgeber ·
D = Bevölkerung & Bewilligungen · E = Politik & Regulierung.

## Adapter

| `adapter_type` | Wofür | Wichtige Felder |
|---|---|---|
| `rest_api` | JSON-API | `items_path`, `params`, `pages`, `auth_env`, `field_map` |
| `rss_atom` | RSS 2.0 / Atom | `endpoints`, `filter_keywords` |
| `csv_url` | CSV-Datei per URL oder `file://` | `delimiter`, `field_map` |

`rss_atom` liest `<item>` und `<entry>`, nimmt `<category>` als Tags, `link`/`href` als `url` und
`pubDate`/`published` als Datum. `csv_url` macht aus jeder Zeile ein Item.

## Optional: Felder umbenennen (`field_map`)

Records heissen selten so wie das Ziel. `field_map` mappt Feld → Pfad **oder** Template:

```yaml
    items_path: "_embedded.results"          # ESCO; bei Parlament: "d", bei Adzuna: "results"
    field_map:
      id: "uri"                              # Punktpfade: preferredLabel.de, location.display_name
      title: "{preferredLabel.de}"           # Template aus mehreren Feldern
      published_at: "{Year}-01-01T00:00:00Z" # Datum aus Jahr/Monat bauen
      tags: "ESCO,{className}"               # Komma oder | trennt mehrere Tags
      metrics:
        anzahl: "anzahl"                     # Zahl aus einer Spalte/einem Feld
        basis: "basis"
```

- Ohne `field_map` gelten die Standardnamen: `id`, `title`, `summary`, `url`, `region`, `published_at`, `tags`.
- `metrics: auto` übernimmt alle numerischen Felder einer Zeile.
- `region` wird auf ein Kantonskürzel abgebildet, wenn eine Zielstadt im Text steht (`defaults.target_cities`),
  sonst `null`.

## Optional: Filter, Auth, Platzhalter

```yaml
    filter_keywords: ["Asyl", "Status S"]   # nur Treffer in Titel/Summary/Tags (Default für Kategorie E: policy_keywords)
    filter_regions: true                    # nur Items in den Zielkantonen
    auth_env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]   # fehlt eine Variable, wird die Quelle übersprungen
    params:
      app_id: "${ADZUNA_APP_ID}"            # ${ENV} wird beim Abruf ersetzt
      what_or: "{target_roles}"             # Platzhalter aus defaults.target_roles
      "$top": 50
    pages: 3                                # 1..n, braucht "{page}" im endpoint
    max_items: 2000
    timeout: 30
```

Alles, was `defaults` (Zielstädte, Zielrollen, Policy-Keywords) betrifft, steht **einmal** oben in der Datei.

## Einbauen und prüfen

```bash
cd backend
python -m app.connectors check <id>        # ein Abruf, kein DB-Schreibvorgang
python -m app.connectors reload            # YAML -> Postgres (oder POST /api/connectors/reload)
python -m app.connectors sync --source <id>
```

Ohne Repo-/Shell-Zugriff (Railway-Volume): YAML hochladen, wird validiert und sofort angewandt —

```bash
curl -X PUT https://<deine-domain>/api/connectors/config \
  -H "Authorization: Bearer $INGEST_TOKEN" --data-binary @sources.yaml
# aktuelle Datei holen: curl -s .../api/connectors/config -H "..." | jq -r .content
```

```bash
curl -s localhost:8080/api/connectors | jq '.sources[] | {id, enabled, itemCount, lastError}'
curl -s 'localhost:8080/api/items?category=A&limit=3' | jq
```

Im Frontend: **Items** (`/items`). Die Filter stehen in der URL und sind teilbar, z. B.
`/items?category=E`, `/items?category=D&region=ZH`, `/items?source=Fedlex%20–%20Amtliche%20Sammlung`.
`VITE_USE_MOCKS=0` nötig, damit die Seite die API statt der 30 Demo-Records zeigt.

Auf Railway läuft das über `POST /api/connectors/sync?due_only=true` per Cron; `refresh_rate`
entscheidet, welche Quelle dabei fällig ist (`static` nur mit ausdrücklichem Aufruf).
Liegt die Datei auf einem Volume (`SOURCES_FILE=/data/sources.yaml`), genügt nach dem Editieren ein
`reload` — kein Redeploy.

## Connector oder Parser?

| Datenlage | Weg |
|---|---|
| CSV, JSON-API oder RSS mit Zeilen/Datensätzen | Connector in `sources.yaml` (kein Code) |
| Excel-Exporte oder Tabellen mit mehrstufigem Kopf | Parser in `backend/app/normalize/parsers/` (Code + Fixture-Test) |

Ein Parser schreibt entweder Kennzahlen (`observations`, Rollen) oder Kontext-Records als MarketItems der
Kategorie D (`market_items`) — wie die BFS-/SEM-Tabellen. Beide Wege landen im Frontend: Zahlen auf den
Dashboard-Seiten, Datensätze unter **Items**.

## Regeln

- Nur offizielle APIs, RSS-Feeds oder Open-Data-Exporte. Kein Scraping, wo Nutzungsbedingungen es verbieten
  (z. B. job-room.ch) — `licence`/`licence_url` im Block dokumentieren.
- Der Adapter liest pro Quelle eine URL bzw. Liste; für dieselbe Quelle mit zwei Kategorien zwei Blöcke anlegen.
- Kaputte Blöcke blockieren nichts: `reload` meldet sie in `errors`, die übrigen werden übernommen. Eine
  unlesbare Datei ändert gar nichts, der letzte Stand bleibt aktiv.
