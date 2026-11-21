"""Tests run against a real Postgres. Uses TEST_DATABASE_URL if set, otherwise starts an embedded one (pgserver)."""
import hashlib
import json
import os
import tempfile
from pathlib import Path

import psycopg
import pytest
import yaml
from fastapi.testclient import TestClient

from app import config

FIXTURES = Path(__file__).with_name("fixtures")
TOKEN = {"Authorization": "Bearer secret"}


@pytest.fixture(scope="session")
def database_url():
    if url := os.environ.get("TEST_DATABASE_URL"):
        yield url
        return
    import pgserver
    with tempfile.TemporaryDirectory() as d:
        srv = pgserver.get_server(d, cleanup_mode="stop")
        yield srv.get_uri()
        srv.cleanup()


@pytest.fixture
def client(database_url, monkeypatch, tmp_path):
    with psycopg.connect(database_url, autocommit=True) as c:  # fresh, empty schema per test
        c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    monkeypatch.setattr(config, "DATABASE_URL", database_url)
    monkeypatch.setattr(config, "INGEST_TOKEN", "secret")
    monkeypatch.setattr(config, "RAW_DIR", tmp_path / "raw")
    from app.main import app
    with TestClient(app) as c:
        yield c


class RawFolder:
    """Builds a raw folder like step 1 (scripts/stage-raw-sources.mjs) does: files + latest.json."""

    def __init__(self, path: Path):
        self.path = path
        self.entries: dict[str, dict] = {}
        path.mkdir(parents=True, exist_ok=True)

    def add(self, source_id: str, content: bytes, ext: str = "csv", **meta) -> dict:
        sha = hashlib.sha256(content).hexdigest()
        rel = f"{source_id}-{sha}.{ext}"
        (self.path / rel).write_bytes(content)
        entry = {"id": source_id, "name": source_id.title(), "publisher": "Test",
                 "report_url": f"https://example.org/{source_id}", "source_url": f"https://example.org/{source_id}.{ext}",
                 "status": "downloaded", "relative_path": rel, "sha256": sha, "bytes": len(content),
                 "content_type": "text/csv", "fetched_at": "2026-11-21T08:00:00.000Z", "error": None, **meta}
        self.entries[source_id] = entry
        self.save()
        return entry

    def save(self) -> None:
        (self.path / "latest.json").write_text(json.dumps(
            {"schema_version": 1, "updated_at": "2026-11-21T08:00:00Z", "sources": list(self.entries.values())}))


@pytest.fixture
def raw(client) -> RawFolder:
    return RawFolder(config.RAW_DIR)


def write_sources(path: Path, sources: list[dict], defaults: dict | None = None) -> None:
    """Write a throwaway sources.yaml (docs/ADDING_SOURCES.md)."""
    path.write_text(yaml.safe_dump({"version": 1, "defaults": defaults or {}, "sources": sources},
                                   allow_unicode=True, sort_keys=False), encoding="utf-8")


@pytest.fixture
def sources_file(tmp_path, monkeypatch) -> Path:
    """Points SOURCES_FILE at a throwaway file; write to it before requesting `client`."""
    path = tmp_path / "sources.yaml"
    write_sources(path, [])
    monkeypatch.setattr(config, "SOURCES_FILE", path)
    monkeypatch.setattr(config, "SOURCES_DEFAULT_FILE", tmp_path / "default.yaml")
    return path


def normalize():
    from app import db
    from app.normalize import run
    with db.connect() as conn:
        return run(conn)
