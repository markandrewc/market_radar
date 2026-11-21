"""GET /api/target-group: the four Question-D figures from the SEM monthly tables."""
from datetime import datetime, timedelta, timezone

import pytest
from psycopg.types.json import Jsonb

from app import config

PERIOD = datetime(2026, 10, 1, tzinfo=timezone.utc)
PREVIOUS = datetime(2026, 9, 1, tzinfo=timezone.utc)

SEM_SOURCES = [
    ("sem-asylum-applications", "SEM · Asylgesuche (Tabelle 7-21)"),
    ("sem-status-s-monthly", "SEM · Schutzstatus S (Tabelle 7-70)"),
    ("sem-provisional-employment", "SEM · Vorläufig angemeldete (Tabelle 6-22)"),
    ("sem-immigration-canton-nationality", "SEM · Einwanderung (Tabelle 3-25)"),
]


def add_source(conn, source_id: str, name: str, *, dataset: bool = False) -> None:
    conn.execute(
        """INSERT INTO sources (id, name, url, fetched_at, data_as_of, dataset_url, dataset_modified)
           VALUES (%s, %s, %s, now(), %s, %s, %s)""",
        (source_id, name, f"https://example.org/{source_id}", PERIOD.date(),
         "https://opendata.swiss/de/dataset/offene-stellen-nach-grossregion7" if dataset else None,
         PERIOD.date() if dataset else None))


def add_item(conn, source_id: str, item_id: str, metrics: dict, *, published=PERIOD, fetched=None,
             name: str | None = None) -> None:
    conn.execute(
        """INSERT INTO market_items (source_id, id, category, categories, title, summary, metrics, tags,
                                     source_name, source_url, published_at, fetched_at)
           VALUES (%s, %s, 'D', ARRAY['D'], %s, '', %s, '{}', %s, %s, %s, %s)""",
        (source_id, item_id, f"Record {item_id}", Jsonb(metrics), name or f"Source {source_id}",
         f"https://example.org/{source_id}.xlsx", published, fetched or datetime.now(timezone.utc)))


def seed(conn, *, region_key: str = "total", sources=SEM_SOURCES) -> None:
    metrics = {
        "sem-asylum-applications": {"asylgesuche": 2210, "primaer": 1881},
        "sem-status-s-monthly": {"gesuche": 987, "schutzgewaehrungen": 932},
        "sem-provisional-employment": {"bestand": 42151, "erwerbstaetigenquote_pct": 47.3},
        "sem-immigration-canton-nationality": {"einwanderung_staendig": 17255, "aufenthalter_b": 16294},
    }
    for source_id, name in sources:
        add_source(conn, source_id, name)
        add_item(conn, source_id, f"2026-10:{region_key}", metrics[source_id], name=name)


def test_switzerland_returns_four_indicators(client):
    from app import db

    with db.connect() as conn:
        seed(conn)

    body = client.get("/api/target-group").json()

    assert body["region"] is None
    assert body["period"] == "2026-10"
    assert body["missing"] == [] and body["stale"] is False
    kpis = {kpi["id"]: kpi for kpi in body["kpis"]}
    assert set(kpis) == {"asylum", "status-s", "status-f", "immigration"}
    assert kpis["asylum"]["value"] == 2210
    assert kpis["asylum"]["secondary"] == 1881
    assert kpis["asylum"]["secondaryLabel"] == "first applications"
    assert kpis["status-f"]["value"] == 42151
    assert kpis["status-f"]["secondary"] == 47.3
    assert kpis["status-s"]["unit"] == "persons"
    # Only one month is stored, so there is no change to show - and none is guessed.
    assert all(kpi["changePct"] is None for kpi in body["kpis"])
    assert kpis["asylum"]["source"]["name"] == "SEM · Asylgesuche (Tabelle 7-21)"
    assert kpis["asylum"]["source"]["dataAsOf"] == "2026-10-01"
    assert kpis["asylum"]["note"]


def test_canton_filter_uses_the_canton_record(client):
    from app import db

    with db.connect() as conn:
        seed(conn, region_key="total")
        seed(conn, region_key="ZH", sources=[])
        add_item(conn, "sem-asylum-applications", "2026-10:ZH",
                 {"asylgesuche": 179, "primaer": 116})

    body = client.get("/api/target-group?region=zh").json()

    assert body["region"] == "ZH"
    asylum = next(kpi for kpi in body["kpis"] if kpi["id"] == "asylum")
    assert asylum["value"] == 179
    # The other indicators have no ZH record in this fixture: they are missing, not filled from CH.
    assert set(body["missing"]) == {"status-s", "status-f", "immigration"}


def test_unknown_canton_returns_no_kpis(client):
    from app import db

    with db.connect() as conn:
        seed(conn)

    body = client.get("/api/target-group?region=ZZ").json()

    assert body["kpis"] == []
    assert len(body["missing"]) == 4


def test_invalid_region_is_rejected(client):
    assert client.get("/api/target-group?region=Zürich").status_code == 422
    assert client.get("/api/target-group?region=Z").status_code == 422


def test_change_pct_needs_an_earlier_month(client):
    from app import db

    with db.connect() as conn:
        seed(conn)
        add_item(conn, "sem-asylum-applications", "2026-09:total",
                 {"asylgesuche": 2000, "primaer": 1700}, published=PREVIOUS)

    asylum = next(kpi for kpi in client.get("/api/target-group").json()["kpis"] if kpi["id"] == "asylum")

    assert asylum["changePct"] == 10.5  # 2210 vs 2000


def test_stale_sources_are_flagged(client):
    from app import db

    with db.connect() as conn:
        seed(conn)
        old = datetime.now(timezone.utc) - timedelta(days=config.SOURCE_STALE_DAYS + 1)
        conn.execute("UPDATE market_items SET fetched_at = %s", (old,))

    assert client.get("/api/target-group").json()["stale"] is True


def test_dataset_provenance_reaches_the_kpi(client):
    from app import db

    with db.connect() as conn:
        add_source(conn, "sem-asylum-applications", "SEM · Asylgesuche", dataset=True)
        add_item(conn, "sem-asylum-applications", "2026-10:total", {"asylgesuche": 2210, "primaer": 1881})

    asylum = client.get("/api/target-group").json()["kpis"][0]

    assert asylum["source"]["datasetUrl"] == "https://opendata.swiss/de/dataset/offene-stellen-nach-grossregion7"
    assert asylum["source"]["datasetModified"] == "2026-10-01"


def test_empty_database_lists_every_indicator_as_missing(client):
    body = client.get("/api/target-group").json()

    assert body["kpis"] == [] and body["period"] is None
    assert set(body["missing"]) == {"asylum", "status-s", "status-f", "immigration"}


def test_sources_endpoint_exposes_the_dataset_link(client):
    from app import db

    with db.connect() as conn:
        add_source(conn, "bfs-besta-regions", "BFS · BESTA", dataset=True)
        add_item(conn, "bfs-besta-regions", "2026-06:total-offene-stellen", {"offene_stellen_tausend": 99.8})

    bfs = next(source for source in client.get("/api/sources").json() if source["id"] == "bfs-besta-regions")

    assert bfs["datasetUrl"].endswith("offene-stellen-nach-grossregion7")
    assert bfs["datasetModified"] == "2026-10-01"
