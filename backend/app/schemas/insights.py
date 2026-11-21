"""Level 3: the plain-language reading (docs/api.md "Insights (the plain-language reading)").

An `Insight` is a short, deterministic sentence built from the same rows the numbers come
from. `evidence` is the only place numbers may come from: every figure in `body` must also
appear there together with its `SourceRef`, so a claim can never lose its source.

Field names stay camelCase to match `src/shared/types.ts`.
"""
from typing import Literal

from pydantic import BaseModel, Field

from .common import Role, SourceRef

InsightKind = Literal["demand", "skills", "employers", "regions", "target", "policy"]
Severity = Literal["info", "attention"]


class Evidence(BaseModel):
    """One number that `body` mentions, with the source it came from."""

    label: str
    value: str
    source: SourceRef


class Insight(BaseModel):
    """One card's reading. `method` is always 'template': a deterministic sentence, never a model."""

    id: str
    kind: InsightKind
    headline: str
    body: str
    evidence: list[Evidence] = Field(default_factory=list)
    severity: Severity = "info"
    method: Literal["template"] = "template"
    generatedAt: str  # ISO 8601
    roleId: str | None = None
    itemId: str | None = None


class PulsePostings(BaseModel):
    """The latest month's sample: the largest role count and the base of all postings (never a role sum)."""

    value: int | float  # whole postings stay whole in JSON (184, not 184.0)
    period: str  # YYYY-MM
    base: int | float | None = None
    source: SourceRef


class PulseMover(BaseModel):
    """A role whose share of all postings moved most between the two latest comparable months."""

    role: Role
    changePct: float
    current: int | float  # postings in the latest month, so a tiny sample is visible next to the move
    source: SourceRef


class SourceHealth(BaseModel):
    ok: int = 0
    stale: int = 0
    error: int = 0


class Overview(BaseModel):
    """The weekly pulse for the home page."""

    generatedAt: str
    postings: PulsePostings | None = None
    rolesTracked: int = 0
    biggestRiser: PulseMover | None = None
    biggestFaller: PulseMover | None = None
    newPolicyItems: int = 0
    targetGroupItems: int = 0
    sources: SourceHealth = Field(default_factory=SourceHealth)
    insights: list[Insight] = Field(default_factory=list)


class PolicyGroup(BaseModel):
    """One curated policy watch group: a label and the German keywords that put an item in it."""

    label: str
    keywords: list[str] = Field(default_factory=list)


class PolicyNote(BaseModel):
    """Our plain-language reading of a recurring topic. Never a fact attributed to the publisher."""

    keyword: str
    label: str
    note: str


class Taxonomy(BaseModel):
    """Curated product knowledge, so the app and the e-mailed briefing tell the same story."""

    policyGroups: list[PolicyGroup] = Field(default_factory=list)
    policyNotes: list[PolicyNote] = Field(default_factory=list)
    roleAliases: dict[str, list[str]] = Field(default_factory=dict)
