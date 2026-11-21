"""Trend and short-term forecast for a monthly series.

Method: weighted linear regression over the last `window` months. Each month is weighted by its sample size
(`base`), so a month with 41 postings counts far less than one with 770; without a sample size all months count
the same. The forecast extends the line `horizon` months and gives a 95 % prediction interval. The direction is
'stable' unless the slope is clearly different from zero (its 95 % confidence interval excludes 0).

This is a plain extrapolation of the recent past, not a model of the labour market. It is labelled as such.
"""
import math
from collections.abc import Sequence

from ..schemas import ForecastPoint, Trend

WINDOW = 12
MIN_MONTHS = 4
METHOD = ("Weighted linear trend over the last {n} months (weights: sample size), "
          "extended {h} months with a 95 % prediction interval. An extrapolation, not a prediction of events.")
# Two-sided 95 % Student-t quantiles by degrees of freedom.
_T95 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086}


def _t95(df: int) -> float:
    return _T95.get(df, 2.06 if df <= 25 else 2.04 if df <= 30 else 1.96)


def month_index(period: str) -> int:
    y, m = period.split("-")
    return int(y) * 12 + int(m) - 1


def month_period(index: int) -> str:
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def compute(points: Sequence[tuple[str, float, float]], basis: str, horizon: int = 3, window: int = WINDOW,
            upper: float | None = None, digits: int = 2, comparable_from: str | None = None) -> Trend | None:
    """points: (period YYYY-MM, value, weight) sorted by period. Months before `comparable_from` (a change in how
    the source counts) are left out. Returns None if there is too little comparable history."""
    pts = [p for p in points if not comparable_from or p[0] >= comparable_from][-window:]
    if len(pts) < MIN_MONTHS:
        return None
    xs = [month_index(p) for p, _, _ in pts]
    ys = [float(v) for _, v, _ in pts]
    ws = [float(w) if w and w > 0 else 1.0 for _, _, w in pts]
    sw = sum(ws)
    xbar = sum(w * x for w, x in zip(ws, xs)) / sw
    ybar = sum(w * y for w, y in zip(ws, ys)) / sw
    sxx = sum(w * (x - xbar) ** 2 for w, x in zip(ws, xs))
    if sxx == 0:
        return None
    slope = sum(w * (x - xbar) * (y - ybar) for w, x, y in zip(ws, xs, ys)) / sxx
    intercept = ybar - slope * xbar
    n = len(pts)
    s2 = sum(w * (y - intercept - slope * x) ** 2 for w, x, y in zip(ws, xs, ys)) / (n - 2)
    t = _t95(n - 2)
    se_slope = math.sqrt(s2 / sxx)
    direction = "stable" if abs(slope) <= t * se_slope else "rising" if slope > 0 else "falling"

    def clamp(v: float) -> float:
        v = max(0.0, v)
        return min(v, upper) if upper is not None else v

    w_next = ws[-1]  # a future month is assumed to have the latest sample size
    forecast = []
    for k in range(1, horizon + 1):
        x0 = xs[-1] + k
        y0 = intercept + slope * x0
        half = t * math.sqrt(s2 * (1 / w_next + 1 / sw + (x0 - xbar) ** 2 / sxx))
        forecast.append(ForecastPoint(period=month_period(x0), value=round(clamp(y0), digits),
                                      low=round(clamp(y0 - half), digits), high=round(clamp(y0 + half), digits)))
    method = METHOD.format(n=n, h=horizon)
    if comparable_from:
        method += f" Uses months from {comparable_from} on: the source changed how it counts."
    return Trend(basis=basis, direction=direction, slopePerMonth=round(slope, digits + 1), months=n,
                 forecast=forecast, method=method)
