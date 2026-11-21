"""Insights: the plain-language reading, the home-page pulse and the curated taxonomy.

Thin HTTP wrappers around `app/insights/service.py` and `app/insights/taxonomy.py`, so the
dashboard, the e-mailed briefing and the API all tell the same story.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..connectors import config as sources_config
from ..db import Conn, get_conn
from ..insights import service, taxonomy
from ..schemas.insights import Insight, InsightKind, Overview, Taxonomy
from ..services import market_view

router = APIRouter()


@router.get("/insights", response_model=list[Insight])
def insights(role: str | None = None, kind: InsightKind | None = None,
             limit: int = Query(20, ge=1, le=100), conn: Conn = Depends(get_conn)) -> list[Insight]:
    """`Insight[]`, newest/most relevant first. `role` limits demand/skills/employers to one role
    (404 for an unknown id); `kind` filters the list (`422` for an unknown kind); an empty
    database answers `[]` - no insight without data."""
    try:
        return service.insights(conn, role=role, kind=kind, limit=limit)
    except market_view.UnknownRole as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/insights/taxonomy", response_model=Taxonomy)
def taxonomy_view() -> Taxonomy:
    """Curated product knowledge: policy groups and role aliases from `sources.yaml` -> `defaults`
    (falling back to the built-in list), plus the six reviewable policy notes. No token required."""
    try:
        loaded = sources_config.load(sources_config.ensure_file())
        return taxonomy.build_taxonomy(loaded.defaults)
    except Exception:  # a missing/unreadable file answers the built-in taxonomy, never an error
        return taxonomy.build_taxonomy(None)


@router.get("/overview", response_model=Overview)
def overview(conn: Conn = Depends(get_conn)) -> Overview:
    """The weekly pulse: postings sample, movers, new policy items, target-group count, source
    health and the short insight list (demand, skills, regions, target, policy)."""
    return service.overview(conn)
