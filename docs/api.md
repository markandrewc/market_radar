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

## Write (ingestion)

Requires the header `Authorization: Bearer <INGEST_TOKEN>`. If the server has no `INGEST_TOKEN`, these return `503`.

### `POST /api/ingest`

One request = one source. Applied in one transaction: if anything is invalid, nothing is written (`422`).
Sending the same data again updates values, so it never creates duplicates.

```json
{
  "source": {
    "id": "my-source",
    "name": "Name shown in the dashboard",
    "url": "https://link-to-the-original-data",
    "fetchedAt": "2026-11-21T08:00:00Z"
  },
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
| `source.fetchedAt` | ISO 8601, when you retrieved the data |
| `roles` | Created or renamed. A `roleId` must exist in the DB or in this list. |
| `metric` | `demand`: `value` = number of postings for the role. `skill`: `value` = postings mentioning `skill`, `base` = all postings in that sample. |
| `period` | `YYYY-MM` |
| `value`, `base` | `value >= 0`, `base > 0`; `skill` requires `skill` and `base`; `demand` must not have `skill` |
| `replace` | `true` deletes this source's existing observations before inserting |

Response: `{"source": "my-source", "roles": 1, "observations": 2}`

Only aggregated counts, no personal data. No scraping where a site's terms forbid it.

### `DELETE /api/sources/{id}`

Deletes the source and all its observations. `204`, or `404` if unknown.

### Example

```sh
curl -X POST http://localhost:8787/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d @payload.json
```

```python
import httpx
httpx.post("http://localhost:8787/api/ingest", json=payload,
           headers={"Authorization": f"Bearer {token}"}).raise_for_status()
```
