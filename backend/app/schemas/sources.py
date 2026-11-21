"""Data source health (frontend: Sources page)."""
from typing import Literal

from pydantic import BaseModel


class SourceStatus(BaseModel):
    id: str
    name: str
    url: str
    lastFetchedAt: str  # ISO 8601, when we last retrieved data from this source
    dataAsOf: str | None = None  # YYYY-MM-DD, the publisher's last update, if known
    datasetUrl: str | None = None  # opendata.swiss dataset page, when one exists for this statistic
    datasetModified: str | None = None  # YYYY-MM-DD, when that catalogue entry last changed
    licence: str | None = None  # e.g. "CC BY 4.0"
    licenceUrl: str | None = None
    status: Literal["ok", "stale", "error"]
    problem: str | None = None  # why status is 'stale' or 'error', in plain words
