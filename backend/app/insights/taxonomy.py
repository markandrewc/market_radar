"""Curated product knowledge: policy watch groups, our reading notes and role aliases.

Three things live here, so the dashboard, the e-mailed briefing and the API tell the same
story (`GET /api/insights/taxonomy`, `defaults` block of `sources.yaml`):

- ``DEFAULT_POLICY_GROUPS``: how a category-E item is grouped for the Policy page.
- ``POLICY_NOTES``: the six curated plain-language readings (Status S/F, Stellenmeldepflicht,
  Asyl, Integration, Fachkräftemangel). The wording is deliberately careful and non-alarmist.
  It is our interpretation, never a claim taken from the source, and it is labelled as such
  everywhere it is rendered. The text is reviewable code on purpose (see docs/ADDING_SOURCES.md).
- ``DEFAULT_ROLE_ALIASES``: synonyms that count as an existing canonical role when connector
  records are normalised (e.g. "Machine Learning Engineer" -> ``role:AI Specialist``).

The defaults are the fallback when ``sources.yaml`` -> ``defaults`` omits the blocks; the file
is authoritative when present, so the team can edit wording and aliases without a deploy.
"""
from __future__ import annotations

from typing import Any

from ..schemas.insights import PolicyGroup, PolicyNote, Taxonomy

# The three watch groups of docs/api.md. German keywords, because the fedlex/parliament items
# are German; the code falls back to this list whenever sources.yaml has no policy_groups.
DEFAULT_POLICY_GROUPS: list[PolicyGroup] = [
    PolicyGroup(label="SEM numbers & distribution", keywords=[
        "Asylstatistik", "Schutzstatus", "Status S", "Status F", "Kantonsverteilung", "Gesuche",
    ]),
    PolicyGroup(label="Migration law", keywords=[
        "Asyl", "Ausländer", "Migration", "Aufenthalt", "Einbürgerung", "Ausweis",
    ]),
    PolicyGroup(label="Labour law & reporting", keywords=[
        "Arbeitsrecht", "Stellenmeldepflicht", "Erwerbstätigkeit", "Berufsbildung", "Arbeitszeit",
    ]),
]

# The six curated notes, served to the app and used in the briefing. `keyword` is the
# literal phrase to look for in an item's title + summary; the note is OUR reading.
POLICY_NOTES: list[PolicyNote] = [
    PolicyNote(
        keyword="Status S",
        label="Protection status S: residence and work rights",
        note=(
            "Status S is temporary protection while an asylum case is open, not a settled residence permit. "
            "Working is possible under conditions set by the asylum decision and the canton, and the status can "
            "change when the case is decided — confirm the current permit before relying on it in a placement."
        ),
    ),
    PolicyNote(
        keyword="Status F",
        label="Status F: provisional admission and work permits",
        note=(
            "Status F is a provisional admission while removal is not possible. Taking up work normally needs "
            "an explicit permit that the employer requests through the cantonal migration office, so the waiting "
            "time belongs in the placement plan — check the current decision with the canton before promising a "
            "start date."
        ),
    ),
    PolicyNote(
        keyword="Stellenmeldepflicht",
        label="Job-reporting duty for posted vacancies",
        note=(
            "The Stellenmeldepflicht makes employers report vacancies in the occupations the rules list to the "
            "RAV before advertising them publicly. If it is extended, affected roles may appear later and through "
            "other channels; the duty sits with the employer, but it changes how soon we can see a vacancy."
        ),
    ),
    PolicyNote(
        keyword="Asyl",
        label="Asylum procedure changes",
        note=(
            "Changes to asylum procedure law can shorten or lengthen how long someone stays in the process, and "
            "with it their access to work and integration measures. Check the amendment’s entry into force before "
            "changing a participant’s plan; this summary does not say whether it already applies."
        ),
    ),
    PolicyNote(
        keyword="Integration",
        label="Integration funding",
        note=(
            "Integration funding usually covers language courses and placement support and is renewed per budget "
            "period. A change can shift which courses or programmes are free for participants in a canton, so "
            "confirm with the canton before promising a specific place."
        ),
    ),
    PolicyNote(
        keyword="Fachkräftemangel",
        label="Skills-shortage policy",
        note=(
            "Debates about the Fachkräftemangel often concern admission rules and quotas for professionals from "
            "outside the EU/EFTA. If a rule changes, it can affect which permits employers are willing to pursue, "
            "but it does not change the skills employers ask for today."
        ),
    ),
]

# Aliases per canonical role name. Matching happens while normalising connector records
# (`app/connectors/base.py::_role_tags`): case-insensitive, whole-word-ish.
DEFAULT_ROLE_ALIASES: dict[str, list[str]] = {
    "AI Specialist": ["AI", "Artificial Intelligence", "Machine Learning", "ML"],
    "Data Science": ["Data Scientist", "Analytics", "Machine Learning", "Data Mining"],
    "IT Support": ["Helpdesk", "Service Desk", "First Level", "Support Specialist"],
    "Web Developer": ["Frontend", "Frontend Developer", "Full Stack"],
    "Software Engineer": ["Backend", "Backend Developer"],
    "Data Analyst": ["BI", "Business Intelligence", "Datenanalyst"],
}


# --- reading helpers ----------------------------------------------------------

def _text(value: str | None) -> str:
    return (value or "").casefold()


def note_for(text: str | None) -> PolicyNote | None:
    """The curated note whose keyword occurs in `text` (title + summary), or None."""
    haystack = _text(text)
    for note in POLICY_NOTES:
        if _text(note.keyword) in haystack:
            return note
    return None


def group_for(text: str | None, groups: list[PolicyGroup] | None = None) -> PolicyGroup | None:
    """The first watch group with a keyword in `text`; ``groups`` defaults to the built-in list."""
    haystack = _text(text)
    for group in groups or DEFAULT_POLICY_GROUPS:
        if any(_text(keyword) in haystack for keyword in group.keywords):
            return group
    return None


# --- sources.yaml defaults -> taxonomy ---------------------------------------

def _default_value(defaults: Any, name: str) -> Any:
    """Read a defaults field from the pydantic `Defaults` or from a plain dict (tests, CLI)."""
    if defaults is None:
        return None
    if isinstance(defaults, dict):
        return defaults.get(name)
    return getattr(defaults, name, None)


def groups_from(defaults: Any) -> list[PolicyGroup]:
    """The policy groups from sources.yaml, falling back to the built-in three."""
    configured = _default_value(defaults, "policy_groups") or []
    groups = list(configured) if configured else list(DEFAULT_POLICY_GROUPS)
    return [group if isinstance(group, PolicyGroup) else PolicyGroup.model_validate(group) for group in groups]


def aliases_from(defaults: Any) -> dict[str, list[str]]:
    """The role aliases from sources.yaml, falling back to the built-in map (copied, never shared)."""
    configured = _default_value(defaults, "role_aliases") or {}
    if not configured:
        return {role: list(aliases) for role, aliases in DEFAULT_ROLE_ALIASES.items()}
    return {str(role): [str(alias) for alias in (aliases or [])] for role, aliases in dict(configured).items()}


def build_taxonomy(defaults: Any = None) -> Taxonomy:
    """The complete taxonomy: file values where present, built-in defaults where not."""
    return Taxonomy(policyGroups=groups_from(defaults), policyNotes=list(POLICY_NOTES),
                    roleAliases=aliases_from(defaults))
