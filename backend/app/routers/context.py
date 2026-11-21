"""Level 3D: the target-group block (Question D), see docs/api.md."""
import re

from fastapi import APIRouter, Depends, HTTPException

from ..db import Conn, get_conn
from ..schemas import TargetGroupContext
from ..services import context

router = APIRouter()

_REGION = re.compile(r"^[A-Z]{2}$")


@router.get("/target-group", response_model=TargetGroupContext)
def target_group(region: str | None = None, conn: Conn = Depends(get_conn)) -> TargetGroupContext:
    """Four target-group figures from the SEM monthly tables, for Switzerland or one canton.

    Indicators without a stored record are listed in `missing` instead of being guessed; `changePct` stays
    null until an earlier month is stored.
    """
    if region is not None:
        region = region.strip().upper()
        if not _REGION.match(region):
            raise HTTPException(422, "region must be a two-letter canton code, e.g. ZH")
    return context.target_group(conn, region)
