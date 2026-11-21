"""Mail delivery (stdlib only) and the HTML version of a digest.

Providers: **brevo** (transactional HTTP API), **smtp** (any relay, including
Brevo's SMTP relay) and **resend**. `MAIL_PROVIDER` selects one explicitly;
without it the first configured provider wins (brevo → resend → smtp). With no
credentials at all `configured()` is False and the subscription layer records a
dry run instead of calling anything.

A provider error raises `MailerError` carrying the provider's own message, so the
Reports page and `report_sends` can show exactly why a mail was rejected.

The HTML renderer escapes every source-controlled string (bullet text, source
names, URLs, headings, notes) because market_items summaries and feed titles are
external data.
"""
from __future__ import annotations

import html as html_lib
import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import parseaddr

from .. import config
from ..schemas import Digest, DigestSection, SourceRef

RESEND_URL = "https://api.resend.com/emails"
BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT = 15
PROVIDERS = ("brevo", "resend", "smtp")


class MailerError(Exception):
    """The provider refused the mail or could not be reached. The message is safe to show/store."""


def _ready(provider: str) -> bool:
    if provider == "brevo":
        return bool(config.BREVO_API_KEY)
    if provider == "resend":
        return bool(config.RESEND_API_KEY)
    if provider == "smtp":
        return bool(config.SMTP_HOST)
    return False


def provider() -> str | None:
    """The mail provider in use: MAIL_PROVIDER when set, else the first configured one."""
    explicit = (config.MAIL_PROVIDER or "").strip().lower()
    if explicit in PROVIDERS:
        return explicit if _ready(explicit) else None
    for candidate in PROVIDERS:
        if _ready(candidate):
            return candidate
    return None


def provider_name() -> str:
    return provider() or "none"


def configured() -> bool:
    """True when a provider is ready. False = record the send as a dry run, deliver nothing."""
    return provider() is not None


def _sender() -> tuple[str, str]:
    name, email = parseaddr(config.REPORT_FROM or "")
    if not email or "@" not in email:
        raise MailerError(
            'REPORT_FROM must name a sender address, e.g. "Market Radar <radar@example.org>".')
    return name.strip(), email.strip()


def _post_json(url: str, payload: dict, headers: dict[str, str], label: str) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 - fixed provider URL
            body = response.read()
    except urllib.error.HTTPError as exc:
        message = _provider_message(exc.read(), str(exc))
        raise MailerError(f"{label} rejected the mail ({exc.code}): {message}") from exc
    except urllib.error.URLError as exc:
        raise MailerError(f"Could not reach {label}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise MailerError(f"{label} did not answer within {TIMEOUT} s.") from exc
    try:
        data = json.loads(body)
    except (TypeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _headers(unsubscribe_url: str) -> dict[str, str]:
    return {
        "List-Unsubscribe": f"<{unsubscribe_url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


def send_email(to: str, subject: str, text: str, html: str, unsubscribe_url: str) -> str | None:
    """Send one briefing. Returns the provider message id (or None); raises MailerError on failure."""
    active = provider()
    if active is None:  # dry run: no network call at all
        return None
    if active == "brevo":
        return _send_brevo(to=to, subject=subject, text=text, html=html, unsubscribe_url=unsubscribe_url)
    if active == "smtp":
        return _send_smtp(to=to, subject=subject, text=text, html=html, unsubscribe_url=unsubscribe_url)
    return _send_resend(to=to, subject=subject, text=text, html=html, unsubscribe_url=unsubscribe_url)


def _send_resend(*, to: str, subject: str, text: str, html: str, unsubscribe_url: str) -> str | None:
    payload = {
        "from": config.REPORT_FROM,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
        "headers": _headers(unsubscribe_url),
    }
    if config.REPORT_REPLY_TO:
        payload["reply_to"] = [config.REPORT_REPLY_TO]
    data = _post_json(RESEND_URL, payload, {"Authorization": f"Bearer {config.RESEND_API_KEY}"}, "resend")
    provider_id = data.get("id")
    return str(provider_id) if provider_id else None


def _send_brevo(*, to: str, subject: str, text: str, html: str, unsubscribe_url: str) -> str | None:
    name, email = _sender()
    if email.endswith("@resend.dev"):
        raise MailerError(
            "REPORT_FROM still points at the Resend demo sender. Brevo only sends from a verified "
            "sender address in your Brevo account — set REPORT_FROM to it.")
    payload = {
        "sender": {"email": email, **({"name": name} if name else {})},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
        "headers": _headers(unsubscribe_url),
    }
    if config.REPORT_REPLY_TO:
        payload["replyTo"] = {"email": config.REPORT_REPLY_TO}
    data = _post_json(BREVO_URL, payload,
                      {"api-key": config.BREVO_API_KEY or "", "Accept": "application/json"}, "brevo")
    provider_id = data.get("messageId") or data.get("messageIds")
    return str(provider_id) if provider_id else None


def _send_smtp(*, to: str, subject: str, text: str, html: str, unsubscribe_url: str) -> str | None:
    _sender()  # validate REPORT_FROM, even though the header may carry a display name
    message = EmailMessage()
    message["From"] = config.REPORT_FROM
    message["To"] = to
    message["Subject"] = subject
    for key, value in _headers(unsubscribe_url).items():
        message[key] = value
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(config.SMTP_HOST or "", config.SMTP_PORT, timeout=TIMEOUT) as smtp:
            smtp.ehlo()
            if config.SMTP_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if config.SMTP_USER:
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD or "")
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise MailerError(f"smtp could not send the mail: {exc}") from exc
    return None


def _provider_message(body: bytes, fallback: str) -> str:
    try:
        data = json.loads(body)
    except (TypeError, ValueError):
        return fallback
    if isinstance(data, dict):
        for key in ("message", "error", "name", "code"):
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
