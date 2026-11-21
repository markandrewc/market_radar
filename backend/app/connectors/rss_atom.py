"""rss_atom adapter: RSS 2.0 <item> and Atom <entry>, one or more feeds per source.

Feeds are the cheapest way to add a source: title, link, date and categories are
enough for a MarketItem, and ``field_map`` decides which date field wins.
"""
import xml.etree.ElementTree as ET

from ..schemas import MarketItem
from .base import ConnectorError, fetch, normalise
from .config import Defaults, SourceConfig

ATOM = "{http://www.w3.org/2005/Atom}"
CONTENT_ENCODED = "{http://purl.org/rss/1.0/modules/content/}encoded"


def _text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return " ".join("".join(node.itertext()).split())


def _link(node: ET.Element) -> str:
    """RSS uses <link>text</link>, Atom uses <link href=... rel=alternate> (namespaced)."""
    for tag in ("link", f"{ATOM}link"):
        for candidate in node.findall(tag):
            href = candidate.get("href")
            if href and candidate.get("rel", "alternate") == "alternate":
                return href
    return ""


def _categories(node: ET.Element) -> list[str]:
    out: list[str] = []
    for tag in ("category", f"{ATOM}category"):
        for candidate in node.findall(tag):
            value = candidate.get("term") or _text(candidate)
            if value:
                out.append(value)
    return out


def _rss_item(node: ET.Element) -> dict:
    guid = node.find("guid")
    return {
        "id": _text(guid) or _text(node.find("link")),
        "title": _text(node.find("title")),
        "summary": _text(node.find("description")) or _text(node.find(CONTENT_ENCODED)),
        "url": _text(node.find("link")),
        "published_at": _text(node.find("pubDate")),
        "tags": _categories(node),
    }


def _atom_entry(node: ET.Element) -> dict:
    return {
        "id": _text(node.find(f"{ATOM}id")),
        "title": _text(node.find(f"{ATOM}title")),
        "summary": _text(node.find(f"{ATOM}summary")) or _text(node.find(f"{ATOM}content")),
        "url": _link(node) or _text(node.find(f"{ATOM}id")),
        "published_at": _text(node.find(f"{ATOM}published")) or _text(node.find(f"{ATOM}updated")),
        "tags": _categories(node),
    }


def _records(root: ET.Element, url: str) -> list[dict]:
    records = [_rss_item(node) for node in root.iter("item")]
    records += [_atom_entry(node) for node in root.iter(f"{ATOM}entry")]
    if not records:
        raise ConnectorError(f"{url}: no <item> or <entry> found - is this an RSS/Atom feed?")
    return records


def fetch_items(source: SourceConfig, *, defaults: Defaults, fetched_at) -> list[MarketItem]:
    items: list[MarketItem] = []
    for url in source.urls:
        body = fetch(url, headers=source.headers, timeout=source.timeout)
        try:
            root = ET.fromstring(body)
        except ET.ParseError as exc:
            raise ConnectorError(f"{url}: not valid XML ({exc})") from exc
        for record in _records(root, url):
            item = normalise(record, source, defaults, fetched_at)
            if item is not None:
                items.append(item)
    return items
