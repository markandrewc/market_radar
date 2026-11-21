# LLM explanations — how the plain-language layer works

Market Radar can phrase its deterministic readings in even plainer language and answer free-form questions.
The model is a **wording layer**, never a data source: the server builds a fact bundle from the database, the
model only rephrases it, and the answer is validated against the facts before it is shown. Without a provider
the app keeps working with the deterministic readings.

## What is sent — and what never is

Sent to the provider: the title and a trimmed excerpt of a **public** source record (Fedlex, Curia Vista, SEM,
BFS, Adzuna posting), aggregate numbers, their labels, and the dates we already show in the UI. All of it is
public information that the team can check itself.

Never sent: e-mail addresses, subscriptions, report history, participant data, session data. The fact bundle is
built from `market_items`, `observations` and the insight objects only; a test asserts that no personal fields
appear in it.

**Data residency.** The DeepSeek preset sends data outside CH/EU. For the hackathon demo this is documented and
accepted; for a production NGO deployment switch the provider (see below) or run a local model. Only the
provider preset changes — the prompts, guardrails and API stay the same.

## Provider configuration

The client is OpenAI-compatible (chat completions, JSON mode). Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `deepseek` | `deepseek` \| `openai` \| `custom` |
| `LLM_BASE_URL` | preset | overrides the preset base URL |
| `LLM_MODEL` | preset | overrides the preset model |
| `LLM_API_KEY` | — | without it explanations are disabled (`503`, UI hides the action) |
| `LLM_TIMEOUT` | `20` | seconds per request; one retry on timeout/5xx |
| `LLM_MAX_OUTPUT_TOKENS` | `700` | answer budget |
| `LLM_DAILY_TOKEN_CAP` | `200000` | global daily budget; when reached, answers fall back |
| `LLM_RATE_PER_MIN` / `LLM_RATE_PER_DAY` | `6` / `100` | per-IP limits (single-worker limiter) |
| `LLM_LANGUAGE` | `en` | default language; a request may override |

Presets: `deepseek` → `https://api.deepseek.com`, `deepseek-flash`; `openai` → `https://api.openai.com/v1`,
`gpt-4o-mini`; `custom` → requires `LLM_BASE_URL` and `LLM_MODEL` (e.g. Azure OpenAI, Mistral, Ollama).

For DeepSeek the request sends `thinking: {"type": "disabled"}`: the default thinking mode would add latency and
tokens without improving a two-sentence explanation. JSON mode is requested with
`response_format: {"type": "json_object"}`.

## Guardrails (deterministic, in `backend/app/llm/guardrails.py`)

An answer is accepted only if all of these hold; otherwise the deterministic reading is returned with
`method: "fallback"` and the reason is logged:

- valid JSON with 1–6 sentences, each ≤400 characters, ≤120 words in total;
- every sentence names at least one `source_id` that exists in the fact bundle — the server resolves the
  citations, the model cannot add a URL or a source;
- **every number in the text also appears in the facts** (formats normalised: `1'350`, `1,350`, `23.9`, `23,9`);
- no `http(s)://` or `www.` in the generated text;
- the answer language matches the request (simple stop-word heuristic);
- provider refusals and empty JSON-mode responses are rejected.

Source text is delimited in `<source>` tags and the system prompt says that it is data, not instructions, so a
document cannot hijack the answer. Because the output is validated against the facts and citations are appended
by the server, prompt injection cannot add a source or a number.

The responses are labelled in the UI as **"AI explanation · our reading, not the source"**, and policy answers
carry **"Not legal advice — check the original."**

## Prompts and versions

`backend/app/llm/prompts.py` holds `PROMPT_VERSION = "explain-v1"` and two system prompts (explain a card, answer
a question). The facts are passed as JSON. Any change to a prompt, the guardrails or the provider model must bump
`PROMPT_VERSION`: it is part of the cache key, so old answers are not served against a new contract.

## Cache, cost and limits

Answers are cached in `llm_explanations`, keyed by
`sha256(provider | model | prompt_version | kind | target_id | role_id | language | facts_hash)`:

| Target | TTL |
|---|---|
| an insight (numbers change monthly) | 24 h |
| a policy or context item (immutable text) | 7 days |
| an ask answer (question + facts hash) | 1 h |

A cache hit makes no provider call (`cached: true` in the response). Usage is counted per UTC day in
`llm_usage` and checked against `LLM_DAILY_TOKEN_CAP`. Cost is negligible at this scale: off-peak DeepSeek Flash
is $0.15 per million input tokens and $0.60 per million output; one explanation is roughly $0.0005, a hundred a
day about five cents. `GET /api/llm/status` reports the remaining budget.

The rate limiter is in-process, so it assumes a single backend worker (the Railway/Docker setup). If the service
is scaled to several workers, move the limiter to Postgres.

## Fallback behaviour

| Situation | What happens |
|---|---|
| no `LLM_API_KEY` | `GET /api/llm/status` → `enabled: false`; `POST /api/explain` / `/api/ask` → `503`; the UI hides the action and shows a hint |
| provider down / timeout / 5xx | explanation falls back to the deterministic insight text (`method: "fallback"`) |
| validation fails | same fallback, reason logged |
| daily budget or rate limit reached | `429`; the deterministic reading is still on screen |
| question has no matching data | `method: "no_data"` with follow-up suggestions, no provider call |

## Try it locally

```sh
cd backend
export LLM_PROVIDER=deepseek LLM_API_KEY='…'      # or openai / custom + base/model
export DATABASE_URL='postgresql:///market_radar'
.venv/bin/uvicorn app.main:app --reload --port 8787

curl -s localhost:8787/api/llm/status | jq
curl -s -X POST localhost:8787/api/explain -H 'Content-Type: application/json' \
  -d '{"kind":"insight","insightId":"demand:it-support"}' | jq
curl -s -X POST localhost:8787/api/ask -H 'Content-Type: application/json' \
  -d '{"question":"Which skills should we teach for IT Support?"}' | jq
```

Tests never call a provider: they monkeypatch `app.llm.client.chat_json`, so the guardrails, cache and fallback
paths are covered offline.
