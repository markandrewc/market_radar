"""Level 3: GET /api/employers, aggregated from stored category-C postings (docs/api.md).

The endpoint is read-only: the tests insert market_items/connector_sources rows directly,
exactly what a connector sync would have written, and check the aggregation, not the fetch.
"""
from datetime import datetime, timezone

from psycopg.types.json import Jsonb

from app import db
from app.connectors import base

ROLE_ID, ROLE_NAME = "it-support", "IT Support"
FETCHED = datetime(2026, 11, 21, 8, 0, tzinfo=timezone.utc)
FETCHED_LATER = datetime(2026, 11, 21, 9, 30, tzinfo=timezone.utc)
SOURCE_NAME = "Adzuna Stellenmarkt Schweiz"
SOURCE_URL = "https://developer.adzuna.com/"


def at(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, tzinfo=timezone.utc)


def seed_role(role_id: str = ROLE_ID, name: str = ROLE_NAME) -> None:
    with db.connect() as conn:
        conn.execute("INSERT INTO roles (id, name) VALUES (%s, %s)", (role_id, name))


def seed_connector(source_id: str = "adzuna_ch", *,
                   last_sync_at: datetime | None = datetime(2026, 11, 21, 10, 0, tzinfo=timezone.utc),
                   categories: tuple[str, ...] = ("A", "B", "C")) -> None:
    with db.connect() as conn:
        conn.execute(
            """INSERT INTO connector_sources (id, name, source_url, categories, adapter_type, refresh_rate,
                                              last_sync_at, config_hash)
               VALUES (%s, %s, %s, %s, 'rest_api', 'weekly', %s, 'test')
               ON CONFLICT (id) DO UPDATE SET categories = EXCLUDED.categories,
                   last_sync_at = EXCLUDED.last_sync_at, config_hash = EXCLUDED.config_hash""",
            (source_id, SOURCE_NAME, SOURCE_URL, list(categories), last_sync_at))


def posting(item_id: str, company: str | None = None, *, title: str = "IT Support Specialist",
            description: str = "", tags: tuple[str, ...] = (), published: datetime | None = None,
            url: str | None = None, category: str = "C", fetched_at: datetime = FETCHED,
            source_id: str = "adzuna_ch", source_name: str = SOURCE_NAME,
            source_url: str = SOURCE_URL, company_style: str = "display_name") -> dict:
    """One row like a connector sync writes it: raw record in `payload`, normalised columns around it."""
    payload: dict = {"id": item_id, "title": title, "description": description}
    if company is not None:
        payload["company"] = company if company_style == "string" else {"display_name": company}
    return {"source_id": source_id, "id": item_id, "category": category, "categories": [category],
            "title": title, "summary": description, "payload": payload, "tags": list(tags), "url": url,
            "published_at": published, "fetched_at": fetched_at, "source_name": source_name,
            "source_url": source_url}


def insert_items(rows: list[dict]) -> None:
    with db.connect() as conn, conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO market_items (source_id, id, category, categories, title, summary, payload, tags,
                                         url, published_at, fetched_at, source_name, source_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            [(row["source_id"], row["id"], row["category"], row["categories"], row["title"], row["summary"],
              Jsonb(row["payload"]), row["tags"], row["url"], row["published_at"], row["fetched_at"],
              row["source_name"], row["source_url"]) for row in rows])


def employers(client, role: str = ROLE_ID) -> dict:
    response = client.get("/api/employers", params={"role": role})
    assert response.status_code == 200, response.text
    return response.json()


def test_employers_aggregate_company_counts_skills_window_and_source(client):
    seed_role()
    seed_connector()
    insert_items([
        # Swisscom: 3 postings; skill counts Windows 3, Active Directory 1, SQL 1
        posting("s1", "Swisscom", description="Windows Server und SQL", tags=["role:IT Support"],
                published=at(2026, 11, 19), url="https://adzuna.test/s1"),
        posting("s2", "Swisscom", description="Active Directory und Windows", tags=["role:IT Support"],
                published=at(2026, 10, 1), url="https://adzuna.test/s2", fetched_at=FETCHED_LATER),
        posting("s3", "Swisscom", description="Windows 10", published=at(2026, 9, 1)),  # title match, no url
        # SBB: 2 postings, matching React.js/JavaScript aliases and TypeScript
        posting("b1", "SBB", description="React.js, TypeScript und JavaScript", tags=["role:IT Support"],
                published=at(2026, 11, 5), url="https://adzuna.test/b1"),
        posting("b2", "SBB", description="TypeScript und react", tags=["role:IT Support"],
                published=at(2026, 10, 10), url="https://adzuna.test/b2"),
        # Coop: the role tag is matched case-insensitively
        posting("c1", "Coop", description="Linux, VPN und PowerShell", tags=["role:it support"],
                published=at(2026, 11, 14), url="https://adzuna.test/c1"),
        # Migros: no role tag, matched by the title fallback
        posting("m1", "Migros", title="IT Supporter 80%", description="Figma und Jira",
                published=at(2026, 11, 12), url="https://adzuna.test/m1"),
        # Decoys: a category-A record and a category-C record without a company are ignored
        posting("a1", "Kanton", title="IT Support", description="Windows, SQL", category="A",
                published=at(2026, 12, 1)),
        posting("x1", None, title="IT Support Lead", description="Windows, SQL, Linux",
                published=at(2026, 12, 5)),
    ])

    body = employers(client)

    assert body["role"] == {"id": ROLE_ID, "name": ROLE_NAME}
    assert body["window"] == {"from": "2026-09-01", "to": "2026-11-19"}
    assert [e["name"] for e in body["employers"]] == ["Swisscom", "SBB", "Coop", "Migros"]
    assert [e["openings"] for e in body["employers"]] == [3, 2, 1, 1]
    assert body["employers"][0]["topSkills"] == ["Windows", "Active Directory", "SQL"]
    assert body["employers"][0]["sourceUrl"] == "https://adzuna.test/s1"  # newest posting of Swisscom
    assert body["employers"][1]["topSkills"] == ["React", "TypeScript", "JavaScript"]
    assert body["employers"][1]["sourceUrl"] == "https://adzuna.test/b1"
    assert body["employers"][2]["topSkills"] == ["Linux", "PowerShell", "VPN"]
    assert body["employers"][3]["topSkills"] == ["Figma", "Jira"]
    assert body["source"] == {"id": "adzuna_ch", "name": SOURCE_NAME, "url": SOURCE_URL,
                              "fetchedAt": "2026-11-21T09:30:00Z",  # max(fetched_at) of the postings
                              "dataAsOf": "2026-11-19", "comparableFrom": None,
                              "datasetUrl": None, "datasetModified": None}


def test_company_string_fallback_and_column_fallbacks(client):
    seed_role()
    seed_connector()
    row = posting("p1", "Post AG", title="IT Supporterin", description="", company_style="string",
                  published=at(2026, 11, 10), url="https://adzuna.test/p1")
    row["payload"].pop("title")        # fall back to market_items.title
    row["payload"].pop("description")  # fall back to market_items.summary
    row["summary"] = "Python und Docker"
    insert_items([row])

    body = employers(client)

    assert body["employers"] == [{"name": "Post AG", "openings": 1, "topSkills": ["Docker", "Python"],
                                  "sourceUrl": "https://adzuna.test/p1"}]
    assert body["window"] == {"from": "2026-11-10", "to": "2026-11-10"}


def test_no_category_c_data_answers_empty_list_with_the_configured_source(client):
    seed_role()
    seed_connector(last_sync_at=datetime(2026, 11, 20, 10, 0, tzinfo=timezone.utc))

    body = employers(client)

    assert body["role"] == {"id": ROLE_ID, "name": ROLE_NAME}
    assert body["window"] is None
    assert body["employers"] == []
    assert body["source"] == {"id": "adzuna_ch", "name": SOURCE_NAME, "url": SOURCE_URL,
                              "fetchedAt": "2026-11-20T10:00:00Z", "dataAsOf": None, "comparableFrom": None,
                              "datasetUrl": None, "datasetModified": None}


def test_role_without_category_c_postings_is_empty_but_keeps_provenance(client):
    seed_role()
    seed_role("web", "Web Developer")
    seed_connector()
    insert_items([posting("p1", "Acme", title="Frontend Developer", tags=["role:Web Developer"],
                          description="React", published=at(2026, 11, 10))])

    body = employers(client)

    assert body["employers"] == [] and body["window"] is None
    assert body["source"]["id"] == "adzuna_ch"
    assert body["source"]["dataAsOf"] == "2026-11-10"


def test_window_is_null_without_published_dates(client):
    seed_role()
    seed_connector()
    insert_items([posting("p1", "Acme", tags=["role:IT Support"], description="SQL", published=None)])

    body = employers(client)

    assert body["window"] is None
    assert body["source"]["dataAsOf"] is None
    assert body["source"]["fetchedAt"] == "2026-11-21T08:00:00Z"


def test_source_falls_back_to_the_item_source_without_a_connector_row(client):
    seed_role()
    insert_items([posting("p1", "Acme", tags=["role:IT Support"], description="SQL",
                          published=at(2026, 11, 10), source_id="jobs_ch", source_name="Jobs Board",
                          source_url="https://jobs.test/feed")])

    body = employers(client)

    assert body["source"] == {"id": "jobs_ch", "name": "Jobs Board", "url": "https://jobs.test/feed",
                              "fetchedAt": "2026-11-21T08:00:00Z", "dataAsOf": "2026-11-10",
                              "comparableFrom": None, "datasetUrl": None, "datasetModified": None}


def test_at_most_ten_employers_sorted_by_openings_then_name(client):
    seed_role()
    seed_connector()
    insert_items([posting(f"e{i:02d}", f"Company {i:02d}", tags=["role:IT Support"], description="Python",
                          published=at(2026, 11, 1)) for i in range(1, 13)])

    body = employers(client)

    assert [e["name"] for e in body["employers"]] == [f"Company {i:02d}" for i in range(1, 11)]


def test_skill_mentions_count_postings_not_occurrences(client):
    seed_role()
    seed_connector()
    insert_items([
        posting("p1", "Acme", tags=["role:IT Support"], description="Python Python Python",
                published=at(2026, 11, 1)),
        posting("p2", "Acme", tags=["role:IT Support"], description="SQL", published=at(2026, 11, 2)),
        posting("p3", "Acme", tags=["role:IT Support"], description="SQL, SQL", published=at(2026, 11, 3)),
    ])

    # two postings mention SQL, one mentions Python - repetitions in one posting do not count twice
    assert employers(client)["employers"][0]["topSkills"] == ["SQL", "Python"]


def test_unknown_role_is_404_and_role_is_required(client):
    seed_role()

    assert client.get("/api/employers", params={"role": "nope"}).status_code == 404
    assert client.get("/api/employers").status_code == 422
    assert client.get("/api/employers", params={"role": ""}).status_code == 422
    assert employers(client)["employers"] == []


def test_employers_does_not_touch_the_network(client, monkeypatch):
    seed_role()
    seed_connector()
    insert_items([posting("p1", "Acme", tags=["role:IT Support"], description="SQL",
                          published=at(2026, 11, 10))])

    def forbidden(*args, **kwargs):
        raise AssertionError("GET /api/employers must only read stored rows")

    monkeypatch.setattr(base, "fetch", forbidden)

    assert employers(client)["employers"][0]["name"] == "Acme"
