"""POST /api/explain: one card -> cache -> provider -> guardrails -> deterministic fallback.

The order is deliberate:

1. the target is resolved server-side (`facts.explain_facts`); client-supplied text never counts;
2. without a provider the endpoint is disabled (`NotConfigured` -> 503);
3. a cached, unexpired answer is returned with `cached = true` and no provider call;
4. `BudgetExceeded` / `RateLimited` propagate (the router answers 429);
5. any provider or guardrail failure returns the deterministic reading (`method = "fallback"`).

A validated model answer is stored in `llm_explanations` (with its resolved sources) and
counted in `llm_usage`, so the token budget stays visible in `GET /api/llm/status`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from .. import config
from ..db import Conn, iso
from ..schemas import SourceRef
from ..schemas.llm import CitedSentence, Explanation, ExplainRequest, LlmStatus
from . import cache, client, facts, prompts
from .facts import ExplanationFacts
from .guardrails import GuardrailError, guard

log = logging.getLogger("app.llm.explain")

DISCLAIMER = prompts.DISCLAIMER
NotConfigured = client.NotConfigured  # the router maps this to 503


def now_iso() -> str:
    return iso(datetime.now(timezone.utc))


def status(conn: Conn) -> LlmStatus:
    """`GET /api/llm/status`: whether explanations are enabled, and the remaining budget."""
    return LlmStatus(
        enabled=client.configured(),
        provider=client.provider(),
        model=client.model_name(),
        language=prompts.language_for(None),
        promptVersion=prompts.PROMPT_VERSION,
        dailyCap=int(config.LLM_DAILY_TOKEN_CAP),
        remainingTokens=cache.remaining_tokens(conn),
        disclaimer=DISCLAIMER,
    )


def _citations(sentences: list[tuple[str, list[SourceRef]]]) -> list[CitedSentence]:
    return [CitedSentence(text=text, sources=sources) for text, sources in sentences]


def _payload(guarded_sentences: list[tuple[str, list[SourceRef]]], used: list[SourceRef],
             follow_ups: list[str] | None = None) -> dict:
    payload: dict = {
        "sentences": [{"text": text, "sources": [source.model_dump() for source in sources]}
                      for text, sources in guarded_sentences],
        "usedSources": [source.model_dump() for source in used],
    }
    if follow_ups is not None:
        payload["followUps"] = follow_ups
    return payload


def _fallback(prepared: ExplanationFacts, language: str) -> Explanation:
    """The deterministic reading: the insight body (or the item description) with its own source."""
    text = prepared.fallback_text.strip() or prepared.target.label
    sources = prepared.fallback_sources
    return Explanation(
        target=prepared.target,
        language=language,
        text=text,
        sentences=[CitedSentence(text=text, sources=sources)],
        method="fallback",
        model=None,
        cached=False,
        generatedAt=now_iso(),
        disclaimer=DISCLAIMER,
        usedSources=sources,
    )


def _cached(row: dict, prepared: ExplanationFacts, language: str) -> Explanation | None:
    """Rebuild an Explanation from a cache row; None when the stored payload is unusable."""
    stored = cache.payload(row)
    try:
        sentences = [CitedSentence(text=item["text"],
                                   sources=[SourceRef.model_validate(source) for source in item.get("sources") or []])
                     for item in stored.get("sentences") or []]
        used = [SourceRef.model_validate(source) for source in stored.get("usedSources") or []]
    except Exception:  # a corrupted payload must not break the endpoint
        return None
    if not sentences or row.get("method") != "model":
        return None
    return Explanation(
        target=prepared.target,
        language=language,
        text=str(row.get("text") or ""),
        sentences=sentences,
        method="model",
        model=row.get("model"),
        cached=True,
        generatedAt=cache.cached_at(row),
        disclaimer=DISCLAIMER,
        usedSources=used,
    )


def explain(conn: Conn, request: ExplainRequest, *, ip: str | None = None) -> Explanation:
    """Run the whole explanation pipeline for one request. Raises NotConfigured/ValueError/429."""
    language = prompts.language_for(request.language)
    prepared = facts.explain_facts(conn, request, language)  # UnknownTarget (ValueError) -> 422
    if not client.configured():
        raise NotConfigured("Explanations are not available: no LLM provider is configured.")
    facts_hash = cache.hash_json(prepared.bundle)
    key = cache.cache_key(provider=client.provider(), model=client.model_name(),
                          prompt_version=prompts.PROMPT_VERSION, kind=prepared.cache_kind,
                          target_id=prepared.target.id, role_id=prepared.role_id,
                          language=language, facts_hash=facts_hash)
    row = cache.cache_get(conn, key)
    if row is not None:
        cached = _cached(row, prepared, language)
        if cached is not None:
            return cached
    cache.check_budget(conn)
    cache.check_rate(ip)
    try:
        content, usage = client.chat_json(
            prompts.SYSTEM_EXPLAIN, prompts.explain_user(prepared.bundle),
            max_tokens=config.LLM_MAX_OUTPUT_TOKENS, timeout=config.LLM_TIMEOUT)
    except client.LlmError as exc:  # provider down, timeout, invalid body: keep the app working
        log.warning("LLM explain fell back to the deterministic reading: %s", exc)
        return _fallback(prepared, language)
    cache.record_usage(conn, usage)
    try:
        guarded = guard(content, prepared.bundle, language=language)
    except GuardrailError as exc:
        log.warning("LLM explain answer rejected: %s", exc)
        return _fallback(prepared, language)
    explanation = Explanation(
        target=prepared.target,
        language=language,
        text=guarded.text,
        sentences=_citations(guarded.sentences),
        method="model",
        model=client.model_name(),
        cached=False,
        generatedAt=now_iso(),
        disclaimer=DISCLAIMER,
        usedSources=guarded.used_sources,
    )
    try:
        cache.cache_put(conn, key, target_kind=prepared.cache_kind, target_id=prepared.target.id,
                        role_id=prepared.role_id, language=language, provider=client.provider(),
                        model=client.model_name(), prompt_version=prompts.PROMPT_VERSION,
                        facts_hash=facts_hash, text=guarded.text,
                        payload=_payload(guarded.sentences, guarded.used_sources), method="model",
                        tokens_in=usage.get("input"), tokens_out=usage.get("output"))
    except Exception as exc:  # a storage hiccup must not throw away a valid answer
        log.warning("Could not cache the LLM explanation: %s", exc)
    return explanation
