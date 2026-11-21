"""BFS BESTA: open positions (quarterly), by economic division and large region.

The workbook has one sheet per measure and a wide layout: years in one header row, quarters (I-IV) in the next,
one column per quarter. We keep the total, the two ICT divisions and the seven large regions - the rest of the
branches do not tell anything about the IT labour market. Each selected row contributes one MarketItem per
quarter (category D), with the latest 8 quarters.
"""
from ..base import ParseOutput, RawFile
from .xlsx import QUARTER_END_MONTH, make_item, number, open_workbook

# (row key, row label in column B, tag) - the Total row plus the ICT branches and the large regions.
SELECTED = [
    ("total", "Total", "noga-5-96"),
    ("ict", "Informationstechnologische und Informationsdienstl.", "noga-62-63"),
    ("info", "Information und Kommunikation", "noga-58-63"),
    ("region-genferseeregion", "Genferseeregion", "region"),
    ("region-espace-mittelland", "Espace Mittelland", "region"),
    ("region-nordwestschweiz", "Nordwestschweiz", "region"),
    ("region-zuerich", "Zürich", "region"),
    ("region-ostschweiz", "Ostschweiz", "region"),
    ("region-zentralschweiz", "Zentralschweiz", "region"),
    ("region-tessin", "Tessin", "region"),
]
# (sheet, indicator, metric name, unit, id suffix) - the suffix keeps counts and rate apart: both exist for the
# same row and quarter, so they must not share a MarketItem id.
MEASURES = [
    ("Anzahl der offenen Stellen", "Offene Stellen", "offene_stellen_tausend", "Tausend", "offene-stellen"),
    ("Quote der offenen Stellen", "Quote offener Stellen", "quote_pct", "%", "quote"),
]
QUARTERS = 8


def _quarter_columns(year_row: tuple, quarter_row: tuple) -> list[tuple[int, str]]:
    """column index -> YYYY-MM of the quarter that column belongs to."""
    columns: list[tuple[int, str]] = []
    year = None
    for index, value in enumerate(year_row):
        if isinstance(value, int) and 1990 <= value <= 2100:
            year = value
        quarter = quarter_row[index] if index < len(quarter_row) else None
        if year and isinstance(quarter, str) and quarter.strip() in QUARTER_END_MONTH:
            columns.append((index, f"{year}-{QUARTER_END_MONTH[quarter.strip()]:02d}"))
    return columns


def _find_row(rows: list[tuple], label: str) -> tuple | None:
    for row in rows:
        if isinstance(row[1], str) and row[1].strip().lower() == label.strip().lower():
            return row
    return None


def parse(f: RawFile) -> ParseOutput:
    out = ParseOutput()
    with open_workbook(f) as workbook:
        for sheet, indicator, metric_name, unit, suffix in MEASURES:
            if sheet not in workbook.sheetnames:
                raise ValueError(f"sheet {sheet!r} missing (found {workbook.sheetnames})")
            rows = list(workbook[sheet].iter_rows(values_only=True))
            if len(rows) < 6:
                raise ValueError(f"{sheet}: too short for a BESTA table")
            year_row, quarter_row = rows[3], rows[4]
            columns = _quarter_columns(year_row, quarter_row)
            if not columns:
                raise ValueError(f"{sheet}: no year/quarter header found")
            columns = columns[-QUARTERS:]
            for key, label, tag in SELECTED:
                row = _find_row(rows, label)
                if row is None:
                    continue
                for index, period in columns:
                    value = number(row[index]) if index < len(row) else None
                    if value is None:
                        continue
                    out.items.append(make_item(
                        f, key=f"{key}-{suffix}", label=label, indicator=indicator, period=period,
                        metrics={metric_name: value}, region=None, tags=("bfs", "besta", tag),
                        summary=f"{label}: {value:g} {unit} ({period})."))
    if not out.items:
        raise ValueError("no BESTA rows found")
    return out

