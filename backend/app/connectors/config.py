"""sources.yaml -> validated source definitions.

The YAML is the whole wiring for a data source: name, url, category, refresh
rate and adapter. Adding a source means adding a block there, nothing in the
adapters, the API or the frontend changes (see docs/ADDING_SOURCES.md).

Validation never raises for a broken *entry*: valid sources are kept, the
problems end up in LoadedConfig.errors and are shown by GET /api/connectors.
That keeps a typo on a mounted volume from taking the service down.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from .. import config as app_config
from ..schemas.insights import PolicyGroup

log = logging.getLogger(__name__)

CATEGORIES = ("A", "B", "C", "D", "E")
ADAPTER_TYPES = ("rest_api", "rss_atom", "csv_url")

_ENV = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
_REFRESH = re.compile(r"^(\d+)\s*(m|h|d|w)$")
_REFRESH_WORDS = {"daily": 86_400, "weekly": 604_800, "monthly": 2_592_000, "yearly": 31_536_000}
_REFRESH_NEVER = ("static", "manual", "never")
_UNIT_SECONDS = {"m": 60, "h": 3_600, "d": 86_400, "w": 604_800}

# City -> canton for the cities in defaults.target_cities; override with defaults.city_cantons.
DEFAULT_CITY_CANTONS = {
    "zürich": "ZH",
    "zurich": "ZH",
    "bern": "BE",
    "basel": "BS",
    "luzern": "LU",
    "zug": "ZG",
    "lausanne": "VD",
    "genève": "GE",
    "geneve": "GE",
    "genf": "GE",
}


class ConfigError(ValueError):
    """sources.yaml cannot be used at all (missing file, unreadable YAML)."""


def expand_env(value: str) -> str:
    """Replace ${VAR} with its environment value; unknown variables stay literal."""
    return _ENV.sub(lambda match: os.environ.get(match.group(1), match.group(0)), value)


def refresh_seconds(value: str) -> int | None:
    """'weekly' -> 604800, '6h' -> 21600, 'static' -> None (never due automatically)."""
    text = value.strip().lower()
    if text in _REFRESH_WORDS:
        return _REFRESH_WORDS[text]
    if text in _REFRESH_NEVER:
        return None
    match = _REFRESH.match(text)
    if match is None:
        raise ValueError(f"expected daily|weekly|monthly|yearly|static or <n>h/<n>d/<n>w, got '{value}'")
    return int(match.group(1)) * _UNIT_SECONDS[match.group(2)]


class Defaults(BaseModel):
    """Values that apply to every source (docs/ADDING_SOURCES.md)."""

    model_config = ConfigDict(extra="forbid")

    target_cities: list[str] = []
    target_roles: list[str] = []
    policy_keywords: list[str] = []
    # Curated product knowledge (docs/ADDING_SOURCES.md). Empty = use app/insights/taxonomy.py.
    policy_groups: list[PolicyGroup] = []
    role_aliases: dict[str, list[str]] = {}
    # Optional override of the built-in city -> canton map used for region normalisation.
    city_cantons: dict[str, str] = {}

    def canton_map(self) -> dict[str, str]:
        mapping = dict(DEFAULT_CITY_CANTONS)
        mapping.update({city.strip().lower(): canton.upper() for city, canton in self.city_cantons.items()})
        return mapping


class SourceConfig(BaseModel):
    """One block of sources.yaml. Optional keys are only needed for special sources."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    name: str
    source_url: str
    description: str = ""
    category: list[Literal["A", "B", "C", "D", "E"]]
    adapter_type: Literal["rest_api", "rss_atom", "csv_url"]

    endpoint: str | None = None
    endpoints: list[str] | None = None
    refresh_rate: str = "weekly"
    enabled: bool = True

    # Auth: names of env variables that must be present; missing ones -> source is skipped, not failed.
    auth_env: list[str] = []
    params: dict[str, str | int | float | bool] = {}
    headers: dict[str, str] = {}

    # Filtering and mapping, so a new source never needs code.
    filter_keywords: list[str] = []
    filter_regions: bool = False
    region: str | None = None
    tags: list[str] = []
    field_map: dict[str, str | dict[str, str]] = {}
    items_path: str | None = None
    pages: int = 1
    max_items: int = 2000
    timeout: float = 20.0
    delimiter: str = ","

    licence: str | None = Field(default=None, validation_alias=AliasChoices("licence", "license"))
    licence_url: str | None = None

    @field_validator("id")
    @classmethod
    def _id(cls, value: str) -> str:
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", value):
            raise ValueError("use lower-case letters, digits, '.', '_' or '-'")
        return value

    @field_validator("category", mode="before")
    @classmethod
    def _category(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list) or not value:
            raise ValueError("expected a non-empty list such as [\"A\"]")
        return value

    @field_validator("category")
    @classmethod
    def _category_unique(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("categories must be unique")
        return value

    @field_validator("endpoints", mode="before")
    @classmethod
    def _endpoints(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = [value]
        return value

    @field_validator("endpoint", "endpoints")
    @classmethod
    def _url(cls, value: Any) -> Any:
        urls = [value] if isinstance(value, str) else value or []
        for url in urls:
            if not re.match(r"^(https?|file)://", url):
                raise ValueError(f"expected an http(s):// or file:// URL, got '{url}'")
        return value

    @field_validator("refresh_rate")
    @classmethod
    def _refresh(cls, value: str) -> str:
        refresh_seconds(value)
        return value.strip().lower()

    @field_validator("auth_env")
    @classmethod
    def _auth_env(cls, value: list[str]) -> list[str]:
        for name in value:
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
                raise ValueError(f"'{name}' is not an environment variable name")
        return value

    @field_validator("pages", "max_items")
    @classmethod
    def _positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("must be at least 1")
        return value

    @field_validator("timeout")
    @classmethod
    def _timeout(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("must be greater than 0")
        return value

    @model_validator(mode="after")
    def _endpoint_choice(self) -> SourceConfig:
        if bool(self.endpoint) == bool(self.endpoints):
            raise ValueError("set exactly one of 'endpoint' or 'endpoints'")
        if self.pages > 1 and any("{page}" not in url for url in self.urls):
            raise ValueError("pages > 1 needs a {page} placeholder in the endpoint")
        return self

    @property
    def urls(self) -> list[str]:
        return self.endpoints or ([self.endpoint] if self.endpoint else [])

    @property
    def refresh_seconds(self) -> int | None:
        return refresh_seconds(self.refresh_rate)

    @property
    def hash(self) -> str:
        """Stable fingerprint of this block, so the API can report config drift."""
        payload = json.dumps(self.model_dump(mode="json"), sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(payload.encode()).hexdigest()


@dataclass
class LoadedConfig:
    """Result of reading sources.yaml. ``usable`` is false when the file itself is broken."""

    path: Path | None
    sha256: str = ""
    usable: bool = False
    defaults: Defaults = field(default_factory=Defaults)
    sources: list[SourceConfig] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.usable and not self.errors

    def by_id(self) -> dict[str, SourceConfig]:
        return {source.id: source for source in self.sources}


def _format_errors(path: Path, label: str, exc: ValidationError) -> list[str]:
    out = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"]) or "?"
        out.append(f"{path.name}: {label}: {location}: {error['msg']}")
    return out


def load(path: Path | None = None) -> LoadedConfig:
    """Read and validate the config. Never raises for broken entries (see the module docstring)."""
    target = Path(path or app_config.SOURCES_FILE)
    if not target.is_file():
        return LoadedConfig(path=target, errors=[f"{target}: not found (set SOURCES_FILE to point at sources.yaml)"])
    return parse(target.read_bytes(), target)


def write_file(target: Path, raw: bytes) -> None:
    """Atomically replace the config file (PUT /api/connectors/config, volume workflow)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"{target.name}.tmp")
    temporary.write_bytes(raw)
    os.replace(temporary, target)


def parse(raw: bytes, target: Path | None = None) -> LoadedConfig:
    """Validate config bytes without touching the filesystem - used by load() and by the upload route."""
    target = Path(target or app_config.SOURCES_FILE)
    sha256 = hashlib.sha256(raw).hexdigest()
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError as exc:
        return LoadedConfig(path=target, sha256=sha256, errors=[f"{target.name}: invalid YAML: {exc}"])

    errors: list[str] = []
    if not isinstance(data, dict):
        return LoadedConfig(path=target, sha256=sha256,
                            errors=[f"{target.name}: expected a mapping with 'defaults' and 'sources'"])

    defaults = Defaults()
    if "defaults" in data:
        try:
            defaults = Defaults.model_validate(data.get("defaults") or {})
        except ValidationError as exc:
            errors.extend(_format_errors(target, "defaults", exc))

    entries = data.get("sources") or []
    if not isinstance(entries, list):
        return LoadedConfig(path=target, sha256=sha256, usable=True, defaults=defaults,
                            errors=errors + [f"{target.name}: 'sources' must be a list"])

    sources: list[SourceConfig] = []
    seen: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"{target.name}: sources[{index}]: expected a mapping")
            continue
        label = entry.get("id") or f"sources[{index}]"
        try:
            source = SourceConfig.model_validate(entry)
        except ValidationError as exc:
            errors.extend(_format_errors(target, label, exc))
            continue
        if source.id in seen:
            errors.append(f"{target.name}: {source.id}: duplicate id")
            continue
        seen.add(source.id)
        sources.append(source)

    return LoadedConfig(path=target, sha256=sha256, usable=True, defaults=defaults, sources=sources, errors=errors)


def ensure_file() -> Path:
    """Seed a fresh volume from the baked copy, so SOURCES_FILE can point at /data/sources.yaml."""
    target = Path(app_config.SOURCES_FILE)
    if target.is_file():
        return target
    default = Path(app_config.SOURCES_DEFAULT_FILE)
    if default != target and default.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(default, target)
        log.info("seeded %s from %s", target, default)
    return target
