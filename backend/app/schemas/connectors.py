"""Schemas for the config-driven connectors (docs/api.md)."""
from pydantic import BaseModel, Field

from .insights import PolicyGroup


class ConnectorSource(BaseModel):
    """One configured source as the UI sees it; secrets are never included."""

    id: str
    name: str
    description: str = ""
    sourceUrl: str
    categories: list[str]
    adapterType: str
    endpoints: list[str] = []
    refreshRate: str
    refreshSeconds: int | None = None
    enabled: bool
    inConfig: bool = True
    authEnv: list[str] = []
    filterKeywords: list[str] = []
    licence: str | None = None
    licenceUrl: str | None = None
    lastSyncAt: str | None = None
    lastError: str | None = None
    itemCount: int = 0


class ConnectorDefaults(BaseModel):
    targetCities: list[str] = []
    targetRoles: list[str] = []
    policyKeywords: list[str] = []
    # Curated knowledge served under defaults too, so the operator sees what the app shows.
    policyGroups: list[PolicyGroup] = []
    roleAliases: dict[str, list[str]] = {}


class ConnectorList(BaseModel):
    configFile: str
    configError: str | None = None
    pendingChanges: bool = False
    appliedAt: str | None = None
    defaults: ConnectorDefaults = Field(default_factory=ConnectorDefaults)
    sources: list[ConnectorSource] = []


class ReloadResult(BaseModel):
    added: int
    updated: int
    disabled: int
    sourceCount: int
    configSha256: str
    errors: list[str] = []


class SyncResult(BaseModel):
    """Outcome for one source. ``skipped`` means nothing was fetched (disabled, not due, missing env)."""

    source: str
    adapter: str
    items: int = 0
    skipped: bool = False
    replaced: bool = False
    reason: str | None = None
    error: str | None = None


class SyncSummary(BaseModel):
    results: list[SyncResult] = []
    items: int = 0
    errors: int = 0


class ConnectorConfigFile(BaseModel):
    """The current sources.yaml as served to the operator (never the secrets in it)."""

    file: str
    sha256: str
    content: str


class ConnectorConfigUpdate(BaseModel):
    """Result of writing a new sources.yaml through the API."""

    file: str
    sha256: str
    added: int
    updated: int
    disabled: int
    sourceCount: int
    errors: list[str] = []
    persistent: bool = False
