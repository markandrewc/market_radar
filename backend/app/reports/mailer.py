"""Resend delivery (stdlib only) and the HTML version of a digest.

`send_email` POSTs to https://api.resend.com/emails. Without RESEND_API_KEY it does
not call anything (`configured()` is the dry-run signal); the subscription layer then
records the send as `dry_run`. A non-2xx answer raises `MailerError` carrying the
provider's message, so the caller can store it verbatim.

`render_html` escapes every source-controlled string (bullet text, source names,
URLs, headings, notes) with html.escape, because market_items summaries and feed
titles are external data.
"""
from __future__ import annotations

import html as html_lib
import json
import urllib.error
import urllib.request

from .. import config
from ..schemas import Digest, DigestSection, SourceRef

RESEND_URL = "https://api.resend.com/emails"
TIMEOUT = 15
PROVIDER = "resend"


class MailerError(Exception):
    """The provider refused the mail or could not be reached. The message is safe to show/store."""


def configured() -> bool:
    """True when a provider key exists. False = record the send as a dry run, deliver nothing."""
    return bool(config.RESEND_API_KEY)


def send_email(to: str, subject: str, text: str, html: str, unsubscribe_url: str) -> str | None:
    """Send one briefing. Returns the provider message id (or None); raises MailerError on failure."""
    if not configured():  # dry run: no network call at all
        return None
    payload = {
        "from": config.REPORT_FROM,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
        "headers": {
            "List-Unsubscribe": f"<{unsubscribe_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    }
    if config.REPORT_REPLY_TO:
        payload["reply_to"] = [config.REPORT_REPLY_TO]
    request = urllib.request.Request(
        RESEND_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 - fixed provider URL
            body = response.read()
    except urllib.error.HTTPError as exc:
        message = _provider_message(exc.read(), str(exc))
        raise MailerError(f"{PROVIDER} rejected the mail ({exc.code}): {message}") from exc
    except urllib.error.URLError as exc:
        raise MailerError(f"Could not reach {PROVIDER}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise MailerError(f"{PROVIDER} did not answer within {TIMEOUT} s.") from exc
    try:
        data = json.loads(body)
    except (TypeError, ValueError):
        return None
    provider_id = data.get("id") if isinstance(data, dict) else None
    return str(provider_id) if provider_id else None


def _provider_message(body: bytes, fallback: str) -> str:
    try:
        data = json.loads(body)
    except (TypeError, ValueError):
        return fallback
    if isinstance(data, dict):
        for key in ("message", "error", "name"):
            value = data.get(key)
            if isinstance(value, str) and value:
                return value
    return fallback


# --- HTML ---------------------------------------------------------------------

def _esc(value: object) -> str:
    return html_lib.escape("" if value is None else str(value), quote=True)


def _source_line(source: SourceRef) -> str:
    data_as_of = source.dataAsOf or "not stated"
    retrieved = (source.fetchedAt or "")[:10] or "not stated"
    url = _esc(source.url)
    return (f"<p class=\"source\">— {_esc(source.name)}, data as of {_esc(data_as_of)}, "
            f"retrieved {_esc(retrieved)}: <a href=\"{url}\">{url}</a></p>")


def _section_html(section: DigestSection) -> str:
    rows = []
    for bullet in section.bullets:
        rows.append(f"<li><p>{_esc(bullet.text)}</p>{_source_line(bullet.source)}</li>")
    bullet_html = f"<ul>{''.join(rows)}</ul>" if rows else ""
    note = ""
    if section.note:
        note = f"<p class=\"note\"><em>Our reading, not the source:</em> {_esc(section.note)}</p>"
    return f"<section><h2>{_esc(section.heading)}</h2>{bullet_html}{note}</section>"


def render_html(digest: Digest, unsubscribe_url: str) -> str:
    """Escaped HTML version of the digest, built from the same bullets and citations."""
    if digest.empty:
        body = "".join(f"<p>{_esc(paragraph)}</p>"
                       for paragraph in digest.text.split("\n\n") if paragraph.strip())
    else:
        body = "".join(_section_html(section) for section in digest.sections)
    sources_url = f"{config.PUBLIC_BASE_URL}/sources" if config.PUBLIC_BASE_URL else "/sources"
    return (
        "<!DOCTYPE html>\n"
        "<html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<title>{_esc(digest.subject)}</title></head>"
        "<body style=\"font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px\">\n"
        f"<h1 style=\"font-size:20px\">{_esc(digest.subject)}</h1>\n"
        f"<p style=\"color:#666;font-size:12px\">Generated {_esc(digest.generatedAt)}.</p>\n"
        f"{body}\n"
        "<hr style=\"border:none;border-top:1px solid #ddd;margin:24px 0\">\n"
        "<p style=\"font-size:12px;color:#666\">Market Radar · "
        f"<a href=\"{_esc(sources_url)}\">Sources</a> · "
        f"<a href=\"{_esc(unsubscribe_url)}\">Unsubscribe</a></p>\n"
        "</body></html>"
    )
