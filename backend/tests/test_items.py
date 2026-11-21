"""CSV adapter, field mapping, filters, sync and GET /api/items."""
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from app import db
from app.connectors import base, csv_url
from app.connectors.base import ConnectorError
from app.connectors.config import Defaults, SourceConfig
from conftest import write_sources

TOKEN = {"Authorization": "Bearer secret"}
SCHEMA = json.loads((Path(__file__).resolve().parents[2] / "docs" / "market-item.schema.json").read_text())
FETCHED = datetime(2026, 11, 21, 9, 15, tzinfo=timezone.utc)

CSV = """monat,kennzahl,auspraegung,anzahl,basis
2026-10,inserate,aktiv,38,
2026-11,inserate,aktiv,41,41
"""

ITBOARD = {
    "id": "itboard",
    "name": "ITBoard",
    "source_url": "https://www.itboard.ch/arbeitsmarkt",
    "category": ["A"],
    "adapter_type": "csv_url",
    "endpoint": "https://example.org/daten.csv",
    "refresh_rate": "weekly",
    "field_map": {
        "id": "{monat}:{kennzahl}:{auspraegung}",
        "title": "{kennzahl} {auspraegung} ({monat})",
        "summary": "ITBoard {kennzahl} {auspraegung}: {anzahl} (Basis {basis}).",
        "published_at": "{monat}-01T00:00:00Z",
        "tags": "{kennzahl},{auspraegung}",
        "metrics": {"anzahl": "anzahl", "basis": "basis"},
    },
}

DEFAULTS = {"target_cities": ["Zürich", "Bern"], "target_roles": ["IT Support"], "policy_keywords": ["Asyl"]}


def patch_fetch(monkeypatch, payload, module=csv_url):
    """Replace the adapter's HTTP call; returns the list of requested URLs."""
    calls: list[str] = []

    def fake(url, *, headers=None, timeout=20.0):
        calls.append(url)
        if isinstance(payload, Exception):
            raise payload
        return payload if isinstance(payload, bytes) else payload.encode()

    monkeypatch.setattr(module, "fetch", fake)
    return calls


@pytest.fixture
def configured(sources_file):
    write_sources(sources_file, [ITBOARD], DEFAULTS)
    return sources_file


def test_csv_adapter_normalises_rows(monkeypatch):
    patch_fetch(monkeypatch, CSV)
    source = SourceConfig.model_validate(ITBOARD)

    items = csv_url.fetch_items(source, defaults=Defaults(target_cities=["Zürich"]), fetched_at=FETCHED)

    assert [item.id for item in items] == ["2026-10:inserate:aktiv", "2026-11:inserate:aktiv"]
    first, last = items
    assert first.title == "inserate aktiv (2026-10)"
    assert first.summary == "ITBoard inserate aktiv: 38 (Basis )."
    assert first.metrics == {"anzahl": 38.0, "basis": None}
    assert first.tags == ["inserate", "aktiv"]
    assert first.category == "A" and first.categories == ["A"]
    assert first.published_at == datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert first.fetched_at == FETCHED
    assert first.region is None
    assert first.source_name == "ITBoard"
    assert first.payload["kennzahl"] == "inserate"
    assert last.metrics["basis"] == 41.0


def test_item_matches_the_frozen_schema(monkeypatch):
    patch_fetch(monkeypatch, CSV)
    item = csv_url.fetch_items(SourceConfig.model_validate(ITBOARD), defaults=Defaults(), fetched_at=FETCHED)[0]

    Draft202012Validator(SCHEMA).validate(item.model_dump(mode="json"))


@pytest.mark.parametrize("raw,expected", [
    ("2026-11-21T08:00:00Z", datetime(2026, 11, 21, 8, tzinfo=timezone.utc)),
    ("2026-11-21T09:00:00+01:00", datetime(2026, 11, 21, 8, tzinfo=timezone.utc)),
    ("2026-11-01", datetime(2026, 11, 1, tzinfo=timezone.utc)),
    ("Sat, 21 Nov 2026 08:00:00 GMT", datetime(2026, 11, 21, 8, tzinfo=timezone.utc)),   # RSS pubDate
    ("/Date(1763708400000)/", datetime.fromtimestamp(1763708400, tz=timezone.utc)),      # OData
    ("", None),
    ("not a date", None),
])
def test_parse_datetime(raw, expected):
    assert base.parse_datetime(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("41", 41.0), ("41.5", 41.5), ("1'234", 1234.0), ("1 234", 1234.0), ("1,5", 1.5),
    ("1,234.5", 1234.5), ("", None), ("n/a", None), (None, None), (True, None),
])
def test_to_number(raw, expected):
    assert base.to_number(raw) == expected


def test_html_and_templates():
    assert base.html_to_text("<p>Hello <b>Welt</b> &amp; Co</p>") == "Hello Welt & Co"
    assert base.render("{a.b} / {missing}", {"a": {"b": 3}}) == "3 / "
    assert base.dig({"a": [{"b": "x"}]}, "a.0.b") == "x"
    assert base.dig({"a": 1}, "a.b.c") is None


def test_region_and_role_tags():
    source = SourceConfig.model_validate({**ITBOARD, "field_map": {
        "id": "ort", "title": "{ort} IT Support", "region": "ort", "metrics": "auto"}})
    record = {"ort": "Zürich", "anzahl": "5"}

    item = base.normalise(record, source, Defaults(target_cities=["Zürich"], target_roles=["IT Support"]), FETCHED)

    assert item.region == "ZH"
    assert "role:IT Support" in item.tags
    assert item.metrics == {"anzahl": 5.0}


def test_filters(monkeypatch):
    patch_fetch(monkeypatch, CSV)
    source = SourceConfig.model_validate(ITBOARD)
    items = csv_url.fetch_items(source, defaults=Defaults(), fetched_at=FETCHED)

    filtered = base.apply_filters(items, SourceConfig.model_validate({**ITBOARD, "filter_keywords": ["41"]}),
                                  Defaults())
    assert [item.id for item in filtered] == ["2026-11:inserate:aktiv"]

    # category E sources fall back to the policy keywords, region filter keeps target cantons only
    policy = SourceConfig.model_validate({**ITBOARD, "category": ["E"], "filter_regions": True})
    assert base.apply_filters(items, policy, Defaults(policy_keywords=["inserate"], target_cities=["Zürich"])) == []


def test_sync_stores_items(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)

    response = client.post("/api/connectors/sync", headers=TOKEN)

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == 2 and body["errors"] == 0
    assert body["results"][0] == {**body["results"][0], "source": "itboard", "adapter": "csv_url",
                                  "items": 2, "replaced": True, "skipped": False, "error": None}

    items = client.get("/api/items").json()
    assert [item["id"] for item in items] == ["2026-11:inserate:aktiv", "2026-10:inserate:aktiv"]
    assert "payload" not in items[0]
    Draft202012Validator(SCHEMA).validate(items[0])

    with db.connect() as conn:
        row = conn.execute("SELECT payload FROM market_items WHERE id = %s", ("2026-11:inserate:aktiv",)).fetchone()
    assert row["payload"]["anzahl"] == "41"

    client.post("/api/connectors/sync", headers=TOKEN)  # identical data: update, no duplicates
    assert len(client.get("/api/items").json()) == 2


def test_connector_listing_reports_counts_and_keeps_sync_state(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    client.post("/api/connectors/sync", headers=TOKEN)
    before = client.get("/api/connectors").json()["sources"][0]

    assert before["itemCount"] == 2
    assert before["lastSyncAt"] and before["lastError"] is None

    configured.write_text(configured.read_text() + "\n")  # edited file: runtime state must survive a reload
    client.post("/api/connectors/reload", headers=TOKEN)
    after = client.get("/api/connectors").json()["sources"][0]

    assert after["itemCount"] == 2
    assert after["lastSyncAt"] == before["lastSyncAt"]


def test_sync_replaces_disappeared_items(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    client.post("/api/connectors/sync", headers=TOKEN)

    patch_fetch(monkeypatch, "monat,kennzahl,auspraegung,anzahl,basis\n2026-11,inserate,aktiv,41,41\n")
    client.post("/api/connectors/sync", headers=TOKEN)

    assert [item["id"] for item in client.get("/api/items").json()] == ["2026-11:inserate:aktiv"]


def test_empty_payload_keeps_existing_items(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    client.post("/api/connectors/sync", headers=TOKEN)

    patch_fetch(monkeypatch, "monat,kennzahl,auspraegung,anzahl,basis\n")
    result = client.post("/api/connectors/sync", headers=TOKEN).json()["results"][0]

    assert result["replaced"] is False and result["items"] == 0
    assert "empty payload" in result["reason"]
    assert len(client.get("/api/items").json()) == 2


def test_sync_skips_source_with_missing_env(sources_file, client, monkeypatch):
    monkeypatch.delenv("MARKET_RADAR_TEST_KEY", raising=False)
    write_sources(sources_file, [{**ITBOARD, "auth_env": ["MARKET_RADAR_TEST_KEY"]}], DEFAULTS)
    calls = patch_fetch(monkeypatch, CSV)

    result = client.post("/api/connectors/sync", headers=TOKEN).json()["results"][0]

    assert result["skipped"] is True
    assert result["reason"] == "missing env: MARKET_RADAR_TEST_KEY"
    assert calls == []


def test_source_errors_do_not_stop_the_others(sources_file, client, monkeypatch):
    write_sources(sources_file, [ITBOARD, {**ITBOARD, "id": "broken", "name": "Broken",
                                           "endpoint": "https://example.org/broken.csv"}], DEFAULTS)

    def fake(url, *, headers=None, timeout=20.0):
        if "broken" in url:
            raise ConnectorError("boom")
        return CSV.encode()

    monkeypatch.setattr(csv_url, "fetch", fake)
    client.post("/api/connectors/reload", headers=TOKEN)
    results = {row["source"]: row for row in client.post("/api/connectors/sync", headers=TOKEN).json()["results"]}

    assert results["broken"]["error"].startswith("ConnectorError: boom")
    assert results["itboard"]["items"] == 2
    with db.connect() as conn:
        last_error = conn.execute("SELECT last_error FROM connector_sources WHERE id = 'broken'").fetchone()
    assert "boom" in last_error["last_error"]


def test_due_only_respects_refresh_rate(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    client.post("/api/connectors/sync", headers=TOKEN)

    result = client.post("/api/connectors/sync?due_only=true", headers=TOKEN).json()["results"][0]
    assert result["skipped"] is True and result["reason"] == "not due"

    write_sources(configured, [{**ITBOARD, "refresh_rate": "static"}], DEFAULTS)
    client.post("/api/connectors/reload", headers=TOKEN)
    static = client.post("/api/connectors/sync?due_only=true", headers=TOKEN).json()["results"][0]
    assert static["reason"] == "not due"
    assert client.post("/api/connectors/sync?source=itboard", headers=TOKEN).json()["items"] == 2  # explicit sync runs


def test_items_filters(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    client.post("/api/connectors/sync", headers=TOKEN)

    assert len(client.get("/api/items?category=A").json()) == 2
    assert client.get("/api/items?category=B").json() == []
    assert client.get("/api/items?category=A&limit=1").json()[0]["id"] == "2026-11:inserate:aktiv"
    assert len(client.get("/api/items?q=inserate").json()) == 2
    assert client.get("/api/items?q=nichts").json() == []
    assert client.get("/api/items?region=ZH").json() == []
    assert client.get("/api/items?source=nope").json() == []
    assert len(client.get("/api/items?source=itboard").json()) == 2      # by source id
    assert len(client.get("/api/items?source=ITBoard").json()) == 2      # by display name
    assert client.get("/api/items?category=F").status_code == 422
    assert client.get("/api/items?order=title").status_code == 422


def test_sync_and_items_are_public_or_token_protected(configured, client, monkeypatch):
    patch_fetch(monkeypatch, CSV)
    assert client.post("/api/connectors/sync").status_code == 401
    assert client.get("/api/items").status_code == 200
    assert client.post("/api/connectors/sync?source=nope", headers=TOKEN).status_code == 404
