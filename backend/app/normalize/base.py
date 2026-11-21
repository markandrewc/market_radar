from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from ..schemas import NormalizedObservation, Role


@dataclass(frozen=True)
class RawFile:
    """One downloaded original from the raw folder, with its entry from latest.json."""
    source_id: str
    path: Path
    sha256: str
    fetched_at: datetime | None
    content_type: str | None
    meta: dict[str, Any]  # the full latest.json entry (period, report_url, licence, ...)


@dataclass
class ParseOutput:
    roles: list[Role] = field(default_factory=list)
    observations: list[NormalizedObservation] = field(default_factory=list)
    # YYYY-MM if the source changed how it counts: months before are kept but not used for trends
    comparable_from: str | None = None


Parser = Callable[[RawFile], ParseOutput]
