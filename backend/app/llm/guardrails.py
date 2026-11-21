"""Deterministic guardrails for the model answer (docs/LLM.md).

The model output is never trusted as it arrives. This module parses it into a small Pydantic
model, checks every rule of the contract, resolves the cited `source_id`s to the real
`SourceRef`s of the fact bundle and joins the sentences into the text the UI shows, each
sentence followed by a short source parenthetical, e.g.
``(ITBoard · data as of 15 Nov 2026)``.

Any violation raises `GuardrailError` with a short reason. The caller then returns the
deterministic reading instead (`method = "fallback"`); the reason is only logged, never
shown to the user.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..schemas import SourceRef

MAX_SENTENCES = 6
MAX_SENTENCE_CHARS = 400
MAX_TOTAL_WORDS = 120
MAX_FOLLOW_UPS = 3

_URL = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_NUMBER = re.compile(r"\d[\d'\u2019.,]*")
_WORD = re.compile(r"[a-z\u00e4\u00f6\u00fc\u00df]+")

# Deliberately small lists: they only have to separate a plainly German answer from a plainly
# English one, so a handful of high-frequency function words is enough and never flags a
# product name or a role title.
_EN_STOP = frozenset({
    "the", "and", "is", "are", "was", "were", "of", "to", "in", "for", "with", "this", "that", "these",
    "those", "we", "it", "not", "on", "by", "from", "more", "than", "which", "will", "can", "has", "have",
})
_DE_STOP = frozenset({
    "der", "die", "das", "und", "ist", "sind", "nicht", "mit", "fuer", "für", "von", "den", "dem", "des",
    "ein", "eine", "einen", "einem", "einer", "zu", "im", "in", "auf", "sich", "werden", "wird", "auch",
    "als", "bei", "nach", "aus", "oder", "dass", "wenn", "noch", "nur",
})
_REFUSAL = (
    "i cannot", "i can't", "i am sorry", "i'm sorry", "as an ai", "i am unable", "i'm unable",
    "cannot assist", "can't assist", "cannot help with that", "i won't",
)
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


class GuardrailError(ValueError):
    """The model answer violates the contract; the caller answers with the deterministic reading."""


class _ModelSentence(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str = ""
    source_ids: list[str] = Field(default_factory=list)


class _ModelAnswer(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sentences: list[_ModelSentence] = Field(default_factory=list)
    no_data: bool = False
    follow_ups: list[str] = Field(default_factory=list)


@dataclass
class GuardedAnswer:
    """A validated answer: sentences already joined with their source parentheticals."""

    sentences: list[tuple[str, list[SourceRef]]] = field(default_factory=list)
    text: str = ""
    used_sources: list[SourceRef] = field(default_factory=list)
    no_data: bool = False
    follow_ups: list[str] = field(default_factory=list)


# --- language -----------------------------------------------------------------

def _language_scores(text: str) -> tuple[int, int]:
    """Crude (English, German) weight from function words and umlauts - enough for a mismatch check."""
    folded = text.casefold()
    words = _WORD.findall(folded)
    english = sum(1 for word in words if word in _EN_STOP)
    german = sum(1 for word in words if word in _DE_STOP)
    if re.search(r"[\u00e4\u00f6\u00fc\u00df]", folded):
        german += 2
    return english, german


def _check_language(text: str, language: str) -> None:
    english, german = _language_scores(text)
    if language == "de" and english >= 2 and english > german + 1:
        raise GuardrailError("the answer is English but the request asked for German")
    if language != "de" and german >= 2 and german > english + 1:
        raise GuardrailError("the answer is German but the request asked for English")


# --- numbers ------------------------------------------------------------------

def _decimals(token: str) -> set[Decimal]:
    """Every plausible reading of one number token, so format variants compare numerically."""
    raw = token.replace("\u2019", "").replace("'", "").replace(" ", "").strip(".,")
    variants = {
        raw,
        raw.replace(",", ""),
        raw.replace(",", "."),
        raw.replace(".", ""),
        raw.replace(".", "").replace(",", "."),
    }
    out: set[Decimal] = set()
    for variant in variants:
        variant = variant.strip(".,")
        if not variant or not any(character.isdigit() for character in variant):
            continue
        try:
            out.add(Decimal(variant).normalize())
        except InvalidOperation:
            continue
    return out


def _number_tokens(text: str) -> list[str]:
    return [match.group(0).rstrip(".,") for match in _NUMBER.finditer(text) if match.group(0).rstrip(".,")]


def fact_numbers(bundle: dict[str, Any]) -> set[Decimal]:
    """All numbers a sentence may mention: fact labels, fact values and published dates."""
    parts: list[str] = []
    for fact in bundle.get("facts") or []:
        if not isinstance(fact, dict):
            continue
        parts.append(str(fact.get("label") or ""))
        parts.append(str(fact.get("value") or ""))
    for source in (bundle.get("sources") or {}).values():
        if isinstance(source, dict) and source.get("dataAsOf"):
            parts.append(str(source["dataAsOf"]))
    allowed: set[Decimal] = set()
    for part in parts:
        for token in _number_tokens(part):
            allowed |= _decimals(token)
    return allowed


def _unknown_number(text: str, allowed: set[Decimal]) -> str | None:
    for token in _number_tokens(text):
        if not (_decimals(token) & allowed):
            return token
    return None


# --- citation rendering -------------------------------------------------------

def _short_date(value: str | None) -> str | None:
    """'2026-11-15' -> '15 Nov 2026'; anything unparseable is passed through unchanged."""
    text = (value or "").strip()
    try:
        year, month, day = text[:10].split("-")
        label = _MONTHS[int(month) - 1]
        return f"{int(day)} {label} {year}"
    except (IndexError, ValueError):
        return text or None


def source_label(sources: list[SourceRef]) -> str:
    """`(ITBoard · data as of 15 Nov 2026)` - the short parenthetical appended to a sentence."""
    names: list[str] = []
    for source in sources:
        name = (source.name or "").strip() or source.id
        if name not in names:
            names.append(name)
    name = ", ".join(names)
    date = next(((source.dataAsOf or "").strip() for source in sources if source.dataAsOf), None)
    short = _short_date(date) if date else None
    if short:
        return f"({name} · data as of {short})"
    return f"({name})"


def _unique_sources(sources: list[SourceRef]) -> list[SourceRef]:
    seen: dict[str, SourceRef] = {}
    for source in sources:
        seen.setdefault(source.id, source)
    return list(seen.values())


def join_sentences(sentences: list[tuple[str, list[SourceRef]]]) -> str:
    """Join validated sentences, appending the source parenthetical to every sentence."""
    parts = []
    for text, sources in sentences:
        parts.append(f"{text} {source_label(sources)}" if sources else text)
    return " ".join(parts)


# --- parsing ------------------------------------------------------------------

def _strip_fences(content: str) -> str:
    text = content.strip()
    if not text.startswith("```"):
        return text
    text = text.split("\n", 1)[1] if "\n" in text else ""
    return text.rstrip().removesuffix("```").rstrip()


def _looks_like_refusal(text: str) -> bool:
    lowered = text.casefold()
    return any(phrase in lowered for phrase in _REFUSAL)


def _model_answer(content: str) -> _ModelAnswer:
    text = _strip_fences(content or "")
    if not text:
        raise GuardrailError("the model returned an empty answer")
    try:
        data = json.loads(text)
    except (TypeError, ValueError) as exc:
        if _looks_like_refusal(text):
            raise GuardrailError("the provider refused to answer") from exc
        raise GuardrailError("the model answer is not valid JSON") from exc
    if not isinstance(data, dict):
        raise GuardrailError("the model answer is not a JSON object")
    if _looks_like_refusal(json.dumps(data)) and not data.get("sentences"):
        raise GuardrailError("the provider refused to answer")
    try:
        answer = _ModelAnswer.model_validate(data)
    except Exception as exc:  # pydantic ValidationError; keep the reason short
        raise GuardrailError("the model answer has an unexpected shape") from exc
    return answer


def guard(content: str, bundle: dict[str, Any], *, language: str = "en",
          allow_no_data: bool = False) -> GuardedAnswer:
    """Validate one model answer against `bundle`; raise `GuardrailError` on any violation."""
    answer = _model_answer(content)
    if answer.no_data:
        if not allow_no_data:
            raise GuardrailError("the model reported no data for an explanation")
        if answer.sentences:
            raise GuardrailError("a no_data answer must not contain sentences")
        follow_ups = [" ".join(item.split()) for item in answer.follow_ups if isinstance(item, str)]
        follow_ups = [item for item in follow_ups if item][:MAX_FOLLOW_UPS]
        return GuardedAnswer(no_data=True, follow_ups=follow_ups)
    if not answer.sentences:
        raise GuardrailError("the model answer has no sentences")
    if len(answer.sentences) > MAX_SENTENCES:
        raise GuardrailError(f"the model answer has more than {MAX_SENTENCES} sentences")

    sources_raw = bundle.get("sources") or {}
    sources = {key: SourceRef.model_validate(value) for key, value in sources_raw.items()}
    allowed = fact_numbers(bundle)
    resolved: list[tuple[str, list[SourceRef]]] = []
    total_words = 0
    for sentence in answer.sentences:
        text = " ".join(sentence.text.split())
        if not text:
            raise GuardrailError("the model answer contains an empty sentence")
        if len(text) > MAX_SENTENCE_CHARS:
            raise GuardrailError(f"a sentence is longer than {MAX_SENTENCE_CHARS} characters")
        cited_ids = [source_id for source_id in sentence.source_ids if isinstance(source_id, str)]
        if not cited_ids:
            raise GuardrailError("a sentence cites no source")
        unknown = [source_id for source_id in cited_ids if source_id not in sources]
        if unknown:
            raise GuardrailError(f"a sentence cites an unknown source: {unknown[0]}")
        if _URL.search(text):
            raise GuardrailError("the model answer contains a URL")
        missing = _unknown_number(text, allowed)
        if missing is not None:
            raise GuardrailError(f"the number {missing} does not appear in the facts")
        total_words += len(text.split())
        resolved.append((text, _unique_sources([sources[source_id] for source_id in cited_ids])))
    if total_words > MAX_TOTAL_WORDS:
        raise GuardrailError(f"the model answer has more than {MAX_TOTAL_WORDS} words")
    _check_language(" ".join(text for text, _ in resolved), language)
    used = _unique_sources([source for _, cited in resolved for source in cited])
    return GuardedAnswer(sentences=resolved, text=join_sentences(resolved), used_sources=used)
