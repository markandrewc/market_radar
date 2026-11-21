"""Shared plumbing for all adapters: fetching, field mapping, normalisation.

An adapter only turns its payload into a list of dicts (one per record) and lets
``normalise()`` do the rest, so adding a source is a YAML block, not code.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import ssl
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape as html_unescape
from typing import Any
from urllib.request import Request, urlopen

from ..schemas import MarketItem
from .config import Defaults, SourceConfig, expand_env

USER_AGENT = "market-radar/1.0 (+https://github.com/markandrewc/market_radar)"
MAX_BYTES = 8 * 1024 * 1024

_TEMPLATE = re.compile(r"(?<!\$)\{([^{}]+)\}")  # not ${ENV}

_TAG_SPLIT = re.compile(r"[,;|]")
_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")
_ODATA_DATE = re.compile(r"^/Date\((-?\d+)(?:[+-]\d{4})?\)/$")

ADAPTERS: dict[str, str] = {"rest_api": "rest_api", "rss_atom": "rss_atom", "csv_url": "csv_url"}


class ConnectorError(RuntimeError):
    """The source could not be read, or its payload is not what the adapter expects."""


def _ssl_context() -> ssl.SSLContext:
    """Use certifi's bundle when available: some Python builds ship without a usable CA store."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # pragma: no cover - certifi is a dependency, this is the safety net
        return ssl.create_default_context()


def fetch(url: str, *, headers: dict[str, str] | None = None, timeout: float = 20.0) -> bytes:
    """GET a URL (http(s) or file). Only used on URLs validated by the config loader."""
    target = expand_env(url)
    request = Request(target, headers={
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
        **{name: expand_env(value) for name, value in (headers or {}).items()},
    })
    tls = {"context": _ssl_context()} if target.startswith("https://") else {}
    try:
        with urlopen(request, timeout=timeout, **tls) as response:  # noqa: S310 - schemes restricted by the loader
            body = response.read(MAX_BYTES + 1)
    except Exception as exc:  # HTTPError, URLError, timeout, missing file
        raise ConnectorError(f"{target}: {exc}") from exc
    if len(body) > MAX_BYTES:
        raise ConnectorError(f"{target}: payload larger than {MAX_BYTES} bytes")
    return body


def dig(record: Any, path: str) -> Any:
    """Read a dotted path such as ``location.display_name`` or ``_embedded.results.0.title``."""
    value = record
    for part in path.split("."):
        if value is None:
            return None
        if isinstance(value, dict):
            value = value.get(part)
        elif isinstance(value, list):
            value = value[int(part)] if part.isdigit() and int(part) < len(value) else None
        else:
            return None
    return value


def text_of(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value).strip()


def render(template: str, record: dict) -> str:
    """Fill ``{path}`` placeholders from the record, e.g. "{Year}-01-01T00:00:00Z"."""
    if "{" not in template:
        return template
    return _TEMPLATE.sub(lambda match: text_of(dig(record, match.group(1).strip())), template)


def parse_datetime(value: Any) -> datetime | None:
    """ISO 8601 (JSON, Atom), RFC 2822 (RSS pubDate), OData /Date(ms)/ or a year -> UTC datetime."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        moment = value
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        moment = datetime.fromtimestamp(float(value), tz=timezone.utc)
    else:
        raw = str(value).strip()
        if not raw:
            return None
        odata = _ODATA_DATE.match(raw)
        if odata:
            moment = datetime.fromtimestamp(int(odata.group(1)) / 1000, tz=timezone.utc)
        else:
            iso = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
            try:
                moment = datetime.fromisoformat(iso)
            except ValueError:
                try:
                    moment = parsedate_to_datetime(raw)
                except (TypeError, ValueError):
                    return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def to_number(value: Any) -> float | None:
    """Accept 41, "41", "41.0", "1 234", "1'234" and "1,5"; everything else is not a number."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        raw = str(value).strip().replace("'", "").replace(" ", "")
        if not raw:
            return None
        if "," in raw and "." in raw:
            raw = raw.replace(",", "")
        elif "," in raw:
            raw = raw.replace(",", ".")
        try:
            number = float(raw)
        except ValueError:
            return None
    return number if math.isfinite(number) else None


def html_to_text(value: Any) -> str:
    cleaned = _HTML_TAG.sub(" ", text_of(value))
    return _WHITESPACE.sub(" ", html_unescape(cleaned)).strip()


def normalise(record: dict, source: SourceConfig, defaults: Defaults, fetched_at: datetime) -> MarketItem | None:
    """Map one raw record to MarketItem, or None when it has no usable title."""
    field_map = source.field_map or {}

    def value(field: str, *fallbacks: str) -> Any:
        configured = field_map.get(field)
        if isinstance(configured, str):
            return render(configured, record) if "{" in configured else dig(record, configured)
        for candidate in (field, *fallbacks):
            found = dig(record, candidate)
            if found not in (None, ""):
                return found
        return None

    title = html_to_text(value("title", "name", "Title"))[:400]
    if not title:
        return None

    item_id = text_of(value("id", "guid", "uri")) or hashlib.sha256(
        json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    region_raw = text_of(value("region", "canton", "location")) or source.region
    tags = _tags(value("tags", "categories"), source.tags)
    tags += _role_tags(f"{title} {text_of(value('summary', 'description'))}", defaults.target_roles)

    return MarketItem(
        id=item_id[:200],
        category=source.category[0],
        categories=list(source.category),
        title=title,
        summary=html_to_text(value("summary", "description", "Abstract", "content"))[:1000],
        metrics=_metrics(record, field_map.get("metrics")),
        tags=tags,
        region=_canton(region_raw, defaults),
        source_name=source.name,
        source_url=source.source_url,
        url=text_of(value("url", "link", "href")) or None,
        published_at=parse_datetime(value("published_at", "date", "publication_date", "created", "updated")),
        fetched_at=fetched_at,
        payload=_payload(record),
    )


def _tags(value: Any, static: list[str]) -> list[str]:
    raw = value if isinstance(value, list) else _TAG_SPLIT.split(text_of(value))
    out: list[str] = []
    for tag in [*raw, *static]:
        cleaned = text_of(tag)[:80]
        if cleaned and cleaned.lower() not in {existing.lower() for existing in out}:
            out.append(cleaned)
    return out[:20]


def _role_tags(text: str, roles: list[str]) -> list[str]:
    haystack = text.lower()
    return [f"role:{role}" for role in roles if role.lower() in haystack]


def _metrics(record: dict, mapping: Any) -> dict[str, float | None]:
    if mapping in ("auto", "*"):
        used = {key for key in record if to_number(record[key]) is not None}
        return {key: to_number(record[key]) for key in used if to_number(record[key]) is not None}
    if not isinstance(mapping, dict):
        return {}
    out: dict[str, float | None] = {}
    for name, path in mapping.items():
        raw = render(path, record) if "{" in path else dig(record, path)
        out[name] = to_number(raw)
    return out


def _canton(value: str, defaults: Defaults) -> str | None:
    """Canton code when the text mentions a target city or is a code itself, else None."""
    if not value:
        return None
    cleaned = value.strip()
    if re.fullmatch(r"[A-Z]{2}", cleaned):
        return cleaned
    haystack = cleaned.lower()
    for city, canton in defaults.canton_map().items():
        if city in haystack:
            return canton
    return None


def _payload(record: dict) -> dict:
    """Raw record for the AI matcher, with long strings trimmed so JSONB stays small."""
    def clean(value: Any) -> Any:
        if isinstance(value, str):
            return value[:4000]
        if isinstance(value, dict):
            return {key: clean(item) for key, item in list(value.items())[:50]}
        if isinstance(value, list):
            return [clean(item) for item in value[:50]]
        return value

    return {key: clean(value) for key, value in list(record.items())[:50]}


def matches_keywords(item: MarketItem, keywords: list[str]) -> bool:
    haystack = f"{item.title} {item.summary} {' '.join(item.tags)}".lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def apply_filters(items: list[MarketItem], source: SourceConfig, defaults: Defaults) -> list[MarketItem]:
    """Keyword filter (default: policy keywords for category E) and optional region filter."""
    keywords = source.filter_keywords or (defaults.policy_keywords if "E" in source.category else [])
    if keywords:
        items = [item for item in items if matches_keywords(item, keywords)]
    if source.filter_regions:
        allowed = {defaults.canton_map().get(city.lower()) for city in defaults.target_cities}
        allowed.discard(None)
        items = [item for item in items if item.region in allowed]
    return items
