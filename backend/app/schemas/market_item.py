"""Normalised connector record: every source becomes this structure (docs/market-item.schema.json).

Field names are snake_case on purpose, unlike the older camelCase endpoints: the
contract is shared with the ingestion team and the AI digest.
"""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Category = Literal["A", "B", "C", "D", "E"]


class MarketItem(BaseModel):
    id: str
    category: Category
    categories: list[Category]
    title: str
    summary: str = ""
    metrics: dict[str, float | None] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    # Canton code (ZH, BE, ...) when recognisable, else null.
    region: str | None = None
    source_name: str
    source_url: str
    url: str | None = None
    published_at: datetime | None = None
    fetched_at: datetime
    # Raw record for the AI skill matcher; stored in Postgres, never returned by the API.
    payload: dict[str, Any] | None = Field(default=None, exclude=True, repr=False)
