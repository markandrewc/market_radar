"""sources.yaml loader, applying it to Postgres, and the /api/connectors read/reload pair."""
import pytest
import yaml

from app import config
from app.connectors import config as sources_config
from app.services import connectors as store
from conftest import write_sources

TOKEN = {"Authorization": "Bearer secret"}

DEFAULTS = {
    "target_cities": ["Zürich", "Bern"],
    "target_roles": ["Web Developer", "IT Support"],
    "policy_keywords": ["Asyl", "Status S"],
}

ITBOARD = {
    "id": "itboard",
    "name": "ITBoard Arbeitsmarkt",
    "source_url": "https://www.itboard.ch/arbeitsmarkt",
    "description": "Monatliche Kennzahlen.",
    "category": ["A"],
    "adapter_type": "csv_url",
    "endpoint": "https://www.itboard.ch/arbeitsmarkt/daten.csv",
    "field_map": {"id": "{monat}:{kennzahl}", "metrics": {"anzahl": "anzahl"}},
    "refresh_rate": "weekly",
    "licence": "CC BY 4.0",
}

POLICY = {
    "id": "policy",
    "name": "Fedlex Politik",
    "source_url": "https://www.fedlex.admin.ch/de/oc",
    "category": ["E"],
    "adapter_type": "rss_atom",
    "endpoints": ["https://fedlex.data.admin.ch/api/rss-oc-de.xml",
                  "https://fedlex.data.admin.ch/api/rss-fga-de.xml"],
    "filter_keywords": ["Asyl"],
    "refresh_rate": "daily",
}

SKILLS = {
    "id": "skills",
    "name": "ESCO Skills",
    "source_url": "https://esco.ec.europa.eu/de/classification/skill_main",
    "category": ["A", "B", "C"],
    "adapter_type": "rest_api",
    "endpoint": "https://ec.europa.eu/esco/api/search",
    "params": {"type": "skill", "language": "de"},
    "items_path": "_embedded.results",
    "field_map": {"id": "uri", "title": "{preferredLabel.de}"},
    "refresh_rate": "monthly",
}


@pytest.fixture
def config_file(sources_file):
    write_sources(sources_file, [ITBOARD, POLICY, SKILLS], DEFAULTS)
    return sources_file


def write_config(path, sources, defaults=None) -> None:
    write_sources(path, sources, DEFAULTS if defaults is None else defaults)


def test_load_parses_defaults_and_sources(config_file):
    loaded = sources_config.load(config_file)

    assert loaded.usable and loaded.ok and loaded.sha256
    assert loaded.defaults.target_roles == ["Web Developer", "IT Support"]
    assert [source.id for source in loaded.sources] == ["itboard", "policy", "skills"]

    itboard, policy, skills = loaded.sources
    assert itboard.refresh_seconds == 604_800
    assert itboard.hash and len(itboard.hash) == 64
    assert policy.urls == ["https://fedlex.data.admin.ch/api/rss-oc-de.xml",
                           "https://fedlex.data.admin.ch/api/rss-fga-de.xml"]
    assert skills.refresh_seconds == 2_592_000
    assert skills.params["type"] == "skill"
    assert itboard.licence == "CC BY 4.0"


def test_load_accepts_single_category_string_and_endpoint_lists(tmp_path):
    path = tmp_path / "sources.yaml"
    single = {key: value for key, value in ITBOARD.items() if key != "endpoint"}
    path.write_text(yaml.safe_dump({"sources": [{**single, "category": "A", "endpoints": ITBOARD["endpoint"]}]}))
    loaded = sources_config.load(path)

    assert loaded.ok
    assert loaded.sources[0].category == ["A"]
    assert loaded.sources[0].urls == [ITBOARD["endpoint"]]


def test_bad_entries_are_reported_and_good_ones_kept(config_file):
    write_config(config_file, [ITBOARD, {**POLICY, "category": ["F"]}, {**SKILLS, "adapter_type": "soap"},
                               {**ITBOARD, "id": "typo", "refresh_rat": "daily"},
                               {**POLICY, "id": "itboard"}])

    loaded = sources_config.load(config_file)

    assert loaded.usable and not loaded.ok
    assert [source.id for source in loaded.sources] == ["itboard"]  # the good one survives
    joined = " | ".join(loaded.errors)
    assert "category" in joined and "adapter_type" in joined
    assert "refresh_rat" in joined  # unknown keys are rejected instead of silently ignored
    assert "duplicate id" in joined


def test_endpoint_is_required(config_file):
    write_config(config_file, [{k: v for k, v in ITBOARD.items() if k != "endpoint"}])
    loaded = sources_config.load(config_file)
    assert not loaded.ok
    assert "exactly one of 'endpoint' or 'endpoints'" in loaded.errors[0]


def test_missing_file_is_not_usable(tmp_path):
    loaded = sources_config.load(tmp_path / "nothing.yaml")
    assert not loaded.usable and not loaded.ok
    assert "not found" in loaded.errors[0]


def test_broken_yaml_does_not_raise(config_file):
    config_file.write_text("sources: [unclosed\n")
    loaded = sources_config.load(config_file)
    assert not loaded.usable
    assert "invalid YAML" in loaded.errors[0]


def test_env_placeholders(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc")
    assert sources_config.expand_env("${ADZUNA_APP_ID}/${ADZUNA_MISSING}") == "abc/${ADZUNA_MISSING}"


def test_ensure_file_seeds_missing_volume_file(tmp_path, monkeypatch):
    baked = tmp_path / "image-sources.yaml"
    write_config(baked, [ITBOARD])
    target = tmp_path / "volume" / "sources.yaml"
    monkeypatch.setattr(config, "SOURCES_FILE", target)
    monkeypatch.setattr(config, "SOURCES_DEFAULT_FILE", baked)

    assert not target.exists()
    assert sources_config.ensure_file() == target
    assert target.read_text() == baked.read_text()
    assert sources_config.load().ok


def test_connectors_api_and_reload(config_file, client):
    listing = client.get("/api/connectors").json()

    assert listing["pendingChanges"] is False
    assert listing["configError"] is None
    assert listing["appliedAt"]
    assert sorted(source["id"] for source in listing["sources"]) == ["itboard", "policy", "skills"]
    assert listing["defaults"]["targetRoles"] == ["Web Developer", "IT Support"]
    itboard = next(source for source in listing["sources"] if source["id"] == "itboard")
    assert itboard["adapterType"] == "csv_url"
    assert itboard["refreshSeconds"] == 604_800
    assert itboard["categories"] == ["A"]
    assert itboard["endpoints"] == [ITBOARD["endpoint"]]

    # A changed file shows up as pending, reload applies it.
    config_file.write_text(config_file.read_text() + "\n")
    assert client.get("/api/connectors").json()["pendingChanges"] is True
    reloaded = client.post("/api/connectors/reload", headers=TOKEN)
    assert reloaded.status_code == 200
    assert reloaded.json()["sourceCount"] == 3
    assert reloaded.json()["updated"] == 3
    assert client.get("/api/connectors").json()["pendingChanges"] is False


def test_reload_requires_token(config_file, client):
    assert client.post("/api/connectors/reload").status_code == 401


def test_source_removed_from_file_is_disabled(config_file, client):
    write_config(config_file, [ITBOARD, POLICY])
    result = client.post("/api/connectors/reload", headers=TOKEN).json()

    assert result["disabled"] == 1
    by_id = {source["id"]: source for source in client.get("/api/connectors").json()["sources"]}
    assert by_id["skills"]["inConfig"] is False
    assert by_id["skills"]["enabled"] is False
    assert by_id["itboard"]["inConfig"] is True


def test_broken_file_keeps_previous_sources(config_file, client):
    config_file.write_text("sources: [unclosed\n")
    response = client.post("/api/connectors/reload", headers=TOKEN)

    assert response.status_code == 422
    listing = client.get("/api/connectors").json()
    assert "invalid YAML" in listing["configError"]
    assert len(listing["sources"]) == 3  # nothing was disabled
    assert listing["pendingChanges"] is True


def test_apply_config_is_idempotent(config_file, client):
    from app import db

    loaded = sources_config.load(config_file)
    with db.connect() as conn:
        first = store.apply_config(conn, loaded)
        second = store.apply_config(conn, loaded)
        rows = conn.execute("SELECT count(*) AS n FROM connector_sources").fetchone()

    assert (first.added, first.updated) == (0, 3)  # startup already applied them
    assert (second.added, second.updated) == (0, 3)
    assert rows["n"] == 3


def test_cli_list(config_file, capsys):
    from app.connectors.__main__ import main

    assert main(["list", "--file", str(config_file)]) == 0
    out = capsys.readouterr().out
    assert "itboard" in out and "csv_url" in out
