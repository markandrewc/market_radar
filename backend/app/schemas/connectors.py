"""Schemas for the config-driven connectors (docs/api.md)."""
from pydantic import BaseModel, Field


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


class ConnectorDefaults(BaseModel):
    targetCities: list[str] = []
    targetRoles: list[str] = []
    policyKeywords: list[str] = []


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
