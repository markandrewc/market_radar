"""Demand, skills and roles: thin HTTP wrappers.

The queries live in app/services/market_view.py and are shared with the briefing
digest, so the dashboard and the e-mailed numbers are computed by the same code.
Empty database -> empty lists / 404 for an unknown role.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import Conn, get_conn
from ..schemas import DemandResponse, Role, SkillsResponse
from ..services import market_view

router = APIRouter()


@router.get("/roles", response_model=list[Role])
def roles(conn: Conn = Depends(get_conn)) -> list[Role]:
    return market_view.roles(conn)


@router.get("/demand", response_model=list[DemandResponse])
def demand(months: int = Query(12, ge=1, le=120), horizon: int = Query(3, ge=0, le=12),
           conn: Conn = Depends(get_conn)) -> list[DemandResponse]:
    """One entry per role and source, largest first: the last `months` months, the current value, and a trend with
    a `horizon`-month forecast. changePct compares the latest month with the one before. If the source states the
    sample size (`base`), changePct and the trend use the role's share of all postings, because a growing sample
    would otherwise look like growth."""
    return market_view.demand_rows(conn, months, horizon)


@router.get("/skills", response_model=SkillsResponse)
def skills(role: str | None = None, horizon: int = Query(3, ge=0, le=12),
           conn: Conn = Depends(get_conn)) -> SkillsResponse:
    """Skills in the latest month, for one role or (no role / role=all) for all postings together.
    share = % of postings mentioning the skill; changePct = relative change of that share vs. the previous month;
    trend = trend of the share with a `horizon`-month forecast. A known role without skill data returns no skills."""
    try:
        return market_view.skills_for(conn, role, horizon)
    except market_view.UnknownRole as exc:
        raise HTTPException(404, str(exc)) from exc
