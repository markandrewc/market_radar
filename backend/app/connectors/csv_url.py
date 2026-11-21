"""csv_url adapter: one MarketItem per CSV row (works for long and wide formats)."""
import csv
import io

from ..schemas import MarketItem
from .base import ConnectorError, fetch, normalise
from .config import Defaults, SourceConfig


def fetch_items(source: SourceConfig, *, defaults: Defaults, fetched_at) -> list[MarketItem]:
    items: list[MarketItem] = []
    for url in source.urls:
        body = fetch(url, headers=source.headers, timeout=source.timeout)
        text = body.decode("utf-8-sig", errors="replace")  # utf-8-sig strips a BOM
        reader = csv.DictReader(io.StringIO(text), delimiter=source.delimiter)
        if not reader.fieldnames:
            raise ConnectorError(f"{url}: no CSV header row found")
        for record in reader:
            item = normalise(record, source, defaults, fetched_at)
            if item is not None:
                items.append(item)
    return items
