"""POST /api/ask: retrieve -> no-data -> cache -> provider -> guardrails -> fallback.

A question is answered only from what the database holds: at most six matching
`market_items`, up to four insights for the role named in the question and the latest
overview numbers (`facts.ask_facts`). When retrieval finds nothing the answer is
`method = "no_data"` with follow-up suggestions and **no provider call**, so an off-topic
question costs nothing and invents nothing. Provider or guardrail failures answer with a
short deterministic text built from the retrieved facts (`method = "fallback"`).

Answers are cached for one hour under the question hash plus the facts hash, so asking the
same thing twice calls the provider once.
"""
from __future__ import annotations

import logging

from .. import config
from ..db import Conn
from ..schemas import SourceRef
from ..schemas.llm import AskAnswer, AskRequest, CitedSentence
from . import cache, client, facts, prompts
from .explain import DISCLAIMER, NotConfigured, now_iso, _payload
from .facts import AskFacts
from .guardrails import GuardrailError, guard

log = logging.getLogger("app.llm.ask")

NO_DATA_TEXT = ("I do not have data on that in Market Radar. I can answer questions about the roles we track, "
                "the skills in the postings, employers, the target group and policy news.")


def _no_data(prepared: AskFacts, request: AskRequest, follow_ups: list[str] | None = None) -> AskAnswer:
    return AskAnswer(
        question=request.question,
        text=NO_DATA_TEXT,
        sentences=[],
        method="no_data",
        usedSources=[],
        followUps=(follow_ups or prepared.follow_ups)[:3],
        cached=False,
        model=None,
        generatedAt=now_iso(),
        disclaimer=DISCLAIMER,
    )


def _fallback(prepared: AskFacts, request: AskRequest) -> AskAnswer:
    """The deterministic data-based answer: the retrieved facts in at most two cited sentences."""
    if not prepared.fallback_text or not prepared.fallback_sentences:
        return _no_data(prepared, request)
    sentences = [CitedSentence(text=text, sources=sources) for text, sources in prepared.fallback_sentences]
    used: list[SourceRef] = []
    seen: set[str] = set()
    for _, sources in prepared.fallback_sentences:
        for source in sources:
            if source.id not in seen:
                seen.add(source.id)
                used.append(source)
    return AskAnswer(
        question=request.question,
        text=prepared.fallback_text,
        sentences=sentences,
        method="fallback",
        usedSources=used,
        followUps=prepared.follow_ups[:3],
        cached=False,
        model=None,
        generatedAt=now_iso(),
        disclaimer=DISCLAIMER,
    )


def _cached(row: dict, prepared: AskFacts, request: AskRequest) -> AskAnswer | None:
    stored = cache.payload(row)
    try:
        sentences = [CitedSentence(text=item["text"],
                                   sources=[SourceRef.model_validate(source) for source in item.get("sources") or []])
                     for item in stored.get("sentences") or []]
        used = [SourceRef.model_validate(source) for source in stored.get("usedSources") or []]
    except Exception:
        return None
    if not sentences or row.get("method") != "model":
        return None
    follow_ups = [str(item) for item in stored.get("followUps") or [] if str(item).strip()][:3]
    return AskAnswer(
        question=request.question,
        text=str(row.get("text") or ""),
        sentences=sentences,
        method="model",
        usedSources=used,
        followUps=follow_ups or prepared.follow_ups[:3],
        cached=True,
        model=row.get("model"),
        generatedAt=cache.cached_at(row),
        disclaimer=DISCLAIMER,
    )


def ask(conn: Conn, request: AskRequest, *, ip: str | None = None) -> AskAnswer:
    """Answer one question from the stored data. Raises NotConfigured/ValueError/429."""
    language = prompts.language_for(request.language)
    prepared = facts.ask_facts(conn, request.question, request.roleId, language)  # UnknownTarget -> 422
    if not client.configured():
        raise NotConfigured("Explanations are not available: no LLM provider is configured.")
    if not prepared.usable:
        return _no_data(prepared, request)  # nothing retrieved: no provider call, no invention
    facts_hash = cache.hash_json(prepared.bundle)
    key = cache.cache_key(provider=client.provider(), model=client.model_name(),
                          prompt_version=prompts.PROMPT_VERSION, kind="ask",
                          target_id=prepared.target_id, role_id=prepared.role_id,
                          language=language, facts_hash=facts_hash)
    row = cache.cache_get(conn, key)
    if row is not None:
        cached = _cached(row, prepared, request)
        if cached is not None:
            return cached
    cache.check_budget(conn)
    cache.check_rate(ip)
    try:
        content, usage = client.chat_json(
            prompts.SYSTEM_ASK, prompts.ask_user(prepared.bundle),
            max_tokens=config.LLM_MAX_OUTPUT_TOKENS, timeout=config.LLM_TIMEOUT)
    except client.LlmError as exc:
        log.warning("LLM ask fell back to the retrieved facts: %s", exc)
        return _fallback(prepared, request)
    cache.record_usage(conn, usage)
    try:
        guarded = guard(content, prepared.bundle, language=language, allow_no_data=True)
    except GuardrailError as exc:
        log.warning("LLM ask answer rejected: %s", exc)
        return _fallback(prepared, request)
    if guarded.no_data:
        # The model itself judged the facts insufficient: keep its follow-up suggestions if it gave any.
        return _no_data(prepared, request, guarded.follow_ups or prepared.follow_ups)
    answer = AskAnswer(
        question=request.question,
        text=guarded.text,
        sentences=[CitedSentence(text=text, sources=sources) for text, sources in guarded.sentences],
        method="model",
        usedSources=guarded.used_sources,
        followUps=prepared.follow_ups[:3],
        cached=False,
        model=client.model_name(),
        generatedAt=now_iso(),
        disclaimer=DISCLAIMER,
    )
    try:
        cache.cache_put(conn, key, target_kind="ask", target_id=prepared.target_id,
                        role_id=prepared.role_id, language=language, provider=client.provider(),
                        model=client.model_name(), prompt_version=prompts.PROMPT_VERSION,
                        facts_hash=facts_hash, text=guarded.text,
                        payload=_payload(guarded.sentences, guarded.used_sources,
                                         follow_ups=answer.followUps),
                        method="model", tokens_in=usage.get("input"), tokens_out=usage.get("output"),
                        ttl=cache.TTL_BY_KIND["ask"])
    except Exception as exc:
        log.warning("Could not cache the LLM answer: %s", exc)
    return answer
