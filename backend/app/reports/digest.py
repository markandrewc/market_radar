"""The briefing itself: DB rows -> `Digest` with one cited source per bullet.

A digest is built only from data that is already in Postgres (observations, roles,
market_items). Nothing is invented: a role without data is skipped, and every
bullet carries the `SourceRef` it came from. The plain-text version is generated
here and the citation is appended by this module, so it cannot be lost on the way
to an inbox. `app/reports/mailer.py` renders the HTML from the same digest.

Optional LLM polish (config.LLM_BASE_URL / LLM_API_KEY / LLM_MODEL all set) may
rewrite the wording of a bullet; the numbers, the source and the citation stay
ours. Any mismatch or error keeps the original text.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .. import config
from ..db import Conn, iso
from ..insights import taxonomy
from ..llm import client
from ..schemas import Digest, DigestBullet, DigestRequest, DigestSection, SourceRef
from ..services import market_view

_MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December")
_POLICY_LIMIT = 5
_TARGET_LIMIT = 3
_EMPLOYER_LIMIT = 3
_DEMAND_LIMIT = 6
_SUMMARY_CHARS = 280


# --- small formatting helpers -------------------------------------------------

def _utc(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(timezone.utc)
    return now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)


def _num(value: float | int | None) -> str:
    """41, 1.2 or 15.7: no trailing .0, no scientific notation for our number ranges."""
    if value is None:
        return "0"
    number = float(value)
    if number.is_integer():
        return str(int(number))
    return f"{number:.1f}".rstrip("0").rstrip(".")


def _month_label(period: str) -> str:
    year, month = period.split("-")
    return f"{_MONTHS[int(month) - 1]} {year}"


def _signed(value: float) -> str:
    return f"+{_num(value)}" if value > 0 else _num(value)


def _is_http(url: str | None) -> bool:
    return bool(url) and str(url).startswith(("http://", "https://"))


def _trim(summary: str, limit: int = _SUMMARY_CHARS) -> str:
    text = " ".join((summary or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _metrics_text(metrics: dict[str, Any] | None) -> str:
    if not metrics:
        return ""
    parts = []
    for key, value in metrics.items():
        if value is None:
            continue
        parts.append(f"{key}: {_num(value) if isinstance(value, (int, float)) else value}")
    return ", ".join(parts)


def citation(source: SourceRef) -> str:
    """The one citation format of every bullet, always appended by this module."""
    data_as_of = source.dataAsOf or "not stated"
    retrieved = (source.fetchedAt or "")[:10] or "not stated"
    return f"  — {source.name}, data as of {data_as_of}, retrieved {retrieved}: {source.url}"


def _item_source(row: dict) -> SourceRef | None:
    """A real SourceRef for one market_items row, or None when no http(s) link exists."""
    url = row["url"] if _is_http(row["url"]) else row["source_url"]
    name = (row["source_name"] or "").strip()
    if not name or not _is_http(url):
        return None
    published = row["published_at"]
    return SourceRef(id=row["source_id"], name=name, url=url, fetchedAt=iso(row["fetched_at"]),
                     dataAsOf=published.date().isoformat() if published else None)


def _source_ok(source: SourceRef) -> bool:
    return bool(source.name.strip()) and _is_http(source.url)


# --- sections -----------------------------------------------------------------

def _demand_bullet(entry) -> DigestBullet | None:
    if not _source_ok(entry.source):
        return None
    last_period = entry.series[-1].period
    parts = [f"{entry.role.name}: {_num(entry.current)} postings in {_month_label(last_period)}"]
    if len(entry.series) > 1:
        previous = _month_label(entry.series[-2].period)
        if entry.changePct > 0:
            parts.append(f"{_num(entry.changePct)} % more than in {previous}")
        elif entry.changePct < 0:
            parts.append(f"{_num(abs(entry.changePct))} % fewer than in {previous}")
        else:
            parts.append(f"unchanged vs. {previous} (0.0 %)")
    else:
        parts.append("no earlier month to compare yet")
    text = ", ".join(parts) + "."
    if entry.trend is not None:
        text += f" Trend: {entry.trend.direction}."
    return DigestBullet(text=text, source=entry.source)


def _demand_section(demand: list, requested: list[str]) -> tuple[DigestSection | None, bool]:
    """One bullet per selected role that has data; roleIds [] = all roles with demand data (max 6)."""
    by_role: dict[str, Any] = {}
    order: list[str] = []
    for entry in demand:  # already largest first
        if entry.role.id not in by_role:
            by_role[entry.role.id] = entry
            order.append(entry.role.id)
    if requested:
        selected = [role_id for role_id in requested if role_id in by_role]
    else:
        selected = order[:_DEMAND_LIMIT]
    bullets = [b for b in (_demand_bullet(by_role[role_id]) for role_id in selected) if b]
    return (DigestSection(heading="Demand", bullets=bullets) if bullets else None), bool(bullets)


def _skill_bullet(row, scope: str) -> DigestBullet | None:
    if not _source_ok(row.source):
        return None
    text = (f"{row.skill}: {_num(row.share)} % of {scope} mention it, "
            f"{_signed(row.changePct)} % vs. the previous month.")
    if row.trend is not None:
        text += f" Trend: {row.trend.direction}."
    return DigestBullet(text=text, source=row.source)


def _skills_section(conn: Conn, requested: list[str]) -> tuple[DigestSection | None, bool]:
    """Exactly one selected role -> that role's skills; otherwise the all-roles series (role_id = '')."""
    if len(requested) == 1:
        response = market_view.skills_for(conn, requested[0], horizon=0)
        scope = f"{response.role.name} postings"
    else:
        response = market_view.skills_for(conn, None, horizon=0)
        scope = "all postings"
    rows = response.skills
    chosen = rows[:5]
    picked = {row.skill for row in chosen}
    rising = [row for row in rows if row.skill not in picked and row.trend and row.trend.direction == "rising"][:3]
    picked.update(row.skill for row in rising)
    falling = [row for row in rows if row.skill not in picked and row.trend and row.trend.direction == "falling"][:3]
    bullets = [b for b in (_skill_bullet(row, scope) for row in [*chosen, *rising, *falling]) if b]
    return (DigestSection(heading="Skills", bullets=bullets) if bullets else None), bool(rows)


def _items(conn: Conn, category: str, limit: int) -> list[dict]:
    return conn.execute(
        """SELECT source_id, id, title, summary, metrics, url, source_name, source_url,
                  published_at, fetched_at
           FROM market_items WHERE %s = ANY(categories)
           ORDER BY published_at DESC NULLS LAST, fetched_at DESC, id LIMIT %s""",
        (category, limit)).fetchall()


def _policy_section(conn: Conn) -> tuple[DigestSection | None, bool]:
    rows = _items(conn, "E", _POLICY_LIMIT)
    bullets = []
    note = None  # our reading of the first matched topic; rendered as "Our reading, not the source"
    for row in rows:
        source = _item_source(row)
        title = (row["title"] or "").strip()
        if source is None or not title:
            continue
        summary = _trim(row["summary"])
        text = f"{title}: {summary}" if summary else title
        bullets.append(DigestBullet(text=text, source=source))
        if note is None:
            curated = taxonomy.note_for(f"{title} {summary}")
            if curated is not None:
                note = curated.note
    return (DigestSection(heading="Policy watch", bullets=bullets, note=note) if bullets else None), bool(bullets)


def _target_section(conn: Conn) -> tuple[DigestSection | None, bool]:
    rows = _items(conn, "D", _TARGET_LIMIT)
    bullets = []
    for row in rows:
        source = _item_source(row)
        title = (row["title"] or "").strip()
        if source is None or not title:
            continue
        metrics = _metrics_text(row["metrics"])
        text = f"{title}: {metrics}" if metrics else title
        bullets.append(DigestBullet(text=text, source=source))
    return (DigestSection(heading="Target group", bullets=bullets) if bullets else None), bool(bullets)


def _employer_response(conn: Conn, module, role_id: str):
    """The aggregation of app/services/employers.py for one role, or None when unavailable.

    That module is a parallel track; use its public API (role_by_id + build) and skip the
    section for any other shape instead of guessing.
    """
    role_by_id = getattr(module, "role_by_id", None)
    build = getattr(module, "build", None)
    if callable(role_by_id) and callable(build):
        role = role_by_id(conn, role_id)
        return build(conn, role) if role is not None else None
    for name in ("employers_for", "for_role", "aggregate", "employers"):  # defensive fallback
        call = getattr(module, name, None)
        if callable(call):
            try:
                return call(conn, role_id)
            except TypeError:
                return call(conn, role=role_id)
    return None


def _employer_bullets(conn: Conn, requested: list[str]) -> list[DigestBullet]:
    """Reuse app/services/employers.py when it exists; otherwise the section is skipped."""
    if not requested:
        return []
    try:
        from ..services import employers as employers_service  # noqa: PLC0415 - may not exist on an old checkout
    except Exception:
        return []
    names = market_view.role_names(conn)
    for role_id in requested:
        try:
            result = _employer_response(conn, employers_service, role_id)
        except Exception:
            continue
        if result is None:
            continue
        employers = getattr(result, "employers", None)
        source = getattr(result, "source", None)
        role = getattr(result, "role", None)
        if not employers or source is None or not _source_ok(source):
            continue
        role_name = getattr(role, "name", None) or names.get(role_id, role_id)
        window = getattr(result, "window", None)
        period = ""
        if window is not None:
            start, end = getattr(window, "from_", None), getattr(window, "to", None)
            if start and end:
                period = f" (postings {start} to {end})"
        bullets = []
        for employer in employers[:_EMPLOYER_LIMIT]:
            name = (getattr(employer, "name", "") or "").strip()
            if not name:
                continue
            openings = getattr(employer, "openings", None)
            parts = [f"{name}: {_num(openings) if openings is not None else '?'} open posting(s) "
                     f"for {role_name}{period}"]
            skills = [skill for skill in (getattr(employer, "topSkills", None) or []) if skill]
            if skills:
                parts.append("top skills " + ", ".join(skills))
            bullets.append(DigestBullet(text="; ".join(parts) + ".", source=source))
        if bullets:
            return bullets
    return []


def _employers_section(conn: Conn, requested: list[str]) -> DigestSection | None:
    bullets = _employer_bullets(conn, requested)
    return DigestSection(heading="Employers", bullets=bullets) if bullets else None


# --- optional LLM polish ------------------------------------------------------

def _llm_configured() -> bool:
    """The shared provider check: LLM_API_KEY plus a resolvable preset base/model."""
    return client.configured()


def _llm_chat(payload: dict) -> str:
    """The polish seam kept for the tests; the shared client performs the HTTP call.

    `payload` keeps the old messages shape. `app.llm.client.chat_json` adds the JSON-mode
    response format, the preset model and, for the DeepSeek preset, `thinking: disabled`.
    Only called when `_llm_configured()` is true.
    """
    messages = payload.get("messages") or []
    system = messages[0]["content"] if messages else ""
    user = messages[1]["content"] if len(messages) > 1 else ""
    content, _usage = client.chat_json(system, user)
    return content


def _parse_polish(answer: str, bullets: list[DigestBullet]) -> list[str] | None:
    """Accept only a JSON array of {text, source_id} in the same order, with our source ids."""
    text = (answer or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rstrip()
        if text.endswith("```"):
            text = text[:-3].rstrip()
    try:
        data = json.loads(text)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, list) or len(data) != len(bullets):
        return None
    out = []
    for item, bullet in zip(data, bullets):
        if not isinstance(item, dict):
            return None
        polished = item.get("text")
        if not isinstance(polished, str) or not polished.strip() or "\n" in polished or len(polished) > 800:
            return None
        if item.get("source_id") != bullet.source.id:
            return None
        out.append(polished.strip())
    return out


def _polish(sections: list[DigestSection]) -> list[DigestSection]:
    """Rewrite bullet wording only; citations are appended afterwards by _render_text."""
    if not _llm_configured() or not sections:
        return sections
    bullets = [bullet for section in sections for bullet in section.bullets]
    if not bullets:
        return sections
    payload = {
        "model": config.LLM_MODEL,
        "temperature": 0,
        "messages": [
            {"role": "system", "content":
                "You rewrite briefing bullets for a Swiss IT labour-market newsletter. Reply with a JSON array only, "
                "same length and order as the input, each item {\"text\": \"...\", \"source_id\": \"...\"}. "
                "Keep every number and fact exactly as given; do not add facts or citations; one or two sentences each."},
            {"role": "user", "content": json.dumps(
                [{"source_id": bullet.source.id, "text": bullet.text} for bullet in bullets], ensure_ascii=False)},
        ],
    }
    try:
        polished = _parse_polish(_llm_chat(payload), bullets)
    except Exception:  # network, provider error, malformed JSON: keep our text
        return sections
    if polished is None:
        return sections
    index = 0
    rewritten = []
    for section in sections:
        new_bullets = []
        for bullet in section.bullets:
            new_bullets.append(DigestBullet(text=polished[index], source=bullet.source))
            index += 1
        rewritten.append(DigestSection(heading=section.heading, bullets=new_bullets, note=section.note))
    return rewritten


# --- text and sources ---------------------------------------------------------

def _render_text(sections: list[DigestSection]) -> str:
    blocks = []
    for section in sections:
        lines = [section.heading]
        for bullet in section.bullets:
            lines.append(f"- {bullet.text}")
            lines.append(citation(bullet.source))
        if section.note:
            lines.append(f"Our reading, not the source: {section.note}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _collect_sources(sections: list[DigestSection]) -> list[SourceRef]:
    seen: dict[str, SourceRef] = {}
    for section in sections:
        for bullet in section.bullets:
            seen.setdefault(bullet.source.id, bullet.source)
    return list(seen.values())


def _empty_text() -> str:
    base = config.PUBLIC_BASE_URL
    sources_url = f"{base}/sources" if base else "/sources"
    return ("Nothing to report this period: there are no matching demand figures, policy items or "
            "target-group items for this briefing.\n"
            f"New data appears after a source sync; check what each source delivered on the sources page: "
            f"{sources_url}")


def build_digest(conn: Conn, request: DigestRequest, now: datetime | None = None) -> Digest:
    """Build the briefing for `request` from the database. Unknown role ids raise ValueError (HTTP 422).

    Sections with no data are left out; `empty` is true only when there are no demand rows and no
    included policy/target-group items, and the text then explains why and links to /sources.
    """
    now = _utc(now)
    requested: list[str] = []
    for role_id in request.roleIds:
        if role_id not in requested:
            requested.append(role_id)
    known = market_view.role_names(conn)
    unknown = [role_id for role_id in requested if role_id not in known]
    if unknown:
        raise ValueError("Unknown role: " + ", ".join(unknown))

    sections: list[DigestSection] = []
    available: list[bool] = []

    demand_section, demand_available = _demand_section(market_view.demand_rows(conn, months=12, horizon=0), requested)
    available.append(demand_available)
    if demand_section:
        sections.append(demand_section)

    # Skills do not count towards `empty`: the contract defines an empty briefing by demand, policy and
    # target-group data only.
    skills_section, _ = _skills_section(conn, requested)
    if skills_section:
        sections.append(skills_section)

    if request.includePolicy:
        policy_section, policy_available = _policy_section(conn)
        available.append(policy_available)
        if policy_section:
            sections.append(policy_section)
    if request.includeTargetGroup:
        target_section, target_available = _target_section(conn)
        available.append(target_available)
        if target_section:
            sections.append(target_section)

    employers_section = _employers_section(conn, requested)
    if employers_section:
        sections.append(employers_section)

    sections = _polish(sections)
    empty = not any(available)
    local = now.astimezone(ZoneInfo(config.REPORT_TIMEZONE))
    subject = f"Market Radar: briefing, week {local.isocalendar().week}"
    if empty:
        # "nothing to report": no bullets at all, just the explanation and the /sources link.
        return Digest(subject=subject, text=_empty_text(), sections=[], sources=[], generatedAt=iso(now), empty=True)
    return Digest(subject=subject, text=_render_text(sections), sections=sections,
                  sources=_collect_sources(sections), generatedAt=iso(now), empty=False)
