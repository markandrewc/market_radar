"""OpenAI-compatible chat-completions client for the LLM layer (docs/LLM.md).

One thin function, `chat_json`, plus the provider presets. Everything is read from
`app.config` at call time (never at import time), so the runtime configuration is the
single source of truth and tests can monkeypatch it.

The client never decides whether an answer is acceptable: it returns the raw content and
`explain.py` / `ask.py` validate it. Failures raise `LlmError` with a short message that
is safe to show a user; the caller then answers with the deterministic fallback.
"""
from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from typing import Any

from .. import config

# The presets of docs/LLM.md. `custom` has no defaults: both LLM_BASE_URL and LLM_MODEL
# are required, which also covers Azure OpenAI, Mistral, Ollama and similar gateways.
PRESETS: dict[str, dict[str, str]] = {
    "deepseek": {"base": "https://api.deepseek.com", "model": "deepseek-flash"},
    "openai": {"base": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    "custom": {"base": "", "model": ""},
}
DEFAULT_PROVIDER = "deepseek"
# DeepSeek's default thinking mode adds latency and tokens without improving a two-sentence
# explanation, so it is explicitly switched off (the other providers ignore the field).
THINKING_OFF = {"type": "disabled"}


class LlmError(RuntimeError):
    """The provider could not produce an answer (network, HTTP, invalid body). Short message."""


class NotConfigured(RuntimeError):
    """No usable provider is configured: the router answers 503 and the UI hides the action."""


def provider() -> str:
    """The configured provider preset id (`deepseek` by default)."""
    return (config.LLM_PROVIDER or DEFAULT_PROVIDER).strip().lower()


def resolved() -> tuple[str, str] | None:
    """(base_url, model) after applying LLM_BASE_URL / LLM_MODEL over the preset; None when unusable."""
    preset = PRESETS.get(provider(), PRESETS["custom"])
    base = (config.LLM_BASE_URL or preset["base"]).strip().rstrip("/")
    model = (config.LLM_MODEL or preset["model"]).strip()
    if not base or not model:
        return None
    return base, model


def configured() -> bool:
    """True only with an API key and a resolvable base URL and model."""
    return bool(config.LLM_API_KEY and resolved())


def model_name() -> str:
    """The model id shown in the API, even when the provider is currently disabled."""
    resolved_pair = resolved()
    if resolved_pair is not None:
        return resolved_pair[1]
    return (config.LLM_MODEL or PRESETS.get(provider(), {}).get("model") or "").strip()


def _provider_message(exc: urllib.error.HTTPError) -> str:
    """Read the provider's error body and keep a short, log-safe message."""
    try:
        raw = exc.read().decode("utf-8", "replace")
    except Exception:  # the body is optional, the HTTP code is the signal
        return ""
    message: Any = raw
    try:
        body = json.loads(raw)
    except (TypeError, ValueError):
        body = None
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            message = error.get("message") or error.get("code") or raw
        elif error:
            message = error
        else:
            message = body.get("message") or raw
    return " ".join(str(message or "").split())[:200]


def _post(url: str, payload: dict[str, Any], timeout: float) -> bytes:
    """One HTTP POST with the bearer key. Separated out so a test can patch it."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {config.LLM_API_KEY}", "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed by config
        return response.read()


def _parse(body: bytes) -> tuple[str, dict[str, int]]:
    """Extract the message content and token usage from a chat-completions body."""
    try:
        data = json.loads(body)
    except (TypeError, ValueError) as exc:
        raise LlmError("The provider returned an invalid response.") from exc
    if not isinstance(data, dict):
        raise LlmError("The provider returned an invalid response.")
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LlmError("The provider returned no answer.")
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    content = message.get("content")
    # Empty content is the classic JSON-mode failure: treat it as an error, never as "".
    if not isinstance(content, str) or not content.strip():
        raise LlmError("The provider returned an empty answer.")
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    try:
        tokens_in = int(usage.get("prompt_tokens") or 0)
        tokens_out = int(usage.get("completion_tokens") or 0)
    except (TypeError, ValueError):
        tokens_in = tokens_out = 0
    return content.strip(), {"input": tokens_in, "output": tokens_out}


def chat_json(system: str, user: str, max_tokens: int | None = None,
              timeout: float | None = None) -> tuple[str, dict[str, int]]:
    """One JSON-mode chat completion; (content, {"input": n, "output": m}).

    Raises `NotConfigured` without a provider and `LlmError` on timeout, 5xx (after one
    retry), another non-2xx status or an invalid body. Never retries a 4xx.
    """
    resolved_pair = resolved()
    if not config.LLM_API_KEY or resolved_pair is None:
        raise NotConfigured("No LLM provider is configured.")
    base, model = resolved_pair
    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.2,
        "max_tokens": int(max_tokens or config.LLM_MAX_OUTPUT_TOKENS),
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    if provider() == "deepseek":
        payload["thinking"] = dict(THINKING_OFF)
    wait = float(timeout if timeout is not None else config.LLM_TIMEOUT)
    url = f"{base}/chat/completions"
    attempts = 2  # the initial call plus one retry on timeout/5xx
    for attempt in range(attempts):
        try:
            return _parse(_post(url, payload, wait))
        except urllib.error.HTTPError as exc:
            if exc.code >= 500 and attempt + 1 < attempts:
                continue
            detail = _provider_message(exc)
            suffix = f": {detail}" if detail else ""
            raise LlmError(f"The provider answered HTTP {exc.code}{suffix}") from exc
        except (TimeoutError, socket.timeout) as exc:
            if attempt + 1 < attempts:
                continue
            raise LlmError("The provider did not answer in time.") from exc
        except urllib.error.URLError as exc:
            if attempt + 1 < attempts:
                continue
            raise LlmError("The provider is unreachable.") from exc
        except OSError as exc:  # connection reset and friends
            if attempt + 1 < attempts:
                continue
            raise LlmError("The provider is unreachable.") from exc
    raise LlmError("The provider did not answer.")  # pragma: no cover - the loop always returns/raises
