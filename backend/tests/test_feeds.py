"""rss_atom adapter: RSS 2.0 and Atom, several feeds per source, keyword filtering."""
from datetime import datetime, timezone

import pytest

from app.connectors import rss_atom
from app.connectors.base import ConnectorError, apply_filters
from app.connectors.config import Defaults, SourceConfig
from conftest import write_sources

TOKEN = {"Authorization": "Bearer secret"}
FETCHED = datetime(2026, 11, 21, 9, 15, tzinfo=timezone.utc)

RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Fedlex AS</title>
  <item>
    <title>Änderung des Asylgesetzes</title>
    <link>https://www.fedlex.admin.ch/eli/cc/2026/512/de</link>
    <description><![CDATA[<p>Die <b>Erwerbstätigkeit</b> von Asylsuchenden wird pr&auml;zisiert.</p>]]></description>
    <pubDate>Thu, 12 Nov 2026 00:00:00 GMT</pubDate>
    <guid>https://www.fedlex.admin.ch/eli/cc/2026/512/de</guid>
    <category>Asyl</category>
  </item>
  <item>
    <title>Verordnung über die Erwerbstätigkeit</title>
    <link>https://www.fedlex.admin.ch/eli/cc/2026/487/de</link>
    <description>Regelt die Bewilligungspraxis.</description>
    <pubDate>Wed, 28 Oct 2026 00:00:00 GMT</pubDate>
  </item>
</channel></rss>""".encode()

ATOM = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Parlament</title>
  <entry>
    <id>tag:parlament.ch,2026:geschaeft/20264567</id>
    <title>Motion: Stellenmeldepflicht ausweiten</title>
    <link rel="alternate" href="https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=20264567"/>
    <summary type="html">&lt;p&gt;Die Motion verlangt eine Ausweitung.&lt;/p&gt;</summary>
    <published>2026-11-05T00:00:00Z</published>
    <category term="Politik"/>
  </entry>
</feed>""".encode()

POLICY = {
    "id": "policy",
    "name": "Fedlex Politik",
    "source_url": "https://www.fedlex.admin.ch/de/oc",
    "category": ["E"],
    "adapter_type": "rss_atom",
    "endpoint": "https://example.org/feed.xml",
    "filter_keywords": ["Asyl"],
    "refresh_rate": "daily",
}


def patch_fetch(monkeypatch, payload):
    calls: list[str] = []

    def fake(url, *, headers=None, timeout=20.0):
        calls.append(url)
        if isinstance(payload, Exception):
            raise payload
        return payload

    monkeypatch.setattr(rss_atom, "fetch", fake)
    return calls


def test_rss_items_are_normalised(monkeypatch):
    patch_fetch(monkeypatch, RSS)
    items = rss_atom.fetch_items(SourceConfig.model_validate(POLICY), defaults=Defaults(), fetched_at=FETCHED)

    assert [item.id for item in items] == ["https://www.fedlex.admin.ch/eli/cc/2026/512/de",
                                           "https://www.fedlex.admin.ch/eli/cc/2026/487/de"]
    first, second = items
    assert first.title == "Änderung des Asylgesetzes"
    assert first.summary == "Die Erwerbstätigkeit von Asylsuchenden wird präzisiert."
    assert first.url == "https://www.fedlex.admin.ch/eli/cc/2026/512/de"
    assert first.published_at == datetime(2026, 11, 12, tzinfo=timezone.utc)
    assert first.tags == ["Asyl"]
    assert first.category == "E" and first.categories == ["E"]
    assert second.published_at == datetime(2026, 10, 28, tzinfo=timezone.utc)
    assert second.tags == []


def test_atom_entries_are_normalised(monkeypatch):
    patch_fetch(monkeypatch, ATOM)
    items = rss_atom.fetch_items(SourceConfig.model_validate(POLICY), defaults=Defaults(), fetched_at=FETCHED)

    item = items[0]
    assert item.id == "tag:parlament.ch,2026:geschaeft/20264567"
    assert item.title == "Motion: Stellenmeldepflicht ausweiten"
    assert item.summary == "Die Motion verlangt eine Ausweitung."
    assert item.url == "https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=20264567"
    assert item.published_at == datetime(2026, 11, 5, tzinfo=timezone.utc)
    assert item.tags == ["Politik"]


def test_several_feeds_are_merged(monkeypatch):
    monkeypatch.setattr(rss_atom, "fetch", lambda url, **_: RSS if "as" in url else ATOM)
    source = SourceConfig.model_validate({**POLICY, "endpoint": None,
                                          "endpoints": ["https://example.org/rss-as.xml", "https://example.org/atom.xml"]})

    items = rss_atom.fetch_items(source, defaults=Defaults(), fetched_at=FETCHED)

    assert len(items) == 3


def test_invalid_feed_raises_a_connector_error(monkeypatch):
    patch_fetch(monkeypatch, b"<html><body>404</body></html>")
    with pytest.raises(ConnectorError, match="no <item> or <entry>"):
        rss_atom.fetch_items(SourceConfig.model_validate(POLICY), defaults=Defaults(), fetched_at=FETCHED)

    patch_fetch(monkeypatch, b"not xml at all")
    with pytest.raises(ConnectorError, match="not valid XML"):
        rss_atom.fetch_items(SourceConfig.model_validate(POLICY), defaults=Defaults(), fetched_at=FETCHED)


def test_policy_keywords_filter_category_e_items(monkeypatch):
    patch_fetch(monkeypatch, RSS)
    source = SourceConfig.model_validate({k: v for k, v in POLICY.items() if k != "filter_keywords"})
    items = rss_atom.fetch_items(source, defaults=Defaults(), fetched_at=FETCHED)

    filtered = apply_filters(items, source, Defaults(policy_keywords=["Asyl", "Stellenmeldepflicht"]))

    assert [item.title for item in filtered] == ["Änderung des Asylgesetzes"]


def test_sync_stores_policy_items(sources_file, client, monkeypatch):
    write_sources(sources_file, [POLICY])
    patch_fetch(monkeypatch, RSS)

    result = client.post("/api/connectors/sync", headers=TOKEN).json()

    assert result["items"] == 1  # only the item matching filter_keywords
    items = client.get("/api/items?category=E").json()
    assert items[0]["title"] == "Änderung des Asylgesetzes"
    assert items[0]["published_at"] == "2026-11-12T00:00:00Z"
    assert items[0]["tags"] == ["Asyl"]
