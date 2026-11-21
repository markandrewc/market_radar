"""SEM table 7-70: requests and decisions for temporary protection (status S), per canton, per month.

Canton sheet "CH-Kt", columns: B new requests, E completed cases, F protection granted, G rejected,
I protection rate (0..1). One MarketItem per canton (category D).
"""
from ..base import ParseOutput, RawFile
from .xlsx import TOTALS, canton_code, canton_rows, make_item, number, period_of, slug

COLUMNS = {"gesuche": 1, "erledigungen": 4, "schutzgewaehrungen": 5, "ablehnungen": 6}
RATE = 8
INDICATOR = "Schutzstatus S"


def parse(f: RawFile) -> ParseOutput:
    period = period_of(f)
    out = ParseOutput()
    for label, values in canton_rows(f):
        metrics = {name: number(values[index]) for name, index in COLUMNS.items()}
        if metrics["gesuche"] is None:
            continue
        rate = number(values[RATE]) if len(values) > RATE else None
        metrics["schutzgewaehrungsquote_pct"] = round(rate * 100, 1) if rate is not None else None
        region = canton_code(label)
        key = region or ("total" if label.lower() in TOTALS else slug(label))
        out.items.append(make_item(
            f, key=key, label=label, indicator=INDICATOR, period=period, metrics=metrics, region=region,
            tags=("status-s", "asyl", "7-70"),
            summary=(f"{label}: {metrics['gesuche']:.0f} neue Gesuche um vorübergehenden Schutz im {period}, "
                     f"{metrics['schutzgewaehrungen'] or 0:.0f} Schutzgewährungen.")))
    if not out.items:
        raise ValueError("no canton rows found in CH-Kt")
    return out

