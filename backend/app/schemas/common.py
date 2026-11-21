"""Shared building blocks. Field names are camelCase to match src/shared/types.ts."""
from pydantic import BaseModel


class SourceRef(BaseModel):
    id: str
    name: str
    url: str
    fetchedAt: str  # ISO 8601, when we last retrieved data from this source
    dataAsOf: str | None = None  # YYYY-MM-DD, the publisher's last update, if known
    comparableFrom: str | None = None  # YYYY-MM: the source changed how it counts; earlier months differ


class Point(BaseModel):
    period: str  # YYYY-MM
    value: float


class Role(BaseModel):
    id: str
    name: str
