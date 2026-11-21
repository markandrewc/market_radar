"""Response models. Must match src/shared/types.ts (field names in camelCase)."""
from pydantic import BaseModel


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
