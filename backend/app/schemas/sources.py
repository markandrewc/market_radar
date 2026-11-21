"""Data source health (frontend: Sources page)."""
from typing import Literal

from pydantic import BaseModel


class SourceStatus(BaseModel):
    id: str
    name: str
    url: str
    lastFetchedAt: str  # ISO 8601
    status: Literal["ok", "stale", "error"]
