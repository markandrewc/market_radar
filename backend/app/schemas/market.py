"""GET /api/demand and GET /api/skills."""
from typing import Literal

from pydantic import BaseModel

from .common import Point, Role, SourceRef


class ForecastPoint(BaseModel):
    period: str  # YYYY-MM, a future month
    value: float
    low: float  # 95 % prediction interval
    high: float


class Trend(BaseModel):
    basis: Literal["share", "count"]  # share = % of all postings in the sample; count = number of postings
    direction: Literal["rising", "falling", "stable"]  # 'stable' = slope not clearly different from zero
    slopePerMonth: float  # percentage points per month (share) or postings per month (count)
    months: int  # history the trend is based on
    forecast: list[ForecastPoint]
    method: str  # plain-language description, show it next to the forecast


class DemandResponse(BaseModel):
    role: Role
    current: float
    changePct: float
    series: list[Point]  # postings per month
    source: SourceRef
    shareSeries: list[Point] | None = None  # % of all postings per month, if the source states the sample size
    trend: Trend | None = None  # None if fewer than 4 months of history


class SkillRow(BaseModel):
    skill: str
    share: float
    changePct: float
    source: SourceRef
    trend: Trend | None = None  # trend of the share


class SkillsResponse(BaseModel):
    role: Role
    skills: list[SkillRow]
