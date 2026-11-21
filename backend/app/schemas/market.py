"""GET /api/demand and GET /api/skills."""
from pydantic import BaseModel

from .common import Point, Role, SourceRef


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
