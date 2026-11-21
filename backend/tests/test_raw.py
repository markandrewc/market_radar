"""Raw store and transform. The parser here is a test double: real parsers need real sample documents."""
from collections import Counter

import pytest

from app.schemas import IngestObservation, Role
from app.transform import parsers
from app.transform.base import Doc, ParseOutput
from conftest import TOKEN


def fake_parser(docs: list[Doc]) -> ParseOutput:
    """Test only: each document is {"role": ..., "month": ..., "skills": [...]}, i.e. one posting."""
    out, demand, skills = ParseOutput(), Counter(), Counter()
    for d in docs:
        if not isinstance(d.content, dict) or "role" not in d.content:
            out.failed[d.id] = "not a posting"
            continue
        demand[(d.content["role"], d.content["month"])] += 1
        for s in d.content["skills"]:
            skills[(d.content["role"], d.content["month"], s)] += 1
    out.roles = [Role(id=r, name=r.title()) for r in {r for r, _ in demand}]
    out.observations = [IngestObservation(metric="demand", roleId=r, period=m, value=n) for (r, m), n in demand.items()]
    out.observations += [IngestObservation(metric="skill", roleId=r, skill=s, period=m, value=n, base=demand[(r, m)])
                         for (r, m, s), n in skills.items()]
    return out


def posting(role, month, *skills):
    return {"fetchedAt": "2026-11-21T08:00:00Z", "content": {"role": role, "month": month, "skills": list(skills)}}


SOURCE = {"id": "jobs", "name": "Job postings", "url": "https://example.org/jobs"}


@pytest.fixture
def with_parser(monkeypatch):
    monkeypatch.setitem(parsers.PARSERS, "jobs", fake_parser)


def test_upload_requires_token(client):
    assert client.post("/api/raw", json={"source": SOURCE, "documents": [posting("web", "2026-11")]}).status_code == 401


def test_upload_validation(client):
    bad = client.post("/api/raw", headers=TOKEN, json={"source": {**SOURCE, "id": "Bad Id"}, "documents": []})
    assert bad.status_code == 422
    no_tz = client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": [
        {"fetchedAt": "2026-11-21T08:00:00", "content": "x"}]})
    assert no_tz.status_code == 422


def test_upload_without_parser_stays_pending(client):
    docs = [posting("web", "2026-11", "React"), {"fetchedAt": "2026-11-21T08:00:00Z", "contentType": "text/csv",
                                                 "content": "a,b\n1,2\n"}]
    r = client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": docs})
    assert r.json() == {"source": "jobs", "received": 2, "duplicates": 0}
    again = client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": docs})
    assert again.json() == {"source": "jobs", "received": 0, "duplicates": 2}
    [st] = client.get("/api/raw/status", headers=TOKEN).json()
    assert (st["hasParser"], st["pending"], st["parsed"]) == (False, 2, 0)
    assert client.get("/api/demand").json() == []
    assert client.get("/api/sources").json()[0]["fetchedAt"] == "2026-11-21T08:00:00Z"


def test_upload_runs_parser(client, with_parser):
    docs = [posting("web", "2026-10", "React"), posting("web", "2026-11", "React", "SQL"),
            posting("web", "2026-11", "SQL"), {"fetchedAt": "2026-11-21T08:00:00Z", "content": [1, 2]}]
    client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": docs})
    [d] = client.get("/api/demand").json()
    assert d["current"] == 2 and [p["value"] for p in d["series"]] == [1, 2]
    sk = {s["skill"]: s["share"] for s in client.get("/api/skills", params={"role": "web"}).json()["skills"]}
    assert sk == {"SQL": 100.0, "React": 50.0}
    [st] = client.get("/api/raw/status", headers=TOKEN).json()
    assert (st["parsed"], st["error"], st["pending"]) == (3, 1, 0)

    # New documents later: the parser sees all documents again and replaces the numbers
    client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": [posting("web", "2026-11", "Go")]})
    assert client.get("/api/demand").json()[0]["current"] == 3


def test_broken_parser_keeps_old_numbers(client, with_parser, monkeypatch):
    client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": [posting("web", "2026-11")]})

    def broken(docs):
        raise KeyError("month")
    monkeypatch.setitem(parsers.PARSERS, "jobs", broken)
    [res] = client.post("/api/transform", headers=TOKEN, params={"source": "jobs"}).json()
    assert res["errors"] == ["KeyError: 'month'"]
    assert client.get("/api/demand").json()[0]["current"] == 1
    [st] = client.get("/api/raw/status", headers=TOKEN).json()
    assert st["error"] == 1


def test_invalid_parser_output_is_rejected(client, with_parser, monkeypatch):
    client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": [posting("web", "2026-11")]})
    monkeypatch.setitem(parsers.PARSERS, "jobs", lambda docs: ParseOutput(observations=[
        IngestObservation(metric="demand", roleId="unknown", period="2026-11", value=1)]))
    [res] = client.post("/api/transform", headers=TOKEN).json()
    assert "unknown roleId" in res["errors"][0]


def test_delete_source_removes_raw_documents(client, with_parser):
    client.post("/api/raw", headers=TOKEN, json={"source": SOURCE, "documents": [posting("web", "2026-11")]})
    assert client.delete("/api/sources/jobs", headers=TOKEN).status_code == 204
    assert client.get("/api/raw/status", headers=TOKEN).json() == []
    assert client.get("/api/demand").json() == []
    assert client.post("/api/transform", headers=TOKEN, params={"source": "jobs"}).status_code == 404
