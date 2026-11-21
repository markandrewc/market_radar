from app import config, db
from conftest import TOKEN


def _seed():
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sources VALUES ('s1', 'Test source', 'https://example.org', '2026-11-01T00:00:00Z')")
        cur.execute("INSERT INTO roles VALUES ('web', 'Web Developer')")
        cur.executemany("INSERT INTO observations VALUES (%s, %s, %s, %s, %s, %s, %s)", [
            ("s1", "demand", "web", "", "2026-09", 100, None),
            ("s1", "demand", "web", "", "2026-10", 120, None),
            ("s1", "skill", "web", "React", "2026-09", 40, 100),
            ("s1", "skill", "web", "React", "2026-10", 60, 120),
        ])


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_empty_db(client):
    assert client.get("/api/demand").json() == []
    assert client.get("/api/roles").json() == []
    assert client.get("/api/skills").status_code == 404


def test_demand_and_skills(client):
    _seed()
    d = client.get("/api/demand").json()
    assert len(d) == 1
    assert d[0]["current"] == 120 and d[0]["changePct"] == 20.0
    assert d[0]["source"] == {"id": "s1", "name": "Test source", "url": "https://example.org",
                              "fetchedAt": "2026-11-01T00:00:00Z"}
    s = client.get("/api/skills", params={"role": "web"}).json()
    assert s["role"]["name"] == "Web Developer"
    assert s["skills"][0]["skill"] == "React"
    assert s["skills"][0]["share"] == 50.0       # 60 / 120
    assert s["skills"][0]["changePct"] == 25.0   # 40 % -> 50 %


PAYLOAD = {
    "source": {"id": "s2", "name": "Upload", "url": "https://example.org/u", "fetchedAt": "2026-11-20T00:00:00Z"},
    "roles": [{"id": "data", "name": "Data Analyst"}],
    "observations": [
        {"metric": "demand", "roleId": "data", "period": "2026-10", "value": 10},
        {"metric": "demand", "roleId": "data", "period": "2026-11", "value": 15},
        {"metric": "skill", "roleId": "data", "skill": "SQL", "period": "2026-11", "value": 6, "base": 15},
    ],
}


def test_ingest_disabled_without_token(client, monkeypatch):
    monkeypatch.setattr(config, "INGEST_TOKEN", None)
    assert client.post("/api/ingest", json=PAYLOAD, headers=TOKEN).status_code == 503


def test_ingest_auth_and_validation(client):
    assert client.post("/api/ingest", json=PAYLOAD).status_code == 401
    bad = {**PAYLOAD, "roles": [], "observations": [{"metric": "skill", "roleId": "x", "period": "2026-11", "value": 1}]}
    r = client.post("/api/ingest", json=bad, headers=TOKEN)
    assert r.status_code == 422 and len(r.json()["detail"]) == 2
    assert client.post("/api/ingest", json={**PAYLOAD, "observations": [
        {"metric": "demand", "roleId": "data", "period": "2026-13", "value": 1}]}, headers=TOKEN).status_code == 422
    assert client.get("/api/sources").json() == []  # nothing written


def test_ingest_roundtrip_and_delete(client):
    r = client.post("/api/ingest", json=PAYLOAD, headers=TOKEN)
    assert r.json() == {"source": "s2", "roles": 1, "observations": 3}
    client.post("/api/ingest", json=PAYLOAD, headers=TOKEN)  # same data again: upsert, no duplicates
    d = client.get("/api/demand").json()
    assert len(d) == 1 and d[0]["current"] == 15 and len(d[0]["series"]) == 2
    assert client.get("/api/skills", params={"role": "data"}).json()["skills"][0]["share"] == 40.0
    client.post("/api/ingest", json={**PAYLOAD, "observations": PAYLOAD["observations"][:1], "replace": True},
                headers=TOKEN)
    assert len(client.get("/api/demand").json()[0]["series"]) == 1
    assert client.delete("/api/sources/s2", headers=TOKEN).status_code == 204
    assert client.get("/api/demand").json() == []
    assert client.delete("/api/sources/s2", headers=TOKEN).status_code == 404
