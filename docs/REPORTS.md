# Briefings — how the e-mailed report works

Level 2 of the Market Radar. A briefing is a short, plain-language summary of what changed in demand, skills,
policy and the target group. It is built only from what is already in the database, so it is exactly as current
as the dashboard — no extra fetching, no invented numbers.

## The rule that cannot be switched off

Every bullet is a pair of **a fact and its source**. The source line is appended by the code when the text is
rendered, not written by a model:

```
Demand
- IT Support: 41 postings in November 2026, 1.2 % more than in October.
  — ITBoard · data as of 2026-11-15 · retrieved 2026-11-21 · https://www.itboard.ch/arbeitsmarkt
```

So a briefing bullet without a source cannot exist. The same `SourceRef` objects (name, link, publisher date,
retrieval date) are what the in-app preview shows and what `report_sends` stores.

## Sections

| Section | Source table | Rule |
|---|---|---|
| Demand | `observations` (`metric = 'demand'`) | one bullet per selected role with data; roles without data are skipped, never shown as 0 |
| Skills | `observations` (`metric = 'skill'`) | one selected role = that role; otherwise the all-roles series; top 5 by share plus up to 3 rising and 3 falling |
| Policy watch | `market_items` with category E | up to 5 newest items (Fedlex, Curia Vista) |
| Target group | `market_items` with category D | up to 3 newest items (SEM/BFS); aggregate statistics only |
| Employers | `market_items` with category C | only when the selected role has Adzuna postings |

`note` on a section is **our reading** (a plain-language implication for the programme), always shown separately
and labelled "Our reading, not the source". The policy note comes from the same taxonomy the app serves at
`GET /api/insights/taxonomy`, so the e-mail and the Policy page never tell different stories. If nothing is
available, `empty: true` and the text says why and links to `/sources`; the briefing never invents a number.

## Building blocks

```
POST /api/reports/preview  ─┐
python -m app.reports ...   ├─▶ app/reports/digest.py  ──▶ app/reports/mailer.py ──▶ Resend
POST /api/subscriptions    ─┤        │                                              │
POST /api/reports/run      ─┘        └──────────────▶ report_sends (audit row) ◀────┘
```

- `app/services/market_view.py`: demand and skills calculations, shared with `GET /api/demand` and `/api/skills`,
  so the briefing and the dashboard can never disagree.
- `app/reports/digest.py`: builds the `Digest` (subject, sections, bullets with sources, plain text).
- `app/reports/mailer.py`: sends through the Resend HTTP API (`POST https://api.resend.com/emails`) with stdlib
  `urllib`; no extra dependency. Without `RESEND_API_KEY` the send is a recorded dry run.
- `app/reports/subscriptions.py`: storage, rate limits, due dates, the send itself.
- `app/reports/__main__.py`: the cron entry point.

## Subscribing

`POST /api/subscriptions` with `email`, `roleIds`, `includePolicy`, `includeTargetGroup`, `cadence`
(`weekly` | `monthly`). The address is lower-cased and upserted, so subscribing again changes topics instead of
creating a duplicate. The first briefing is sent immediately, which is the moment the subscriber sees the format.

Limits (protect the Resend quota, a public endpoint):

| Limit | Value |
|---|---|
| one send per address | max. 1 per 60 seconds |
| one address per day | max. 5 sends |
| whole deployment per day | `REPORTS_DAILY_CAP` (default 100) |
| behaviour when exceeded | `429` with a plain message |

If Resend rejects the mail, the subscription is kept, `sent: false` and the provider message are returned, and the
error is stored — the subscriber can fix the address or the operator can fix the domain.

## When it sends

`python -m app.reports run --due` is the cron entry point (Railway: a second service from the same image with this
start command). Due-ness is compared in `REPORT_TIMEZONE` (default `Europe/Zurich`):

- **weekly**: `last_sent_at` is in an earlier ISO week (or empty). Monday is the intended day; if the Monday run is
  missed, the next run catches up instead of skipping a week.
- **monthly**: `last_sent_at` is in an earlier calendar month.

After a successful or dry-run send `last_sent_at` is written, so running the command twice in the same period sends
once. `--no-due` sends every active subscription (use deliberately).

## Unsubscribing

Every e-mail carries `List-Unsubscribe` and a one-line link to
`GET /api/reports/unsubscribe?token=<unsubscribe_token>`. The link works without login and deletes the
subscription **and** its `report_sends` rows, so the address leaves the database with it.

## Personal data

The e-mail address is the only personal datum in the system. It is stored only to deliver the briefing, is never
returned by a read endpoint, and disappears on unsubscribe. The market data itself stays aggregate: no names, no
individuals, no applications. `report_sends.digest` keeps the exact text that left the server, so the team can check
what was sent even if the inbox is gone.

## Optional: AI polish with a guardrail

Set `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` (OpenAI-compatible) to have the wording of each bullet rewritten
in plainer language. The model must return one sentence per bullet together with the id of the source it is based
on; the code rejects unknown ids and falls back to the template on any error. Citations are appended afterwards, so
a hallucinated URL cannot reach an inbox. Without the three variables the briefing is fully deterministic —
this is the default, and it is what the demo runs on.

## Resend setup (5 minutes)

1. Create an API key at resend.com and set `RESEND_API_KEY`.
2. Set `REPORT_FROM` to a verified sender. **Without a verified domain Resend only delivers to the account owner's
   address** — for a hackathon demo either verify a domain or use that address as the demo recipient.
3. Set `PUBLIC_BASE_URL` (e.g. `https://radar.example.ch`) so unsubscribe and dashboard links are absolute.
4. Optional: `REPORT_REPLY_TO`.
5. Test: `POST /api/reports/preview` (no mail), then subscribe yourself and check the inbox and `report_sends`.

## Local check without a provider

```sh
cd backend
DATABASE_URL='postgresql:///market_radar' .venv/bin/python -m app.reports preview --role it-support
DATABASE_URL='postgresql:///market_radar' .venv/bin/python -m app.reports run --due
```

Without `RESEND_API_KEY` the run prints `dry_run` per subscription and writes the same audit row with
`status = 'dry_run'` — the full flow can be demonstrated offline.
