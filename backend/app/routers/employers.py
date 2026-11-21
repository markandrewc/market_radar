"""Level 3: who is hiring for a role (category C, docs/api.md). Read-only, no network calls."""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import Conn, get_conn
from ..schemas import EmployersResponse
from ..services import employers as employer_service

router = APIRouter()


@router.get("/employers", response_model=EmployersResponse)
def employers(
        role: str = Query(..., min_length=1, description="Role id from GET /api/roles"),
        conn: Conn = Depends(get_conn)) -> EmployersResponse:
    """Employers with the most open positions for one role, aggregated from the stored
    category-C postings (no extra request; the numbers are as old as the last sync).
    An unknown role is a 404; a role without category-C data answers an empty list."""
    found = employer_service.role_by_id(conn, role)
    if not found:
        raise HTTPException(404, f"Unknown role: {role}")
    return employer_service.build(conn, found)
