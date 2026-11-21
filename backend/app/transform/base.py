from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..schemas import IngestObservation, Role


@dataclass(frozen=True)
class Doc:
    """One raw document as stored in raw_documents."""
    id: int
    url: str | None
    fetched_at: datetime
    content_type: str
    content: Any  # parsed JSON, or a str for text formats


@dataclass
class ParseOutput:
    roles: list[Role] = field(default_factory=list)
    observations: list[IngestObservation] = field(default_factory=list)
    failed: dict[int, str] = field(default_factory=dict)  # doc id -> reason; these get status 'error'


Parser = Callable[[list[Doc]], ParseOutput]
