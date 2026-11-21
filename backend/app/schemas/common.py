"""Shared building blocks. Field names are camelCase to match src/shared/types.ts."""
from pydantic import BaseModel


class SourceRef(BaseModel):
    id: str
    name: str
    url: str
    fetchedAt: str  # ISO 8601


class Point(BaseModel):
    period: str  # YYYY-MM
    value: float


class Role(BaseModel):
    id: str
    name: str
