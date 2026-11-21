"""SEM table 3-25: immigration of foreign residents per canton, per month.

Canton sheet "CH-Kt", columns: B permanent residents (total), E short-term permit L (total),
H permit B (total). One MarketItem per canton (category D).
"""
from ..base import ParseOutput, RawFile
from .xlsx import TOTALS, canton_code, canton_rows, make_item, number, period_of, slug

COLUMNS = {"einwanderung_staendig": 1, "kurzaufenthalter_l": 4, "aufenthalter_b": 7}
INDICATOR = "Einwanderung ausländischer Wohnbevölkerung"


def parse(f: RawFile) -> ParseOutput:
    period = period_of(f)
    out = ParseOutput()
    for label, values in canton_rows(f, headers=("Wohnkanton", "Kanton")):
        metrics = {name: number(values[index]) for name, index in COLUMNS.items()}
        if metrics["einwanderung_staendig"] is None:
            continue
        region = canton_code(label)
        key = region or ("total" if label.lower() in TOTALS else slug(label))
        total = metrics["einwanderung_staendig"] or 0
        out.items.append(make_item(
            f, key=key, label=label, indicator=INDICATOR, period=period, metrics=metrics, region=region,
            tags=("einwanderung", "3-25"),
            summary=f"{label}: {total:.0f} ständige ausländische Wohnbevölkerung im {period}."))
    if not out.items:
        raise ValueError("no canton rows found in CH-Kt")
    return out

