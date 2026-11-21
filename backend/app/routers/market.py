"""Demand and skills, computed from the observations table. Empty database -> empty lists / 404."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import Conn, get_conn, iso
from ..services import trend
from ..schemas import DemandResponse, Point, Role, SkillRow, SkillsResponse, SourceRef

router = APIRouter()


def _source(conn: Conn, source_id: str) -> SourceRef:
    r = conn.execute("SELECT id, name, url, fetched_at, data_as_of, comparable_from FROM sources WHERE id = %s",
                     (source_id,)).fetchone()
    return SourceRef(id=r["id"], name=r["name"], url=r["url"], fetchedAt=iso(r["fetched_at"]),
                     dataAsOf=r["data_as_of"].isoformat() if r["data_as_of"] else None,
                     comparableFrom=r["comparable_from"])


def _pct(new: float, old: float) -> float:
    return round((new - old) / old * 100, 1) if old else 0.0


@router.get("/roles", response_model=list[Role])
def roles(conn: Conn = Depends(get_conn)) -> list[Role]:
    return [Role(id=r["id"], name=r["name"]) for r in conn.execute("SELECT id, name FROM roles ORDER BY name")]


def _share(value: float, base: float | None) -> float | None:
    return value / base * 100 if base else None


@router.get("/demand", response_model=list[DemandResponse])
def demand(months: int = Query(12, ge=1, le=120), horizon: int = Query(3, ge=0, le=12),
           conn: Conn = Depends(get_conn)) -> list[DemandResponse]:
    """One entry per role and source, largest first: the last `months` months, the current value, and a trend with
    a `horizon`-month forecast. changePct compares the latest month with the one before. If the source states the
    sample size (`base`), changePct and the trend use the role's share of all postings, because a growing sample
    would otherwise look like growth."""
    rows = conn.execute(
        """SELECT o.role_id, r.name AS role_name, o.source_id, o.period, o.value, o.base
           FROM observations o JOIN roles r ON r.id = o.role_id
           WHERE o.metric = 'demand' ORDER BY r.name, o.period""").fetchall()
    grouped: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for r in rows:
        grouped[(r["role_id"], r["role_name"], r["source_id"])].append(r)
    out = []
    for (role_id, role_name, source_id), points in grouped.items():
        src = _source(conn, source_id)
        has_base = all(p["base"] for p in points)
        prev, last = points[-2] if len(points) > 1 else points[-1], points[-1]
        comparable = not src.comparableFrom or prev["period"] >= src.comparableFrom
        if has_base:
            change = _pct(_share(last["value"], last["base"]), _share(prev["value"], prev["base"])) if comparable else 0.0
            history = [(p["period"], _share(p["value"], p["base"]), p["base"]) for p in points]
            tr = trend.compute(history, "share", horizon, upper=100, comparable_from=src.comparableFrom)
        else:
            change = _pct(last["value"], prev["value"]) if comparable else 0.0
            tr = trend.compute([(p["period"], p["value"], 1) for p in points], "count", horizon, digits=1,
                               comparable_from=src.comparableFrom)
        window = points[-months:]
        out.append(DemandResponse(
            role=Role(id=role_id, name=role_name), current=last["value"], changePct=change,
            series=[Point(period=p["period"], value=p["value"]) for p in window],
            shareSeries=[Point(period=p["period"], value=round(_share(p["value"], p["base"]), 2)) for p in window]
            if has_base else None,
            trend=tr, source=src))
    out.sort(key=lambda d: (-d.current, d.role.name))
    return out


ALL_ROLES = Role(id="all", name="All IT roles")


@router.get("/skills", response_model=SkillsResponse)
def skills(role: str | None = None, horizon: int = Query(3, ge=0, le=12),
           conn: Conn = Depends(get_conn)) -> SkillsResponse:
    """Skills in the latest month, for one role or (no role / role=all) for all postings together.
    share = % of postings mentioning the skill; changePct = relative change of that share vs. the previous month;
    trend = trend of the share with a `horizon`-month forecast. A known role without skill data returns no skills."""
    if role in (None, "", ALL_ROLES.id):
        role_id, role_out = "", ALL_ROLES
    else:
        r = conn.execute("SELECT id, name FROM roles WHERE id = %s", (role,)).fetchone()
        if not r:
            raise HTTPException(404, f"Unknown role: {role}")
        role_id, role_out = r["id"], Role(id=r["id"], name=r["name"])
    rows = conn.execute(
        """SELECT source_id, skill, period, value, base FROM observations
           WHERE metric = 'skill' AND role_id = %s AND base > 0 ORDER BY period""", (role_id,)).fetchall()
    history: dict[tuple[str, str], list[tuple[str, float, float]]] = defaultdict(list)
    for x in rows:
        history[(x["source_id"], x["skill"])].append((x["period"], _share(x["value"], x["base"]), x["base"]))
    latest = max((x["period"] for x in rows), default=None)
    out = []
    for (source_id, skill), points in history.items():
        if points[-1][0] != latest:
            continue
        src = _source(conn, source_id)
        now = points[-1][1]
        comparable = len(points) > 1 and (not src.comparableFrom or points[-2][0] >= src.comparableFrom)
        out.append(SkillRow(skill=skill, share=round(now, 1),
                            changePct=_pct(now, points[-2][1]) if comparable else 0.0,
                            trend=trend.compute(points, "share", horizon, upper=100, comparable_from=src.comparableFrom),
                            source=src))
    out.sort(key=lambda s: (-s.share, s.skill))
    return SkillsResponse(role=role_out, skills=out)
