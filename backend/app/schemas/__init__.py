"""API schemas (Pydantic). Must match src/shared/types.ts, camelCase field names."""
from .common import Point, Role, SourceRef
from .connectors import (ConnectorConfigFile, ConnectorConfigUpdate, ConnectorDefaults, ConnectorList,
                         ConnectorSource, ReloadResult, SyncResult, SyncSummary)
from .market_item import MarketItem
from .employers import Employer, EmployersResponse, Window
from .insights import (Evidence, Insight, InsightKind, Overview, PolicyGroup, PolicyNote, PulseMover,
                       PulsePostings, Severity, SourceHealth, Taxonomy)
from .market import DemandResponse, ForecastPoint, SkillRow, SkillsResponse, Trend
from .normalize import NormalizedObservation, NormalizeResult
from .reports import (Digest, DigestBullet, DigestRequest, DigestSection, RunRequest, RunResult, SendOutcome,
                      SubscribeBody, SubscribeResult)
from .sources import SourceStatus

__all__ = [
    "ConnectorConfigFile", "ConnectorConfigUpdate", "ConnectorDefaults", "ConnectorList", "ConnectorSource", "ReloadResult", "SyncResult", "SyncSummary",
    "DemandResponse", "Employer", "ForecastPoint", "Trend", "EmployersResponse", "Window", "NormalizedObservation", "NormalizeResult",
    "Point", "Role", "SkillRow", "SkillsResponse", "SourceRef", "SourceStatus",
    "Digest", "DigestBullet", "DigestRequest", "DigestSection", "MarketItem", "RunRequest", "RunResult", "SendOutcome", "SubscribeBody", "SubscribeResult",
    "Evidence", "Insight", "InsightKind", "Overview", "PolicyGroup", "PolicyNote", "PulseMover", "PulsePostings", "Severity",
    "SourceHealth", "Taxonomy",
]
