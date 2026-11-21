"""Level 2: briefings (digest), subscriptions and the weekly send run.

A digest is a list of sections, each a list of bullets. Every bullet carries the
source it came from, so the citation can never be lost on the way to an inbox.
"""
from typing import Literal

from pydantic import BaseModel, Field

from .common import SourceRef


class DigestBullet(BaseModel):
    text: str
    source: SourceRef


class DigestSection(BaseModel):
    heading: str
    bullets: list[DigestBullet] = Field(default_factory=list)
    note: str | None = None  # our reading, clearly marked as not part of the source


class Digest(BaseModel):
    subject: str
    text: str  # plain-text version, citations included
    sections: list[DigestSection] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)  # every source used, for the footer
    generatedAt: str  # ISO 8601
    empty: bool = False  # true = no data this period; the text says why, nothing is invented


class DigestRequest(BaseModel):
    roleIds: list[str] = Field(default_factory=list)
    includePolicy: bool = True
    includeTargetGroup: bool = True


class SubscribeBody(DigestRequest):
    # Plain str keeps the backend free of the email-validator dependency; checked with a pattern instead.
    email: str = Field(pattern=r"^\S+@\S+\.\S+$")
    cadence: Literal["weekly", "monthly"] = "weekly"


class SubscribeResult(BaseModel):
    ok: bool = True
    sent: bool = False
    error: str | None = None  # provider message when the mail could not be sent; the subscription is kept
    nextRun: str | None = None  # YYYY-MM-DD, the next planned send
    unsubscribeUrl: str | None = None


class SendOutcome(BaseModel):
    subscriptionId: str
    email: str
    status: Literal["sent", "dry_run", "error", "skipped"]
    detail: str | None = None


class RunResult(BaseModel):
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    results: list[SendOutcome] = Field(default_factory=list)


class RunRequest(BaseModel):
    dueOnly: bool = True
    subscriptionId: str | None = None
