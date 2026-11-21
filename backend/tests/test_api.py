import pytest
from fastapi.testclient import TestClient

from app import config, db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    from app.main import app
    with TestClient(app) as c:
        yield c


def _seed():
    conn = db.connect()
    conn.execute("INSERT INTO sources VALUES ('s1', 'Test source', 'https://example.org', '2026-11-01T00:00:00Z')")
    conn.execute("INSERT INTO roles VALUES ('web', 'Web Developer')")
    conn.executemany("INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?)", [
        ("s1", "demand", "web", "", "2026-09", 100, None),
        ("s1", "demand", "web", "", "2026-10", 120, None),
        ("s1", "skill", "web", "React", "2026-09", 40, 100),
        ("s1", "skill", "web", "React", "2026-10", 60, 120),
    ])
    conn.commit()
    conn.close()


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
