"""API schemas (Pydantic). Must match src/shared/types.ts, camelCase field names."""
from .common import Point, Role, SourceRef
from .employers import Employer, EmployersResponse
from .market import DemandResponse, ForecastPoint, SkillRow, SkillsResponse, Trend
from .participants import TargetGroup, TargetGroupResponse
from .policy import PolicyItem, PolicyResponse
from .normalize import NormalizedObservation, NormalizeResult
from .sources import SourceStatus
from .subscription import SubscribeBody, SubscribeResult

__all__ = [
    "DemandResponse", "Employer", "ForecastPoint", "Trend", "EmployersResponse", "NormalizedObservation", "NormalizeResult",
    "Point", "PolicyItem", "PolicyResponse", "Role", "SkillRow", "SkillsResponse", "SourceRef", "SourceStatus",
    "SubscribeBody", "SubscribeResult", "TargetGroup", "TargetGroupResponse",
]
