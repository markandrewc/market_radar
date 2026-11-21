"""API schemas (Pydantic). Must match src/shared/types.ts, camelCase field names."""
from .common import Point, Role, SourceRef
from .employers import Employer, EmployersResponse
from .ingest import IngestObservation, IngestRequest, IngestResult
from .market import DemandResponse, SkillRow, SkillsResponse
from .participants import TargetGroup, TargetGroupResponse
from .policy import PolicyItem, PolicyResponse
from .sources import SourceStatus
from .subscription import SubscribeBody, SubscribeResult

__all__ = [
    "DemandResponse", "Employer", "EmployersResponse", "IngestObservation", "IngestRequest", "IngestResult",
    "Point", "PolicyItem", "PolicyResponse", "Role", "SkillRow", "SkillsResponse", "SourceRef", "SourceStatus",
    "SubscribeBody", "SubscribeResult", "TargetGroup", "TargetGroupResponse",
]
