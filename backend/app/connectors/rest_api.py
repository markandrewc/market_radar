"""rest_api adapter: JSON endpoints with query params, {page} pagination and path templates.

The shape of the payload is configuration: ``items_path`` says where the records live
(e.g. ``_embedded.results`` for ESCO, ``d`` for the Parliament OData endpoint) and
``field_map`` maps their fields to MarketItem.
"""
import json
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from ..schemas import MarketItem
from .base import ConnectorError, dig, expand_env, fetch, normalise, render
from .config import Defaults, SourceConfig


def _query(url: str, source: SourceConfig, defaults: Defaults) -> str:
    """Endpoint query + configured params, with {target_roles}/{target_cities} and ${ENV} filled in."""
    if not source.params:
        return url
    placeholders = {"target_roles": " ".join(defaults.target_roles),
                    "target_cities": " ".join(defaults.target_cities)}
    rendered = {name: expand_env(render(str(value), placeholders)) for name, value in source.params.items()}
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(rendered)
    # quote_via=quote keeps spaces as %20 instead of '+', which OData endpoints prefer.
    return urlunsplit(parts._replace(query=urlencode(query, quote_via=quote)))


def _records(payload, source: SourceConfig, url: str) -> list[dict]:
    if source.items_path:
        found = dig(payload, source.items_path)
        if found is None:
            return []
        if not isinstance(found, list):
            raise ConnectorError(f"{url}: items_path '{source.items_path}' does not point at a list")
        return [record for record in found if isinstance(record, dict)]
    if isinstance(payload, list):
        return [record for record in payload if isinstance(record, dict)]
    raise ConnectorError(f'{url}: the JSON is an object, so items_path is required (e.g. items_path: "results")')


def fetch_items(source: SourceConfig, *, defaults: Defaults, fetched_at) -> list[MarketItem]:
    items: list[MarketItem] = []
    for endpoint in source.urls:
        for page in range(1, source.pages + 1):
            url = _query(endpoint.replace("{page}", str(page)), source, defaults)
            body = fetch(url, headers=source.headers, timeout=source.timeout)
            try:
                payload = json.loads(body)
            except json.JSONDecodeError as exc:
                raise ConnectorError(f"{url}: not valid JSON ({exc})") from exc
            records = _records(payload, source, url)
            if not records:  # last page reached, or nothing to read
                break
            for record in records:
                item = normalise(record, source, defaults, fetched_at)
                if item is not None:
                    items.append(item)
            if "{page}" not in endpoint:
                break
    return items
