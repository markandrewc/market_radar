"""GET /api/sources: link, dates, licence and health per source."""
from datetime import datetime, timedelta, timezone

from conftest import FIXTURES, normalize

ITBOARD = (FIXTURES / "itboard-excerpt.csv").read_bytes()


def test_old_download_is_stale(client, raw):
    old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    raw.add("itboard-monthly", ITBOARD, fetched_at=old)
    normalize()
    [s] = client.get("/api/sources").json()
    assert s["status"] == "stale" and "7 days" in s["problem"]


def test_dates_only_move_forward(client, raw):
    raw.add("itboard-monthly", ITBOARD, report_date="2026-11-15", fetched_at="2026-11-21T08:00:00Z")
    normalize()
    raw.add("itboard-monthly", ITBOARD + b"\n", report_date="2026-10-15", fetched_at="2026-11-01T08:00:00Z")
    normalize()
    [s] = client.get("/api/sources").json()
    assert s["dataAsOf"] == "2026-11-15" and s["lastFetchedAt"] == "2026-11-21T08:00:00Z"
