"""POST /api/ingest (used by the ingestion team)."""
from typing import Literal

from pydantic import BaseModel, Field

from .common import Role, SourceRef


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
