# Demo runbook (3 minutes)

The demo must show five things in this order: the market (Level 1), the briefing e-mail (Level 2), the people and
the employers (Level 3), the policy watch (Level 3), and adding a source without a developer (Level 4).
Everything on screen names its source — point at the source line once and let the judges see it everywhere.

## Ten minutes before

1. **Build the frontend against the API** (the demo build never uses mock data):
   `VITE_USE_MOCKS=0 npm run build`
2. **Environment**: `DATABASE_URL`, `INGEST_TOKEN`, `RESEND_API_KEY`, `REPORT_FROM`, `PUBLIC_BASE_URL`
   (see [DEPLOY.md](../DEPLOY.md) and [REPORTS.md](REPORTS.md)).
3. **Data in place**: `npm run pipeline` (ITBoard + BFS + SEM tables) and
   `curl -X POST "$HOST/api/connectors/sync" -H "Authorization: Bearer $INGEST_TOKEN"`
   (Adzuna needs `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, otherwise Level 3 employers is empty).
4. **Check `/api/health`, `/api/demand`, `/api/items?category=E`, `/api/employers?role=<id>`** — the last one is
   allowed to be empty, but then say so instead of showing a mock.
5. **Send yourself one briefing** and confirm it arrives; keep the inbox open in a second window.
6. Have `/sources` open in a second tab for the operator panel.

## The script

| Seconds | Screen | Say |
|---|---|---|
| 0–20 | `/` | "Powercoders' programme decisions depend on a market nobody has time to read. This is one radar for it." |
| 20–50 | `/` → a role card | "Demand for this role over the last months, with trend and forecast. Every card names its source, the publisher's date and when we fetched it — click it and you are at the original." |
| 50–80 | `/roles/<id>` | "The skills named in the postings, rising and falling. This is what we should teach next term." |
| 80–130 | `/reports` | "Staff pick topics, preview the exact e-mail with links, and subscribe. Here is the one that just arrived." (switch to inbox, open a bullet link) |
| 130–170 | `/roles/<id>` employers | "The employers worth a call, straight from the postings." |
| 170–200 | `/policy` | "New laws and motions that change what we can do: Status S/F, job reporting duties. The note under a card is our reading and is labelled as such." |
| 200–240 | `/sources` → operator panel | "Adding a source is a config block, not a code change: paste, apply, sync." Paste the block below, click *Validate & apply*, then *Sync now*, open `/items?category=E` and show the new rows. |

## Level 4 block to paste (no code, no shell)

```yaml
  - id: fedlex_all_publications_demo
    name: "Fedlex – Gesamtpublikationen"
    source_url: "https://www.fedlex.admin.ch/"
    description: "All new federal publications; added live in the browser."
    category: ["E"]
    adapter_type: "rss_atom"
    endpoint: "https://fedlex.data.admin.ch/api/rss-de.xml"
    filter_keywords: ["Digitalisierung", "Künstliche Intelligenz", "Arbeitsmarkt"]
    refresh_rate: "daily"
    enabled: true
```

Paste it under `sources:` (indentation matters, two spaces before `- id`), keep the rest of the file, apply, sync.
The source appears in the connector table with its last sync time; `/items?category=E` shows the records.

## Fallbacks

| Problem | What to do on stage |
|---|---|
| Resend rejects the mail (domain unverified) | show the amber "saved, but not sent" state and the preview — the flow and the citations are visible; mention the provider message is shown verbatim |
| No Adzuna key | `/roles/<id>` shows "No employer data yet" with the exact fix; say the source is configured but the key is not in this environment |
| A feed is down | `/sources` shows the source as stale with the error; the stored records stay and are still cited |
| Live YAML edit fails | the `422` message is displayed and the previous configuration stays active — that is the safety property, not a bug |
| No time | skip the inbox step; the preview on `/reports` is the same text |

## Phrases that score with the judges

- "Citations are appended by the code, not by the model — the e-mail cannot contain a source we did not fetch."
- "No scraping: Adzuna API, official SEM/BFS exports, Fedlex and the parliament's open data web service."
- "Every number carries the publisher's date and our retrieval date; `/sources` shows licence and health."
- "A new source is six lines of YAML; the Live-4 demo just proved it."
