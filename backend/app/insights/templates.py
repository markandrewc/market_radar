"""The plain-language insights of "Market Radar" (docs/api.md "Insights").

Deterministic, template-only text built from the same rows the numbers come from: no model,
no invented figure. Every number that appears in a `body` is also in `evidence` with its
`SourceRef`, and a hint the source gives (comparable months, forecast as extrapolation) is
spelled out in the sentence.

The `app/insights/service.py` layer queries and prepares the `...Facts`; the functions here are
pure: facts in, ``(headline, body, evidence, severity)`` out.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas import SourceRef
from ..schemas.insights import Evidence, PolicyGroup, PolicyNote

MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December")

INFO = "info"
ATTENTION = "attention"

MIN_MONTHS_FOR_FORECAST = 4


# --- formatting helpers -------------------------------------------------------

def month_label(period: str) -> str:
    """'2026-11' -> 'November 2026' (the year is part of the evidence label, never invented)."""
    try:
        year, month = period.split("-")
        return f"{MONTHS[int(month) - 1]} {year}"
    except (AttributeError, IndexError, ValueError):
        return str(period)


def num(value: float | int | None) -> str:
    """41, 1.2, 5.25: plain decimal, no thousands separator and no scientific notation."""
    if value is None:
        return "0"
    number = float(value)
    if number.is_integer():
        return str(int(number))
    return f"{number:.2f}".rstrip("0").rstrip(".")


def signed(value: float) -> str:
    if value == 0:
        return "0"
    return f"+{num(value)}" if value > 0 else f"-{num(abs(value))}"


def is_http(url: str | None) -> bool:
    return bool(url) and str(url).startswith(("http://", "https://"))


def source_ok(source: SourceRef | None) -> bool:
    """A citation is only usable when it names the publisher and links to an http(s) page."""
    return bool(source) and bool(source.name.strip()) and is_http(source.url)


def _direction_word(direction: str | None, change_pct: float | None) -> str:
    if direction in ("rising", "falling", "stable"):
        return {"rising": "rising", "falling": "falling", "stable": "stable"}[direction]
    if change_pct is None or change_pct == 0:
        return "stable"
    return "rising" if change_pct > 0 else "falling"


# --- facts --------------------------------------------------------------------

@dataclass(frozen=True)
class DemandFacts:
    """One role/source demand series, already reduced to the latest two comparable months."""

    role_name: str
    period: str  # latest month, YYYY-MM
    value: float  # postings in the latest month
    previous_period: str | None
    previous_value: float | None
    change_pct: float | None  # share-based when the source states a sample size
    share: float | None  # latest share of all postings, if the source states the sample
    previous_comparable: bool  # False when the source changed how it counts between the months
    trend_direction: str | None  # rising / falling / stable, None when < 4 months
    months: int  # comparable months the trend is based on
    source: SourceRef


@dataclass(frozen=True)
class SkillFact:
    skill: str
    share: float
    change_pct: float
    trend_direction: str | None
    source: SourceRef


@dataclass(frozen=True)
class SkillsFacts:
    scope: str  # "all postings" or "IT Support postings"
    rows: list[SkillFact] = field(default_factory=list)


@dataclass(frozen=True)
class EmployerFact:
    name: str
    openings: int
    top_skills: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class EmployersFacts:
    role_name: str
    employers: list[EmployerFact] = field(default_factory=list)
    source: SourceRef | None = None


@dataclass(frozen=True)
class RegionFact:
    name: str
    latest: float
    previous: float | None
    change_pct: float | None


@dataclass(frozen=True)
class RegionsFacts:
    quarter: str  # YYYY-MM of the latest published quarter (end month)
    previous_quarter: str | None
    metric: str  # "count" (thousand open positions) or "rate" (open-position rate in %)
    regions: list[RegionFact] = field(default_factory=list)
    source: SourceRef | None = None


@dataclass(frozen=True)
class TargetFacts:
    count: int  # category-D items stored
    title: str | None  # newest item's title
    published: str | None  # newest item's date, YYYY-MM-DD
    source: SourceRef | None


@dataclass(frozen=True)
class PolicyFacts:
    title: str
    published: str | None
    note: PolicyNote | None
    group: PolicyGroup | None
    source: SourceRef | None


# --- demand -------------------------------------------------------------------

def demand(facts: DemandFacts) -> tuple[str, str, list[Evidence], str]:
    """Demand for one role: the count the card shows, plus the share when the source states a sample size."""
    month = month_label(facts.period)
    lead = f"{facts.role_name} shows {num(facts.value)} open positions in {month}"
    evidence = [Evidence(label=f"Open positions, {month}", value=num(facts.value), source=facts.source)]
    if facts.share is not None:
        lead += f", {num(facts.share)} % of all postings"
        evidence.append(Evidence(label=f"Share of all postings, {month}", value=f"{num(facts.share)} %",
                                 source=facts.source))
    parts = [lead + "."]

    comparable_noted = False
    if facts.previous_period and facts.previous_comparable and facts.change_pct is not None:
        previous = month_label(facts.previous_period)
        if facts.change_pct > 0:
            parts.append(f"{num(facts.change_pct)} % more than in {previous}.")
        elif facts.change_pct < 0:
            parts.append(f"{num(abs(facts.change_pct))} % fewer than in {previous}.")
        else:
            parts.append(f"Unchanged compared with {previous}.")
        evidence.append(Evidence(label=f"Change vs. {previous}", value=f"{signed(facts.change_pct)} %",
                                 source=facts.source))
    elif facts.previous_period:
        changed = facts.source.comparableFrom
        parts.append(f"We do not compare with {month_label(facts.previous_period)}: the source changed how it "
                     f"counts{' from ' + changed if changed else ''}.")
        comparable_noted = True
    else:
        parts.append("No earlier month to compare yet.")

    if facts.source.comparableFrom and not comparable_noted:
        parts.append(f"The source changed how it counts from {facts.source.comparableFrom}, so earlier months differ.")
    if facts.source.comparableFrom:
        evidence.append(Evidence(label="Comparable from", value=facts.source.comparableFrom, source=facts.source))

    if facts.trend_direction and facts.months >= MIN_MONTHS_FOR_FORECAST:
        word = {"rising": "up", "falling": "down", "stable": "sideways"}[facts.trend_direction]
        parts.append(f"The trend points {word} over the last months; treat the forecast as an extrapolation, "
                     f"not a promise.")
        evidence.append(Evidence(label=f"Trend over {facts.months} months", value=facts.trend_direction,
                                 source=facts.source))

    direction = _direction_word(facts.trend_direction, facts.change_pct)
    return f"{facts.role_name}: demand is {direction}", " ".join(parts), evidence, INFO


# --- skills -------------------------------------------------------------------

def skills(facts: SkillsFacts) -> tuple[str, str, list[Evidence], str]:
    """The most named skill and the clearest movers, each number tied to the skill row's source."""
    top = facts.rows[0]
    parts = [f"{top.skill} is the most named skill in {facts.scope}: {num(top.share)} % of postings mention it."]
    evidence = [Evidence(label=f"{top.skill}, share of {facts.scope}", value=f"{num(top.share)} %",
                         source=top.source)]

    rising = max((row for row in facts.rows if row.change_pct > 0), key=lambda row: row.change_pct, default=None)
    falling = min((row for row in facts.rows if row.change_pct < 0), key=lambda row: row.change_pct, default=None)
    if rising is not None and rising.skill != top.skill:
        parts.append(f"{rising.skill} is gaining ground ({num(rising.change_pct)} % vs. the previous month).")
        evidence.append(Evidence(label=f"{rising.skill}, change vs. the previous month",
                                 value=f"{signed(rising.change_pct)} %", source=rising.source))
    if falling is not None and falling.skill != top.skill:
        parts.append(f"{falling.skill} is losing ground ({num(abs(falling.change_pct))} % vs. the previous month).")
        evidence.append(Evidence(label=f"{falling.skill}, change vs. the previous month",
                                 value=f"{signed(falling.change_pct)} %", source=falling.source))

    if rising is not None and falling is None:
        headline = f"Skills: {top.skill} leads, {rising.skill} gains"
    elif falling is not None and rising is None:
        headline = f"Skills: {top.skill} leads, {falling.skill} slips"
    else:
        headline = f"Skills: {top.skill} is the most named skill"
    return headline, " ".join(parts), evidence, INFO


# --- employers ----------------------------------------------------------------

def employers(facts: EmployersFacts) -> tuple[str, str, list[Evidence], str]:
    """Who lists the most postings for one role (aggregate only: names and counts)."""
    lead = facts.employers[0]
    parts = [f"{lead.name} lists the most open postings for {facts.role_name}: {lead.openings}."]
    evidence = [Evidence(label=f"Open postings, {lead.name}", value=str(lead.openings), source=facts.source)]
    if len(facts.employers) > 1:
        second = facts.employers[1]
        parts.append(f"{second.name} follows with {second.openings}.")
        evidence.append(Evidence(label=f"Open postings, {second.name}", value=str(second.openings),
                                 source=facts.source))
    if lead.top_skills:
        parts.append(f"The most requested skills in those postings: {', '.join(lead.top_skills)}.")
        evidence.append(Evidence(label="Top skills in the postings", value=", ".join(lead.top_skills),
                                 source=facts.source))
    return f"{lead.name} hires most for {facts.role_name}", " ".join(parts), evidence, INFO


# --- regions ------------------------------------------------------------------

def regions(facts: RegionsFacts) -> tuple[str, str, list[Evidence], str]:
    """The latest published BFS BESTA quarter, compared with the one before it."""
    quarter = month_label(facts.quarter)
    lead = max(facts.regions, key=lambda region: region.latest)
    if facts.metric == "rate":
        lead_sentence = f"the {lead.name} region reports the highest open-position rate ({num(lead.latest)} %)."
        label = "Open-position rate"
        unit = "%"
    else:
        lead_sentence = f"the {lead.name} region reports the most open positions ({num(lead.latest)} thousand)."
        label = "Open positions"
        unit = "thousand"
    parts = [f"In {quarter} {lead_sentence}"]
    evidence = [Evidence(label=f"{label}, {lead.name}, {quarter}", value=f"{num(lead.latest)} {unit}",
                         source=facts.source)]

    moved = [region for region in facts.regions if region.change_pct is not None]
    riser = max((region for region in moved if region.change_pct > 0),
                key=lambda region: region.change_pct, default=None)
    faller = min((region for region in moved if region.change_pct < 0),
                 key=lambda region: region.change_pct, default=None)
    if facts.previous_quarter:
        previous = month_label(facts.previous_quarter)
        if riser is not None:
            parts.append(f"{riser.name} grew fastest: {num(riser.change_pct)} % more than in {previous}.")
            evidence.append(Evidence(label=f"Change, {riser.name}, vs. {previous}",
                                     value=f"{signed(riser.change_pct)} %", source=facts.source))
        if faller is not None:
            parts.append(f"{faller.name} fell by {num(abs(faller.change_pct))} %.")
            evidence.append(Evidence(label=f"Change, {faller.name}, vs. {previous}",
                                     value=f"{signed(faller.change_pct)} %", source=facts.source))
    parts.append("Regional figures are quarterly, so they move more slowly than the monthly series.")
    headline = (f"{lead.name}: highest open-position rate in the latest quarter" if facts.metric == "rate"
                else f"{lead.name}: most open positions in the latest quarter")
    return headline, " ".join(parts), evidence, INFO


# --- target group -------------------------------------------------------------

def target(facts: TargetFacts) -> tuple[str, str, list[Evidence], str]:
    """The newest category-D context figure for our target group (aggregate only)."""
    parts = [f"We track {facts.count} context items for our target group."]
    evidence = [Evidence(label="Target-group items", value=str(facts.count), source=facts.source)]
    if facts.title:
        parts.append(f'The newest is "{facts.title}".')
        evidence.append(Evidence(label="Newest item", value=facts.title, source=facts.source))
    if facts.published:
        parts.append(f"Published {facts.published}.")
        evidence.append(Evidence(label=f"Published, {facts.published}", value=facts.published,
                                 source=facts.source))
    parts.append("Aggregate figures only; they say nothing about individual participants.")
    return "What the newest figures say about our target group", " ".join(parts), evidence, INFO


# --- policy -------------------------------------------------------------------

def policy(facts: PolicyFacts) -> tuple[str, str, list[Evidence], str]:
    """A new category-E item: what it touches, plus our reading when a curated note matches."""
    if facts.note is not None:
        headline = f"A new publication touches {facts.note.keyword}"
        parts = [f'"{facts.title}" matches our watch topic {facts.note.label}.',
                 f"Our reading, not the source: {facts.note.note}"]
    elif facts.group is not None:
        headline = f"A new publication falls under {facts.group.label}"
        parts = [f'"{facts.title}" falls under the watch group {facts.group.label}.',
                 "Our reading, not the source: a new publication in a watched area; check the original "
                 "before relying on it."]
    else:
        headline = "New in the policy watch"
        parts = [f'New in the policy watch: "{facts.title}".',
                 "Our reading, not the source: a new publication in a watched area; check the original "
                 "before relying on it."]
    evidence = [Evidence(label="Publication title", value=facts.title, source=facts.source)]
    if facts.published:
        parts.append(f"Published {facts.published}.")
        evidence.append(Evidence(label=f"Published, {facts.published}", value=facts.published,
                                 source=facts.source))
    if facts.note is not None:
        evidence.append(Evidence(label="Watch topic", value=facts.note.keyword, source=facts.source))
    severity = ATTENTION if (facts.note is not None or facts.group is not None) else INFO
    return headline, " ".join(parts), evidence, severity
