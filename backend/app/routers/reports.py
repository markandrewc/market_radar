"""Level 2: briefings, subscriptions and the send run (docs/api.md, "Briefings (Level 2)").

Thin HTTP layer: the digest is built in app/reports/digest.py, storage and sending
in app/reports/subscriptions.py. Public: preview, subscribe and unsubscribe.
Token-protected: run. No endpoint lists e-mail addresses; `report_sends` is an
audit table, not a read API.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from ..auth import require_token
from ..db import Conn, get_conn
from ..reports import digest as digest_service
from ..reports import subscriptions
from ..schemas import Digest, DigestRequest, RunRequest, RunResult, SubscribeBody, SubscribeResult

router = APIRouter()

_DRY_RUN = ("No mail provider is configured on the server (set BREVO_API_KEY, RESEND_API_KEY or SMTP_*): "
            "the briefing was recorded as a dry run and nothing was delivered.")

_UNSUBSCRIBED_PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Unsubscribed · Market Radar</title></head>
<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem">
<h1>You are unsubscribed</h1>
<p>Your e-mail address and the briefing history stored with it have been deleted.</p>
<p><a href="/">Back to Market Radar</a></p>
</body></html>"""

_UNKNOWN_TOKEN_PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Link not valid · Market Radar</title></head>
<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem">
<h1>This link is not valid</h1>
<p>This unsubscribe link is unknown or has already been used. If you still receive briefings,
reply to one of them and we will remove your address.</p>
<p><a href="/">Back to Market Radar</a></p>
</body></html>"""


@router.post("/reports/preview", response_model=Digest)
def preview(request: DigestRequest, conn: Conn = Depends(get_conn)) -> Digest:
    """Public preview of the briefing, no storage. An unknown role id answers 422."""
    try:
        return digest_service.build_digest(conn, request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/subscriptions", response_model=SubscribeResult)
def subscribe(body: SubscribeBody, conn: Conn = Depends(get_conn)) -> SubscribeResult:
    """Store the subscription and send the first briefing immediately.

    The address is lower-cased and upserted. The subscription is kept even when the
    provider rejects the mail: the answer is 200 with `sent: false` and the provider
    message in `error`; without a configured mail provider the attempt is a dry run.
    """
    try:
        # Check the public rate limits before storing anything: a 429 must not create a hidden subscription.
        subscriptions.check_rate_limits(conn, body.email)
    except subscriptions.RateLimited as exc:
        raise HTTPException(429, str(exc)) from exc
    try:
        subscription = subscriptions.upsert_subscription(conn, body)
    except ValueError as exc:  # no topic, or a role id that does not exist
        raise HTTPException(422, str(exc)) from exc
    try:
        attempt = subscriptions.send_briefing(conn, subscription)
    except subscriptions.RateLimited as exc:
        raise HTTPException(429, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    error = _DRY_RUN if attempt.status == "dry_run" else attempt.error
    return SubscribeResult(ok=True, sent=attempt.status == "sent", error=error,
                           nextRun=subscriptions.next_run(subscription["cadence"]),
                           unsubscribeUrl=subscriptions.unsubscribe_url_for(subscription["unsubscribe_token"]))


@router.post("/reports/run", response_model=RunResult, dependencies=[Depends(require_token)])
def run(request: RunRequest, conn: Conn = Depends(get_conn)) -> RunResult:
    """Send every due subscription (or all with `dueOnly: false`, or one `subscriptionId`)."""
    try:
        return subscriptions.run(conn, request)
    except subscriptions.UnknownSubscription as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/reports/unsubscribe", response_class=HTMLResponse)
def unsubscribe(token: str = Query(..., min_length=1), conn: Conn = Depends(get_conn)) -> HTMLResponse:
    """Delete the subscription and its report_sends rows; unknown/used token -> 404 HTML."""
    if not subscriptions.delete_by_token(conn, token):
        return HTMLResponse(_UNKNOWN_TOKEN_PAGE, status_code=404)
    return HTMLResponse(_UNSUBSCRIBED_PAGE)
