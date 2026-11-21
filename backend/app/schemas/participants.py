"""Participant groups (frontend: Participants page)."""
from pydantic import BaseModel, Field

from .common import SourceRef


class TargetGroup(BaseModel):
    label: str
    count: int = Field(ge=0)


class TargetGroupResponse(BaseModel):
    groups: list[TargetGroup]
    source: SourceRef
