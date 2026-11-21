# Market Radar API

Contract between the **ingestion**, **backend** and **frontend** teams. Change this file first, then the code.
Response types for the frontend are defined in `src/shared/types.ts`; the backend mirrors them in
`backend/app/schemas/`. Interactive docs: http://localhost:8787/docs

Every number belongs to a source, so the frontend can always show the source name, link and retrieval date.

## Read (frontend)

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` |
| GET | `/api/roles` | `Role[]` |
| GET | `/api/sources` | `SourceRef[]` |
| GET | `/api/demand?months=12` | `DemandResponse[]`, one per role and source, last `months` periods |
| GET | `/api/skills?role=<id>` | `SkillsResponse` for the latest period (`404` if no data) |

- `DemandResponse.changePct`: change from the first to the last period in `series`, in %.
- `SkillRow.share`: % of postings in the latest period that mention the skill (`value / base * 100`).
- `SkillRow.changePct`: relative change of `share` vs. the previous period, in %. *(Open: or percentage points?)*

Errors: `{"detail": "..."}` with an HTTP status.

## Write

All write endpoints require the header `Authorization: Bearer <INGEST_TOKEN>`. If the server has no
`INGEST_TOKEN`, they return `503`.

### How data flows

```
ingestion team ──POST /api/raw──▶ raw_documents (Postgres JSONB, stored as delivered)
                                        │  automatically after each upload
                                        ▼
                               parser for that source (backend/app/transform/parsers/)
                                        │  replaces the source's numbers
                                        ▼
                                  observations ──▶ GET /api/demand, /api/skills ──▶ frontend
```

The ingestion team only uploads raw documents. Turning them into numbers is the backend's job: one parser per
source. Until a source has a parser, its documents wait with status `pending` and nothing changes on the dashboard.

### `POST /api/raw` (ingestion team)

Stores documents exactly as delivered. Up to 1000 documents per request. The same content for the same source is
stored only once, so re-sending is safe.

```json
{
  "source": { "id": "my-source", "name": "Name shown in the dashboard", "url": "https://link-to-the-original-data" },
  "documents": [
    { "url": "https://example.org/job/123", "fetchedAt": "2026-11-21T08:00:00Z",
      "contentType": "application/json", "content": { "anything": "as delivered" } },
    { "fetchedAt": "2026-11-21T08:00:00Z", "contentType": "text/csv", "content": "col1,col2\n1,2\n" }
  ]
}
```

| Field | Rule |
|---|---|
| `source.id` | Stable, lowercase letters, digits, `-`, `_` (max 64). Use the same id for every upload from that source. |
| `source.url` | Link to the original data. Shown next to every number from this source. |
| `fetchedAt` | When you retrieved the document. ISO 8601 **with time zone** (`Z` or `+01:00`). |
| `contentType` | Default `application/json`. For CSV, HTML, plain text: send the text as one string in `content`. |
| `content` | Any JSON value. Binary files (PDF, images) are not supported yet. |

Response: `{"source": "my-source", "received": 2, "duplicates": 0}`

Only aggregated or public data, no personal data. No scraping where a site's terms forbid it.

### `GET /api/raw/status`

Per source: whether a parser exists, documents `pending` / `parsed` / `error`, last upload, last parse.

### `POST /api/transform?source=<id>`

Re-runs the parsers for one source (or all sources with a parser), e.g. after a parser was changed.
Same as `uv run python -m app.transform [source-id]`. Returns per source: documents read, observations written,
errors. If a parser fails, the previous numbers stay and the documents get status `error`.

### `POST /api/ingest` (already aggregated numbers)

For a source that already delivers finished counts and needs no parser. One request = one source, one transaction:
if anything is invalid, nothing is written (`422`). Don't use it for a source that also has a parser: the parser
replaces that source's numbers on every run.

```json
{
  "source": { "id": "my-stats", "name": "…", "url": "https://…", "fetchedAt": "2026-11-21T08:00:00Z" },
  "roles": [{ "id": "web-developer", "name": "Web Developer" }],
  "observations": [
    { "metric": "demand", "roleId": "web-developer", "period": "2026-11", "value": 120 },
    { "metric": "skill", "roleId": "web-developer", "skill": "React", "period": "2026-11", "value": 54, "base": 120 }
  ],
  "replace": false
}
```

| Field | Rule |
|---|---|
| `roles` | Created or renamed. A `roleId` must exist in the DB or in this list. |
| `metric` | `demand`: `value` = number of postings for the role. `skill`: `value` = postings mentioning `skill`, `base` = all postings in that sample. |
| `period` | `YYYY-MM` |
| `value`, `base` | `value >= 0`, `base > 0`; `skill` requires `skill` and `base`; `demand` must not have `skill` |
| `replace` | `true` deletes this source's existing observations first |

Parsers produce exactly these observations, so the same rules apply to them.

### `DELETE /api/sources/{id}`

Deletes the source with its raw documents and observations. `204`, or `404` if unknown.

### Example

```sh
curl -X POST http://localhost:8787/api/raw \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d @payload.json
```

```python
import httpx
httpx.post("http://localhost:8787/api/raw", json=payload,
           headers={"Authorization": f"Bearer {token}"}).raise_for_status()
```
