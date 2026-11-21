from app import config, db
from conftest import TOKEN


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


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_empty_db(client):
    assert client.get("/api/demand").json() == []
    assert client.get("/api/roles").json() == []
    assert client.get("/api/sources").json() == []
    assert client.get("/api/skills").json() == {"role": {"id": "all", "name": "All IT roles"}, "skills": []}
    assert client.get("/api/skills", params={"role": "nope"}).status_code == 404


def test_demand(client):
    _seed()
    d = client.get("/api/demand").json()
    assert [x["role"]["id"] for x in d] == ["web", "data"]  # largest first
    assert d[0]["current"] == 120 and d[0]["changePct"] == 20.0  # vs. previous month; no base: counts
    assert len(d[0]["series"]) == 3
    assert d[1]["current"] == 30 and d[1]["changePct"] == 50.0   # base: share 10 % -> 15 %, not +200 %
    assert d[0]["source"] == {"id": "s1", "name": "Test source", "url": "https://example.org",
                              "fetchedAt": "2026-11-01T00:00:00Z", "dataAsOf": None,
                              "comparableFrom": None, "datasetUrl": None, "datasetModified": None}


def test_skills(client):
    _seed()
    s = client.get("/api/skills", params={"role": "web"}).json()
    assert s["role"]["name"] == "Web Developer"
    assert s["skills"][0]["skill"] == "React"
    assert s["skills"][0]["share"] == 50.0       # 60 / 120
    assert s["skills"][0]["changePct"] == 25.0   # 40 % -> 50 %
    overall = client.get("/api/skills").json()
    assert overall["role"]["id"] == "all" and [x["skill"] for x in overall["skills"]] == ["SQL"]
    assert client.get("/api/skills", params={"role": "data"}).json()["skills"] == []  # known role, no skills


def test_delete_source(client, monkeypatch):
    _seed()
    assert client.delete("/api/sources/s1").status_code == 401
    assert client.delete("/api/sources/s1", headers=TOKEN).status_code == 204
    assert client.get("/api/demand").json() == []
    assert client.delete("/api/sources/s1", headers=TOKEN).status_code == 404
    monkeypatch.setattr(config, "INGEST_TOKEN", None)
    assert client.delete("/api/sources/s1", headers=TOKEN).status_code == 503
