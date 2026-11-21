"""SEM table 6-22: provisionally admitted persons and their employment, per canton, per month.

Canton sheet "CH-Kt", columns: B total, C persons able to work, D employed, E employment rate (0..1).
One MarketItem per canton (category D).
"""
from ..base import ParseOutput, RawFile
from .xlsx import TOTALS, canton_code, canton_rows, make_item, number, period_of, slug

COLUMNS = {"bestand": 1, "erwerbsfaehig": 2, "erwerbstaetig": 3}
RATE = 4
INDICATOR = "Vorläufig Aufgenommene"


def parse(f: RawFile) -> ParseOutput:
    period = period_of(f)
    out = ParseOutput()
    for label, values in canton_rows(f):
        metrics = {name: number(values[index]) for name, index in COLUMNS.items()}
        if metrics["bestand"] is None:
            continue
        rate = number(values[RATE]) if len(values) > RATE else None
        metrics["erwerbstaetigenquote_pct"] = round(rate * 100, 1) if rate is not None else None
        region = canton_code(label)
        key = region or ("total" if label.lower() in TOTALS else slug(label))
        employed = metrics["erwerbstaetig"] or 0
        out.items.append(make_item(
            f, key=key, label=label, indicator=INDICATOR, period=period, metrics=metrics, region=region,
            tags=("status-f", "erwerb", "6-22"),
            summary=(f"{label}: {metrics['bestand']:.0f} vorläufig Aufgenommene im {period}, "
                     f"davon {employed:.0f} erwerbstätig.")))
    if not out.items:
        raise ValueError("no canton rows found in CH-Kt")
    return out

