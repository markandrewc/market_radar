"""Who is hiring for one role: aggregate the stored category-C postings (Level 3, category C).

Everything comes from `market_items` (categories contain ``C``) and `connector_sources`, so
the answer is as old as the last connector sync and costs no extra request. The contract is
frozen in docs/api.md: aggregate only - employer names, counts and skills, never contact
persons or applications. No category-C data answers with an empty list, never with invented
numbers.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from ..db import Conn, iso
from ..schemas import Employer, EmployersResponse, Role, SourceRef, Window

CATEGORY = "C"  # market_items.categories contains "C" = employer postings
MAX_EMPLOYERS = 10
TOP_SKILLS = 3
SKILLS_FILE = Path(__file__).resolve().parents[1] / "data" / "it_skills.yaml"
_MIN_DATE = datetime.min.replace(tzinfo=timezone.utc)

_ITEMS = """SELECT source_id, id, title, summary, payload, tags, url, published_at, fetched_at,
                   source_name, source_url
              FROM market_items
             WHERE %s = ANY(categories)"""


# --- skill list (app/data/it_skills.yaml) -----------------------------------

@dataclass(frozen=True)
class Skill:
    """One curated skill: the canonical name we return plus its compiled aliases."""

    name: str
    patterns: tuple[re.Pattern[str], ...]

    def matches(self, text: str) -> bool:
        return any(pattern.search(text) for pattern in self.patterns)


@lru_cache(maxsize=4)
def _read_skills(path: str) -> tuple[Skill, ...]:
    document = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    entries = document.get("skills") if isinstance(document, dict) else document
    if not isinstance(entries, list):
        raise ValueError(f"{path}: expected a 'skills' list")
    skills: list[Skill] = []
    for entry in entries:
        if isinstance(entry, str):
            name, aliases = entry, []
        elif isinstance(entry, dict):
            name, aliases = entry.get("name"), entry.get("aliases") or []
        else:
            continue
        name = str(name or "").strip()
        if not name:
            continue
        if not isinstance(aliases, list):
            aliases = [aliases]
        alias_texts = [str(alias).strip() for alias in aliases if str(alias).strip()]
        if name.casefold() not in {alias.casefold() for alias in alias_texts}:
            alias_texts.insert(0, name)
        skills.append(Skill(name=name, patterns=tuple(_alias_pattern(alias) for alias in alias_texts)))
    if not skills:
        raise ValueError(f"{path}: no usable skills")
    return tuple(skills)


def skills() -> tuple[Skill, ...]:
    """The curated IT skill list, parsed once per process."""
    return _read_skills(str(SKILLS_FILE))


def _alias_pattern(alias: str) -> re.Pattern[str]:
    """Case-insensitive whole-word-ish match: "Java" must not match "JavaScript"."""
    body = re.escape(alias)
    left = r"(?<![A-Za-z0-9])" if alias[0].isalnum() else ""
    right = r"(?![A-Za-z0-9])" if alias[-1].isalnum() else ""
    return re.compile(f"{left}{body}{right}", re.IGNORECASE)


# --- stored postings ---------------------------------------------------------

@dataclass(frozen=True)
class Posting:
    """One stored category-C record, already reduced to what the aggregation needs."""

    source_id: str
    id: str
    title: str
    summary: str
    payload: dict[str, Any]
    tags: tuple[str, ...]
    url: str | None
    published_at: datetime | None
    fetched_at: datetime
    source_name: str
    source_url: str

    @property
    def company(self) -> str | None:
        """`payload.company.display_name`, else a plain `payload.company` string; None = skip."""
        company = self.payload.get("company")
        name = company.get("display_name") if isinstance(company, dict) else company
        if not isinstance(name, str):
            return None
        return name.strip() or None

    @property
    def text(self) -> str:
        """Title + summary/description, preferring the raw payload fields the connector kept."""
        raw_title = self.payload.get("title")
        title = raw_title.strip() if isinstance(raw_title, str) and raw_title.strip() else self.title
        description = self.payload.get("description") or self.payload.get("summary")
        if not (isinstance(description, str) and description.strip()):
            description = self.summary
        return f"{title} {description}"


def _posting(row: Any) -> Posting:
    payload = row["payload"] if isinstance(row["payload"], dict) else {}
    return Posting(
        source_id=row["source_id"], id=row["id"], title=row["title"], summary=row["summary"],
        payload=payload, tags=tuple(row["tags"] or ()), url=row["url"],
        published_at=row["published_at"], fetched_at=row["fetched_at"],
        source_name=row["source_name"], source_url=row["source_url"])


def _order(posting: Posting) -> tuple[datetime, datetime, str]:
    """Newest first: published date, then retrieval, then id (records may lack a date)."""
    return (posting.published_at or _MIN_DATE, posting.fetched_at, posting.id)


def _matches_role(posting: Posting, role_name: str) -> bool:
    """`role:<role name>` tag (set by the connector) or the role name in the title."""
    wanted = f"role:{role_name}".casefold()
    if any(existing.casefold() == wanted for existing in posting.tags):
        return True
    return role_name.casefold() in posting.title.casefold()


# --- response building -------------------------------------------------------

def role_by_id(conn: Conn, role_id: str) -> Role | None:
    """The role from the `roles` table, or None for an unknown id (the router answers 404)."""
    row = conn.execute("SELECT id, name FROM roles WHERE id = %s", (role_id,)).fetchone()
    return Role(id=row["id"], name=row["name"]) if row else None


def build(conn: Conn, role: Role, *, limit: int = MAX_EMPLOYERS) -> EmployersResponse:
    """Aggregate the stored category-C postings for one role. Read-only, no network access."""
    skill_list = skills()
    postings = [posting for posting in (_posting(row) for row in conn.execute(_ITEMS, (CATEGORY,)))
                if _matches_role(posting, role.name) and posting.company]
    if not postings:
        return EmployersResponse(role=role, window=None, employers=[], source=_fallback_source(conn))
    postings.sort(key=_order, reverse=True)
    return EmployersResponse(role=role, window=_window(postings),
                             employers=_employers(postings, skill_list, limit=limit),
                             source=_source(conn, postings))


def _employers(postings: list[Posting], skill_list: tuple[Skill, ...], *,
               limit: int = MAX_EMPLOYERS) -> list[Employer]:
    """One row per employer: openings, sourceUrl of the newest posting, top 3 skills."""
    by_company: dict[str, list[Posting]] = defaultdict(list)
    for posting in postings:
        if posting.company:
            by_company[posting.company].append(posting)

    out: list[Employer] = []
    for company, group in by_company.items():
        group.sort(key=_order, reverse=True)
        mentions: Counter[str] = Counter()
        for posting in group:
            text = posting.text
            for skill in skill_list:
                if skill.matches(text):  # one mention per posting, however often the alias appears
                    mentions[skill.name] += 1
        top = [name for name, _ in sorted(mentions.items(), key=lambda item: (-item[1], item[0]))[:TOP_SKILLS]]
        out.append(Employer(
            name=company,
            openings=len(group),
            topSkills=top,
            sourceUrl=next((posting.url for posting in group if posting.url), None)))
    out.sort(key=lambda employer: (-employer.openings, employer.name.casefold(), employer.name))
    return out[:limit]


def _window(postings: list[Posting]) -> Window | None:
    """Min/max `published_at` of the contributing postings; None when no posting has a usable date."""
    dates = [posting.published_at.date() for posting in postings if posting.published_at]
    return Window(from_=min(dates).isoformat(), to=max(dates).isoformat()) if dates else None


def _connector(conn: Conn, source_id: str) -> Any:
    return conn.execute(
        """SELECT id, name, source_url, last_sync_at, applied_at
             FROM connector_sources WHERE id = %s""", (source_id,)).fetchone()


def _source(conn: Conn, postings: list[Posting]) -> SourceRef:
    """The connector behind the contributing postings: newest item's name/link, max retrieval date."""
    newest = max(postings, key=_order)
    connector = _connector(conn, newest.source_id)
    dates = [posting.published_at for posting in postings if posting.published_at]
    return SourceRef(
        id=connector["id"] if connector else newest.source_id,
        name=newest.source_name or (connector["name"] if connector else ""),
        url=newest.source_url or (connector["source_url"] if connector else ""),
        fetchedAt=iso(max(posting.fetched_at for posting in postings)),
        dataAsOf=max(dates).date().isoformat() if dates else None)


def _fallback_source(conn: Conn) -> SourceRef:
    """Provenance for the empty answer: the newest stored category-C record, else the configured
    category-C connector (so the UI can explain what to configure), else an empty reference.

    The response schema always carries a `source`; no employer numbers are invented."""
    row = conn.execute(f"{_ITEMS} ORDER BY published_at DESC NULLS LAST, fetched_at DESC, id DESC LIMIT 1",
                       (CATEGORY,)).fetchone()
    if row:
        newest = _posting(row)
        connector = _connector(conn, newest.source_id)
        fetched = conn.execute("SELECT max(fetched_at) AS fetched FROM market_items WHERE %s = ANY(categories)",
                               (CATEGORY,)).fetchone()["fetched"]
        newest_date = conn.execute("SELECT max(published_at) AS newest FROM market_items WHERE %s = ANY(categories)",
                                   (CATEGORY,)).fetchone()["newest"]
        return SourceRef(
            id=connector["id"] if connector else newest.source_id,
            name=newest.source_name or (connector["name"] if connector else ""),
            url=newest.source_url or (connector["source_url"] if connector else ""),
            fetchedAt=iso(fetched),
            dataAsOf=newest_date.date().isoformat() if newest_date else None)
    connector = conn.execute(
        """SELECT id, name, source_url, last_sync_at, applied_at
             FROM connector_sources
            WHERE %s = ANY(categories)
            ORDER BY (last_sync_at IS NULL), last_sync_at DESC NULLS LAST, name
            LIMIT 1""", (CATEGORY,)).fetchone()
    if connector:
        return SourceRef(id=connector["id"], name=connector["name"], url=connector["source_url"],
                         fetchedAt=iso(connector["last_sync_at"] or connector["applied_at"]), dataAsOf=None)
    return SourceRef(id="", name="", url="", fetchedAt="")
