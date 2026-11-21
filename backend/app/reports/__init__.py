"""Level 2: e-mailed briefings (docs/api.md, "Briefings (Level 2)").

    digest        build_digest(conn, DigestRequest, now=None) -> Digest
    mailer        render_html(digest, unsubscribe_url) / send_email(...) via Resend
    subscriptions upsert, due dates, rate limits, send_briefing, run

The router (app/routers/reports.py) and the cron CLI (`python -m app.reports`) are
thin wrappers around these modules; the queries behind the numbers live in
app/services/market_view.py, shared with the dashboard endpoints.
"""
from . import digest, mailer, subscriptions

__all__ = ["digest", "mailer", "subscriptions"]
