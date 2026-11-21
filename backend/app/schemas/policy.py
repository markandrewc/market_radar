"""Policy news (frontend: Policy page, PolicyCard)."""
from pydantic import BaseModel

from .common import SourceRef


class PolicyItem(BaseModel):
    title: str
    summary: str
    date: str  # YYYY-MM-DD
    source: SourceRef


class PolicyResponse(BaseModel):
    items: list[PolicyItem]
