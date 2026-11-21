"""Level 2: digest, subscriptions, Resend mailer, cron run and unsubscribe (docs/api.md).

Runs against the real Postgres from TEST_DATABASE_URL; the provider is always
monkeypatched, so no network call leaves the test suite.
"""
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from psycopg.types.json import Jsonb

from app import config, db
from app.reports import __main__ as cli
from app.reports import digest, mailer, subscriptions
from app.schemas import DigestRequest
from conftest import TOKEN

BACKEND = Path(__file__).resolve().parents[1]
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@pytest.fixture(autouse=True)
def report_settings(monkeypatch):
    """Every test starts without a provider, without an LLM and with relative links."""
    monkeypatch.setattr(config, "RESEND_API_KEY", None)
    monkeypatch.setattr(config, "REPORT_FROM", "Market Radar <onboarding@resend.dev>")
    monkeypatch.setattr(config, "REPORT_REPLY_TO", None)
    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "")
    monkeypatch.setattr(config, "REPORTS_DAILY_CAP", 100)
    monkeypatch.setattr(config, "REPORT_TIMEZONE", "Europe/Zurich")
    monkeypatch.setattr(config, "LLM_BASE_URL", "")
    monkeypatch.setattr(config, "LLM_API_KEY", None)
    monkeypatch.setattr(config, "LLM_MODEL", None)


# --- seed helpers -------------------------------------------------------------

PERIODS = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]


def add_item(conn, *, source_id, item_id, category, title, summary="", metrics=None, url=None,
             source_name="Test source", source_url="https://example.org/source",
             published_at="2026-11-01T00:00:00Z", fetched_at="2026-11-21T08:00:00Z",
             tags=None, payload=None):
    conn.execute(
        """INSERT INTO market_items
               (source_id, id, category, categories, title, summary, metrics, payload, tags, region,
                source_name, source_url, url, published_at, fetched_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s)""",
        (source_id, item_id, category, [category], title, summary, Jsonb(metrics or {}),
         Jsonb(payload) if payload is not None else None, tags or [],
         source_name, source_url, url, published_at, fetched_at))


def seed():
    """Two demand series, skill rows for a full trend, five policy and four target-group items."""
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO sources (id, name, url, fetched_at, data_as_of, comparable_from)
               VALUES ('itboard-monthly', 'ITBoard · IT-Arbeitsmarkt Schweiz',
                       'https://www.itboard.ch/arbeitsmarkt', '2026-11-21T08:00:00Z', '2026-11-15', NULL)""")
        cur.execute("""INSERT INTO roles VALUES ('it-support', 'IT Support'), ('web', 'Web Developer'),
                                                   ('data', 'Data Analyst')""")
        observations = []
        for period, value in zip(PERIODS, [30, 35, 38, 40, 41]):
            observations.append(("itboard-monthly", "demand", "it-support", "", period, value, None))
        for period, value in zip(PERIODS, [80, 90, 100, 110, 120]):
            observations.append(("itboard-monthly", "demand", "web", "", period, value, None))
        skills = {
            "Windows": [50, 48, 46, 44, 40],           # top 5, falling
            "Active Directory": [30, 30, 30, 30, 30],  # top 5, stable
            "Kubernetes": [20, 20, 20, 20, 20],        # top 5, stable
            "SQL": [10, 12, 15, 18, 20],               # top 5, rising
            "Azure": [10, 11, 12, 13, 15],             # top 5, rising
            "Docker": [2, 4, 6, 8, 10],                # below top 5, rising -> included
            "Terraform": [12, 10, 8, 6, 4],            # below top 5, falling -> included
            "Linux": [1, 2, 3, 4, 5],                  # below top 5, rising -> included
            "React": [5, 5, 5, 5, 5],                  # below top 5, stable -> left out
        }
        for skill, values in skills.items():
            for period, value in zip(PERIODS, values):
                observations.append(("itboard-monthly", "skill", "it-support", skill, period, value, 100))
        for skill, values in {"React": [10, 12, 14, 16, 18], "Python": [30, 30, 30, 30, 30]}.items():
            for period, value in zip(PERIODS, values):
                observations.append(("itboard-monthly", "skill", "", skill, period, value, 200))
        cur.executemany("INSERT INTO observations VALUES (%s, %s, %s, %s, %s, %s, %s)", observations)
        for number in range(1, 7):  # six policy items: only the five newest belong in the digest
            add_item(conn, source_id="fedlex", item_id=f"policy-{number}", category="E",
                     title=f"Policy item {number}", summary=f"Summary of policy item {number}.",
                     source_name="Fedlex", source_url="https://www.fedlex.admin.ch/de/policy",
                     published_at=f"2026-11-{14 + number:02d}T00:00:00Z", fetched_at="2026-11-20T09:00:00Z")
        for number in range(1, 5):  # four target-group items, only the three newest are used
            add_item(conn, source_id="sem", item_id=f"target-{number}", category="D",
                     title=f"Target group item {number}", metrics={"gesuche": 100 * number, "quote": 3.2},
                     source_name="SEM", source_url="https://www.sem.admin.ch/de/asyl",
                     published_at=f"2026-11-{number:02d}T00:00:00Z", fetched_at="2026-11-20T09:00:00Z")


def counts():
    with db.connect() as conn:
        subscriptions_rows = conn.execute("SELECT * FROM report_subscriptions").fetchall()
        sends = conn.execute("SELECT * FROM report_sends ORDER BY id").fetchall()
    return subscriptions_rows, sends


def add_subscription(conn, sub_id="sub_test", email="due@example.org", role_ids=("it-support",),
                     cadence="weekly", last_sent_at=None, token=None, include_policy=True,
                     include_target_group=False, active=True):
    conn.execute(
        """INSERT INTO report_subscriptions
               (id, email, role_ids, include_policy, include_target_group, cadence, active,
                unsubscribe_token, last_sent_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (sub_id, email, list(role_ids), include_policy, include_target_group, cadence, active,
         token or f"tok_{sub_id}", last_sent_at))


def this_week_start() -> datetime:
    local = datetime.now(timezone.utc).astimezone(ZoneInfo("Europe/Zurich"))
    monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return monday.astimezone(timezone.utc)


def subscribe(client, **overrides):
    body = {"email": "team@powercoders.org", "roleIds": ["it-support"],
            "includePolicy": True, "includeTargetGroup": False, "cadence": "weekly"}
    body.update(overrides)
    return client.post("/api/subscriptions", json=body)


# --- digest -------------------------------------------------------------------

def test_digest_sections_have_a_cited_source_per_bullet(client):
    seed()
    answer = client.post("/api/reports/preview",
                         json={"roleIds": ["it-support"], "includePolicy": True, "includeTargetGroup": True})
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["empty"] is False
    assert [section["heading"] for section in body["sections"]] == \
        ["Demand", "Skills", "Policy watch", "Target group"]
    bullets = [bullet for section in body["sections"] for bullet in section["bullets"]]
    assert bullets, "the digest must contain bullets"
    for bullet in bullets:
        assert bullet["source"]["name"].strip()
        assert bullet["source"]["url"].startswith(("http://", "https://"))
        assert bullet["text"] in body["text"]
        assert f"— {bullet['source']['name']}, data as of " in body["text"]
    citations = [line for line in body["text"].splitlines() if line.startswith("  — ")]
    assert len(citations) == len(bullets)  # exactly one citation per bullet, appended by the backend
    assert body["sources"] and all(source["url"].startswith("https://") for source in body["sources"])
    assert ISO_DATE.match(body["generatedAt"][:10]) and body["generatedAt"].endswith("Z")
    assert counts() == ([], [])  # preview stores nothing

    demand = body["sections"][0]["bullets"]
    assert len(demand) == 1  # only the selected role, the role without data is not invented as 0
    assert "IT Support" in demand[0]["text"] and "41 postings in November 2026" in demand[0]["text"]
    assert "2.5 % more than in October 2026" in demand[0]["text"]
    assert re.search(r"Trend: (rising|falling|stable)\.", demand[0]["text"])
    assert demand[0]["source"]["dataAsOf"] == "2026-11-15"
    assert demand[0]["source"]["fetchedAt"] == "2026-11-21T08:00:00Z"

    policy = body["sections"][2]["bullets"]
    assert len(policy) == 5  # max 5, newest first
    assert policy[0]["text"].startswith("Policy item 6") and policy[0]["source"]["dataAsOf"] == "2026-11-20"
    assert all("Policy item 1" not in bullet["text"] for bullet in policy)
    target = body["sections"][3]["bullets"]
    assert len(target) == 3  # max 3
    assert all("gesuche:" in bullet["text"] and "quote:" in bullet["text"] for bullet in target)


def test_skills_section_follows_the_selection_rule(client):
    seed()
    one = client.post("/api/reports/preview",
                      json={"roleIds": ["it-support"], "includePolicy": False, "includeTargetGroup": False}).json()
    skills = next(section for section in one["sections"] if section["heading"] == "Skills")["bullets"]
    texts = " ".join(bullet["text"] for bullet in skills)
    assert "IT Support postings" in texts and "Windows" in texts
    assert "Docker" in texts and "Terraform" in texts  # rising/falling below the top five are added
    assert "React" not in texts  # stable and below the top five: not reported

    many = client.post("/api/reports/preview",
                       json={"roleIds": ["it-support", "web"], "includePolicy": False,
                             "includeTargetGroup": False}).json()
    all_roles = " ".join(bullet["text"] for section in many["sections"] if section["heading"] == "Skills"
                         for bullet in section["bullets"])
    assert "all postings" in all_roles and "React" in all_roles and "Windows" not in all_roles

    skipped = client.post("/api/reports/preview",
                          json={"roleIds": ["data"], "includePolicy": False, "includeTargetGroup": False}).json()
    assert skipped["empty"] is True and "Data Analyst" not in skipped["text"]


def test_empty_database_gives_a_valid_empty_digest(client, monkeypatch):
    answer = client.post("/api/reports/preview", json={})
    assert answer.status_code == 200
    body = answer.json()
    assert body["empty"] is True and body["sections"] == [] and body["sources"] == []
    assert "/sources" in body["text"] and body["subject"]
    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "https://radar.example.ch")
    with db.connect() as conn:
        digest_body = digest.build_digest(conn, DigestRequest())
    assert digest_body.empty is True
    assert "https://radar.example.ch/sources" in digest_body.text


def test_preview_rejects_unknown_role_and_invalid_topic(client):
    seed()
    unknown = client.post("/api/reports/preview", json={"roleIds": ["no-such-role"]})
    assert unknown.status_code == 422 and "Unknown role" in unknown.json()["detail"]
    invalid = client.post("/api/reports/preview", json={"roleIds": "it-support"})
    assert invalid.status_code == 422


def test_employers_section_reuses_the_employers_aggregation(client):
    """The Employers section reuses app/services/employers.py (category-C postings, aggregate only)."""
    seed()
    with db.connect() as conn:
        for number, company in enumerate(["Swisscom", "Swisscom", "PostFinance"], start=1):
            add_item(conn, source_id="adzuna_ch", item_id=f"job-{number}", category="C",
                     title="IT Support Specialist", summary="Windows und Active Directory",
                     payload={"company": {"display_name": company}, "description": "Windows Active Directory SQL"},
                     tags=["role:IT Support"], source_name="Adzuna Stellenmarkt Schweiz",
                     source_url="https://developer.adzuna.com/", url=f"https://adzuna.ch/ad/{number}",
                     published_at=f"2026-11-1{number}T00:00:00Z")
    body = client.post("/api/reports/preview",
                       json={"roleIds": ["it-support"], "includePolicy": False,
                             "includeTargetGroup": False}).json()
    assert [section["heading"] for section in body["sections"]] == ["Demand", "Skills", "Employers"]
    employers = body["sections"][-1]["bullets"]
    assert employers[0]["text"].startswith("Swisscom: 2 open posting(s) for IT Support")
    assert employers[1]["text"].startswith("PostFinance: 1 open posting(s) for IT Support")
    assert all(bullet["source"]["url"].startswith("https://") for bullet in employers)
    assert "— Adzuna Stellenmarkt Schweiz, data as of 2026-11-13" in body["text"]
    # one bullet per employer is not counted as policy/target data for emptiness, but the digest is full here
    assert body["empty"] is False


# --- mailer -------------------------------------------------------------------

class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.payload


def test_send_email_posts_the_resend_payload(monkeypatch):
    monkeypatch.setattr(config, "RESEND_API_KEY", "re_key")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["body"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        captured["headers"] = {key.lower(): value for key, value in request.header_items()}
        return FakeResponse(b'{"id": "prov_1"}')

    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    provider_id = mailer.send_email("team@x.ch", "Subject", "text body", "<p>html</p>", "https://x.ch/u?t=1")
    assert provider_id == "prov_1"
    assert captured["url"] == "https://api.resend.com/emails" and captured["timeout"] == 15
    body = captured["body"]
    assert body["from"] and body["to"] == ["team@x.ch"] and body["subject"] == "Subject"
    assert body["text"] == "text body" and body["html"] == "<p>html</p>"
    assert body["headers"]["List-Unsubscribe"] == "<https://x.ch/u?t=1>"
    assert body["headers"]["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert captured["headers"]["authorization"] == "Bearer re_key"


def test_send_email_dry_run_without_key_and_provider_error(monkeypatch):
    def no_call(*args, **kwargs):
        raise AssertionError("no network call without RESEND_API_KEY")

    monkeypatch.setattr(mailer.urllib.request, "urlopen", no_call)
    assert mailer.configured() is False
    assert mailer.send_email("team@x.ch", "Subject", "text", "<p>html</p>", "/u") is None

    monkeypatch.setattr(config, "RESEND_API_KEY", "re_key")

    def failing(*args, **kwargs):
        raise urllib.error.HTTPError("https://api.resend.com/emails", 403, "Forbidden", {},
                                     io.BytesIO(b'{"message": "domain not verified"}'))

    monkeypatch.setattr(mailer.urllib.request, "urlopen", failing)
    with pytest.raises(mailer.MailerError) as error:
        mailer.send_email("team@x.ch", "Subject", "text", "<p>html</p>", "/u")
    assert "domain not verified" in str(error.value)


def test_render_html_escapes_every_source_controlled_string(client):
    seed()
    with db.connect() as conn:
        add_item(conn, source_id="evil", item_id="evil-1", category="E",
                 title='<script>alert("x")</script>', summary='<img src=x onerror="alert(1)">',
                 source_name="Evil <Feed>", source_url="https://example.org/p?a=1&b=2",
                 published_at="2026-11-21T00:00:00Z")
        briefing = digest.build_digest(conn, DigestRequest(roleIds=["it-support"], includePolicy=True,
                                                           includeTargetGroup=False))
    html_body = mailer.render_html(briefing, "https://radar.example.ch/unsub?token=a&b=2")
    assert "<script>" not in html_body and "<img" not in html_body
    assert "&lt;script&gt;" in html_body and "&lt;img" in html_body
    assert "&amp;b=2" in html_body  # URLs are escaped in href and label
    assert "token=a&amp;b=2" in html_body


# --- subscribe ----------------------------------------------------------------

def test_subscribe_is_dry_run_upsert_and_rate_limited(client):
    seed()
    answer = subscribe(client, email="Team@PowerCoders.org")
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["ok"] is True and body["sent"] is False
    assert "dry run" in (body["error"] or "").lower() and "RESEND_API_KEY" in body["error"]
    assert ISO_DATE.match(body["nextRun"])
    assert "token=" in body["unsubscribeUrl"]
    subscriptions_rows, sends = counts()
    assert len(subscriptions_rows) == 1
    subscription = subscriptions_rows[0]
    assert subscription["email"] == "team@powercoders.org"  # lower-cased
    assert subscription["role_ids"] == ["it-support"] and subscription["cadence"] == "weekly"
    assert body["unsubscribeUrl"].endswith(subscription["unsubscribe_token"])
    assert len(sends) == 1
    send = sends[0]
    assert send["status"] == "dry_run" and send["provider_id"] is None and send["error"] is None
    assert send["subject"] and "Demand" in send["digest"] and "  — " in send["digest"]
    assert send["sources"] and all(source["url"].startswith("https://") for source in send["sources"])
    assert subscription["last_sent_at"] is not None

    # the same address again within a minute -> 429, and no second subscription is created
    limited = subscribe(client, email="team@powercoders.org", roleIds=["web"])
    assert limited.status_code == 429
    subscriptions_rows, _ = counts()
    assert len(subscriptions_rows) == 1 and subscriptions_rows[0]["role_ids"] == ["it-support"]

    # outside the minute/day window the upsert updates the existing row and keeps id + token
    with db.connect() as conn:
        conn.execute("UPDATE report_sends SET sent_at = sent_at - interval '2 days'")
        conn.execute("UPDATE report_subscriptions SET last_sent_at = last_sent_at - interval '2 days'")
    updated = subscribe(client, email="team@powercoders.org", roleIds=["web", "it-support"], cadence="monthly",
                        includePolicy=False, includeTargetGroup=True)
    assert updated.status_code == 200, updated.text
    subscriptions_rows, sends = counts()
    assert len(subscriptions_rows) == 1
    assert subscriptions_rows[0]["id"] == subscription["id"]
    assert subscriptions_rows[0]["unsubscribe_token"] == subscription["unsubscribe_token"]
    assert subscriptions_rows[0]["role_ids"] == ["web", "it-support"]
    assert subscriptions_rows[0]["cadence"] == "monthly"
    assert subscriptions_rows[0]["include_policy"] is False
    assert subscriptions_rows[0]["include_target_group"] is True
    assert len(sends) == 2


def test_subscribe_validation(client):
    seed()
    no_topic = subscribe(client, roleIds=[], includePolicy=False, includeTargetGroup=False)
    assert no_topic.status_code == 422
    bad_email = subscribe(client, email="not-an-email")
    assert bad_email.status_code == 422
    unknown_role = subscribe(client, roleIds=["no-such-role"])
    assert unknown_role.status_code == 422 and "Unknown role" in unknown_role.json()["detail"]
    assert counts() == ([], [])


def test_subscribe_provider_failure_keeps_subscription(client, monkeypatch):
    seed()
    monkeypatch.setattr(config, "RESEND_API_KEY", "re_key")

    def failing(*args, **kwargs):
        raise mailer.MailerError("resend rejected the mail (403): domain not verified")

    monkeypatch.setattr(mailer, "send_email", failing)
    answer = subscribe(client, email="failure@powercoders.org")
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["ok"] is True and body["sent"] is False
    assert body["error"] == "resend rejected the mail (403): domain not verified"
    subscriptions_rows, sends = counts()
    assert len(subscriptions_rows) == 1 and subscriptions_rows[0]["email"] == "failure@powercoders.org"
    assert subscriptions_rows[0]["last_error"] == body["error"]
    assert subscriptions_rows[0]["last_sent_at"] is None
    assert len(sends) == 1
    assert sends[0]["status"] == "error" and sends[0]["error"] == body["error"]
    assert sends[0]["provider_id"] is None and sends[0]["digest"]


def test_subscribe_success_writes_sent_row(client, monkeypatch):
    seed()
    monkeypatch.setattr(config, "RESEND_API_KEY", "re_key")
    captured = {}

    def fake_send(to, subject, text, html_body, unsubscribe_url):
        captured.update(to=to, subject=subject, text=text, html=html_body, unsubscribe_url=unsubscribe_url)
        return "prov_42"

    monkeypatch.setattr(mailer, "send_email", fake_send)
    answer = subscribe(client, email="sent@powercoders.org")
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["sent"] is True and body["error"] is None
    assert captured["to"] == "sent@powercoders.org"
    assert captured["subject"] and captured["html"].startswith("<!DOCTYPE html>")
    assert "  — " in captured["text"] and captured["unsubscribe_url"] == body["unsubscribeUrl"]
    subscriptions_rows, sends = counts()
    assert subscriptions_rows[0]["last_sent_at"] is not None and subscriptions_rows[0]["last_error"] is None
    assert sends[0]["status"] == "sent" and sends[0]["provider_id"] == "prov_42"
    assert sends[0]["subject"] == captured["subject"]


def test_global_daily_cap_answers_429_and_does_not_store(client, monkeypatch):
    seed()
    monkeypatch.setattr(config, "REPORTS_DAILY_CAP", 1)
    first = subscribe(client, email="first@powercoders.org")
    assert first.status_code == 200 and first.json()["sent"] is False  # dry run counts against the cap
    second = subscribe(client, email="second@powercoders.org")
    assert second.status_code == 429 and "daily" in second.json()["detail"].lower()
    subscriptions_rows, _ = counts()
    assert [row["email"] for row in subscriptions_rows] == ["first@powercoders.org"]


# --- unsubscribe --------------------------------------------------------------

def test_unsubscribe_deletes_subscription_and_sends(client):
    seed()
    body = subscribe(client).json()
    with db.connect() as conn:
        subscription = conn.execute("SELECT * FROM report_subscriptions").fetchone()
    token = subscription["unsubscribe_token"]

    page = client.get("/api/reports/unsubscribe", params={"token": token})
    assert page.status_code == 200 and "text/html" in page.headers["content-type"]
    assert "unsubscribed" in page.text.lower()
    assert counts() == ([], [])  # subscription and its report_sends rows are gone

    again = client.get("/api/reports/unsubscribe", params={"token": token})
    assert again.status_code == 404 and "text/html" in again.headers["content-type"]
    assert "not valid" in again.text.lower()
    unknown = client.get("/api/reports/unsubscribe", params={"token": "never-issued"})
    assert unknown.status_code == 404
    assert "token" in body["unsubscribeUrl"]


# --- run ----------------------------------------------------------------------

def test_run_due_is_token_protected_and_idempotent(client):
    seed()
    with db.connect() as conn:
        add_subscription(conn, "sub_due", "due@powercoders.org")
        add_subscription(conn, "sub_not_due", "later@powercoders.org", last_sent_at=this_week_start())

    assert client.post("/api/reports/run", json={"dueOnly": True}).status_code == 401
    first = client.post("/api/reports/run", json={"dueOnly": True}, headers=TOKEN)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["sent"] == 1 and body["failed"] == 0 and body["skipped"] == 0
    assert [result["subscriptionId"] for result in body["results"]] == ["sub_due"]
    assert body["results"][0]["status"] == "dry_run"  # no RESEND_API_KEY in the tests
    subscriptions_rows, sends = counts()
    assert len(sends) == 1 and sends[0]["subscription_id"] == "sub_due"
    assert {row["id"]: row["last_sent_at"] for row in subscriptions_rows}["sub_due"] is not None

    second = client.post("/api/reports/run", json={"dueOnly": True}, headers=TOKEN).json()
    assert second["sent"] == 0 and second["results"] == []  # nothing became due again
    assert len(counts()[1]) == 1

    # an explicitly named subscription can be skipped or forced
    skipped = client.post("/api/reports/run", json={"dueOnly": True, "subscriptionId": "sub_not_due"},
                          headers=TOKEN).json()
    assert skipped["skipped"] == 1 and skipped["results"][0]["status"] == "skipped"
    forced = client.post("/api/reports/run", json={"dueOnly": False, "subscriptionId": "sub_not_due"},
                         headers=TOKEN).json()
    assert forced["sent"] == 1 and forced["results"][0]["status"] == "dry_run"
    assert len(counts()[1]) == 2
    assert client.post("/api/reports/run", json={"dueOnly": True, "subscriptionId": "nope"},
                       headers=TOKEN).status_code == 404


def test_run_needs_server_token(client, monkeypatch):
    monkeypatch.setattr(config, "INGEST_TOKEN", None)
    assert client.post("/api/reports/run", json={"dueOnly": True}).status_code == 503


def test_due_rule_uses_iso_week_and_calendar_month():
    now = datetime(2026, 11, 21, 12, tzinfo=timezone.utc)  # a Saturday in ISO week 47
    weekly = {"cadence": "weekly", "last_sent_at": None}
    assert subscriptions.is_due(weekly, now) is True
    weekly["last_sent_at"] = now - timedelta(days=2)  # Thursday, same ISO week
    assert subscriptions.is_due(weekly, now) is False
    weekly["last_sent_at"] = now - timedelta(days=10)  # earlier ISO week
    assert subscriptions.is_due(weekly, now) is True
    monthly = {"cadence": "monthly", "last_sent_at": datetime(2026, 11, 1, tzinfo=timezone.utc)}
    assert subscriptions.is_due(monthly, now) is False
    monthly["last_sent_at"] = datetime(2026, 10, 31, tzinfo=timezone.utc)
    assert subscriptions.is_due(monthly, now) is True
    expected_monday = now.date() + timedelta(days=7 - now.weekday() or 7)
    assert subscriptions.next_run("weekly", now) == expected_monday.isoformat()
    assert subscriptions.next_run("monthly", now) == "2026-12-01"


# --- optional LLM polish ------------------------------------------------------

def test_llm_polish_rewrites_wording_and_keeps_our_citations(client, monkeypatch):
    seed()
    request = DigestRequest(roleIds=["it-support"], includePolicy=True, includeTargetGroup=True)
    with db.connect() as conn:
        baseline = digest.build_digest(conn, request)
    assert baseline.sections

    monkeypatch.setattr(config, "LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setattr(config, "LLM_API_KEY", "llm-key")
    monkeypatch.setattr(config, "LLM_MODEL", "small-model")
    calls = []

    def fake_chat(payload):
        calls.append(payload)
        items = json.loads(payload["messages"][1]["content"])
        return json.dumps([{"source_id": item["source_id"], "text": f"Polished {index}: {item['text']}"}
                           for index, item in enumerate(items)])

    monkeypatch.setattr(digest, "_llm_chat", fake_chat)
    with db.connect() as conn:
        polished = digest.build_digest(conn, request)
    bullets = [bullet for section in polished.sections for bullet in section.bullets]
    assert calls and bullets
    assert all(bullet.text.startswith("Polished ") for bullet in bullets)
    assert polished.text.count("  — ") == len(bullets)  # citations are still appended by our code
    assert polished.sources == baseline.sources


def test_llm_mismatch_or_error_keeps_our_text(client, monkeypatch):
    seed()
    request = DigestRequest(roleIds=["it-support"], includePolicy=False, includeTargetGroup=False)
    with db.connect() as conn:
        baseline = digest.build_digest(conn, request)
    original = [bullet.text for section in baseline.sections for bullet in section.bullets]

    monkeypatch.setattr(config, "LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setattr(config, "LLM_API_KEY", "llm-key")
    monkeypatch.setattr(config, "LLM_MODEL", "small-model")
    for bad_answer in ("not json", "[]",
                       json.dumps([{"source_id": "wrong-source", "text": "rewritten"}]),
                       json.dumps([{"source_id": "wrong-source", "text": "rewritten"} for _ in original])):
        monkeypatch.setattr(digest, "_llm_chat", lambda payload, answer=bad_answer: answer)
        with db.connect() as conn:
            fallback = digest.build_digest(conn, request)
        assert [bullet.text for section in fallback.sections for bullet in section.bullets] == original

    def broken(payload):
        raise OSError("network down")

    monkeypatch.setattr(digest, "_llm_chat", broken)
    with db.connect() as conn:
        fallback = digest.build_digest(conn, request)
    assert [bullet.text for section in fallback.sections for bullet in section.bullets] == original


# --- CLI ----------------------------------------------------------------------

def _cli_env(database_url: str) -> dict:
    env = {key: value for key, value in os.environ.items() if not key.startswith("LLM_")}
    env["DATABASE_URL"] = database_url
    env["PUBLIC_BASE_URL"] = ""
    env["REPORT_TIMEZONE"] = "Europe/Zurich"
    env.pop("RESEND_API_KEY", None)
    return env


def test_cli_preview_works_offline(client, database_url):
    seed()
    process = subprocess.run([sys.executable, "-m", "app.reports", "preview", "--role", "it-support"],
                             cwd=BACKEND, env=_cli_env(database_url), capture_output=True, text=True, timeout=120)
    assert process.returncode == 0, process.stderr
    assert "Demand" in process.stdout and "IT Support" in process.stdout
    assert "https://www.itboard.ch/arbeitsmarkt" in process.stdout and "  — " in process.stdout
    assert "Policy watch" in process.stdout and "Target group" in process.stdout

    quiet = subprocess.run([sys.executable, "-m", "app.reports", "preview", "--role", "it-support",
                            "--no-policy", "--no-target-group"],
                           cwd=BACKEND, env=_cli_env(database_url), capture_output=True, text=True, timeout=120)
    assert quiet.returncode == 0, quiet.stderr
    assert "Policy watch" not in quiet.stdout and "Target group" not in quiet.stdout


def test_cli_run_summary_and_exit_codes(client, monkeypatch, capsys):
    seed()
    with db.connect() as conn:
        add_subscription(conn, "sub_cli", "cli@powercoders.org")
    assert cli.main(["run", "--due"]) == 0
    assert "1 sent" in capsys.readouterr().out
    assert cli.main(["run", "--due"]) == 0
    assert "0 sent" in capsys.readouterr().out

    # a provider failure is counted as failed and makes the cron exit non-zero
    monkeypatch.setattr(config, "RESEND_API_KEY", "re_key")

    def failing(*args, **kwargs):
        raise mailer.MailerError("provider down")

    monkeypatch.setattr(mailer, "send_email", failing)
    with db.connect() as conn:
        conn.execute("UPDATE report_sends SET sent_at = sent_at - interval '2 days'")
        conn.execute("UPDATE report_subscriptions SET last_sent_at = last_sent_at - interval '2 days'")
    assert cli.main(["run", "--no-due"]) == 1
    assert "1 failed" in capsys.readouterr().out

    assert cli.main(["preview", "--role", "no-such-role"]) == 2
    assert cli.main(["run", "--due", "--subscription", "no-such-id"]) == 2
