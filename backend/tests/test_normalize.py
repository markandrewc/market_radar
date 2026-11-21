"""Step 2: raw folder -> database."""
import pytest

from app.normalize import ManifestError, parsers
from app.normalize.base import ParseOutput
from app.schemas import NormalizedObservation
from conftest import FIXTURES, normalize

ITBOARD = (FIXTURES / "itboard-excerpt.csv").read_bytes()  # real rows from itboard.ch/arbeitsmarkt/daten.csv


def test_missing_manifest(client):
    with pytest.raises(ManifestError, match="Run step 1 first"):
        normalize()


def test_itboard_end_to_end(client, raw):
    raw.add("itboard-monthly", ITBOARD, name="ITBoard · IT-Arbeitsmarkt Schweiz",
            report_url="https://www.itboard.ch/arbeitsmarkt", report_date="2026-11-15",
            licence="CC BY 4.0", licence_url="https://creativecommons.org/licenses/by/4.0/")
    [r] = normalize()
    assert (r.status, r.observations) == ("parsed", 12)  # 6 role rows + 6 technology rows ('ohne_chip' skipped)

    d = {x["role"]["id"]: x for x in client.get("/api/demand").json()}
    assert list(d) == ["software-engineer", "it-support", "data-analyst"]
    assert d["it-support"]["role"]["name"] == "IT Support"
    assert d["software-engineer"]["current"] == 184
    # vs. previous month: 139/582 -> 184/770, the share barely moves although the count rose by 32 %
    assert d["software-engineer"]["changePct"] == 0.1
    assert d["software-engineer"]["source"]["url"] == "https://www.itboard.ch/arbeitsmarkt"
    assert d["software-engineer"]["source"]["dataAsOf"] == "2026-11-15"

    s = client.get("/api/skills").json()
    assert s["role"]["id"] == "all"
    assert [(x["skill"], x["share"]) for x in s["skills"]] == [("ICT", 46.4), ("Python", 24.4), ("React", 4.8)]
    assert client.get("/api/skills", params={"role": "it-support"}).json()["skills"] == []

    [src] = client.get("/api/sources").json()
    assert (src["licence"], src["status"]) == ("CC BY 4.0", "ok")


def _rows(*lines: str) -> bytes:
    return ("monat,kennzahl,auspraegung,anzahl,basis\n" + "\n".join(lines) + "\n").encode()


def test_history_is_kept_and_corrections_win(client, raw):
    raw.add("itboard-monthly", _rows("2026-09,rolle,web,10,100", "2026-10,rolle,web,12,100"))
    normalize()
    # Next file only has the latest month and a corrected October: September must stay.
    raw.add("itboard-monthly", _rows("2026-10,rolle,web,13,100", "2026-11,rolle,web,15,100"))
    normalize()
    [d] = client.get("/api/demand").json()
    assert [(p["period"], p["value"]) for p in d["series"]] == [("2026-09", 10), ("2026-10", 13), ("2026-11", 15)]


def test_parser_error_keeps_old_numbers(client, raw):
    raw.add("itboard-monthly", ITBOARD)
    normalize()
    raw.add("itboard-monthly", b"something,else\n1,2\n")
    [r] = normalize()
    assert r.status == "error" and "unexpected header" in r.error
    assert len(client.get("/api/demand").json()) == 3
    [src] = client.get("/api/sources").json()
    assert src["status"] == "error" and "unexpected header" in src["problem"]


def test_checksum_and_missing_file(client, raw):
    e = raw.add("itboard-monthly", ITBOARD)
    (raw.path / e["relative_path"]).write_bytes(b"tampered")
    [r] = normalize()
    assert r.status == "error" and "checksum" in r.error
    (raw.path / e["relative_path"]).unlink()
    [r] = normalize()
    assert r.status == "error" and "missing" in r.error


def test_sources_without_parser_or_file(client, raw):
    raw.add("sem-status-s-monthly", b"PK\x03\x04", ext="xlsx")
    raw.entries["bfs-besta-regions"] = {"id": "bfs-besta-regions", "status": "unavailable", "relative_path": None,
                                        "sha256": None, "error": "HTTP 503"}
    raw.save()
    results = {r.source: r for r in normalize()}
    assert results["sem-status-s-monthly"].status == "no_parser"
    assert results["bfs-besta-regions"].status == "not_downloaded"
    assert results["bfs-besta-regions"].error == "HTTP 503"
    assert client.get("/api/sources").json() == []  # nothing on the dashboard from these


def test_failed_download_marks_source_stale(client, raw):
    raw.add("itboard-monthly", ITBOARD, status="retained", error="HTTP 500 · https://www.itboard.ch/...")
    normalize()
    [src] = client.get("/api/sources").json()
    assert src["status"] == "stale" and "download failed" in src["problem"]


def test_invalid_parser_output(client, raw, monkeypatch):
    monkeypatch.setitem(parsers.PARSERS, "x", lambda f: ParseOutput(observations=[
        NormalizedObservation(metric="demand", roleId="unknown", period="2026-11", value=1)]))
    raw.add("x", b"anything")
    [r] = normalize()
    assert r.status == "error" and "unknown roleId" in r.error


def test_itboard_counting_break(client, raw):
    # Up to August one role per posting (roles add up to less than counted), from September several.
    lines = []
    for month, counted, web, data in [("2026-05", 100, 40, 40), ("2026-06", 100, 41, 40), ("2026-07", 100, 42, 40),
                                      ("2026-08", 100, 43, 40), ("2026-09", 100, 80, 70), ("2026-10", 100, 80, 70),
                                      ("2026-11", 100, 81, 70), ("2026-12", 100, 82, 70)]:
        lines += [f"{month},inserate,gezaehlt,{counted},", f"{month},rolle,web,{web},{counted}",
                  f"{month},rolle,data,{data},{counted}"]
    raw.add("itboard-monthly", _rows(*lines))
    normalize()
    d = {x["role"]["id"]: x for x in client.get("/api/demand").json()}
    assert d["web"]["source"]["comparableFrom"] == "2026-09"
    assert len(d["web"]["series"]) == 8                       # history before the break is kept
    assert d["web"]["trend"]["months"] == 4                   # the trend only uses comparable months
    assert d["web"]["trend"]["slopePerMonth"] == 0.7          # 80 -> 82, not the jump from 43 to 80
    assert "changed how it counts" in d["web"]["trend"]["method"]
    assert d["data"]["trend"]["direction"] == "stable"
