"""Postgres cache, token budget and the in-process rate limiter for the LLM layer.

`llm_explanations` keeps every validated answer with its resolved sources, so the team can
audit what was shown and a repeated request costs nothing. The prompt itself is never
stored (only its version and a facts hash). `llm_usage` is the per-UTC-day token counter
behind `LLM_DAILY_TOKEN_CAP` and `GET /api/llm/status`.

The rate limiter lives in process memory. That assumes a single backend worker (the
Railway/Docker setup of this project); if the service is ever scaled to several workers,
move the counters into Postgres - see docs/LLM.md.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any

from psycopg.types.json import Jsonb

from .. import config
from ..db import Conn, iso

# docs/LLM.md: numbers change monthly, item text is immutable, a question is cheap to re-ask.
TTL_BY_KIND = {
    "insight": timedelta(hours=24),
    "policy": timedelta(days=7),
    "item": timedelta(days=7),
    "ask": timedelta(hours=1),
}

_EXPLANATION_COLUMNS = """cache_key, target_kind, target_id, role_id, language, provider, model,
                          prompt_version, facts_hash, text, payload, method, tokens_in, tokens_out,
                          created_at, expires_at"""


class BudgetExceeded(RuntimeError):
    """The global daily token budget is used up; the router answers 429."""


class RateLimited(RuntimeError):
    """The per-IP request limit is reached; the router answers 429."""


# --- cache keys ---------------------------------------------------------------

def cache_key(*, provider: str, model: str, prompt_version: str, kind: str, target_id: str,
              role_id: str | None, language: str, facts_hash: str) -> str:
    """sha256(provider|model|prompt_version|kind|target_id|role_id|language|facts_hash)."""
    parts = [provider, model, prompt_version, kind, target_id, role_id or "", language, facts_hash]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def hash_json(value: Any) -> str:
    """Stable sha256 of a JSON-serialisable value (the fact bundle)."""
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# --- explanations cache -------------------------------------------------------

def cache_get(conn: Conn, key: str) -> dict[str, Any] | None:
    """The unexpired row for `key`, or None."""
    return conn.execute(
        f"SELECT {_EXPLANATION_COLUMNS} FROM llm_explanations WHERE cache_key = %s AND expires_at > now()",
        (key,)).fetchone()


def cache_put(conn: Conn, key: str, *, target_kind: str, target_id: str, language: str,
              provider: str, model: str, prompt_version: str, facts_hash: str, text: str,
              payload: dict[str, Any], method: str, role_id: str | None = None,
              tokens_in: int | None = None, tokens_out: int | None = None,
              ttl: timedelta | None = None) -> None:
    """Insert or refresh one cached answer; the TTL defaults to the kind's documented value."""
    lifetime = ttl or TTL_BY_KIND.get(target_kind, TTL_BY_KIND["item"])
    expires_at = datetime.now(timezone.utc) + lifetime
    conn.execute(
        """INSERT INTO llm_explanations
               (cache_key, target_kind, target_id, role_id, language, provider, model,
                prompt_version, facts_hash, text, payload, method, tokens_in, tokens_out, expires_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (cache_key) DO UPDATE SET
               text = EXCLUDED.text, payload = EXCLUDED.payload, method = EXCLUDED.method,
               tokens_in = EXCLUDED.tokens_in, tokens_out = EXCLUDED.tokens_out,
               expires_at = EXCLUDED.expires_at""",
        (key, target_kind, target_id, role_id, language, provider, model, prompt_version,
         facts_hash, text, Jsonb(payload), method, tokens_in, tokens_out, expires_at))


def payload(row: dict[str, Any]) -> dict[str, Any]:
    """The stored JSON payload of a cache row (empty dict when it is not readable)."""
    stored = row.get("payload") or {}
    return stored if isinstance(stored, dict) else {}


def cached_at(row: dict[str, Any]) -> str:
    """The timestamp a cached answer was generated (kept for the audit trail)."""
    created = row.get("created_at")
    return iso(created) if isinstance(created, datetime) else str(created or "")


# --- token budget -------------------------------------------------------------

def used_tokens(conn: Conn) -> int:
    """Tokens recorded for today (UTC)."""
    row = conn.execute("SELECT tokens FROM llm_usage WHERE day = CURRENT_DATE").fetchone()
    return int(row["tokens"]) if row else 0


def remaining_tokens(conn: Conn) -> int:
    """`LLM_DAILY_TOKEN_CAP` minus today's recorded tokens, never negative."""
    return max(0, int(config.LLM_DAILY_TOKEN_CAP) - used_tokens(conn))


def record_usage(conn: Conn, usage: dict[str, Any] | None) -> None:
    """Count one provider request and its tokens for today (UTC), upserting the day row."""
    usage = usage or {}
    try:
        tokens = int(usage.get("input") or 0) + int(usage.get("output") or 0)
    except (TypeError, ValueError):
        tokens = 0
    conn.execute(
        """INSERT INTO llm_usage (day, requests, tokens) VALUES (CURRENT_DATE, 1, %s)
           ON CONFLICT (day) DO UPDATE SET
               requests = llm_usage.requests + 1,
               tokens = llm_usage.tokens + EXCLUDED.tokens""",
        (tokens,))


def check_budget(conn: Conn) -> None:
    """Raise `BudgetExceeded` when today's token budget is used up."""
    if remaining_tokens(conn) <= 0:
        raise BudgetExceeded("The daily explanation budget is used up; try again tomorrow.")


# --- per-IP rate limiter (single worker) --------------------------------------

_LOCK = threading.Lock()
_MINUTE: dict[str, deque[float]] = {}
_DAY: dict[str, deque[float]] = {}


def reset_rate_limiter() -> None:
    """Forget all counters (tests and a local restart)."""
    with _LOCK:
        _MINUTE.clear()
        _DAY.clear()


def _prune(bucket: deque[float], now: float, window: float) -> None:
    while bucket and bucket[0] <= now - window:
        bucket.popleft()


def check_rate(ip: str | None, now: float | None = None) -> None:
    """Count one request for `ip`; raise `RateLimited` past LLM_RATE_PER_MIN / LLM_RATE_PER_DAY."""
    key = ip or "unknown"
    moment = time.time() if now is None else now
    minute_limit = max(1, int(config.LLM_RATE_PER_MIN))
    day_limit = max(1, int(config.LLM_RATE_PER_DAY))
    with _LOCK:
        minute = _MINUTE.setdefault(key, deque())
        day = _DAY.setdefault(key, deque())
        _prune(minute, moment, 60.0)
        _prune(day, moment, 86_400.0)
        if len(minute) >= minute_limit:
            raise RateLimited("Too many explanations in a minute; try again in a minute.")
        if len(day) >= day_limit:
            raise RateLimited("The daily explanation limit for this address is reached; try again tomorrow.")
        minute.append(moment)
        day.append(moment)
