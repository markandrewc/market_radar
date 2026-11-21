"""Step 2 (raw folder -> database): what a parser produces and what a run reports."""
from typing import Literal

from pydantic import BaseModel, Field


class NormalizedObservation(BaseModel):
    metric: Literal["demand", "skill"]
    roleId: str = Field(description="Role id; '' = all roles together (e.g. skills counted over all postings)")
    skill: str = ""
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")
    value: float = Field(ge=0)
    base: float | None = Field(default=None, gt=0,
                               description="All postings in the sample. Required for 'skill', optional for 'demand'")


class NormalizeResult(BaseModel):
    source: str
    status: Literal["parsed", "error", "no_parser", "not_downloaded"]
    parser: str | None = None
    observations: int = 0
    items: int = 0
    error: str | None = None
