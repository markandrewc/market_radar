"""Level 3D: the target-group numbers at a glance (Question D).

Four SEM monthly tables are stored as MarketItems of category D (one record per canton and month).
This service picks, per indicator, the newest record for Switzerland or a single canton and returns one
or two numbers plus their provenance, so every card can say where a number comes from and when the
publisher updated it. It never invents a number: an indicator without a stored record is reported as
missing instead.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .. import config
from ..db import Conn, iso
from ..schemas import ContextKpi, SourceRef, TargetGroupContext


@dataclass(frozen=True)
class Indicator:
    id: str
    label: str
    source_id: str
    primary: str
    unit: str
    secondary: str | None
    secondary_label: str | None
    note: str


INDICATORS = (
    Indicator("asylum", "Asylum applications", "sem-asylum-applications", "asylgesuche", "persons",
              "primaer", "first applications",
              "New asylum applications in the month, by canton of registration."),
    Indicator("status-s", "Requests for protection status S", "sem-status-s-monthly", "gesuche", "persons",
              "schutzgewaehrungen", "protections granted",
              "Requests, completed cases and protection grants for temporary protection (status S)."),
    Indicator("status-f", "Provisionally admitted (status F)", "sem-provisional-employment", "bestand", "persons",
              "erwerbstaetigenquote_pct", "employment rate (%)",
              "People admitted provisionally and how many of them are employed."),
    Indicator("immigration", "Immigration of foreign residents", "sem-immigration-canton-nationality",
              "einwanderung_staendig", "persons", "aufenthalter_b", "permit B",
              "Immigration of permanent foreign residents, by canton and month."),
)


def _latest(conn: Conn, source_id: str, suffix: str, before: datetime | None = None) -> dict | None:
    """Newest stored record of one indicator for ``total`` or a canton code."""
    sql = "SELECT * FROM market_items WHERE source_id = %s AND id LIKE %s"
    params: list = [source_id, f"%:{suffix}"]
    if before is not None:
        sql += " AND published_at < %s"
        params.append(before)
    sql += " ORDER BY published_at DESC NULLS LAST, fetched_at DESC LIMIT 1"
    return conn.execute(sql, params).fetchone()


def _metric(row: dict | None, name: str) -> float | None:
    if not row:
        return None
    value = (row["metrics"] or {}).get(name)
    return None if value is None else float(value)


def _change_pct(value: float, previous: float | None) -> float | None:
    if previous in (None, 0):
        return None
    return round((value - previous) / previous * 100, 1)


def _source(conn: Conn, source_id: str, row: dict) -> SourceRef:
    """Provenance of one record, including the opendata.swiss entry of the source when it has one."""
    meta = conn.execute("SELECT dataset_url, dataset_modified FROM sources WHERE id = %s",
                        (source_id,)).fetchone()
    published = row["published_at"]
    return SourceRef(
        id=source_id,
        name=row["source_name"],
        url=row["source_url"],
        fetchedAt=iso(row["fetched_at"]),
        dataAsOf=published.date().isoformat() if published else None,
        datasetUrl=meta["dataset_url"] if meta else None,
        datasetModified=meta["dataset_modified"].isoformat() if meta and meta["dataset_modified"] else None,
    )


def target_group(conn: Conn, region: str | None = None) -> TargetGroupContext:
    """The four Question-D indicators for Switzerland (``region=None``) or one canton."""
    suffix = region or "total"
    stale_before = datetime.now(timezone.utc) - timedelta(days=config.SOURCE_STALE_DAYS)
    kpis: list[ContextKpi] = []
    missing: list[str] = []
    periods: list[datetime] = []
    stale = False

    for spec in INDICATORS:
        row = _latest(conn, spec.source_id, suffix)
        value = _metric(row, spec.primary)
        if row is None or value is None:
            missing.append(spec.id)
            continue
        if row["published_at"]:
            periods.append(row["published_at"])
        if row["fetched_at"] and row["fetched_at"] < stale_before:
            stale = True
        previous = _metric(_latest(conn, spec.source_id, suffix, before=row["published_at"]), spec.primary)
        kpis.append(ContextKpi(
            id=spec.id, label=spec.label, value=value, unit=spec.unit,
            secondary=_metric(row, spec.secondary) if spec.secondary else None,
            secondaryLabel=spec.secondary_label if spec.secondary else None,
            changePct=_change_pct(value, previous),
            note=spec.note,
            source=_source(conn, spec.source_id, row)))

    return TargetGroupContext(
        region=region,
        period=max(periods).strftime("%Y-%m") if periods else None,
        kpis=kpis,
        missing=missing,
        stale=stale)
