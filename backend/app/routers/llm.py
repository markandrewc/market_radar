"""LLM explanations: GET /api/llm/status, POST /api/explain, POST /api/ask (docs/api.md).

Thin, public HTTP layer over `app/llm/`. No secrets are returned: the status endpoint says
whether a provider is configured but never which key is used. The endpoints are public and
rate-limited (per IP) and the daily token budget is global; both limits answer `429`, and the
deterministic reading stays on screen. A missing provider is `503` (the UI then hides the
"Explain simply" action).

Everything that is expected to fail answers with the deterministic reading instead of an
error (`method = "fallback"`), so `502` is reserved for an unexpected provider bug.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import Conn, get_conn
from ..llm import ask as ask_service
from ..llm import cache, client
from ..llm import explain as explain_service
from ..schemas.llm import AskAnswer, AskRequest, Explanation, ExplainRequest, LlmStatus

router = APIRouter()


def _client_ip(request: Request) -> str:
    """The caller's address for the per-IP limiter; honours the reverse proxy's header."""
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client is not None else "unknown"


@router.get("/llm/status", response_model=LlmStatus)
def llm_status(conn: Conn = Depends(get_conn)) -> LlmStatus:
    """Whether plain-language explanations are available, with the remaining daily budget."""
    return explain_service.status(conn)


@router.post("/explain", response_model=Explanation)
def explain(request: Request, body: ExplainRequest, conn: Conn = Depends(get_conn)) -> Explanation:
    """Explain one card in plain words. 503 without a provider, 429 on a limit, 422 for an
    unknown target. Any provider or guardrail failure answers the deterministic reading."""
    try:
        return explain_service.explain(conn, body, ip=_client_ip(request))
    except explain_service.NotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except (cache.BudgetExceeded, cache.RateLimited) as exc:
        raise HTTPException(429, str(exc)) from exc
    except ValueError as exc:  # UnknownTarget and an unknown role id
        raise HTTPException(422, str(exc)) from exc
    except client.LlmError as exc:  # normally already handled by the fallback inside explain()
        raise HTTPException(502, str(exc)) from exc


@router.post("/ask", response_model=AskAnswer)
def ask(request: Request, body: AskRequest, conn: Conn = Depends(get_conn)) -> AskAnswer:
    """Answer a free-form question from the stored data only; `method = "no_data"` when the
    data cannot answer it. 503 without a provider, 429 on a limit; the question length
    (3..300 characters) is validated by FastAPI (`422`)."""
    try:
        return ask_service.ask(conn, body, ip=_client_ip(request))
    except explain_service.NotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except (cache.BudgetExceeded, cache.RateLimited) as exc:
        raise HTTPException(429, str(exc)) from exc
    except ValueError as exc:  # UnknownTarget / unknown role id
        raise HTTPException(422, str(exc)) from exc
    except client.LlmError as exc:
        raise HTTPException(502, str(exc)) from exc
