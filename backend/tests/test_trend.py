"""Trend and forecast (app/services/trend.py) and how the API exposes them."""
import pytest

from app import db
from app.services import trend


def series(values, bases=None, start=(2026, 1)):
    y, m = start
    out = []
    for i, v in enumerate(values):
        idx = y * 12 + m - 1 + i
        out.append((trend.month_period(idx), v, bases[i] if bases else 1))
    return out


def test_too_little_history():
    assert trend.compute(series([1, 2, 3]), "count") is None


def test_clear_rise_and_forecast():
    t = trend.compute(series([10, 12, 14, 16, 18, 20]), "count", horizon=3, digits=1)
    assert t.direction == "rising" and t.slopePerMonth == 2.0 and t.months == 6
    assert [(f.period, f.value) for f in t.forecast] == [("2026-07", 22.0), ("2026-08", 24.0), ("2026-09", 26.0)]
    assert all(f.low == f.value == f.high for f in t.forecast)  # perfect line: no uncertainty


def test_noise_is_stable_with_interval():
    t = trend.compute(series([10, 14, 9, 13, 10, 14, 9, 13]), "count", digits=1)
    assert t.direction == "stable"
    f = t.forecast[0]
    assert f.low < f.value < f.high


def test_forecast_is_clamped():
    t = trend.compute(series([30, 20, 10, 5]), "share", horizon=3, upper=100)
    assert all(0 <= f.low <= f.value <= f.high <= 100 for f in t.forecast)


def test_small_samples_count_less():
    # A wild first month from a tiny sample barely moves the weighted trend.
    vals, bases = [60, 20, 20, 20, 20, 20], [5, 500, 500, 500, 500, 500]
    weighted = trend.compute(series(vals, bases), "share")
    unweighted = trend.compute(series(vals), "share")
    assert abs(weighted.slopePerMonth) < abs(unweighted.slopePerMonth) / 5


def test_month_rollover():
    assert trend.month_period(trend.month_index("2026-12") + 1) == "2027-01"


@pytest.fixture
def seeded(client):
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sources (id, name, url, fetched_at) VALUES ('s', 'S', 'https://example.org', now())")
        cur.execute("INSERT INTO roles VALUES ('web', 'Web')")
        months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
        # The sample doubles every month, the role's share rises 1 point per month (10 % -> 15 %).
        for i, p in enumerate(months):
            base = 100 * 2 ** i
            cur.execute("INSERT INTO observations VALUES ('s', 'demand', 'web', '', %s, %s, %s)",
                        (p, (10 + i) / 100 * base, base))
            cur.execute("INSERT INTO observations VALUES ('s', 'skill', '', 'SQL', %s, %s, %s)",
                        (p, (40 - 2 * i) / 100 * base, base))
    return client


def test_api_demand_trend_uses_share(seeded):
    [d] = seeded.get("/api/demand", params={"horizon": 2}).json()
    assert d["trend"]["basis"] == "share" and d["trend"]["direction"] == "rising"
    assert d["trend"]["slopePerMonth"] == 1.0
    assert [f["period"] for f in d["trend"]["forecast"]] == ["2026-12", "2027-01"]
    assert d["trend"]["forecast"][0]["value"] == 16.0
    assert [p["value"] for p in d["shareSeries"]] == [10, 11, 12, 13, 14, 15]
    assert "extrapolation" in d["trend"]["method"]


def test_api_skill_trend(seeded):
    [s] = seeded.get("/api/skills").json()["skills"]
    assert s["trend"]["direction"] == "falling" and s["trend"]["slopePerMonth"] == -2.0


def test_api_no_trend_without_history(client):
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sources (id, name, url, fetched_at) VALUES ('s', 'S', 'https://example.org', now())")
        cur.execute("INSERT INTO roles VALUES ('web', 'Web')")
        cur.execute("INSERT INTO observations VALUES ('s', 'demand', 'web', '', '2026-11', 5, NULL)")
    [d] = client.get("/api/demand").json()
    assert d["trend"] is None and d["shareSeries"] is None


def test_comparable_from_drops_earlier_months():
    pts = series([1, 1, 1, 1, 50, 52, 54, 56])
    t = trend.compute(pts, "count", digits=1, comparable_from=pts[4][0])
    assert t.months == 4 and t.slopePerMonth == 2.0
    assert trend.compute(pts, "count", comparable_from=pts[6][0]) is None  # only 2 comparable months
