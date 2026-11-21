"""Server-side target resolution and fact bundles for the LLM layer (docs/LLM.md).

The client never supplies facts: the server resolves the requested card or question against
the database, builds a small bundle of `{id: "f1", kind, label, value, source_id}` facts plus
the resolved `SourceRef`s, and only that bundle goes to the provider. Every leaf comes from
`market_items`, `observations` / insights or the overview - never from `report_subscriptions`
or `report_sends` - and e-mail-like strings are scrubbed defensively, so the bundle cannot
carry personal data (a test asserts it).

Two entry points:

- `explain_facts(conn, request, language)` resolves `insightId` (recomputed through
  `app.insights.service.insights`) or `itemId` (a `market_items` row) and also builds the
  deterministic fallback text and its sources.
- `ask_facts(conn, question, role_id, language)` retrieves at most 6 matching items, up to 4
  insights for the detected role and the latest overview numbers; with nothing usable it
  reports `usable = False` and the caller answers `no_data` without a provider call.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from ..connectors import config as sources_config
from ..db import Conn, iso
from ..insights import service as insights_service
from ..insights import taxonomy
from ..schemas import SourceRef
from ..schemas.insights import Insight, Overview
from ..schemas.llm import ExplainRequest, ExplainTarget
from ..services import market_view

MAX_ITEM_SUMMARY = 6000  # chars of a stored summary sent to the provider
MAX_ASK_ITEMS = 6
MAX_ASK_INSIGHTS = 4
MAX_ASK_NUMBERS = 8
MAX_ASK_SUMMARY = 1200  # chars of an item summary inside an ask bundle
MAX_INSIGHT_BODY = 800
FALLBACK_ITEM_CHARS = 280
FALLBACK_INSIGHT_CHARS = 320
FALLBACK_SUMMARY_CHARS = 240

_HTTP = ("http://", "https://")
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_LINK = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_CATEGORY_LABEL = {
    "A": "Labour-market record",
    "B": "Skills or occupation record",
    "C": "Employer posting",
    "D": "Population or permit record",
    "E": "Policy or regulation publication",
}
_STOPWORDS = frozenset("""
about after again also been before being between both could does doing down during each from further
have having into itself just might more most much must need needs only other our over said same should
some such than that their them then there these they this those through under until very want wants
well were what when where which while whom whose will with would your yours skill skills learn teach
teach our we you can how many what's whats radar market data show shows tell give find look list
der die das und ist sind nicht mit für von den dem des ein eine einen einem einer zu im auf sich werden
wird auch als bei nach aus oder dass wenn noch nur welche welcher welches wie was wer wo wann warum
""".split())

_ITEM_COLUMNS = ("source_id, id, category, categories, title, summary, metrics, tags, region, "
                 "source_name, source_url, url, published_at, fetched_at")


class UnknownTarget(ValueError):
    """The requested insight or item does not exist (the router answers 422)."""


# --- small helpers ------------------------------------------------------------

def _is_http(url: str | None) -> bool:
    return bool(url) and str(url).startswith(_HTTP)


def _num(value: Any) -> str:
    """41, 1.2 or 0.5: whole numbers without .0, no scientific notation."""
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        number = float(value)
        if number.is_integer():
            return str(int(number))
        return f"{number:.2f}".rstrip("0").rstrip(".")
    return str(value)


def _trim(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _scrub(value: Any) -> str:
    """Remove e-mail addresses: the fact bundle must never carry personal data."""
    return _EMAIL.sub("[email removed]", str(value or ""))


def _plain(value: Any) -> str:
    """Fallback text is shown as prose, not as a link list: e-mails and links are removed."""
    return _LINK.sub("[link removed]", _scrub(value))


def _row_source(row: Any) -> SourceRef | None:
    """The published page of one `market_items` row, or None without a real http(s) link."""
    url = row["source_url"] if _is_http(row["source_url"]) else row["url"]
    name = (row["source_name"] or "").strip()
    if not name or not _is_http(url):
        return None
    published = row["published_at"]
    return SourceRef(id=row["source_id"], name=name, url=url, fetchedAt=iso(row["fetched_at"]),
                     dataAsOf=published.date().isoformat() if published else None)


def _unique_sources(sources: list[SourceRef | None]) -> list[SourceRef]:
    seen: dict[str, SourceRef] = {}
    for source in sources:
        if source is not None:
            seen.setdefault(source.id, source)
    return list(seen.values())


def _policy_groups() -> list:
    """The curated watch groups from sources.yaml -> defaults, falling back to the built-ins."""
    try:
        loaded = sources_config.load(sources_config.ensure_file())
        return taxonomy.groups_from(loaded.defaults)
    except Exception:  # an unreadable file must not take the explanation down
        return list(taxonomy.DEFAULT_POLICY_GROUPS)


def role_aliases() -> dict[str, list[str]]:
    """Role synonyms from sources.yaml -> defaults, falling back to the built-in taxonomy."""
    try:
        loaded = sources_config.load(sources_config.ensure_file())
        return taxonomy.aliases_from(loaded.defaults)
    except Exception:
        return taxonomy.aliases_from(None)


# --- fact bundle builder ------------------------------------------------------

@dataclass
class BundleBuilder:
    """Accumulates facts and the source map of one bundle; IDs are f1, f2, ... in order."""

    language: str
    question: str | None = None
    facts: list[dict[str, Any]] = field(default_factory=list)
    sources: dict[str, dict[str, Any]] = field(default_factory=dict)
    caveats: list[str] = field(default_factory=list)
    numbers: int = 0

    def source(self, source: SourceRef | None) -> str | None:
        if source is None:
            return None
        self.sources.setdefault(source.id, source.model_dump())
        return source.id

    def _add(self, kind: str, label: str, value: Any, source: SourceRef | None) -> None:
        text = _scrub(value).strip()
        if not text:
            return
        source_id = self.source(source)
        self.facts.append({"id": f"f{len(self.facts) + 1}", "kind": kind, "label": _scrub(label).strip(),
                           "value": text, "source_id": source_id or ""})

    def text(self, label: str, value: Any, source: SourceRef | None = None) -> None:
        self._add("text", label, value, source)

    def number(self, label: str, value: Any, source: SourceRef | None = None,
               limit: int | None = None) -> bool:
        """Add a numeric fact; returns False when `limit` (the ask number cap) is reached."""
        if value is None or isinstance(value, bool):
            return False
        if limit is not None and self.numbers >= limit:
            return False
        self._add("number", label, _num(value), source)
        self.numbers += 1
        return True

    def caveat(self, text: str) -> None:
        if text and text not in self.caveats:
            self.caveats.append(text)

    def bundle(self) -> dict[str, Any]:
        bundle: dict[str, Any] = {"language": self.language}
        if self.question is not None:
            bundle["question"] = self.question
        bundle.update({"facts": self.facts, "sources": self.sources, "caveats": self.caveats})
        return bundle


# --- explain targets ----------------------------------------------------------

@dataclass
class ExplanationFacts:
    """Everything `explain.py` needs before it may call a provider."""

    target: ExplainTarget
    cache_kind: str  # insight | policy | item
    bundle: dict[str, Any]
    fallback_text: str
    fallback_sources: list[SourceRef] = field(default_factory=list)
    role_id: str | None = None


def _insight_facts(conn: Conn, request: ExplainRequest, language: str) -> ExplanationFacts:
    """Recompute the insight list (never trust a client-supplied text) and find `insightId`."""
    try:
        candidates = insights_service.insights(conn, role=request.roleId, limit=100)
    except market_view.UnknownRole as exc:
        raise UnknownTarget(str(exc)) from exc
    insight = next((item for item in candidates if item.id == request.insightId), None)
    if insight is None:
        raise UnknownTarget(f"Unknown insight: {request.insightId}")
    return _insight_bundle(conn, insight, request, language)


def _insight_bundle(conn: Conn, insight: Insight, request: ExplainRequest,
                    language: str) -> ExplanationFacts:
    evidence_sources = _unique_sources([row.source for row in insight.evidence])
    primary = evidence_sources[0] if evidence_sources else None
    builder = BundleBuilder(language)
    builder.text("Finding", insight.headline, primary)
    builder.text("Kind", insight.kind, primary)
    if insight.roleId:
        role_name = market_view.role_names(conn).get(insight.roleId, insight.roleId)
        builder.text("Role", role_name, primary)
    builder.text("Explanation", insight.body, primary)
    for evidence in insight.evidence:
        if re.search(r"\d", str(evidence.value)):
            builder.number(evidence.label, evidence.value, evidence.source)
        else:
            builder.text(evidence.label, evidence.value, evidence.source)
    builder.caveat("Only the facts listed above are known; anything else is unknown.")
    if insight.kind == "policy":
        builder.caveat("The facts do not establish whether the rule is in force; check the original.")
    known_sources = [SourceRef.model_validate(value) for value in builder.sources.values()]
    return ExplanationFacts(
        target=ExplainTarget(kind=request.kind, id=insight.id, label=insight.headline),
        cache_kind="insight",
        bundle=builder.bundle(),
        fallback_text=insight.body,
        fallback_sources=evidence_sources or known_sources,
        role_id=request.roleId,
    )


def _item_row(conn: Conn, item_id: str) -> Any:
    row = conn.execute(
        f"""SELECT {_ITEM_COLUMNS} FROM market_items WHERE id = %s
             ORDER BY fetched_at DESC, source_id LIMIT 1""", (item_id,)).fetchone()
    if row is None:
        raise UnknownTarget(f"Unknown item: {item_id}")
    return row


def _item_fallback(row: Any, summary: str, note: Any) -> str:
    title = _plain(row["title"]).strip()
    parts = [f"{title}: {_plain(summary)}" if summary else title]
    if note is not None:
        parts.append(f"Our reading, not the source: {note.note}")
    text = ". ".join(part.rstrip(".") for part in parts if part.strip()) + "."
    return text


def _item_facts(conn: Conn, request: ExplainRequest, language: str, row: Any) -> ExplanationFacts:
    source = _row_source(row)
    categories = list(row["categories"] or [])
    summary = " ".join((row["summary"] or "").split())
    trimmed = len(summary) > MAX_ITEM_SUMMARY
    excerpt = summary[: MAX_ITEM_SUMMARY - 1].rstrip() + "…" if trimmed else summary
    title = " ".join((row["title"] or "").split())
    builder = BundleBuilder(language)
    builder.text("Title", title, source)
    builder.text("Record type", _CATEGORY_LABEL.get(row["category"], "Stored record"), source)
    builder.text("Summary" + (" (excerpt)" if trimmed else ""), excerpt, source)
    if trimmed:
        builder.text("Note", f"The summary is shortened to its first {MAX_ITEM_SUMMARY} characters; "
                             f"the original may say more.", source)
    for key, value in (row["metrics"] or {}).items():
        if isinstance(value, (int, float)):
            builder.number(str(key).replace("_", " "), value, source)
        else:
            builder.text(str(key).replace("_", " "), value, source)
    if row["region"]:
        builder.text("Region", row["region"], source)
    published = row["published_at"]
    builder.text("Published", published.date().isoformat() if published else "not stated", source)
    builder.text("Retrieved", row["fetched_at"].date().isoformat(), source)
    builder.text("Publisher", row["source_name"], source)
    note = None
    if "E" in categories:
        text = f"{title} {summary}"
        note = taxonomy.note_for(text)
        group = taxonomy.group_for(text, _policy_groups())
        if note is not None:
            builder.text("Watch topic", note.label, source)
            builder.text("Our reading", note.note, source)
        if group is not None:
            builder.text("Watch group", group.label, source)
        builder.caveat("The facts do not establish whether the rule is in force; check the original publication.")
        builder.caveat("This is our plain-language reading, not legal advice.")
    else:
        builder.caveat("The facts describe one stored source record, not the whole market.")
    builder.caveat("Only the facts listed above are known; anything else is unknown.")
    fallback_summary = summary[:FALLBACK_ITEM_CHARS].rstrip()
    fallback_text = _item_fallback(row, fallback_summary, note)
    cache_kind = "policy" if ("E" in categories or request.kind == "policy") else "item"
    return ExplanationFacts(
        target=ExplainTarget(kind=request.kind, id=row["id"], label=title or row["id"]),
        cache_kind=cache_kind,
        bundle=builder.bundle(),
        fallback_text=fallback_text,
        fallback_sources=[source] if source is not None else [],
        role_id=request.roleId,
    )


def explain_facts(conn: Conn, request: ExplainRequest, language: str) -> ExplanationFacts:
    """Resolve the request server-side: an `insightId` or a `market_items` `itemId`."""
    if request.insightId:
        return _insight_facts(conn, request, language)
    if request.itemId:
        return _item_facts(conn, request, language, _item_row(conn, request.itemId))
    raise UnknownTarget("Explain needs an insightId or an itemId.")


# --- ask retrieval ------------------------------------------------------------

@dataclass
class AskFacts:
    """The retrieved bundle for one question plus the deterministic no-data/fallback material."""

    question: str
    language: str
    target_id: str  # hash of the normalised question (part of the cache key)
    bundle: dict[str, Any]
    role_id: str | None = None
    role_name: str | None = None
    usable: bool = False  # False -> no_data, no provider call
    follow_ups: list[str] = field(default_factory=list)
    fallback_text: str = ""
    fallback_sentences: list[tuple[str, list[SourceRef]]] = field(default_factory=list)


def _word_match(question: str, phrase: str) -> int:
    """Length of `phrase` when it occurs as a whole phrase in `question`, else 0."""
    cleaned = " ".join((phrase or "").split())
    if len(cleaned) < 3:
        return 0
    pattern = re.compile(rf"(?<!\w){re.escape(cleaned)}(?!\w)", re.IGNORECASE)
    return len(cleaned) if pattern.search(question) else 0


def detect_role(conn: Conn, question: str) -> str | None:
    """A role mentioned by name or alias in the question (roles table first, then taxonomy aliases)."""
    names = market_view.role_names(conn)
    best: tuple[int, str] | None = None
    for role_id, name in names.items():
        score = _word_match(question, name)
        if score and (best is None or score > best[0]):
            best = (score, role_id)
    by_name = {name.strip().casefold(): role_id for role_id, name in names.items()}
    for canonical, aliases in role_aliases().items():
        role_id = by_name.get((canonical or "").strip().casefold())
        if role_id is None:
            continue
        for alias in aliases:
            score = _word_match(question, alias)
            if score and (best is None or score > best[0]):
                best = (score, role_id)
    return best[1] if best is not None else None


def _search_tokens(question: str) -> list[str]:
    """Words longer than three characters, stopwords removed, case-insensitive and unique."""
    words = re.findall(r"[0-9A-Za-z\u00e4\u00f6\u00fc\u00df]{4,}", question or "")
    out: list[str] = []
    for word in words:
        folded = word.casefold()
        if folded in _STOPWORDS or folded in out:
            continue
        out.append(folded)
    return out[:6]


def _item_rows(conn: Conn, where: str, params: tuple, limit: int) -> list[Any]:
    return conn.execute(
        f"""SELECT {_ITEM_COLUMNS} FROM market_items {where}
             ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC, id LIMIT %s""",
        (*params, limit)).fetchall()


def _search_items(conn: Conn, question: str, role_name: str | None) -> list[Any]:
    """At most 6 items: ILIKE matches on title/summary, topped up with this role's tagged items."""
    rows: list[Any] = []
    tokens = _search_tokens(question)
    if tokens:
        patterns = [f"%{token}%" for token in tokens]
        rows = _item_rows(conn, "WHERE (title ILIKE ANY(%s) OR summary ILIKE ANY(%s))",
                          (patterns, patterns), MAX_ASK_ITEMS)
    if role_name and len(rows) < MAX_ASK_ITEMS:
        seen = {(row["source_id"], row["id"]) for row in rows}
        extra = _item_rows(conn, "WHERE %s = ANY(tags)", (f"role:{role_name}",), MAX_ASK_ITEMS - len(rows))
        rows.extend(row for row in extra if (row["source_id"], row["id"]) not in seen)
    return rows[:MAX_ASK_ITEMS]


def _follow_ups(insights: list[Insight], conn: Conn) -> list[str]:
    """Up to three headline suggestions: the role's insights first, then the global list."""
    pool = list(insights)
    if len(pool) < 3:
        try:
            pool += insights_service.insights(conn, limit=3)
        except Exception:  # an empty database must not stop the no-data answer
            pass
    headlines: list[str] = []
    for insight in pool:
        headline = (insight.headline or "").strip()
        if headline and headline not in headlines:
            headlines.append(headline)
        if len(headlines) == 3:
            break
    if not headlines:
        headlines = ["Which roles are growing fastest?",
                     "Which skills do the postings ask for?",
                     "What changed in policy this week?"]
    return headlines[:3]


def _ask_fallback(items: list[Any], insights: list[Insight], overview: Overview) -> tuple[str, list[tuple[str, list[SourceRef]]]]:
    """The deterministic answer when the provider or the guardrails fail: retrieved facts only.

    Our own (English) readings are preferred over raw source text: an item summary can be in
    German and is not a plain-language explanation. Item titles are the last resort.
    """
    sentences: list[tuple[str, list[SourceRef]]] = []
    # Market readings answer a question better than a global policy note; only fall back to those
    # when no market reading was retrieved at all.
    market = [item for item in insights if item.kind in {"demand", "skills", "employers"}]
    for insight in (market or insights)[:2]:
        sources = _unique_sources([row.source for row in insight.evidence])
        text = _trim(insight.body, FALLBACK_INSIGHT_CHARS).strip()
        if text:
            sentences.append((text if text.endswith((".", "!", "?")) else f"{text}.", sources))
    if not sentences and items:
        row = items[0]
        source = _row_source(row)
        title = _plain(row["title"]).strip()
        if title:
            text = title if title.endswith((".", "!", "?")) else f"{title}."
            sentences.append((text, [source] if source is not None else []))
            sentences.append(("Open the source next to it to read the original record.", [source] if source is not None else []))
    if not sentences and overview.postings is not None and overview.postings.value is not None:
        postings = overview.postings
        sentences.append((f"The latest sample has {_num(postings.value)} postings for the tracked roles "
                          f"in {postings.period}.", [postings.source]))
    if not sentences:
        return "", []
    return " ".join(text for text, _ in sentences), sentences


def ask_facts(conn: Conn, question: str, role_id: str | None, language: str) -> AskFacts:
    """Retrieve what the stored data has for this question (never calls a provider)."""
    normalized = " ".join((question or "").split())
    names = market_view.role_names(conn)
    if role_id:
        if role_id not in names:
            raise UnknownTarget(f"Unknown role: {role_id}")
    else:
        role_id = detect_role(conn, normalized)
    role_name = names.get(role_id) if role_id else None
    items = _search_items(conn, normalized, role_name)
    insights: list[Insight] = []
    if role_id:
        try:
            insights = insights_service.insights(conn, role=role_id, limit=100)[:MAX_ASK_INSIGHTS]
        except market_view.UnknownRole as exc:
            raise UnknownTarget(str(exc)) from exc
    overview = insights_service.overview(conn)
    usable = bool(items or insights or (role_id and (overview.postings or overview.biggestRiser
                                                     or overview.biggestFaller)))
    follow_ups = _follow_ups(insights, conn)
    fallback_text, fallback_sentences = _ask_fallback(items, insights, overview)
    primary = next((_row_source(row) for row in items if _row_source(row) is not None), None)
    builder = BundleBuilder(language, question=normalized)
    if role_name:
        builder.text("Role", role_name, primary)
    # Overview numbers first: they are the comparison the staff needs most, so the 8-number
    # cap can never drop them in favour of a single item's metrics.
    if overview.postings is not None:
        postings = overview.postings
        builder.number(f"Open positions, {postings.period}", postings.value, postings.source,
                       limit=MAX_ASK_NUMBERS)
        if postings.base is not None:
            builder.number("All postings in that sample", postings.base, postings.source,
                           limit=MAX_ASK_NUMBERS)
    for mover, label in ((overview.biggestRiser, "Largest rise"), (overview.biggestFaller, "Largest fall")):
        if mover is None:
            continue
        builder.number(f"{label}, change vs. the previous month, {mover.role.name}",
                       mover.changePct, mover.source, limit=MAX_ASK_NUMBERS)
        builder.number(f"{label}, postings in the latest month, {mover.role.name}",
                       mover.current, mover.source, limit=MAX_ASK_NUMBERS)
    for insight in insights:
        sources = _unique_sources([row.source for row in insight.evidence])
        source = sources[0] if sources else primary
        builder.text("Finding", insight.headline, source)
        builder.text("Reading", _trim(insight.body, MAX_INSIGHT_BODY), source)
        for evidence in insight.evidence:
            if re.search(r"\d", str(evidence.value)):
                builder.number(evidence.label, evidence.value, evidence.source, limit=MAX_ASK_NUMBERS)
            else:
                builder.text(evidence.label, evidence.value, evidence.source)
    for row in items:
        source = _row_source(row)
        builder.text("Stored record", row["title"], source)
        builder.text("Details", _trim(row["summary"], MAX_ASK_SUMMARY), source)
        for key, value in (row["metrics"] or {}).items():
            if isinstance(value, (int, float)):
                builder.number(str(key).replace("_", " "), value, source, limit=MAX_ASK_NUMBERS)
        if row["region"]:
            builder.text("Region", row["region"], source)
        if row["published_at"]:
            builder.text("Published", row["published_at"].date().isoformat(), source)
    builder.caveat("Only the facts listed above are known; anything else is unknown.")
    if overview.postings is not None:
        builder.caveat("Postings are a sample of the tracked roles, not a census of the market.")
    return AskFacts(
        question=normalized,
        language=language,
        target_id=hashlib.sha256(normalized.casefold().encode("utf-8")).hexdigest(),
        bundle=builder.bundle(),
        role_id=role_id,
        role_name=role_name,
        usable=usable,
        follow_ups=follow_ups,
        fallback_text=fallback_text,
        fallback_sentences=fallback_sentences,
    )
