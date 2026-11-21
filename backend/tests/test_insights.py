"""Insights, the home-page overview, the taxonomy and role aliases (docs/api.md "Insights").

Every insight is built from seeded rows and then checked against the frozen contract: each
one carries at least one real `SourceRef` with an http(s) URL, and every number in `body`
also appears in `evidence`. The database is the real Postgres of TEST_DATABASE_URL; nothing
here touches the network.
"""
import re
from datetime import datetime, timedelta, timezone

import pytest
from psycopg.types.json import Jsonb

from app import db
from app.connectors import base
from app.connectors.config import Defaults, SourceConfig
from app.insights import service, taxonomy
from conftest import write_sources

FETCHED = datetime(2026, 11, 21, 9, 15, tzinfo=timezone.utc)
NUMBER = re.compile(r"\d[\d'’.,]*")
ITBOARD_URL = "https://www.itboard.ch/arbeitsmarkt"
BESTA_URL = "https://www.bfs.admin.ch/bfs/de/home/statistiken/arbeit-erwerb.html"
SOURCE = {
    "id": "itboard",
    "name": "ITBoard",
    "source_url": ITBOARD_URL,
    "category": ["A"],
    "adapter_type": "csv_url",
    "endpoint": "https://example.org/daten.csv",
    "refresh_rate": "weekly",
}


# --- seed helpers -------------------------------------------------------------

def add_source(conn, source_id="itboard-monthly", *, name="ITBoard · IT-Arbeitsmarkt Schweiz",
               url=ITBOARD_URL, fetched_at="2026-11-21T08:00:00Z", data_as_of="2026-11-15",
               comparable_from=None):
    conn.execute(
        """INSERT INTO sources (id, name, url, fetched_at, data_as_of, comparable_from)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (source_id, name, url, fetched_at, data_as_of, comparable_from))


def add_item(conn, *, source_id, item_id, category, title, summary="", metrics=None, tags=None,
             source_name="Test source", source_url="https://example.org/source", url=None,
             published_at="2026-11-01T00:00:00Z", fetched_at="2026-11-21T08:00:00Z", payload=None):
    conn.execute(
        """INSERT INTO market_items
               (source_id, id, category, categories, title, summary, metrics, payload, tags, region,
                source_name, source_url, url, published_at, fetched_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s)""",
        (source_id, item_id, category, [category], title, summary, Jsonb(metrics or {}),
         Jsonb(payload) if payload is not None else None, tags or [],
         source_name, source_url, url, published_at, fetched_at))


def add_observation(conn, source_id, metric, role_id, skill, period, value, base=None):
    conn.execute(
        "INSERT INTO observations VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (source_id, metric, role_id, skill, period, value, base))


def seed_market(conn):
    """Three demand roles, all-roles skills, one employer role, BESTA regions and policy items."""
    add_source(conn)
    conn.execute("""INSERT INTO roles VALUES ('web', 'Web Developer'), ('ops', 'Operations Engineer'),
                                                   ('data', 'Data Analyst'), ('it-support', 'IT Support')""")
    periods = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
    for period, value in zip(periods, [80, 90, 100, 110, 120]):  # rising, sample of 1000
        add_observation(conn, "itboard-monthly", "demand", "web", "", period, value, 1000)
    for period, value in zip(periods, [60, 55, 50, 45, 40]):  # falling
        add_observation(conn, "itboard-monthly", "demand", "ops", "", period, value, 1000)
    add_observation(conn, "itboard-monthly", "demand", "data", "", "2026-10", 10, 100)  # 10 % of 100
    add_observation(conn, "itboard-monthly", "demand", "data", "", "2026-11", 30, 200)  # 15 % of 200
    for skill, values in {"SQL": [50, 60], "React": [20, 18]}.items():  # only the latest month is used
        for period, value in zip(["2026-10", "2026-11"], values):
            add_observation(conn, "itboard-monthly", "skill", "", skill, period, value, 200)
    for number, company in enumerate(["Swisscom", "Swisscom", "PostFinance"], start=1):
        add_item(conn, source_id="adzuna_ch", item_id=f"job-{number}", category="C",
                 title="IT Support Specialist", summary="Windows und Active Directory",
                 payload={"company": {"display_name": company},
                          "description": "Windows Active Directory SQL"},
                 tags=["role:IT Support"], source_name="Adzuna Stellenmarkt Schweiz",
                 source_url="https://developer.adzuna.com/", url=f"https://adzuna.ch/ad/{number}",
                 published_at=f"2026-11-1{number}T00:00:00Z")
    seed_regions(conn)
    now = datetime.now(timezone.utc)
    for item_id, title, summary, published in (
            ("p1", "Status S: neue Regeln zur Erwerbstätigkeit", "Der Bundesrat ändert die Regeln.",
             now - timedelta(days=2)),
            ("p2", "Asylverfahren: Anpassung", "Die Vorlage betrifft Asyl und Integration.",
             now - timedelta(days=10)),
            ("p3", "Vorstoss ohne Datum", "Kein published_at, nur fetched_at.",
             None)):
        add_item(conn, source_id="rss_policy", item_id=item_id, category="E", title=title,
                 summary=summary, source_name="Fedlex",
                 source_url="https://www.fedlex.admin.ch/de/oc", published_at=published)
    add_item(conn, source_id="sem-asylum-applications", item_id="target-1", category="D",
             title="Asylgesuche 2026", summary="Gesuche: 2210",
             source_name="SEM", source_url="https://www.sem.admin.ch/de/asylstatistik",
             published_at="2026-11-18T00:00:00Z")


def seed_regions(conn):
    """BESTA-shaped rows: id/title carry the region, metrics the value, plus one quota row to ignore."""
    for period, month, values in (
            ("2026-03", 3, {"zuerich": 20.0, "tessin": 5.0}),
            ("2026-06", 6, {"zuerich": 23.7, "tessin": 4.8})):
        for slug, value in values.items():
            label = {"zuerich": "Zürich", "tessin": "Tessin"}[slug]
            add_item(conn, source_id="bfs-besta-regions", item_id=f"{period}:region-{slug}-offene-stellen",
                     category="D", title=f"Offene Stellen: {label} ({period})",
                     summary=f"{label}: {value:g} Tausend ({period}).",
                     metrics={"offene_stellen_tausend": value},
                     tags=["bfs-besta-regions", "bfs", "besta", "region"],
                     source_name="BFS · Offene Stellen nach Branche und Grossregion (BESTA)",
                     source_url=BESTA_URL, published_at=f"{period}-01T00:00:00Z")
    add_item(conn, source_id="bfs-besta-regions", item_id="2026-06:region-zuerich-quote", category="D",
             title="Quote offener Stellen: Zürich (2026-06)", summary="Quote: 1.359 %.",
             metrics={"quote_pct": 1.359}, tags=["bfs-besta-regions", "bfs", "besta", "region"],
             source_name="BFS · Offene Stellen nach Branche und Grossregion (BESTA)",
             source_url=BESTA_URL, published_at="2026-06-01T00:00:00Z")


def add_raw_file(conn, source_id, status="error", error="unreadable file", fetch_error=None):
    conn.execute(
        """INSERT INTO raw_files (source_id, sha256, relative_path, fetched_at, fetch_error, status, error)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (source_id, f"sha-{source_id}", f"{source_id}.csv", "2026-11-21T08:00:00Z", fetch_error, status, error))


# --- contract helpers ---------------------------------------------------------

def evidence_haystack(insight: dict) -> str:
    """Only label + value count: a number must be repeated there, not smuggled in via a URL."""
    return " ".join(f"{evidence['label']} {evidence['value']}" for evidence in insight["evidence"])


def numbers(text: str) -> list[str]:
    return [token.rstrip(".,") for token in NUMBER.findall(text) if token.rstrip(".,")]


def assert_insight_contract(insight: dict) -> None:
    assert insight["method"] == "template"
    assert insight["generatedAt"].endswith("Z")
    assert insight["severity"] in ("info", "attention")
    assert insight["kind"] in ("demand", "skills", "employers", "regions", "target", "policy")
    assert insight["headline"].strip() and insight["body"].strip()
    assert insight["evidence"], f"{insight['id']} has no evidence"
    for evidence in insight["evidence"]:
        assert evidence["label"].strip() and evidence["value"].strip()
        source = evidence["source"]
        assert source["name"].strip()
        assert source["url"].startswith(("http://", "https://")), source
        assert source["fetchedAt"]
    haystack = evidence_haystack(insight)
    missing = [token for token in numbers(insight["body"]) if token not in haystack]
    assert not missing, f"{insight['id']}: body numbers {missing} are not in evidence: {haystack}"


# --- GET /api/insights --------------------------------------------------------

def test_empty_database_answers_no_insight(client):
    assert client.get("/api/insights").json() == []
    body = client.get("/api/overview").json()
    assert body["postings"] is None
    assert body["rolesTracked"] == 0
    assert body["biggestRiser"] is None and body["biggestFaller"] is None
    assert body["newPolicyItems"] == 0 and body["targetGroupItems"] == 0
    assert body["sources"] == {"ok": 0, "stale": 0, "error": 0}
    assert body["insights"] == []
    with db.connect() as conn:
        assert service.insights(conn) == []
        assert service.overview(conn).insights == []


def test_insights_cover_all_kinds_and_every_number_has_evidence(client):
    with db.connect() as conn:
        seed_market(conn)

    answer = client.get("/api/insights")
    assert answer.status_code == 200, answer.text
    insights = answer.json()
    kinds = {insight["kind"] for insight in insights}
    assert kinds == {"demand", "skills", "employers", "regions", "target", "policy"}
    for insight in insights:
        assert_insight_contract(insight)

    demand = next(insight for insight in insights if insight["id"] == "demand:web")
    assert demand["roleId"] == "web"
    assert demand["headline"] == "Web Developer: demand is rising"
    assert "shows 120 open positions in November 2026, 12 % of all postings" in demand["body"]  # count + share
    assert "9.1 % more than in October 2026" in demand["body"]
    assert "extrapolation" in demand["body"]  # five months: the forecast is labelled
    assert demand["evidence"][0]["source"]["dataAsOf"] == "2026-11-15"

    target = next(insight for insight in insights if insight["kind"] == "target")
    assert target["itemId"] == "target-1"
    assert "We track 6 context items" in target["body"]  # 5 BESTA rows (incl. one quota) + 1 SEM row
    regions = next(insight for insight in insights if insight["kind"] == "regions")
    assert "Zürich" in regions["body"] and "23.7" in regions["body"]
    assert "18.5 % more than in March 2026" in regions["body"]
    assert "1.359" not in regions["body"]  # quota rows are not mixed into the count metric
    policy = [insight for insight in insights if insight["kind"] == "policy"]
    assert [insight["itemId"] for insight in policy] == ["p3", "p1", "p2"]  # newest first, fetched_at fallback
    status_s = next(insight for insight in policy if insight["itemId"] == "p1")
    assert status_s["severity"] == "attention"
    assert "temporary protection" in status_s["body"]  # our curated reading, not the source
    assert policy[0]["severity"] == "info"  # a publication without a watched topic

    with db.connect() as conn:  # the router is a thin wrapper around the service
        direct = [insight.model_dump(by_alias=True) for insight in service.insights(conn)]
    assert [(item["id"], item["body"]) for item in insights] == [(item["id"], item["body"]) for item in direct]


def test_kind_and_role_filters_limit_the_list(client):
    with db.connect() as conn:
        seed_market(conn)

    only_demand = client.get("/api/insights", params={"kind": "demand"}).json()
    assert {insight["kind"] for insight in only_demand} == {"demand"}
    assert [insight["roleId"] for insight in only_demand] == ["web", "ops", "data"]  # largest first

    limited = client.get("/api/insights", params={"limit": 1}).json()
    assert len(limited) == 1 and limited[0]["id"] == "demand:web"

    for_role = client.get("/api/insights", params={"role": "it-support"}).json()
    assert all(insight["roleId"] in (None, "it-support") for insight in for_role)
    assert not [insight for insight in for_role if insight["kind"] == "demand"]  # no demand data: no insight
    assert [insight["id"] for insight in for_role if insight["kind"] == "employers"] == ["employers:it-support"]

    assert client.get("/api/insights", params={"role": "no-such-role"}).status_code == 404
    assert client.get("/api/insights", params={"kind": "bogus"}).status_code == 422
    assert client.get("/api/insights", params={"limit": 0}).status_code == 422
    assert client.get("/api/insights", params={"limit": 101}).status_code == 422


def test_short_history_gets_no_forecast_claim_and_roles_without_data_get_no_insight(client):
    with db.connect() as conn:
        add_source(conn)
        conn.execute("INSERT INTO roles VALUES ('it-support', 'IT Support'), ('empty', 'Empty Role')")
        for period, value in zip(["2026-09", "2026-10", "2026-11"], [10, 11, 12]):  # three months
            add_observation(conn, "itboard-monthly", "demand", "it-support", "", period, value)
    body = client.get("/api/insights", params={"kind": "demand"}).json()
    assert [insight["id"] for insight in body] == ["demand:it-support"]
    assert "forecast" not in body[0]["body"].lower() and "extrapolation" not in body[0]["body"]
    assert_insight_contract(body[0])
    assert not [insight for insight in client.get("/api/insights").json() if insight.get("roleId") == "empty"]


def test_comparable_from_and_forecast_rules_are_stated(client):
    with db.connect() as conn:
        add_source(conn, comparable_from="2026-11")  # the source changed counting; October is not comparable
        conn.execute("INSERT INTO roles VALUES ('it-support', 'IT Support')")
        for period, value in zip(["2026-09", "2026-10", "2026-11"], [10, 11, 12]):
            add_observation(conn, "itboard-monthly", "demand", "it-support", "", period, value)
    [insight] = client.get("/api/insights", params={"kind": "demand"}).json()
    assert "changed how it counts from 2026-11" in insight["body"]
    assert insight["body"].count("changed how it counts") == 1  # one hint, not two
    assert "We do not compare with October 2026" in insight["body"]
    assert "extrapolation" not in insight["body"]
    assert insight["evidence"][-1] == {
        "label": "Comparable from", "value": "2026-11", "source": insight["evidence"][0]["source"]}
    assert_insight_contract(insight)


# --- GET /api/overview --------------------------------------------------------

def test_overview_postings_are_the_largest_role_not_a_sum(client):
    with db.connect() as conn:
        seed_market(conn)
    body = client.get("/api/overview").json()
    assert body["postings"]["value"] == 120  # web, not 120 + 40 + 30 = 190 and not 190 either way
    assert body["postings"]["value"] != 190
    assert body["postings"]["period"] == "2026-11"
    assert body["postings"]["base"] == 1000  # the sample of all postings in that month
    assert body["postings"]["source"]["name"].startswith("ITBoard")
    assert body["rolesTracked"] == 3  # the role without demand data is not counted
    # movers compare shares when a sample exists: data 10/100 -> 30/200 is +50 %, not +200 %
    assert body["biggestRiser"]["role"] == {"id": "data", "name": "Data Analyst"}
    assert body["biggestRiser"]["changePct"] == pytest.approx(50.0)
    assert body["biggestRiser"]["current"] == 30  # the sample behind the move is part of the contract
    assert body["biggestRiser"]["source"]["url"].startswith("https://")
    assert body["biggestFaller"]["role"] == {"id": "ops", "name": "Operations Engineer"}
    assert body["biggestFaller"]["changePct"] == pytest.approx(-11.1)
    assert body["generatedAt"].endswith("Z")
    # the pulse is the short list: one insight each, in the documented order
    assert [insight["kind"] for insight in body["insights"]] == ["demand", "skills", "regions", "target", "policy"]
    for insight in body["insights"]:
        assert_insight_contract(insight)


def test_overview_policy_window_target_count_and_source_health(client):
    now = datetime.now(timezone.utc)
    with db.connect() as conn:
        add_source(conn, "fresh", name="Fresh", url="https://example.org/fresh", fetched_at=now.isoformat())
        add_source(conn, "old", name="Old", url="https://example.org/old",
                   fetched_at=(now - timedelta(days=30)).isoformat())
        add_source(conn, "broken", name="Broken", url="https://example.org/broken", fetched_at=now.isoformat())
        add_raw_file(conn, "broken", status="error", error="checksum mismatch")
        add_item(conn, source_id="rss_policy", item_id="new", category="E", title="Status S: neu",
                 source_name="Fedlex", source_url="https://www.fedlex.admin.ch/de/oc",
                 published_at=now - timedelta(days=2))
        add_item(conn, source_id="rss_policy", item_id="old", category="E", title="Asyl: alt",
                 source_name="Fedlex", source_url="https://www.fedlex.admin.ch/de/oc",
                 published_at=now - timedelta(days=10))
        add_item(conn, source_id="rss_policy", item_id="fetched-only", category="E", title="Ohne Datum",
                 summary="nur fetched_at", source_name="Fedlex",
                 source_url="https://www.fedlex.admin.ch/de/oc", published_at=None,
                 fetched_at=now - timedelta(days=1))
        for number in range(3):
            add_item(conn, source_id="sem", item_id=f"target-{number}", category="D",
                     title=f"Zielgruppe {number}", source_name="SEM",
                     source_url="https://www.sem.admin.ch/de/asylstatistik")
    body = client.get("/api/overview").json()
    assert body["newPolicyItems"] == 2  # published within 7 days, plus the fetched_at fallback
    assert body["targetGroupItems"] == 3
    assert body["sources"] == {"ok": 1, "stale": 1, "error": 1}
    assert body["postings"] is None and body["biggestRiser"] is None and body["biggestFaller"] is None
    assert [insight["kind"] for insight in body["insights"]] == ["target", "policy"]


# --- regions (BFS BESTA) ------------------------------------------------------

def test_regions_compare_the_latest_quarter_with_the_previous_one(client):
    with db.connect() as conn:
        seed_regions(conn)
    [insight] = client.get("/api/insights", params={"kind": "regions"}).json()
    assert insight["id"] == "regions:bfs-besta-regions"
    assert "In June 2026" in insight["body"] and "most open positions (23.7 thousand)" in insight["body"]
    assert "Zürich grew fastest: 18.5 % more than in March 2026" in insight["body"]
    assert "Tessin fell by 4 %" in insight["body"]
    assert insight["evidence"][0]["source"]["dataAsOf"] == "2026-06-01"
    assert insight["evidence"][0]["source"]["name"].startswith("BFS")
    assert_insight_contract(insight)

    # the same numbers without the previous quarter: no comparison, still a cited value
    with db.connect() as conn:
        conn.execute("DELETE FROM market_items WHERE published_at < '2026-06-01'")
    [current] = client.get("/api/insights", params={"kind": "regions"}).json()
    assert "more than in" not in current["body"] and "March 2026" not in current["body"]
    assert "23.7 thousand" in current["body"]
    assert_insight_contract(current)

    with db.connect() as conn:  # no BESTA rows -> no insight, never an empty one
        conn.execute("DELETE FROM market_items WHERE source_id = 'bfs-besta-regions'")
    assert client.get("/api/insights", params={"kind": "regions"}).json() == []


# --- taxonomy & role aliases --------------------------------------------------

def test_taxonomy_falls_back_to_the_built_in_defaults(client, sources_file):
    write_sources(sources_file, [], {})  # no policy_groups / role_aliases in the file
    body = client.get("/api/insights/taxonomy").json()
    assert [group["label"] for group in body["policyGroups"]] == [
        "SEM numbers & distribution", "Migration law", "Labour law & reporting"]
    assert all(group["keywords"] for group in body["policyGroups"])
    assert [note["keyword"] for note in body["policyNotes"]] == [
        "Status S", "Status F", "Stellenmeldepflicht", "Asyl", "Integration", "Fachkräftemangel"]
    assert body["policyNotes"][0]["note"].startswith("Status S is temporary protection while an asylum case")
    assert body["roleAliases"]["AI Specialist"] == ["AI", "Artificial Intelligence", "Machine Learning", "ML"]
    assert body["roleAliases"]["IT Support"]
    assert body["policyGroups"] == [{"label": group.label, "keywords": group.keywords}
                                    for group in taxonomy.DEFAULT_POLICY_GROUPS]
    # /api/connectors defaults serve the same taxonomy, so the operator sees what the app shows
    defaults = client.get("/api/connectors").json()["defaults"]
    assert defaults["policyGroups"] == body["policyGroups"]
    assert defaults["roleAliases"] == body["roleAliases"]


def test_taxonomy_comes_from_sources_yaml_when_present(client, sources_file):
    write_sources(sources_file, [], {
        "policy_groups": [{"label": "Eigene Gruppe", "keywords": ["Arbeitsrecht", "Test"]}],
        "role_aliases": {"AI Specialist": ["KI", "Machine Learning"]},
    })
    body = client.get("/api/insights/taxonomy").json()
    assert body["policyGroups"] == [{"label": "Eigene Gruppe", "keywords": ["Arbeitsrecht", "Test"]}]
    assert body["roleAliases"] == {"AI Specialist": ["KI", "Machine Learning"]}
    assert len(body["policyNotes"]) == 6  # the curated text lives in code, reviewable
    defaults = client.get("/api/connectors").json()["defaults"]
    assert defaults["policyGroups"] == body["policyGroups"]
    assert defaults["roleAliases"] == body["roleAliases"]


def test_role_aliases_tag_the_canonical_role_through_normalise():
    aliases = taxonomy.aliases_from(None)
    defaults = Defaults(target_roles=["AI Specialist", "IT Support", "Web Developer"], role_aliases=aliases)
    source = SourceConfig.model_validate(SOURCE)

    def tags(title: str) -> list[str]:
        item = base.normalise({"title": title}, source, defaults, FETCHED)
        return [tag for tag in item.tags if tag.startswith("role:")]

    assert tags("Machine Learning Engineer (m/w/d)") == ["role:AI Specialist"]
    assert "role:AI Specialist" not in tags("The team said the main task is support")
    assert tags("Full Stack Developer") == ["role:Web Developer"]
    assert tags("IT Support Specialist") == ["role:IT Support"]
    # an alias only tags an existing canonical role, never invents one
    assert tags("Data Scientist") == []


# --- digest policy note -------------------------------------------------------

def test_digest_policy_note_is_the_curated_taxonomy_reading(client):
    with db.connect() as conn:
        add_item(conn, source_id="rss_policy", item_id="p1", category="E",
                 title="Status S: neue Regeln zur Erwerbstätigkeit",
                 summary="Der Bundesrat ändert die Regeln.",
                 source_name="Fedlex", source_url="https://www.fedlex.admin.ch/de/oc",
                 published_at="2026-11-19T00:00:00Z")
    answer = client.post("/api/reports/preview", json={
        "roleIds": [], "includePolicy": True, "includeTargetGroup": False})
    assert answer.status_code == 200, answer.text
    body = answer.json()
    [section] = body["sections"]
    assert section["heading"] == "Policy watch"
    assert section["note"] == taxonomy.note_for("Status S").note
    assert "Our reading, not the source: Status S is temporary protection while an asylum case is open" in body["text"]
    # an item without a curated topic still gets a section, but no invented note
    with db.connect() as conn:
        conn.execute("UPDATE market_items SET title = 'Neue Verordnung', summary = 'Ohne Schlagwort'")
    plain = client.post("/api/reports/preview", json={
        "roleIds": [], "includePolicy": True, "includeTargetGroup": False}).json()
    assert plain["sections"][0]["note"] is None


def test_movers_prefer_roles_with_a_real_sample(client):
    """A +400 % move on five postings must not become the pulse; the 30-posting role wins."""
    with db.connect() as conn:
        seed_market(conn)
        conn.execute("INSERT INTO roles VALUES ('tiny', 'Tiny Role')")
        add_observation(conn, "itboard-monthly", "demand", "tiny", "", "2026-10", 1, 1000)
        add_observation(conn, "itboard-monthly", "demand", "tiny", "", "2026-11", 5, 1000)
    body = client.get("/api/overview").json()
    assert body["biggestRiser"]["role"]["id"] == "data"
    assert body["biggestRiser"]["current"] == 30
