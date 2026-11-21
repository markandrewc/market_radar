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
| `region` | string \| null | Canton code (`ZH`, `BE`, …) when the record mentions a target city, else `null`. |
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
| GET | `/api/connectors` | `ConnectorList`: the sources from `sources.yaml`, the `defaults` (roles, cities, keywords), `configError`, `pendingChanges` |
| GET | `/api/items?category=&region=&source=&q=&order=&limit=&offset=` | `MarketItem[]` from all connectors, newest `published_at` first |

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

## Connectors (sources.yaml)

Sources are configuration, not code: `sources.yaml` (repo root, `SOURCES_FILE`, or a Railway volume such as
`/data/sources.yaml`) is applied into `connector_sources` on start and by `POST /api/connectors/reload`.
Adding a source is a six-line block — see [ADDING_SOURCES.md](ADDING_SOURCES.md). Its records are normalised
to MarketItem (above).

### `GET /api/connectors`

Returns `configFile`, `configError`, `pendingChanges` (the file changed since the last apply), `appliedAt`,
`defaults` (`targetCities`, `targetRoles`, `policyKeywords`) and `sources`:

| Field | Meaning |
|---|---|
| `categories` | Categories A–E this source feeds; the first one becomes the item's `category`. |
| `adapterType` | `rest_api`, `rss_atom` or `csv_url`. |
| `endpoints` | One or more URLs the adapter reads (`rss_policy` merges several feeds). |
| `refreshRate` / `refreshSeconds` | `refreshSeconds` is `null` for `static`: only a manual sync runs it. |
| `enabled` / `inConfig` | `inConfig: false` = removed from the file; already stored items stay. |
| `authEnv` | Names of required environment variables — never their values. |
| `lastSyncAt` / `lastError` | Outcome of the last sync of this source. |

### `POST /api/connectors/reload`

Requires `Authorization: Bearer <INGEST_TOKEN>`. Applies the file and returns
`{added, updated, disabled, sourceCount, configSha256, errors}`.
A file that cannot be read at all answers `422` and changes nothing: the previously applied sources stay
active, so a typo on a mounted volume cannot wipe the configuration. Broken single blocks are listed in
`errors`, the valid ones are applied anyway.

### `GET /api/connectors/config` · `PUT /api/connectors/config`

Token-protected read/replace of the `sources.yaml` that is in effect — typically on a mounted volume, so the file
can be changed without shell access or a redeploy. `GET` returns `{file, sha256, content}`.

`PUT` takes the YAML as the request body, validates it and applies it in one step:

- a broken file or an invalid block answers `422`; the old file stays untouched
- a target that cannot be written answers `409` (point `SOURCES_FILE` at a volume)
- `persistent` reports whether the target sits on a mount point, i.e. survives a redeploy

```sh
curl -X PUT https://<domain>/api/connectors/config \
  -H "Authorization: Bearer $INGEST_TOKEN" --data-binary @sources.yaml
```

### `GET /api/items`

Normalised records from every connector **and** from the pipeline parsers that produce context data
(BFS vacancies, SEM asylum/residence tables; shape see [MarketItem](#marketitem-frozen-contract)). Query parameters:
`category` (A–E, matches `categories`), `region` (canton code), `source` (connector id), `q` (title/summary
contains), `order` (`published_at`, default, or `fetched_at`), `limit` (1–1000, default 100), `offset`.
An unknown `category` or `order` answers `422`.

### `POST /api/connectors/sync?source=<id>&due_only=true`

Requires the token. Fetches the configured sources, normalises them and writes `market_items`:
`{results, items, errors}`. `source` limits the run to one id (`404` if unknown); `due_only` skips sources whose
`refreshSeconds` has not elapsed since `lastSyncAt`, and `static` sources only run on an explicit call.
Per source: `{source, adapter, items, skipped, replaced, reason, error}`.

- A failing source does not stop the others: its previous items stay, `lastError` is stored and the result carries
  the message.
- An empty payload also keeps the existing items (`replaced: false`), so a temporarily broken feed cannot wipe a
  source's data.
- Missing `authEnv` variables skip the source instead of failing it.

## Write

| Method | Path | |
|---|---|---|
| DELETE | `/api/sources/{id}` | Removes a source and its numbers from the database (`204`, `404`). The raw folder is not touched. |

Requires `Authorization: Bearer <INGEST_TOKEN>`; without `INGEST_TOKEN` on the server: `503`.
Data only enters the database through step 2.

## Briefings (Level 2)

A briefing is a `Digest`: a subject, a plain-text version and a list of sections. **Every bullet carries its own
`source`** (`SourceRef`, see above), and the rendered text ends each bullet with the citation — the backend
appends it, so it cannot be lost on the way to an inbox.

```json
{
  "subject": "Market Radar: weekly briefing, week 47",
  "text": "Demand\n- IT Support: 41 postings in November 2026, 1.2 % more than in October.\n  — ITBoard · data as of 2026-11-15 · retrieved 2026-11-21 · https://www.itboard.ch/arbeitsmarkt",
  "sections": [
    {
      "heading": "Demand",
      "bullets": [
        {
          "text": "IT Support: 41 postings in November 2026, 1.2 % more than in October.",
          "source": {
            "id": "itboard-monthly",
            "name": "ITBoard · IT-Arbeitsmarkt Schweiz",
            "url": "https://www.itboard.ch/arbeitsmarkt",
            "fetchedAt": "2026-11-21T08:00:00Z",
            "dataAsOf": "2026-11-15",
            "comparableFrom": "2026-06"
          }
        }
      ],
      "note": null
    }
  ],
  "sources": [ { "id": "itboard-monthly", "name": "ITBoard · IT-Arbeitsmarkt Schweiz", "...": "..." } ],
  "generatedAt": "2026-11-21T14:00:00Z",
  "empty": false
}
```

| Section | Built from | Rules |
|---|---|---|
| `Demand` | `observations` (`metric = 'demand'`) via `app/services/market_view.py` | one bullet per selected role that has data: latest value, `changePct`, trend direction. `roleIds: []` = all roles with demand data (max. 6). |
| `Skills` | `observations` (`metric = 'skill'`) | exactly one selected role = that role's skills; otherwise the all-roles series (`role_id = ''`). Top 5 by share plus up to 3 rising and 3 falling. |
| `Policy watch` (if `includePolicy`) | `market_items` with `'E' = ANY(categories)`, newest `published_at` | max. 5 bullets: title + trimmed summary; each bullet is one item and one source. |
| `Target group` (if `includeTargetGroup`) | `market_items` with `'D' = ANY(categories)` | max. 3 bullets with the item's key `metrics`. Aggregate statistics only, no personal data. |
| `Employers` | same aggregation as `GET /api/employers` | only when at least one selected role has category-C data. |

`note` is **our** reading (e.g. a plain-language implication), always shown separately from the source text and
labelled as ours in the UI and in the e-mail. `empty: true` means there was nothing to report: the text then
explains why and links to `/sources`; no number is invented. A role without data is skipped, never reported as 0.

### `POST /api/reports/preview`

Public, no storage: body `{"roleIds": ["it-support"], "includePolicy": true, "includeTargetGroup": false}`,
answer `Digest`. Used by the Reports page and by `python -m app.reports preview`.

### `POST /api/subscriptions`

Public, rate-limited. Body:

```json
{"email": "team@powercoders.org", "roleIds": ["it-support"], "includePolicy": true,
 "includeTargetGroup": false, "cadence": "weekly"}
```

- `email` is lower-cased and upserted: subscribing again updates topics instead of creating a second row.
- At least one topic is required (`422` otherwise); an invalid address answers `422`.
- The first briefing is sent immediately so the subscriber sees the format. Limits: one send per address per
  minute, five per day, and `REPORTS_DAILY_CAP` (default 100) per day for the whole deployment → `429`.
- Answer `{ok, sent, error?, nextRun, unsubscribeUrl}`. If the provider rejects the mail, the subscription is
  still stored and the answer is `200` with `sent: false` and the provider message in `error`.
- Without `RESEND_API_KEY` the send is recorded as `dry_run`; nothing is delivered.

### `POST /api/reports/run`

Requires the token. Body `{"dueOnly": true, "subscriptionId": null}`. Sends every due subscription and answers
`{sent, failed, skipped, results: [{subscriptionId, email, status, detail}]}`.
Due rule, compared in `REPORT_TIMEZONE` (default `Europe/Zurich`):

- `weekly`: `last_sent_at` is in an earlier ISO week (or null) — Monday is the intended day, a missed cron run
  catches up on the next run instead of skipping the week;
- `monthly`: `last_sent_at` is in an earlier calendar month (or null).

`python -m app.reports run --due` is the cron entry point and uses the same rule; `--no-due` sends everyone.
The same code path is idempotent: after a send `last_sent_at` is written, so two runs in the same period send once.

### `GET /api/reports/unsubscribe?token=<token>`

Public, answers a small HTML page. Deletes the subscription and its `report_sends` rows (the address is removed
with it); an unknown or already used token answers `404` HTML. The e-mail carries the same URL in
`List-Unsubscribe` for one-click unsubscribe.

### Tables

```sql
report_subscriptions(id TEXT PK, email TEXT, role_ids TEXT[], include_policy BOOL, include_target_group BOOL,
                     cadence TEXT CHECK IN ('weekly','monthly'), active BOOL, unsubscribe_token TEXT UNIQUE,
                     created_at, last_sent_at, last_error);
report_sends(id BIGSERIAL PK, subscription_id TEXT REFERENCES report_subscriptions ON DELETE CASCADE,
             email TEXT, sent_at, status TEXT CHECK IN ('sent','dry_run','error'), provider TEXT,
             subject TEXT, digest TEXT, sources JSONB, provider_id TEXT, error TEXT);
```

The e-mail address is the only personal datum in the database: it is stored only to deliver the briefing, never
returned by a read endpoint, and deleted with the subscription. `report_sends.digest` keeps the exact text that
left the server, so the team can check what was sent even if the inbox is gone.

## Employers (Level 3, category C)

### `GET /api/employers?role=<role-id>`

Who is hiring for one role of the `roles` table (`404` for an unknown role). Built only from stored
`market_items` whose `categories` contain `C` (today: the Adzuna connector), so no extra request is made and the
numbers are as old as the last sync.

```json
{
  "role": { "id": "it-support", "name": "IT Support" },
  "window": { "from": "2026-09-01", "to": "2026-11-19" },
  "employers": [
    { "name": "Swisscom", "openings": 7, "topSkills": ["Windows", "Active Directory", "SQL"],
      "sourceUrl": "https://www.adzuna.ch/land/ad/…" }
  ],
  "source": { "id": "adzuna_ch", "name": "Adzuna Stellenmarkt Schweiz", "url": "https://developer.adzuna.com/",
              "fetchedAt": "2026-11-21T08:00:00Z", "dataAsOf": "2026-11-19" }
}
```

- A posting belongs to the role when its tags contain `role:<role name>` (set by the connector from
  `defaults.target_roles`) or when its title contains the role name.
- `openings` is the number of stored postings of that employer for this role; `topSkills` are the three most
  named skills in those postings (curated IT skill list, `app/data/it_skills.yaml`), not an ESCO classification.
- `window` is min/max `published_at` of the contributing postings (`YYYY-MM-DD`), `null` when the source dates
  are unusable. `source` is the connector, with `dataAsOf` = newest posting date.
- No category-C data (e.g. `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` missing) answers `200` with `employers: []`; the UI
  explains what to configure instead of showing placeholder numbers.
- Aggregate only: employer names and counts, no contact persons, no applications.

## Insights (the plain-language reading)

The UI never shows a bare number: each card carries one or more `Insight` objects — a short, deterministic
reading of the data. **The text is generated from the same rows the numbers come from; no model, no invented
figures.** Every number that appears in `body` must also appear in `evidence`, together with its source. The UI
labels the text as *our reading, not the source*; it is never attributed to the publisher.

```json
{
  "id": "demand:it-support",
  "kind": "demand",
  "headline": "IT Support: demand is rising",
  "body": "IT Support has 41 open positions in November 2026, 1.2 % more than in October. The trend points up over the last months; treat the forecast as an extrapolation, not a promise.",
  "evidence": [
    { "label": "Open positions, Nov 2026", "value": "41", "source": { "id": "itboard-monthly", "name": "ITBoard · IT-Arbeitsmarkt Schweiz", "url": "https://www.itboard.ch/arbeitsmarkt", "fetchedAt": "2026-11-21T08:00:00Z", "dataAsOf": "2026-11-15", "comparableFrom": "2026-06" } }
  ],
  "severity": "info",
  "method": "template",
  "generatedAt": "2026-11-21T14:00:00Z",
  "roleId": "it-support",
  "itemId": null
}
```

`kind`: `demand` · `skills` · `employers` · `regions` · `target` · `policy`. `severity`: `info` · `attention`
(e.g. a policy item that matches one of the watch groups). `method` is always `template` today.

### `GET /api/insights?role=<id>&kind=<kind>&limit=<n>`

Returns `Insight[]`, newest/most relevant first. `role` limits demand/skills/employers insights to one role
(`404` for an unknown role); `kind` filters the list; `limit` defaults to 20, max 100. Empty database → `[]`
(no insight without data). A missing section (e.g. no category-C records) produces no insight, not an empty one.

### `GET /api/overview`

The weekly pulse for the home page:

```json
{
  "generatedAt": "2026-11-21T14:00:00Z",
  "postings": { "value": 184, "period": "2026-11", "base": 770,
                "source": { "id": "itboard-monthly", "name": "…", "url": "…", "fetchedAt": "…", "dataAsOf": "…" } },
  "rolesTracked": 6,
  "biggestRiser": { "role": { "id": "data-analyst", "name": "Data Analyst" }, "changePct": 12.4, "source": { "…": "…" } },
  "biggestFaller": null,
  "newPolicyItems": 2,
  "targetGroupItems": 343,
  "sources": { "ok": 5, "stale": 1, "error": 0 },
  "insights": [ { "…": "Insight" } ]
}
```

- `postings.value` is the **largest role count** in the latest month, `base` is the sample of all postings in that
  month. Never sum role counts: ITBoard counts one posting for several roles (136–161 % of postings).
- `biggestRiser` / `biggestFaller` compare the latest month with the previous one, using the share where the
  source states a sample size. They prefer roles with at least 20 postings in the latest month (small samples
  swing wildly); when no role reaches that, the largest available role is used. `current` is that month's
  postings, so the UI can show the sample next to the move. `null` when fewer than two comparable months exist
  for every role.
- `newPolicyItems` = category-E records whose `published_at` (fallback `fetched_at`) is within the last 7 days.
- `sources` counts the health states of `GET /api/sources` (`ok`, `stale`, `error`).
- `insights` embeds the short list shown in the pulse (demand, skills, regions, target, policy).

### `GET /api/insights/taxonomy`

Curated product knowledge, so the app and the e-mailed briefing tell the same story:
`{ policyGroups: [{label, keywords[]}], policyNotes: [{keyword, label, note}], roleAliases: {role: [alias]} }`.
`policyGroups` and `roleAliases` come from `sources.yaml` → `defaults` when present (falling back to the built-in
list); `policyNotes` are curated text (our reading, never the source's). No token required.
