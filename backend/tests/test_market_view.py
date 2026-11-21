"""GET /api/demand, /api/skills and /api/roles are thin wrappers around app/services/market_view.py.

The numbers and the response shapes must stay exactly what they were when the queries
lived in the router: these tests compare the service output with the HTTP answer and
pin the known values from tests/test_api.py.
"""
import pytest

from app import db
from app.schemas import SkillsResponse
from app.services import market_view


def _seed():
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sources (id, name, url, fetched_at) "
                    "VALUES ('s1', 'Test source', 'https://example.org', '2026-11-01T00:00:00Z')")
        cur.execute("INSERT INTO roles VALUES ('web', 'Web Developer'), ('data', 'Data Analyst')")
        cur.executemany("INSERT INTO observations VALUES (%s, %s, %s, %s, %s, %s, %s)", [
            ("s1", "demand", "web", "", "2026-08", 50, None),
            ("s1", "demand", "web", "", "2026-09", 100, None),
            ("s1", "demand", "web", "", "2026-10", 120, None),
            ("s1", "demand", "data", "", "2026-09", 10, 100),   # 10 % of the sample
            ("s1", "demand", "data", "", "2026-10", 30, 200),   # 15 % of a doubled sample
            ("s1", "skill", "web", "React", "2026-09", 40, 100),
            ("s1", "skill", "web", "React", "2026-10", 60, 120),
            ("s1", "skill", "", "SQL", "2026-10", 50, 200),
        ])


def test_empty_database_behaviour_stays_the_same(client):
    with db.connect() as conn:
        assert market_view.roles(conn) == []
        assert market_view.demand_rows(conn) == []
        response = market_view.skills_for(conn)
        assert response.role.id == "all" and response.skills == []
        with pytest.raises(market_view.UnknownRole):
            market_view.skills_for(conn, "nope")

    assert client.get("/api/roles").json() == []
    assert client.get("/api/demand").json() == []
    assert client.get("/api/skills").json() == {"role": {"id": "all", "name": "All IT roles"}, "skills": []}
    assert client.get("/api/skills", params={"role": "nope"}).status_code == 404


def test_demand_numbers_unchanged_and_service_matches_endpoint(client):
    _seed()
    with db.connect() as conn:
        rows = market_view.demand_rows(conn, months=12, horizon=3)
    # Same numbers as before the service split (tests/test_api.py::test_demand).
    assert [entry.role.id for entry in rows] == ["web", "data"]  # largest first
    assert rows[0].current == 120 and rows[0].changePct == 20.0  # counts: 100 -> 120
    assert rows[1].current == 30 and rows[1].changePct == 50.0   # shares: 10 % -> 15 %
    assert rows[0].source.model_dump(by_alias=True) == {
        "id": "s1", "name": "Test source", "url": "https://example.org",
        "fetchedAt": "2026-11-01T00:00:00Z", "dataAsOf": None, "comparableFrom": None,
        "datasetUrl": None, "datasetModified": None}
    assert rows[1].shareSeries[0].period == "2026-09" and rows[1].shareSeries[0].value == 10.0
    assert rows[1].shareSeries[1].value == 15.0
    assert rows[0].shareSeries is None

    answer = client.get("/api/demand", params={"months": 12, "horizon": 3})
    assert answer.status_code == 200
    assert answer.json() == [entry.model_dump(by_alias=True) for entry in rows]


def test_skills_numbers_unchanged_and_service_matches_endpoint(client):
    _seed()
    with db.connect() as conn:
        for role in (None, "web", "data"):
            response = market_view.skills_for(conn, role, horizon=3)
            params = {} if role is None else {"role": role}
            assert client.get("/api/skills", params=params).json() == response.model_dump(by_alias=True)
        web = market_view.skills_for(conn, "web")
        assert web.role.name == "Web Developer"
        assert web.skills[0].skill == "React" and web.skills[0].share == 50.0
        assert web.skills[0].changePct == 25.0
        overall = market_view.skills_for(conn)
        assert overall.role.id == "all" and [row.skill for row in overall.skills] == ["SQL"]
        assert market_view.skills_for(conn, "data").skills == []  # known role, no skill data


@pytest.mark.parametrize("path", ["/api/demand", "/api/skills", "/api/roles"])
def test_the_router_does_no_queries_itself(client, monkeypatch, path):
    """The router only calls the service; replacing the service replaces the answer."""
    from app.routers import market as market_router

    calls = []

    def fake_demand(conn, months, horizon):
        calls.append(("demand", conn is not None, months, horizon))
        return []

    def fake_skills(conn, role, horizon):
        calls.append(("skills", role, horizon))
        return SkillsResponse(role=market_view.ALL_ROLES, skills=[])

    def fake_roles(conn):
        calls.append(("roles",))
        return []

    monkeypatch.setattr(market_router.market_view, "demand_rows", fake_demand)
    monkeypatch.setattr(market_router.market_view, "skills_for", fake_skills)
    monkeypatch.setattr(market_router.market_view, "roles", fake_roles)

    if path == "/api/demand":
        assert client.get(path, params={"months": 6, "horizon": 2}).json() == []
        assert calls == [("demand", True, 6, 2)]
    elif path == "/api/skills":
        assert client.get(path, params={"horizon": 2}).json()["skills"] == []
        assert calls == [("skills", None, 2)]
    else:
        assert client.get(path).json() == []
        assert calls == [("roles",)]
