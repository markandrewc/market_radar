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
python -m app.reports ...   ├─▶ app/reports/digest.py  ──▶ app/reports/mailer.py ──▶ provider
POST /api/subscriptions    ─┤        │                                              │
POST /api/reports/run      ─┘        └──────────────▶ report_sends (audit row) ◀────┘
```

- `app/services/market_view.py`: demand and skills calculations, shared with `GET /api/demand` and `/api/skills`,
  so the briefing and the dashboard can never disagree.
- `app/reports/digest.py`: builds the `Digest` (subject, sections, bullets with sources, plain text).
- `app/reports/mailer.py`: sends through one of three providers with stdlib only — **Brevo** transactional API
  (`POST https://api.brevo.com/v3/smtp/email`, header `api-key`), **SMTP** (any relay, e.g.
  `smtp-relay.brevo.com:587`) or **Resend** (`POST https://api.resend.com/emails`). Without credentials the send
  is a recorded dry run. The provider actually used is stored in `report_sends.provider`.
- `app/reports/subscriptions.py`: storage, rate limits, due dates, the send itself.
- `app/reports/__main__.py`: the cron entry point.

## Subscribing

`POST /api/subscriptions` with `email`, `roleIds`, `includePolicy`, `includeTargetGroup`, `cadence`
(`weekly` | `monthly`). The address is lower-cased and upserted, so subscribing again changes topics instead of
creating a duplicate. The first briefing is sent immediately, which is the moment the subscriber sees the format.

Limits (protect the provider quota, a public endpoint):

| Limit | Value |
|---|---|
| one send per address | max. 1 per 60 seconds |
| one address per day | max. 5 sends |
| whole deployment per day | `REPORTS_DAILY_CAP` (default 100) |
| behaviour when exceeded | `429` with a plain message |

If the provider rejects the mail, the subscription is kept, `sent: false` and the provider message are returned,
and the error is stored — the subscriber can fix the address or the operator can fix the sender/domain. The
Reports page shows the message verbatim (amber state), so a Brevo sender problem is visible without server logs.

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

Set `LLM_PROVIDER`, `LLM_API_KEY` and (optionally) `LLM_MODEL` to have the wording of each bullet rewritten
in plainer language. The model must return one sentence per bullet together with the id of the source it is based
on; the code rejects unknown ids and falls back to the template on any error. Citations are appended afterwards, so
a hallucinated URL cannot reach an inbox. Without the three variables the briefing is fully deterministic —
this is the default, and it is what the demo runs on.

## Choosing the provider

One provider per deployment. `MAIL_PROVIDER` selects it explicitly; otherwise the first configured one wins:
**brevo** (`BREVO_API_KEY`) → **resend** (`RESEND_API_KEY`) → **smtp** (`SMTP_HOST`). With none of them every
attempt is a `dry_run` in `report_sends`.

### Brevo (recommended)

1. In Brevo: **Senders & IP → Senders** — add and verify the sender address you want to send from.
2. **Settings → API keys** — create a key and set `BREVO_API_KEY` (starts with `xkeysib-`).
3. Set `REPORT_FROM` to that verified address, e.g. `Market Radar <radar@your-domain.ch>`. The Resend demo
   default (`onboarding@resend.dev`) is rejected by Brevo with a clear error: set a real sender.
4. Set `PUBLIC_BASE_URL` so unsubscribe and dashboard links are absolute.
5. Optional: `REPORT_REPLY_TO`. If a test still fails, `report_sends.error` contains Brevo's own message
   (e.g. `sender not valid`, `unauthorized`); the Reports page shows it too.

Brevo's API is called with `sender {name,email}`, `to`, `subject`, `htmlContent`, `textContent`, the
`List-Unsubscribe` headers and `replyTo`. The provider returns a `messageId`, stored as `provider_id`.

### Brevo SMTP relay (or any SMTP)

Set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` and `SMTP_PASSWORD` (Brevo: SMTP & API →
SMTP keys), `SMTP_STARTTLS=1` (default). `MAIL_PROVIDER=smtp` is optional — a host is enough for auto-detection.
`REPORT_FROM` must still be a verified sender.

### Resend

`RESEND_API_KEY` + `REPORT_FROM` from a verified domain. Without a verified domain Resend only delivers to the
account owner's address — for a hackathon demo verify a domain or use that address as the recipient.

### Checking a send

`POST /api/reports/preview` renders the text without sending. Subscribing yourself sends the first briefing;
then look at `GET /api/sources` for feed health and `report_sends` (status, provider, provider_id, error) for the
delivery result.

## Local check without a provider

```sh
cd backend
DATABASE_URL='postgresql:///market_radar' .venv/bin/python -m app.reports preview --role it-support
DATABASE_URL='postgresql:///market_radar' .venv/bin/python -m app.reports run --due
```

Without `RESEND_API_KEY` the run prints `dry_run` per subscription and writes the same audit row with
`status = 'dry_run'` — the full flow can be demonstrated offline.
