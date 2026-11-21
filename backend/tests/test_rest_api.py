"""rest_api adapter: JSON endpoints, items_path, params, {page} pagination, {target_roles}."""
import json
from datetime import datetime, timezone

import pytest

from app.connectors import rest_api
from app.connectors.base import ConnectorError
from app.connectors.config import Defaults, SourceConfig
from conftest import write_sources

TOKEN = {"Authorization": "Bearer secret"}
FETCHED = datetime(2026, 11, 21, 9, 15, tzinfo=timezone.utc)

ADZUNA = {
    "id": "adzuna_ch",
    "name": "Adzuna",
    "source_url": "https://developer.adzuna.com/",
    "category": ["A", "B", "C"],
    "adapter_type": "rest_api",
    "endpoint": "https://api.example.org/jobs/{page}",
    "pages": 2,
    "params": {"what_or": "{target_roles}", "app_id": "${ADZUNA_APP_ID}", "results_per_page": 2},
    "items_path": "results",
    "field_map": {
        "id": "id",
        "title": "title",
        "summary": "description",
        "region": "location.display_name",
        "url": "redirect_url",
        "published_at": "created",
        "tags": "category.label",
        "metrics": {"salary_min": "salary_min"},
    },
    "refresh_rate": "weekly",
}

ESCO = {
    "id": "esco",
    "name": "ESCO",
    "source_url": "https://esco.ec.europa.eu/de/classification/skill_main",
    "category": ["B"],
    "adapter_type": "rest_api",
    "endpoint": "https://ec.europa.eu/esco/api/search",
    "params": {"type": "skill", "language": "de", "limit": 2},
    "items_path": "_embedded.results",
    "field_map": {"id": "uri", "title": "{preferredLabel.de}", "tags": "ESCO,{className}"},
    "refresh_rate": "monthly",
}

PAGE = {
    "count": 3,
    "results": [
        {"id": "1", "title": "Web Developer", "description": "<p>React und TypeScript</p>",
         "location": {"display_name": "Zürich, Kanton Zürich"}, "redirect_url": "https://adzuna.ch/1",
         "created": "2026-11-20T00:00:00Z", "category": {"label": "IT Jobs"}, "salary_min": 90000},
        {"id": "2", "title": "IT Support", "description": "Active Directory",
         "location": {"display_name": "Bern"}, "redirect_url": "https://adzuna.ch/2",
         "created": "2026-11-19T00:00:00Z", "category": {"label": "IT Jobs"}, "salary_min": None},
    ],
}

ESCO_PAYLOAD = {"total": 2, "_embedded": {"results": [
    {"uri": "http://data.europa.eu/esco/skill/1", "className": "Skill", "title": "python",
     "preferredLabel": {"de": "Python"}},
    {"uri": "http://data.europa.eu/esco/skill/2", "className": "Skill", "title": "sql",
     "preferredLabel": {"de": "SQL"}},
]}}


def patch_fetch(monkeypatch, responder):
    calls: list[str] = []

    def fake(url, *, headers=None, timeout=20.0):
        calls.append(url)
        payload = responder(url) if callable(responder) else responder
        if isinstance(payload, Exception):
            raise payload
        return payload if isinstance(payload, bytes) else json.dumps(payload).encode()

    monkeypatch.setattr(rest_api, "fetch", fake)
    return calls


def test_adzuna_style_payload_is_mapped(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    calls = patch_fetch(monkeypatch, PAGE)
    defaults = Defaults(target_roles=["Web Developer", "IT Support"], target_cities=["Zürich", "Bern"])

    items = rest_api.fetch_items(SourceConfig.model_validate(ADZUNA), defaults=defaults, fetched_at=FETCHED)

    assert len(calls) == 2  # two pages
    assert calls[0].startswith("https://api.example.org/jobs/1?")
    assert "app_id=abc123" in calls[0]
    assert "what_or=Web+Developer+IT+Support" in calls[0] or "what_or=Web%20Developer%20IT%20Support" in calls[0]
    assert "jobs/2" in calls[1]

    assert [item.id for item in items] == ["1", "2", "1", "2"]
    web = items[0]
    assert web.title == "Web Developer"
    assert web.summary == "React und TypeScript"        # HTML stripped
    assert web.region == "ZH"                            # Zürich -> canton
    assert web.url == "https://adzuna.ch/1"
    assert web.published_at == datetime(2026, 11, 20, tzinfo=timezone.utc)
    assert web.tags == ["IT Jobs", "role:Web Developer"]   # category label + role tag from defaults
    assert web.metrics == {"salary_min": 90000.0}
    assert web.category == "A" and web.categories == ["A", "B", "C"]
    assert items[1].metrics == {"salary_min": None}
    assert items[1].region == "BE"


def test_esco_style_nested_payload(monkeypatch):
    patch_fetch(monkeypatch, ESCO_PAYLOAD)

    items = rest_api.fetch_items(SourceConfig.model_validate(ESCO), defaults=Defaults(), fetched_at=FETCHED)

    assert [item.title for item in items] == ["Python", "SQL"]
    assert items[0].id == "http://data.europa.eu/esco/skill/1"
    assert items[0].tags == ["ESCO", "Skill"]
    assert items[0].category == "B"


def test_object_payload_needs_items_path(monkeypatch):
    patch_fetch(monkeypatch, {"results": []})
    source = SourceConfig.model_validate({**ESCO, "items_path": None})

    with pytest.raises(ConnectorError, match="items_path is required"):
        rest_api.fetch_items(source, defaults=Defaults(), fetched_at=FETCHED)


def test_missing_items_path_returns_no_items(monkeypatch):
    patch_fetch(monkeypatch, {"something": "else"})
    items = rest_api.fetch_items(SourceConfig.model_validate(ESCO), defaults=Defaults(), fetched_at=FETCHED)
    assert items == []


def test_pagination_stops_on_empty_page(monkeypatch):
    def responder(url):
        return PAGE if "/1" in url else {"results": []}

    calls = patch_fetch(monkeypatch, responder)
    items = rest_api.fetch_items(SourceConfig.model_validate({**ADZUNA, "pages": 3}), defaults=Defaults(),
                                 fetched_at=FETCHED)

    assert len(calls) == 2 and len(items) == 2


def test_rest_error_is_reported_per_source(sources_file, client, monkeypatch):
    write_sources(sources_file, [ADZUNA])
    patch_fetch(monkeypatch, b'{"broken": ')

    result = client.post("/api/connectors/sync", headers=TOKEN).json()["results"][0]

    assert "not valid JSON" in result["error"]
    assert client.get("/api/items").json() == []


def test_check_cli_reports_missing_env(monkeypatch):
    from app.connectors.__main__ import main

    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    code = main(["check", "adzuna_ch"])
    assert code == 1  # the shipped config needs the Adzuna keys
