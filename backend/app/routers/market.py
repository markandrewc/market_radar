"""Demand and skills, computed from the observations table. Empty database -> empty lists / 404."""
import sqlite3
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..models import DemandResponse, Point, Role, SkillRow, SkillsResponse, SourceRef

router = APIRouter()


def _source(conn: sqlite3.Connection, source_id: str) -> SourceRef:
    r = conn.execute("SELECT id, name, url, fetched_at FROM sources WHERE id = ?", (source_id,)).fetchone()
    return SourceRef(id=r["id"], name=r["name"], url=r["url"], fetchedAt=r["fetched_at"])


def _pct(new: float, old: float) -> float:
    return round((new - old) / old * 100, 1) if old else 0.0


@router.get("/roles", response_model=list[Role])
def roles(conn: sqlite3.Connection = Depends(get_conn)) -> list[Role]:
    return [Role(id=r["id"], name=r["name"]) for r in conn.execute("SELECT id, name FROM roles ORDER BY name")]


@router.get("/sources", response_model=list[SourceRef])
def sources(conn: sqlite3.Connection = Depends(get_conn)) -> list[SourceRef]:
    return [_source(conn, r["id"]) for r in conn.execute("SELECT id FROM sources ORDER BY name")]


@router.get("/demand", response_model=list[DemandResponse])
def demand(months: int = 12, conn: sqlite3.Connection = Depends(get_conn)) -> list[DemandResponse]:
    """One entry per role and source: last `months` periods, current value, change first -> last period."""
    rows = conn.execute(
        """SELECT o.role_id, r.name AS role_name, o.source_id, o.period, o.value
           FROM observations o JOIN roles r ON r.id = o.role_id
           WHERE o.metric = 'demand' ORDER BY r.name, o.period""").fetchall()
    grouped: dict[tuple[str, str, str], list[Point]] = defaultdict(list)
    for r in rows:
        grouped[(r["role_id"], r["role_name"], r["source_id"])].append(Point(period=r["period"], value=r["value"]))
    out = []
    for (role_id, role_name, source_id), series in grouped.items():
        series = series[-months:]
        out.append(DemandResponse(
            role=Role(id=role_id, name=role_name), current=series[-1].value,
            changePct=_pct(series[-1].value, series[0].value), series=series, source=_source(conn, source_id)))
    return out


@router.get("/skills", response_model=SkillsResponse)
def skills(role: str | None = None, conn: sqlite3.Connection = Depends(get_conn)) -> SkillsResponse:
    """Skills for one role in the latest period. share = % of postings mentioning the skill;
    changePct = relative change of that share vs. the previous period."""
    if role is None:
        first = conn.execute("SELECT DISTINCT role_id FROM observations WHERE metric = 'skill' "
                             "ORDER BY role_id LIMIT 1").fetchone()
        if not first:
            raise HTTPException(404, "No skill data yet.")
        role = first["role_id"]
    r = conn.execute("SELECT id, name FROM roles WHERE id = ?", (role,)).fetchone()
    if not r:
        raise HTTPException(404, f"Unknown role: {role}")
    rows = conn.execute(
        """SELECT source_id, skill, period, value, base FROM observations
           WHERE metric = 'skill' AND role_id = ? AND base > 0 ORDER BY period""", (role,)).fetchall()
    if not rows:
        raise HTTPException(404, f"No skill data for role: {role}")
    share: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for x in rows:
        share[(x["source_id"], x["skill"])][x["period"]] = x["value"] / x["base"] * 100
    latest = max(x["period"] for x in rows)
    out = []
    for (source_id, skill), by_period in share.items():
        if latest not in by_period:
            continue
        earlier = sorted(p for p in by_period if p < latest)
        now = by_period[latest]
        out.append(SkillRow(skill=skill, share=round(now, 1),
                            changePct=_pct(now, by_period[earlier[-1]]) if earlier else 0.0,
                            source=_source(conn, source_id)))
    out.sort(key=lambda s: -s.share)
    return SkillsResponse(role=Role(id=r["id"], name=r["name"]), skills=out)
