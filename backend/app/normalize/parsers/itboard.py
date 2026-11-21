"""ITBoard monthly CSV (https://www.itboard.ch/arbeitsmarkt/daten.csv, CC BY 4.0).

Columns: monat, kennzahl, auspraegung, anzahl, basis. Used here:
- kennzahl 'rolle':       postings per role per month -> metric 'demand' (base = counted postings that month)
- kennzahl 'technologie': postings mentioning a technology, all roles -> metric 'skill', roleId '' (base = counted)
The sample size changes a lot between months, so the API compares shares (value / base), not raw counts.

Series break: ITBoard first assigned each posting to at most one role (role counts add up to less than the counted
postings), later to several (they add up to more). Shares from before and after are not comparable, so the parser
reports the first month of the current way of counting as `comparable_from`.
"""
import csv
import io

from ...schemas import NormalizedObservation, Role
from ..base import ParseOutput, RawFile

HEADER = ["monat", "kennzahl", "auspraegung", "anzahl", "basis"]
NO_TECHNOLOGY = "ohne_chip"  # postings without any technology tag: not a skill
# Written in capitals when a role id is turned into a display name ("it-support" -> "IT Support").
ACRONYMS = {"it", "ux", "ui", "bi", "qa", "sap", "ml", "ai", "ict", "erp", "crm", "seo", "hr"}


def role_name(role_id: str) -> str:
    return " ".join(w.upper() if w in ACRONYMS else w.capitalize() for w in role_id.split("-"))


def _int(value: str, what: str) -> int:
    if not value.isdigit():
        raise ValueError(f"{what}: expected a whole number, got {value!r}")
    return int(value)


def counting_break(role_sum: dict[str, int], counted: dict[str, int]) -> str | None:
    """First month of the current counting regime (one role per posting vs. several), if it changed."""
    regime = [(m, role_sum.get(m, 0) > counted[m]) for m in sorted(counted) if counted[m] and m in role_sum]
    start = None
    for (_, before), (month, now) in zip(regime, regime[1:]):
        if now != before:
            start = month
    return start


def parse(f: RawFile) -> ParseOutput:
    reader = csv.reader(io.StringIO(f.path.read_text(encoding="utf-8-sig")))
    header = next(reader, None)
    if header != HEADER:
        raise ValueError(f"unexpected header {header!r}, expected {HEADER!r}")
    out = ParseOutput()
    roles: set[str] = set()
    role_sum: dict[str, int] = {}
    counted: dict[str, int] = {}
    for n, row in enumerate(reader, start=2):
        if not row:
            continue
        if len(row) != 5:
            raise ValueError(f"line {n}: expected 5 columns, got {len(row)}")
        month, metric, key, count, base = row
        if metric == "inserate" and key == "gezaehlt":
            counted[month] = _int(count, f"line {n}")
        elif metric == "rolle":
            roles.add(key)
            role_sum[month] = role_sum.get(month, 0) + _int(count, f"line {n}")
            out.observations.append(NormalizedObservation(
                metric="demand", roleId=key, period=month, value=_int(count, f"line {n}"),
                base=_int(base, f"line {n}") or None if base else None))
        elif metric == "technologie" and key != NO_TECHNOLOGY:
            if not base or not _int(base, f"line {n}"):
                continue  # no postings counted that month: a share is not defined
            out.observations.append(NormalizedObservation(
                metric="skill", roleId="", skill=key, period=month, value=_int(count, f"line {n}"),
                base=_int(base, f"line {n}")))
    out.roles = [Role(id=r, name=role_name(r)) for r in sorted(roles)]
    out.comparable_from = counting_break(role_sum, counted)
    if not out.observations:
        raise ValueError("no role or technology rows found")
    return out
