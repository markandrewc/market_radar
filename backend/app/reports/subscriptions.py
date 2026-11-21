"""Subscriptions, due dates, rate limits and the actual send of one briefing.

One code path for the public subscribe endpoint and the cron run (`POST
/api/reports/run`, `python -m app.reports run`), so "sent once per ISO week" holds
for both. Every attempt is written to `report_sends`: the exact text and sources
that left the server, so the team can audit it. Without RESEND_API_KEY nothing is
delivered and the attempt is stored as `dry_run`.
"""
from __future__ import annotations

import secrets
import urllib.parse
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb

from .. import config
from ..db import Conn
from ..schemas import Digest, DigestRequest, RunRequest, RunResult, SendOutcome, SubscribeBody
from . import digest as digest_service
from . import mailer

SUCCESS_STATUSES = ("sent", "dry_run")
PER_ADDRESS_PER_MINUTE = 60          # seconds between two sends to the same address
PER_ADDRESS_PER_DAY = 5              # briefings per address per local calendar day
_MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December")


class RateLimited(Exception):
    """A limit from docs/api.md would be exceeded; the router answers 429. Nothing is sent."""


class UnknownSubscription(ValueError):
    """The requested subscription id does not exist (run endpoint: 404)."""


@dataclass
class SendAttempt:
    status: Literal["sent", "dry_run", "error"]
    subject: str
    digest: Digest
    provider_id: str | None = None
    error: str | None = None
    detail: str | None = None


# --- helpers ------------------------------------------------------------------

def _utc(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(timezone.utc)
    return now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)


def _local(value: datetime) -> datetime:
    return value.astimezone(ZoneInfo(config.REPORT_TIMEZONE))


def is_due(subscription: dict, now: datetime | None = None) -> bool:
    """ISO-week (weekly) / calendar-month (monthly) comparison in REPORT_TIMEZONE.

    A missed cron run catches up on the next run: any earlier week/month is due.
    """
    last_sent = subscription.get("last_sent_at")
    if last_sent is None:
        return True
    local_now = _local(_utc(now))
    local_last = _local(last_sent)
    if subscription["cadence"] == "monthly":
        return (local_last.year, local_last.month) < (local_now.year, local_now.month)
    return local_last.isocalendar()[:2] < local_now.isocalendar()[:2]


def next_run(cadence: str, now: datetime | None = None) -> str:
    """YYYY-MM-DD of the next planned send after today (weekly: next Monday, monthly: 1st)."""
    local = _local(_utc(now))
    if cadence == "monthly":
        first = local.date().replace(day=1)
        return (date(first.year + 1, 1, 1) if first.month == 12 else date(first.year, first.month + 1, 1)).isoformat()
    days = 7 - local.weekday() or 7  # next Monday, never today
    return (local.date() + timedelta(days=days)).isoformat()


def unsubscribe_url_for(token: str) -> str:
    path = f"/api/reports/unsubscribe?token={urllib.parse.quote(token, safe='')}"
    return f"{config.PUBLIC_BASE_URL}{path}"


def _day_start_utc(now: datetime) -> datetime:
    local = _local(now)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


# --- storage ------------------------------------------------------------------

def _require_known_roles(conn: Conn, role_ids: list[str]) -> None:
    known = {row["id"] for row in conn.execute("SELECT id FROM roles")}
    unknown = [role_id for role_id in role_ids if role_id not in known]
    if unknown:
        raise ValueError("Unknown role: " + ", ".join(unknown))


def upsert_subscription(conn: Conn, body: SubscribeBody) -> dict:
    """Lower-cased e-mail, one row per address: subscribing again updates the topics.

    The id and the unsubscribe token stay stable, so a second subscribe never
    invalidates a previously mailed footer.
    """
    if not (body.roleIds or body.includePolicy or body.includeTargetGroup):
        raise ValueError("Choose at least one topic: a role, Policy watch or Target group.")
    role_ids = list(dict.fromkeys(body.roleIds))
    _require_known_roles(conn, role_ids)
    email = body.email.strip().lower()
    row = conn.execute(
        """INSERT INTO report_subscriptions
               (id, email, role_ids, include_policy, include_target_group, cadence, active, unsubscribe_token)
           VALUES (%s, %s, %s, %s, %s, %s, true, %s)
           ON CONFLICT (lower(email)) DO UPDATE SET
               email = EXCLUDED.email, role_ids = EXCLUDED.role_ids,
               include_policy = EXCLUDED.include_policy, include_target_group = EXCLUDED.include_target_group,
               cadence = EXCLUDED.cadence, active = true
           RETURNING *""",
        (f"sub_{secrets.token_urlsafe(12)}", email, role_ids, body.includePolicy, body.includeTargetGroup,
         body.cadence, secrets.token_urlsafe(24))).fetchone()
    return row


def get_by_token(conn: Conn, token: str) -> dict | None:
    return conn.execute("SELECT * FROM report_subscriptions WHERE unsubscribe_token = %s", (token,)).fetchone()


def delete_by_token(conn: Conn, token: str) -> bool:
    """Deletes the subscription; report_sends rows go with it (ON DELETE CASCADE)."""
    deleted = conn.execute("DELETE FROM report_subscriptions WHERE unsubscribe_token = %s", (token,)).rowcount
    return bool(deleted)


def due_subscriptions(conn: Conn, now: datetime | None = None, due_only: bool = True) -> list[dict]:
    now = _utc(now)
    rows = conn.execute(
        "SELECT * FROM report_subscriptions WHERE active ORDER BY created_at, id").fetchall()
    return [row for row in rows if not due_only or is_due(row, now)]


def _subscription(conn: Conn, subscription_id: str) -> dict:
    row = conn.execute("SELECT * FROM report_subscriptions WHERE id = %s", (subscription_id,)).fetchone()
    if not row:
        raise UnknownSubscription(f"Unknown subscription: {subscription_id}")
    return row


# --- rate limits --------------------------------------------------------------

def check_rate_limits(conn: Conn, email: str, now: datetime | None = None) -> None:
    """1 per address per minute, 5 per address per day, REPORTS_DAILY_CAP for the deployment."""
    now = _utc(now)
    last = conn.execute(
        "SELECT max(sent_at) AS last FROM report_sends WHERE lower(email) = %s", (email.lower(),)).fetchone()["last"]
    if last is not None and (now - _utc(last)).total_seconds() < PER_ADDRESS_PER_MINUTE:
        raise RateLimited("One briefing per address per minute; please try again shortly.")
    day_start = _day_start_utc(now)
    day_count = conn.execute(
        """SELECT count(*) AS n FROM report_sends
           WHERE lower(email) = %s AND sent_at >= %s AND status = ANY(%s)""",
        (email.lower(), day_start, list(SUCCESS_STATUSES))).fetchone()["n"]
    if day_count >= PER_ADDRESS_PER_DAY:
        raise RateLimited(f"At most {PER_ADDRESS_PER_DAY} briefings per address per day; "
                          "please try again tomorrow.")
    total = conn.execute(
        "SELECT count(*) AS n FROM report_sends WHERE sent_at >= %s AND status = ANY(%s)",
        (day_start, list(SUCCESS_STATUSES))).fetchone()["n"]
    if total >= config.REPORTS_DAILY_CAP:
        raise RateLimited("The daily briefing limit of this deployment is reached; nothing was sent. "
                          "Please try again tomorrow.")


# --- sending ------------------------------------------------------------------

def _store_send(conn: Conn, subscription: dict, now: datetime, status: str, subject: str, digest: Digest,
                provider_id: str | None, error: str | None) -> None:
    conn.execute(
        """INSERT INTO report_sends
               (subscription_id, email, sent_at, status, subject, digest, sources, provider_id, error)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (subscription["id"], subscription["email"], now, status, subject, digest.text,
         Jsonb([source.model_dump() for source in digest.sources]), provider_id, error))


def send_briefing(conn: Conn, subscription: dict, now: datetime | None = None) -> SendAttempt:
    """Build, rate-check, send and record one briefing. Raises RateLimited (nothing sent/stored) or ValueError."""
    now = _utc(now)
    request = DigestRequest(roleIds=list(subscription["role_ids"] or []),
                            includePolicy=subscription["include_policy"],
                            includeTargetGroup=subscription["include_target_group"])
    try:
        digest = digest_service.build_digest(conn, request, now=now)
    except ValueError as exc:  # e.g. a role was deleted after subscribing
        conn.execute("UPDATE report_subscriptions SET last_error = %s WHERE id = %s",
                     (str(exc), subscription["id"]))
        raise
    subject = digest.subject
    if subscription["cadence"] == "monthly":
        local = _local(now)
        subject = f"Market Radar: monthly briefing, {_MONTHS[local.month - 1]} {local.year}"
    check_rate_limits(conn, subscription["email"], now)
    unsubscribe_url = unsubscribe_url_for(subscription["unsubscribe_token"])
    html = mailer.render_html(digest, unsubscribe_url)

    provider_id: str | None = None
    error: str | None = None
    if mailer.configured():
        try:
            provider_id = mailer.send_email(subscription["email"], subject, digest.text, html,
                                            unsubscribe_url)
            status: Literal["sent", "dry_run", "error"] = "sent"
        except mailer.MailerError as exc:
            status, error = "error", str(exc)
    else:
        status = "dry_run"  # nothing delivered; recorded so the cron run is still auditable

    _store_send(conn, subscription, now, status, subject, digest, provider_id, error)
    if status == "error":
        conn.execute("UPDATE report_subscriptions SET last_error = %s WHERE id = %s", (error, subscription["id"]))
    else:
        conn.execute("UPDATE report_subscriptions SET last_sent_at = %s, last_error = NULL WHERE id = %s",
                     (now, subscription["id"]))
    detail = "Dry run: RESEND_API_KEY is not set, nothing was delivered." if status == "dry_run" else error
    return SendAttempt(status=status, subject=subject, digest=digest, provider_id=provider_id, error=error,
                       detail=detail)


def run(conn: Conn, request: RunRequest, now: datetime | None = None) -> RunResult:
    """The send run behind POST /api/reports/run and `python -m app.reports run`."""
    now = _utc(now)
    if request.subscriptionId:
        subscription = _subscription(conn, request.subscriptionId)
        candidates = [subscription] if subscription["active"] else []
    else:
        candidates = due_subscriptions(conn, now, request.dueOnly)
    result = RunResult()
    for subscription in candidates:
        base = {"subscriptionId": subscription["id"], "email": subscription["email"]}
        if request.dueOnly and not is_due(subscription, now):
            result.skipped += 1
            result.results.append(SendOutcome(status="skipped", detail="Not due in this week/month.", **base))
            continue
        try:
            attempt = send_briefing(conn, subscription, now)
        except RateLimited as exc:
            result.skipped += 1
            result.results.append(SendOutcome(status="skipped", detail=str(exc), **base))
        except ValueError as exc:
            result.failed += 1
            result.results.append(SendOutcome(status="error", detail=str(exc), **base))
        else:
            if attempt.status == "error":
                result.failed += 1
            else:
                result.sent += 1
            result.results.append(SendOutcome(status=attempt.status, detail=attempt.detail, **base))
    return result
