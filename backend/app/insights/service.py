"""The insight engine: stored rows -> `Insight` texts and the home-page `Overview`.

Everything here is read-only and deterministic. The numbers come from the same service calls
the dashboard uses (`market_view.demand_rows` / `skills_for`, `services.employers.build`) and
from `market_items` (category C = employer postings, D = context/target group, E = policy);
`templates.py` writes the sentence, this module only decides what is worth a sentence.

Rules enforced here (docs/api.md "Insights"):

- no data, no insight: an empty database answers `[]`, never a placeholder;
- every evidence row carries a real `SourceRef` with an http(s) URL (an item without one is
  skipped instead of being cited to nothing);
- the overview `postings.value` is the largest role count of the latest month with the sample
  size as `base` - role counts are never summed (one posting can count for several roles);
- regions come from the BFS BESTA records (`source_id = 'bfs-besta-regions'`), latest published
  quarter vs. the one before, and the insight is omitted when there are no such records.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from ..connectors import config as sources_config
from ..db import Conn, iso
from ..schemas import SourceRef
from ..schemas.insights import Insight, Overview, PulseMover, PulsePostings, SourceHealth
from ..services import market_view
from ..services.source_health import counts as source_health_counts
from . import taxonomy, templates

NEW_POLICY_DAYS = 7
# Below this many postings a month, a percentage move is mostly noise; the pulse prefers a role with data.
MIN_MOVER_POSTINGS = 20
MAX_POLICY_INSIGHTS = 100  # the API's maximum limit, so ?kind=policy&limit=100 can fill up
PULSE_KINDS = ("demand", "skills", "regions", "target", "policy")
REGIONS_SOURCE = "bfs-besta-regions"
COUNT_METRIC = "offene_stellen_tausend"  # thousand open positions, plenty of rows
RATE_METRIC = "quote_pct"  # open-position rate in %, the fallback when no counts exist
_HTTP = ("http://", "https://")
_ITEM_COLUMNS = ("source_id, id, title, summary, metrics, tags, url, source_name, source_url, "
                 "published_at, fetched_at")
_ID_PERIOD = re.compile(r"^(\d{4}-\d{2}):")
_TITLE_LABEL = re.compile(r"^[^:]+:\s*(.+?)\s*\(\d{4}-\d{2}\)")


def _now(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(timezone.utc)
    return now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)


def _is_http(url: str | None) -> bool:
    return bool(url) and str(url).startswith(_HTTP)


def _item_source(row: Any) -> SourceRef | None:
    """A real `SourceRef` for one `market_items` row, built from source_name/source_url and the dates.

    The publisher's page (`source_url`) is cited; only when it is not http(s) do we fall back to the
    record's own link. No http(s) link means no citation and therefore no insight.
    """
    url = row["source_url"] if _is_http(row["source_url"]) else row["url"]
    name = (row["source_name"] or "").strip()
    if not name or not _is_http(url):
        return None
    published = row["published_at"]
    return SourceRef(id=row["source_id"], name=name, url=url, fetchedAt=iso(row["fetched_at"]),
                     dataAsOf=published.date().isoformat() if published else None)


def _published(row: Any) -> str | None:
    published = row["published_at"]
    return published.date().isoformat() if published else None


def _period(row: Any) -> str | None:
    """YYYY-MM from `published_at`, else from the item id ('2026-06:region-zuerich-...')."""
    if row["published_at"]:
        return row["published_at"].strftime("%Y-%m")
    match = _ID_PERIOD.match(row["id"] or "")
    return match.group(1) if match else None


def _insight(kind: str, insight_id: str, generated_at: str, built: tuple[str, str, list, str],
             *, role_id: str | None = None, item_id: str | None = None) -> Insight:
    headline, body, evidence, severity = built
    return Insight(id=insight_id, kind=kind, headline=headline, body=body, evidence=evidence,
                   severity=severity, method="template", generatedAt=generated_at,
                   roleId=role_id, itemId=item_id)


# --- demand & skills ----------------------------------------------------------

def _demand_insights(conn: Conn, role_id: str | None, now: datetime) -> list[Insight]:
    entries = market_view.demand_rows(conn)
    if role_id is not None:
        entries = [entry for entry in entries if entry.role.id == role_id]
    generated = iso(now)
    out: list[Insight] = []
    seen: set[str] = set()
    for entry in entries:
        if entry.role.id in seen or not entry.series:
            continue
        seen.add(entry.role.id)  # one insight per role: the largest series first
        if not templates.source_ok(entry.source):
            continue
        previous = entry.series[-2] if len(entry.series) > 1 else None
        comparable = bool(previous) and (not entry.source.comparableFrom
                                         or previous.period >= entry.source.comparableFrom)
        months = entry.trend.months if entry.trend is not None else len(entry.series)
        facts = templates.DemandFacts(
            role_name=entry.role.name, period=entry.series[-1].period, value=entry.current,
            previous_period=previous.period if previous else None,
            previous_value=previous.value if previous else None,
            change_pct=entry.changePct if comparable else None,
            share=entry.shareSeries[-1].value if entry.shareSeries else None,
            previous_comparable=comparable,
            trend_direction=entry.trend.direction if entry.trend is not None else None,
            months=months, source=entry.source)
        out.append(_insight("demand", f"demand:{entry.role.id}", generated, templates.demand(facts),
                            role_id=entry.role.id))
    return out


def _skills_insight(conn: Conn, role_id: str | None, now: datetime) -> Insight | None:
    response = market_view.skills_for(conn, role_id)
    rows = [templates.SkillFact(skill=row.skill, share=row.share, change_pct=row.changePct,
                                trend_direction=row.trend.direction if row.trend is not None else None,
                                source=row.source)
            for row in response.skills if templates.source_ok(row.source)]
    if not rows:
        return None
    scope = "all postings" if role_id is None else f"{response.role.name} postings"
    facts = templates.SkillsFacts(scope=scope, rows=rows)
    return _insight("skills", f"skills:{role_id or 'all'}", iso(now), templates.skills(facts),
                    role_id=role_id)


# --- employers ----------------------------------------------------------------

def _employer_insights(conn: Conn, role_id: str | None, now: datetime) -> list[Insight]:
    from ..services import employers as employer_service  # the Level-3 aggregation, aggregate only

    roles = [employer_service.role_by_id(conn, role_id)] if role_id is not None else market_view.roles(conn)
    generated = iso(now)
    out: list[Insight] = []
    for role in roles:
        if role is None:
            continue
        try:
            result = employer_service.build(conn, role)
        except Exception:  # the parallel track may not be importable/usable on an old checkout
            continue
        if not result.employers or not templates.source_ok(result.source):
            continue
        facts = templates.EmployersFacts(
            role_name=role.name,
            employers=[templates.EmployerFact(name=employer.name, openings=employer.openings,
                                              top_skills=list(employer.topSkills))
                       for employer in result.employers],
            source=result.source)
        out.append(_insight("employers", f"employers:{role.id}", generated, templates.employers(facts),
                            role_id=role.id))
    return out


# --- regions (BFS BESTA) ------------------------------------------------------

def _region_key(row: Any) -> tuple[str, str] | None:
    """(stable key, readable region name) for one BESTA row; None for totals / branches."""
    item_id = row["id"] or ""
    key = item_id.split(":", 1)[1] if ":" in item_id else item_id
    for suffix in ("-offene-stellen", "-quote"):
        if key.endswith(suffix):
            key = key[: -len(suffix)]
    if not key.startswith("region-"):
        return None  # 'total' / 'ict' / 'info' rows are not regions
    match = _TITLE_LABEL.match(row["title"] or "")
    name = match.group(1).strip() if match else key[len("region-"):].replace("-", " ").title()
    return key, name


def _region_series(conn: Conn, metric: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""SELECT {_ITEM_COLUMNS} FROM market_items
             WHERE source_id = %s AND 'D' = ANY(categories)
             ORDER BY published_at DESC NULLS LAST, fetched_at DESC, id""",
        (REGIONS_SOURCE,)).fetchall()
    series: list[dict[str, Any]] = []
    for row in rows:
        period = _period(row)
        key = _region_key(row)
        metrics = row["metrics"] or {}
        value = metrics.get(metric)
        source = _item_source(row)
        if period is None or key is None or value is None or source is None:
            continue
        series.append({"key": key[0], "name": key[1], "period": period, "value": float(value), "source": source})
    return series


def _region_insights(conn: Conn, now: datetime) -> list[Insight]:
    series = _region_series(conn, COUNT_METRIC)
    metric = "count"
    if not series:
        series = _region_series(conn, RATE_METRIC)
        metric = "rate"
    if not series:
        return []
    periods = sorted({row["period"] for row in series})
    latest, previous = periods[-1], (periods[-2] if len(periods) > 1 else None)
    regions: list[templates.RegionFact] = []
    for row in series:
        if row["period"] != latest:
            continue
        older = next((other for other in series if other["period"] == previous and other["key"] == row["key"]),
                     None)
        change = None
        if older is not None and older["value"]:
            change = round((row["value"] - older["value"]) / older["value"] * 100, 1)
        regions.append(templates.RegionFact(name=row["name"], latest=round(row["value"], 1),
                                            previous=round(older["value"], 1) if older else None,
                                            change_pct=change))
    if not regions:
        return []
    facts = templates.RegionsFacts(quarter=latest, previous_quarter=previous, metric=metric,
                                   regions=regions, source=series[0]["source"])
    return [_insight("regions", f"regions:{REGIONS_SOURCE}", iso(now), templates.regions(facts))]


# --- target group (category D) ------------------------------------------------

def _target_count(conn: Conn) -> int:
    row = conn.execute("SELECT count(*) AS n FROM market_items WHERE 'D' = ANY(categories)").fetchone()
    return int(row["n"])


def _target_insight(conn: Conn, now: datetime) -> Insight | None:
    count = _target_count(conn)
    if not count:
        return None
    row = conn.execute(
        f"""SELECT {_ITEM_COLUMNS} FROM market_items
             WHERE 'D' = ANY(categories)
             ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC, id LIMIT 1""").fetchone()
    if row is None:
        return None
    source = _item_source(row)
    title = (row["title"] or "").strip()
    if source is None or not title:
        return None
    facts = templates.TargetFacts(count=count, title=title, published=_published(row), source=source)
    return _insight("target", "target:latest", iso(now), templates.target(facts), item_id=row["id"])


# --- policy (category E) ------------------------------------------------------

def _policy_groups() -> list:
    """The groups from sources.yaml -> defaults, falling back to the built-in list."""
    try:
        loaded = sources_config.load(sources_config.ensure_file())
        return taxonomy.groups_from(loaded.defaults)
    except Exception:  # unreadable file must not take the insight list down
        return list(taxonomy.DEFAULT_POLICY_GROUPS)


def _policy_insights(conn: Conn, now: datetime) -> list[Insight]:
    rows = conn.execute(
        f"""SELECT {_ITEM_COLUMNS} FROM market_items
             WHERE 'E' = ANY(categories)
             ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC, id LIMIT %s""",
        (MAX_POLICY_INSIGHTS,)).fetchall()
    groups = _policy_groups()
    generated = iso(now)
    out: list[Insight] = []
    for row in rows:
        source = _item_source(row)
        title = (row["title"] or "").strip()
        if source is None or not title:
            continue
        text = f"{title} {row['summary'] or ''}"
        facts = templates.PolicyFacts(title=title, published=_published(row),
                                      note=taxonomy.note_for(text), group=taxonomy.group_for(text, groups),
                                      source=source)
        out.append(_insight("policy", f"policy:{row['source_id']}:{row['id']}", generated,
                            templates.policy(facts), item_id=row["id"]))
    return out


# --- public API ---------------------------------------------------------------

def _build(conn: Conn, role_id: str | None, now: datetime) -> list[Insight]:
    """Every insight the stored rows support, in the order the UI shows them."""
    out: list[Insight] = []
    out.extend(_demand_insights(conn, role_id, now))
    skills_insight = _skills_insight(conn, role_id, now)
    if skills_insight is not None:
        out.append(skills_insight)
    out.extend(_employer_insights(conn, role_id, now))
    out.extend(_region_insights(conn, now))
    target_insight = _target_insight(conn, now)
    if target_insight is not None:
        out.append(target_insight)
    out.extend(_policy_insights(conn, now))
    return out


def insights(conn: Conn, role: str | None = None, kind: str | None = None, limit: int = 20,
             now: datetime | None = None) -> list[Insight]:
    """`GET /api/insights`: the plain-language list, newest/most relevant first.

    `role` limits demand/skills/employers to one role and raises `UnknownRole` for an unknown
    id; `kind` filters the list; `limit` is clamped to 1..100. An empty database answers `[]`.
    """
    moment = _now(now)
    role_id = (role or "").strip() or None
    if role_id is not None:
        row = conn.execute("SELECT id FROM roles WHERE id = %s", (role_id,)).fetchone()
        if row is None:
            raise market_view.UnknownRole(role_id)
    items = _build(conn, role_id, moment)
    if kind:
        items = [item for item in items if item.kind == kind]
    return items[: max(1, min(int(limit), 100))]


def _whole(value: float | int | None) -> int | float | None:
    """Keep whole counts whole so the JSON shows 184 instead of 184.0 (both are the same number)."""
    if value is None:
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def _postings(conn: Conn, demand: list) -> PulsePostings | None:
    """The latest month: the largest role count plus the sample size of all postings (never a sum)."""
    if not demand:
        return None
    latest_period = max(entry.series[-1].period for entry in demand if entry.series)
    latest = [entry for entry in demand if entry.series and entry.series[-1].period == latest_period]
    if not latest:
        return None
    biggest = max(latest, key=lambda entry: entry.series[-1].value)
    base = conn.execute(
        """SELECT max(base) AS base FROM observations
            WHERE source_id = %s AND metric = 'demand' AND period = %s""",
        (biggest.source.id, latest_period)).fetchone()["base"]
    return PulsePostings(value=_whole(biggest.series[-1].value), period=latest_period,
                         base=_whole(base), source=biggest.source)


def _movers(demand: list) -> tuple[PulseMover | None, PulseMover | None]:
    """Largest / smallest change between the two latest comparable months; None without two months."""
    by_role: dict[str, list] = {}
    for entry in demand:
        by_role.setdefault(entry.role.id, []).append(entry)
    candidates = []
    for entries in by_role.values():  # the source with the longest usable history explains the move
        entry = max(entries, key=lambda item: (len(item.series), item.current))
        if len(entry.series) < 2:
            continue
        previous = entry.series[-2].period
        if entry.source.comparableFrom and previous < entry.source.comparableFrom:
            continue
        candidates.append(entry)
    # Small samples swing wildly; prefer roles with at least MIN_MOVER_POSTINGS postings this month.
    solid = [entry for entry in candidates if entry.current >= MIN_MOVER_POSTINGS] or candidates
    riser = max((entry for entry in solid if entry.changePct > 0),
                key=lambda entry: entry.changePct, default=None)
    faller = min((entry for entry in solid if entry.changePct < 0),
                 key=lambda entry: entry.changePct, default=None)
    mover = lambda entry: PulseMover(role=entry.role, changePct=entry.changePct,  # noqa: E731
                                     current=_whole(entry.current), source=entry.source)
    return (mover(riser) if riser else None, mover(faller) if faller else None)


def _new_policy_count(conn: Conn, now: datetime) -> int:
    """Category-E records published (fallback: retrieved) within the last `NEW_POLICY_DAYS` days."""
    since = now - timedelta(days=NEW_POLICY_DAYS)
    row = conn.execute(
        """SELECT count(*) AS n FROM market_items
            WHERE 'E' = ANY(categories) AND COALESCE(published_at, fetched_at) BETWEEN %s AND %s""",
        (since, now)).fetchone()
    return int(row["n"])


def overview(conn: Conn, now: datetime | None = None) -> Overview:
    """`GET /api/overview`: the weekly pulse for the home page."""
    moment = _now(now)
    demand = market_view.demand_rows(conn)
    everything = _build(conn, None, moment)
    pulse: list[Insight] = []
    for kind in PULSE_KINDS:
        first = next((item for item in everything if item.kind == kind), None)
        if first is not None:
            pulse.append(first)
    riser, faller = _movers(demand)
    return Overview(
        generatedAt=iso(moment),
        postings=_postings(conn, demand),
        rolesTracked=len({entry.role.id for entry in demand}),
        biggestRiser=riser,
        biggestFaller=faller,
        newPolicyItems=_new_policy_count(conn, moment),
        targetGroupItems=_target_count(conn),
        sources=SourceHealth(**source_health_counts(conn)),
        insights=pulse)
