"""LLM explanations (docs/LLM.md, docs/api.md "LLM explanations").

The model is a *wording* layer only: `facts.py` builds a server-side fact bundle from the
database, `client.py` talks to an OpenAI-compatible provider, `guardrails.py` validates the
answer against the facts, `cache.py` stores validated answers and the token budget, and
`explain.py` / `ask.py` fall back to the deterministic readings on any failure.

Import order matters for tests: the provider call is always made as
`client.chat_json(...)` (module attribute), so a test can monkeypatch it without network.
"""
from . import ask, cache, client, explain, facts, guardrails, prompts

__all__ = ["ask", "cache", "client", "explain", "facts", "guardrails", "prompts"]
