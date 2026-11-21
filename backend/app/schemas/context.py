"""Level 3D: curated target-group numbers (Question D) and their provenance."""
from pydantic import BaseModel, Field

from .common import SourceRef


class ContextKpi(BaseModel):
    """One headline figure: one or two numbers, the change, and where they come from."""

    id: str
    label: str
    value: float
    unit: str
    secondary: float | None = None
    secondaryLabel: str | None = None
    # Compared with the month before; null when no earlier month is stored (never guessed).
    changePct: float | None = None
    note: str | None = None  # "What this measures", shown in the source popover
    source: SourceRef


class TargetGroupContext(BaseModel):
    region: str | None = None  # null = Switzerland-wide
    period: str | None = None  # YYYY-MM of the newest record
    kpis: list[ContextKpi] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)  # indicators without a stored record
    stale: bool = False  # at least one record older than SOURCE_STALE_DAYS
