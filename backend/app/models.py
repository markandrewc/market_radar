"""Response models. Must match src/shared/types.ts (field names in camelCase)."""
from typing import Literal

from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    id: str
    name: str
    url: str
    fetchedAt: str


class Point(BaseModel):
    period: str
    value: float


class Role(BaseModel):
    id: str
    name: str


class DemandResponse(BaseModel):
    role: Role
    current: float
    changePct: float
    series: list[Point]
    source: SourceRef


class SkillRow(BaseModel):
    skill: str
    share: float
    changePct: float
    source: SourceRef


class SkillsResponse(BaseModel):
    role: Role
    skills: list[SkillRow]


# --- Ingestion (POST /api/ingest) ---


class IngestObservation(BaseModel):
    metric: Literal["demand", "skill"]
    roleId: str
    skill: str = ""
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")
    value: float = Field(ge=0)
    base: float | None = Field(default=None, gt=0, description="Required for metric 'skill'")


class IngestRequest(BaseModel):
    source: SourceRef
    roles: list[Role] = []
    observations: list[IngestObservation] = []
    replace: bool = Field(default=False, description="Delete this source's existing observations first")


class IngestResult(BaseModel):
    source: str
    roles: int
    observations: int
