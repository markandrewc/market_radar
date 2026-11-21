"""Raw store: POST /api/raw (ingestion team), GET /api/raw/status, POST /api/transform."""
from typing import Any

from pydantic import AwareDatetime, BaseModel, Field

SOURCE_ID = r"^[a-z0-9][a-z0-9_-]{0,63}$"


class RawSource(BaseModel):
    id: str = Field(pattern=SOURCE_ID, description="Stable id, e.g. 'jobs-api'. Lowercase, digits, - and _.")
    name: str = Field(min_length=1, description="Name shown in the dashboard")
    url: str = Field(min_length=1, description="Link to the original data, shown next to every number")


class RawDocument(BaseModel):
    url: str | None = Field(default=None, description="Where this document came from")
    fetchedAt: AwareDatetime = Field(description="When you retrieved it, ISO 8601 with time zone")
    contentType: str = Field(default="application/json", description="e.g. application/json, text/csv, text/html")
    content: Any = Field(description="JSON as-is, or the text of a CSV/HTML/... file as one string")


class RawUploadRequest(BaseModel):
    source: RawSource
    documents: list[RawDocument] = Field(min_length=1, max_length=1000)


class RawUploadResult(BaseModel):
    source: str
    received: int
    duplicates: int


class RawSourceStatus(BaseModel):
    sourceId: str
    name: str
    hasParser: bool
    pending: int
    parsed: int
    error: int
    lastReceivedAt: str | None
    lastParsedAt: str | None


class TransformResult(BaseModel):
    source: str
    parser: str | None
    documents: int = 0
    observations: int = 0
    errors: list[str] = []
