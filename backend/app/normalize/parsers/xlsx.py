"""Shared helpers for the BFS/SEM Excel tables (normalize step 2).

The files are official monthly/quarterly tables: a canton sheet ("CH-Kt") with a merged multi-row header,
German canton names in column A and one column per result. Their numbers describe the target group (asylum,
residence permits, vacancies by branch), not job demand per role, so they become MarketItems of category D
instead of role observations (docs/market-item.schema.json).
"""
from __future__ import annotations

import re
import warnings
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from openpyxl import load_workbook

from ...schemas import MarketItem
from ..base import RawFile

CANTONS = {
    "aargau": "AG", "appenzell a. rh.": "AR", "appenzell i. rh.": "AI", "basel-land": "BL", "basel-stadt": "BS",
    "bern": "BE", "freiburg": "FR", "genf": "GE", "glarus": "GL", "graubünden": "GR", "jura": "JU", "luzern": "LU",
    "neuenburg": "NE", "nidwalden": "NW", "obwalden": "OW", "schaffhausen": "SH", "schwyz": "SZ", "solothurn": "SO",
    "st. gallen": "SG", "tessin": "TI", "thurgau": "TG", "uri": "UR", "waadt": "VD", "wallis": "VS", "zug": "ZG",
    "zürich": "ZH",
}
TOTALS = {"total", "gesamttotal", "schweiz"}
FOOTNOTE_PREFIXES = ("quelle:", "*")
QUARTER_END_MONTH = {"I": 3, "II": 6, "III": 9, "IV": 12}


def canton_code(label: str) -> str | None:
    return CANTONS.get(label.strip().lower())


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def number(value: Any) -> float | None:
    """Excel cells are numbers, text or placeholders like '-' / '…'."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace("'", "").replace("\u2019", "")
        if not cleaned or cleaned in {"-", "–", "…"}:
            return None
        try:
            return float(cleaned.replace(",", "."))
        except ValueError:
            return None
    return None


def period_of(f: RawFile) -> str:
    """YYYY-MM from the manifest (period / period_end / report_date, in that order)."""
    for key in ("period", "period_end", "report_date"):
        value = f.meta.get(key)
        if isinstance(value, str) and re.match(r"^\d{4}-\d{2}", value):
            return value[:7]
    raise ValueError("no period in latest.json (period/period_end/report_date)")


@contextmanager
def open_workbook(f: RawFile):
    with warnings.catch_warnings():  # openpyxl warns about print areas in the official files
        warnings.simplefilter("ignore")
        workbook = load_workbook(f.path, read_only=True, data_only=True)
    try:
        yield workbook
    finally:
        workbook.close()


def canton_rows(f: RawFile, *, sheet: str = "CH-Kt", headers: tuple[str, ...] = ("Kanton",)) -> Iterator[tuple[str, tuple]]:
    """(label, values) for the Total row and the cantons of an SEM monthly table."""
    with open_workbook(f) as workbook:
        if sheet not in workbook.sheetnames:
            raise ValueError(f"sheet {sheet!r} missing (found {workbook.sheetnames[:5]}...)")
        worksheet = workbook[sheet]
        started = False
        for row in worksheet.iter_rows(values_only=True):
            label = row[0]
            if not started:
                if isinstance(label, str) and label.strip() in headers:
                    started = True
                continue
            if not isinstance(label, str) or not label.strip():
                continue
            cleaned = label.strip()
            if cleaned.lower().startswith(FOOTNOTE_PREFIXES):
                return
            yield cleaned, row


def make_item(f: RawFile, *, key: str, label: str, indicator: str, period: str, metrics: dict[str, float | None],
              region: str | None, tags: tuple[str, ...] = (), summary: str = "") -> MarketItem:
    year, month = (int(part) for part in period.split("-"))
    return MarketItem(
        id=f"{period}:{key}",
        category="D",
        categories=["D"],
        title=f"{indicator}: {label} ({period})",
        summary=summary,
        metrics={name: value for name, value in metrics.items()},
        tags=[f.source_id, *tags],
        region=region,
        source_name=f.meta.get("name") or f.source_id,
        source_url=f.meta.get("report_url") or f.meta.get("source_url") or "",
        url=f.meta.get("source_url"),
        published_at=datetime(year, month, 1, tzinfo=timezone.utc),
        fetched_at=f.fetched_at or datetime.now(timezone.utc),
        payload={"source": f.source_id, "period": period, "label": label, "metrics": metrics},
    )
