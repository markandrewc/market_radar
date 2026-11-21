# Market Radar API and data pipeline

Contract between the **ingestion**, **backend** and **frontend** teams. Change this file first, then the code.
Response types for the frontend are defined in `src/shared/types.ts`; the backend mirrors them in
`backend/app/schemas/`. Interactive docs: http://localhost:8787/docs

Every number belongs to a source, so the frontend can always show the source name, a link to check it, when we
last downloaded it (`fetchedAt`) and, if the publisher states it, the date of their last update (`dataAsOf`).

## Pipeline

```
1. ingestion          scripts/stage-raw-sources.mjs          npm run ingest
   sources ─────────▶ raw folder: original files + latest.json (unchanged downloads, checksums, metadata)
                            │
2. normalization      backend/app/normalize/                 npm run normalize
                            ▼  one parser per source, merges into the history
                      Postgres: sources, roles, observations, raw_files
                            │
3. UI                 GET /api/...  ──────────────────────▶  React frontend
```

`npm run pipeline` runs steps 1 and 2. Step 2 needs `DATABASE_URL`; both use `MARKET_RADAR_RAW_DIR`
(default `<repo>/.market-radar/raw`, not in git).

### Step 1 → step 2: the raw folder

Step 1 downloads originals without changing them and writes `latest.json`:

```json
{
  "schema_version": 1,
  "updated_at": "2026-11-21T11:17:07Z",
  "sources": [
    {
      "id": "itboard-monthly",
      "name": "ITBoard · IT-Arbeitsmarkt Schweiz",
      "publisher": "ITBoard.ch",
      "report_url": "https://www.itboard.ch/arbeitsmarkt",
      "source_url": "https://www.itboard.ch/arbeitsmarkt/daten.csv",
      "report_date": "2026-11-15",
      "licence": "CC BY 4.0",
      "licence_url": "https://creativecommons.org/licenses/by/4.0/",
      "status": "downloaded",
      "relative_path": "itboard-monthly-<sha256>.csv",
      "sha256": "<sha256 of the file>",
      "content_type": "text/csv; charset=utf-8",
      "fetched_at": "2026-11-21T11:17:07.032Z",
      "error": null
    }
  ]
}
```

| Field | Used by step 2 for |
|---|---|
| `id` | Picks the parser (`backend/app/normalize/parsers/__init__.py`) |
| `name` | Source name shown next to every number |
| `report_url` (else `source_url`) | The link the team clicks to check the original |
| `report_date` | `dataAsOf`: the publisher's last update |
| `fetched_at` | `fetchedAt`: our last successful download |
| `licence`, `licence_url` | Shown on the Sources page (attribution) |
| `relative_path`, `sha256` | The file to parse; step 2 refuses a file whose checksum does not match |
| `status`, `error` | `retained` + `error` = the latest download failed and an older file was kept → source shows as out of date |

### History

The database keeps its own history. When step 2 reads a new file, the months in that file replace the same months
in the database (so the publisher's corrections win); all other months stay. A source that only publishes the
latest month therefore still builds up a time series. Every processed file is logged in `raw_files`
(checksum, download time, result).

If a source changes how it counts, its parser reports the first month of the new way of counting
(`comparableFrom`). Earlier months stay in the history but are not used for trends. ITBoard: from 2026-06 a posting
can count for several roles (role counts add up to 136–161 % of postings, before ~80 %).

Step 2 results per source: `parsed`, `error` (previous numbers stay, the error shows on the Sources page),
`no_parser` (file is kept, nothing on the dashboard yet), `not_downloaded`.

Parsers registered: `itboard-monthly`. Staged without parser yet: `bfs-besta-regions` and the SEM tables (XLSX).

Only aggregated or public data, no personal data. No scraping where a site's terms forbid it.

## MarketItem (frozen contract)

Every connector normalises its raw data into this one structure, so adding a data source never changes code.
The schema lives in [market-item.schema.json](market-item.schema.json), the TypeScript mirror in
`src/shared/types.ts`, the 30 reference records in `src/web/mocks/market-items.json`.
`npm run check:contract` validates the mocks against the schema; the backend returns exactly this shape.

```json
{
  "id": "itboard:2026-11:inserate:aktiv",
  "category": "A",
  "categories": ["A"],
  "title": "Inserate aktiv (2026-11)",
  "summary": "ITBoard zählt 41 aktive IT-Inserate im November 2026, drei mehr als im Vormonat.",
  "metrics": { "anzahl": 41, "basis": null },
  "tags": ["inserate", "aktiv", "monat"],
  "region": null,
  "source_name": "ITBoard Arbeitsmarkt",
  "source_url": "https://www.itboard.ch/arbeitsmarkt",
  "url": "https://www.itboard.ch/arbeitsmarkt/daten.csv",
  "published_at": "2026-11-01T00:00:00Z",
  "fetched_at": "2026-11-21T09:15:00Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable within its source. |
| `category` | `"A"`–`"E"` | Primary category: A = demand/job market, B = skills, C = employers, D = population/permits, E = policy/regulation. |
| `categories` | string[] | All categories the source feeds; always contains `category`. |
| `title` | string | Headline for the UI. |
| `summary` | string | Plain text, HTML stripped. |
| `metrics` | `{ [name]: number \| null }` | Numbers that belong to the record; the key names the meaning. |
| `tags` | string[] | Free-form tags and skills, e.g. `role:IT Support`. |
| `region` | string \| null | Canton code (`ZH`, `BE`, …) when recognisable, else the raw location, `null` for Switzerland-wide. |
| `source_name` | string | Shown next to every number (provenance). |
| `source_url` | string | Link to the original data of the source. |
| `url` | string \| null | Permalink of the single record; `null` for aggregates. |
| `published_at` | string \| null | RFC 3339 in UTC; period start for monthly/yearly figures. |
| `fetched_at` | string | RFC 3339 in UTC, when the connector retrieved the record. |

Field names are deliberately `snake_case` here, unlike the older camelCase endpoints, so the JSON matches
the Python and TypeScript definitions one-to-one.

## Read (frontend)

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` |
| GET | `/api/roles` | `Role[]` |
| GET | `/api/sources` | `SourceStatus[]` |
| GET | `/api/demand?months=12&horizon=3` | `DemandResponse[]`, one per role and source, largest first |
| GET | `/api/skills?horizon=3` | `SkillsResponse` over all postings (`role.id = "all"`) |
| GET | `/api/skills?role=<id>&horizon=3` | `SkillsResponse` for one role; empty `skills` if the role has no skill data; `404` for an unknown role |

`months` (1–120): history returned in `series`. `horizon` (0–12): months of forecast in `trend.forecast`.

- `DemandResponse.current`: postings in the latest month. `series`: postings per month, the last `months` months.
- `DemandResponse.shareSeries`: the role's % of all postings per month (only if the source states the sample size).
- `DemandResponse.changePct`: latest month vs. the month before, in %. If the source states the sample size, this
  compares the role's **share** of all postings, because a growing sample (ITBoard grew from 41 to 770 postings
  per month in 2026) would otherwise look like growth.
- `SkillRow.share`: % of postings in the latest month that mention the skill (`value / base * 100`).
- `SkillRow.changePct`: relative change of `share` vs. the previous month, in %. `0` if the previous month is
  before `comparableFrom`.
- `trend` (on `DemandResponse` and `SkillRow`, `null` with fewer than 4 comparable months):
  - `basis`: `share` (% of all postings; used whenever the sample size is known) or `count`
  - `direction`: `rising` / `falling` / `stable`. `stable` = the slope is not clearly different from zero
    (its 95 % confidence interval includes 0)
  - `slopePerMonth`: percentage points (share) or postings (count) per month
  - `months`: comparable months the trend is based on (max. 12)
  - `forecast`: `[{period, value, low, high}]`, the next `horizon` months with a 95 % prediction interval
  - `method`: plain-language description; show it next to any forecast
  - Method: weighted linear regression over the last 12 comparable months, each month weighted by its sample size
    (a month with 41 postings counts far less than one with 770). An extrapolation of the recent past, not a
    prediction of events.
- `SourceRef.comparableFrom`: `YYYY-MM` if the source changed how it counts; earlier months are not comparable.
- `SourceStatus`: `url` (link to the original), `lastFetchedAt`, `dataAsOf`, `licence`, `licenceUrl`,
  `status` and `problem` (why, in plain words):
  - `error`: the latest file could not be read; older numbers are shown
  - `stale`: the latest download failed, or nothing new for `SOURCE_STALE_DAYS` days (default 7)
  - `ok`

Errors: `{"detail": "..."}` with an HTTP status.

## Write

| Method | Path | |
|---|---|---|
| DELETE | `/api/sources/{id}` | Removes a source and its numbers from the database (`204`, `404`). The raw folder is not touched. |

Requires `Authorization: Bearer <INGEST_TOKEN>`; without `INGEST_TOKEN` on the server: `503`.
Data only enters the database through step 2.
