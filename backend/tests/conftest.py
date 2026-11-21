"""Tests run against a real Postgres. Uses TEST_DATABASE_URL if set, otherwise starts an embedded one (pgserver)."""
import os
import tempfile

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import config


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
def client(database_url, monkeypatch):
    with psycopg.connect(database_url, autocommit=True) as c:  # fresh, empty schema per test
        c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    monkeypatch.setattr(config, "DATABASE_URL", database_url)
    monkeypatch.setattr(config, "INGEST_TOKEN", "secret")
    from app.main import app
    with TestClient(app) as c:
        yield c


TOKEN = {"Authorization": "Bearer secret"}
