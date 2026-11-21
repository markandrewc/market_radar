"""Config-driven connectors: sources.yaml -> adapters -> market_items.

- ``config``   reads and validates sources.yaml (docs/ADDING_SOURCES.md)
- ``base``     shared plumbing for all adapters (fetch, field mapping, MarketItem)
- adapters     ``rest_api``, ``rss_atom``, ``csv_url`` - each returns normalised MarketItems
"""
from collections.abc import Callable

from ..schemas import MarketItem
from . import csv_url, rss_atom
from .base import ConnectorError
from .config import Defaults, SourceConfig

Adapter = Callable[..., list[MarketItem]]

ADAPTERS: dict[str, Adapter] = {
    "csv_url": csv_url.fetch_items,
    "rss_atom": rss_atom.fetch_items,
}


def adapter_for(adapter_type: str) -> Adapter:
    try:
        return ADAPTERS[adapter_type]
    except KeyError:
        raise ConnectorError(f"unknown adapter_type '{adapter_type}' (known: {', '.join(sorted(ADAPTERS))})") from None
