"""SEM table 7-21: asylum applications per canton, per month.

Canton sheet "CH-Kt", columns: B total applications, C first applications, D secondary applications.
One MarketItem per canton (category D), the Total row becomes the Switzerland-wide record.
"""
from ..base import ParseOutput, RawFile
from .xlsx import TOTALS, canton_code, canton_rows, make_item, number, period_of, slug

COLUMNS = {"asylgesuche": 1, "primaer": 2, "sekundaer": 3}
INDICATOR = "Asylgesuche"


def parse(f: RawFile) -> ParseOutput:
    period = period_of(f)
    out = ParseOutput()
    for label, values in canton_rows(f):
        metrics = {name: number(values[index]) for name, index in COLUMNS.items()}
        if metrics["asylgesuche"] is None:
            continue
        region = canton_code(label)
        key = region or ("total" if label.lower() in TOTALS else slug(label))
        total = metrics["asylgesuche"] or 0
        primaer = metrics["primaer"] or 0
        out.items.append(make_item(
            f, key=key, label=label, indicator=INDICATOR, period=period, metrics=metrics, region=region,
            tags=("asyl", "7-21"),
            summary=f"{label}: {total:.0f} Asylgesuche im {period}, davon {primaer:.0f} primär."))
    if not out.items:
        raise ValueError("no canton rows found in CH-Kt")
    return out

