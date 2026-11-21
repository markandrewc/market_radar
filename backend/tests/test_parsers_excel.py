"""Excel parsers for the BFS/SEM tables: canton rows become MarketItems of category D.

The fixtures are small synthetic excerpts with the same layout as the official files (header rows, German
canton names, footnotes), so a layout drift in the real tables shows up as a failing parser.
"""
from datetime import datetime, timezone

import pytest
from openpyxl import Workbook

from app.normalize.base import RawFile
from app.normalize.parsers import bfs_besta, sem_asylum, sem_immigration, sem_provisional, sem_status_s

FETCHED = datetime(2026, 11, 21, 8, 0, tzinfo=timezone.utc)
CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def make_raw(tmp_path, sheets: dict[str, list[list]], source_id: str, period: str = "2026-10") -> RawFile:
    path = tmp_path / f"{source_id}.xlsx"
    workbook = Workbook()
    workbook.remove(workbook.active)
    for title, rows in sheets.items():
        worksheet = workbook.create_sheet(title)
        for row in rows:
            worksheet.append(row)
    workbook.save(path)
    return RawFile(source_id=source_id, path=path, sha256="0" * 64, fetched_at=FETCHED, content_type=CONTENT_TYPE,
                   meta={"name": f"{source_id} (Test)", "period": period, "report_url": "https://example.org/report",
                         "source_url": "https://example.org/file.xlsx"})


def canton_sheet(header: list, rows: list[list], *, subheader: list | None = None) -> list[list]:
    return [["7-21"], ["Titel der Tabelle"], header, subheader or [None] * len(header), [], *rows,
            ["Quelle: SEM Statistik"]]


def test_asylum_parser_builds_canton_items(tmp_path):
    sheet = canton_sheet(
        ["Kanton", "Total Asylgesuche", "Primär-Gesuche", "Sekundär-Gesuche"],
        [["Total", 2210, 1881, 329], ["Zürich", 179, 116, 63], ["Bern", 128, 85, 43],
         ["Ohne Angabe", 1320, 1290, 30]],
        subheader=[None, None, None, "Total Sekundär-Gesuch"])
    out = sem_asylum.parse(make_raw(tmp_path, {"CH-Kt": sheet}, "sem-asylum-applications"))

    assert len(out.items) == 4
    zurich = next(item for item in out.items if item.region == "ZH")
    assert zurich.id == "2026-10:ZH"
    assert zurich.category == "D" and zurich.categories == ["D"]
    assert zurich.title == "Asylgesuche: Zürich (2026-10)"
    assert zurich.metrics == {"asylgesuche": 179.0, "primaer": 116.0, "sekundaer": 63.0}
    assert zurich.published_at == datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert zurich.source_name == "sem-asylum-applications (Test)"
    assert zurich.source_url == "https://example.org/report"
    assert "sem-asylum-applications" in zurich.tags and "asyl" in zurich.tags
    assert "179 Asylgesuche" in zurich.summary

    assert next(item for item in out.items if item.id == "2026-10:total").region is None
    assert next(item for item in out.items if item.id == "2026-10:ohne-angabe").region is None


def test_immigration_parser_reads_permit_columns(tmp_path):
    sheet = canton_sheet(
        ["Wohnkanton", "Ständige", None, None, "Kurzaufenthalter (L)", None, None, "Aufenthalter (B)"],
        [["Total", 17255, 7850, 9405, 844, 372, 472, 16294],
         ["Zürich", 3231, 1423, 1808, 95, 40, 55, 3114]],
        subheader=[None, "Total", "Frauen", "Männer", "Total", "Frauen", "Männer", "Total"])
    out = sem_immigration.parse(make_raw(tmp_path, {"CH-Kt": sheet}, "sem-immigration-canton-nationality"))

    zurich = next(item for item in out.items if item.region == "ZH")
    assert zurich.metrics == {"einwanderung_staendig": 3231.0, "kurzaufenthalter_l": 95.0,
                              "aufenthalter_b": 3114.0}
    assert "3-25" in zurich.tags


def test_provisional_parser_converts_the_rate(tmp_path):
    sheet = canton_sheet(
        ["Kanton", "Total", "Erwerbsfähige", "Erwerbstätige", "Erwerbstätigenquote"],
        [["Total", 42151, 31069, 14696, 0.47301168], ["Zürich", 7298, 5340, 2505, 0.46910112]])
    out = sem_provisional.parse(make_raw(tmp_path, {"CH-Kt": sheet}, "sem-provisional-employment"))

    zurich = next(item for item in out.items if item.region == "ZH")
    assert zurich.metrics["bestand"] == 7298.0
    assert zurich.metrics["erwerbstaetigenquote_pct"] == 46.9
    assert "status-f" in zurich.tags


def test_status_s_parser(tmp_path):
    sheet = canton_sheet(
        ["Kanton", "Gesuche", "Mehrfach", "Wiederaufnahmen", "Erledigungen", "Schutzgewährungen",
         "Ablehnungen", "Andere", "Quote"],
        [["Total", 987, 0, 37, 1188, 932, 101, 155, 0.9022], ["Zürich", 181, 0, 11, 207, 161, 18, 28, 0.8994]])
    out = sem_status_s.parse(make_raw(tmp_path, {"CH-Kt": sheet}, "sem-status-s-monthly"))

    zurich = next(item for item in out.items if item.region == "ZH")
    assert zurich.metrics == {"gesuche": 181.0, "erledigungen": 207.0, "schutzgewaehrungen": 161.0,
                              "ablehnungen": 18.0, "schutzgewaehrungsquote_pct": 89.9}
    assert zurich.title == "Schutzstatus S: Zürich (2026-10)"


def test_missing_canton_sheet_raises(tmp_path):
    with pytest.raises(ValueError, match="sheet 'CH-Kt' missing"):
        sem_asylum.parse(make_raw(tmp_path, {"Andere": [["x"]]}, "sem-asylum-applications"))


def besta_sheet(values: list[float], quote: bool = False) -> list[list]:
    years, quarters, header = [], [], [None, None]
    for index in range(10):  # 2024 Q1 .. 2026 Q2
        year = 2024 + index // 4
        quarter = ["I", "II", "III", "IV"][index % 4]
        years.append(year if quarter == "I" else None)
        quarters.append(quarter)
    data = [
        ["5-96", "Total", *values],
        ["62-63", "Informationstechnologische und Informationsdienstl.", *[value + 10 for value in values]],
        [None, "Genferseeregion", *[value + 20 for value in values]],
        ["77+79-82", "Erbringung von sonst. wirtschaftlichen Dienst.", *[value + 30 for value in values]],
    ]
    return [["06.02.00.02.01b"], ["Quartalswerte"], ["Quelle: BFS"],
            ["ABSCHNITTE UND ABTEILUNGEN", None, *years], [None, None, *quarters], *data]


def test_besta_parser_takes_the_last_eight_quarters(tmp_path):
    values = [100.0 + index for index in range(10)]
    raw = make_raw(tmp_path, {"Anzahl der offenen Stellen": besta_sheet(values),
                              "Quote der offenen Stellen": besta_sheet([1.0 + index / 10 for index in range(10)])},
                   "bfs-besta-regions", period="2026-Q2")

    out = bfs_besta.parse(raw)

    counts = [item for item in out.items if "offene_stellen_tausend" in item.metrics]
    assert len(counts) == 3 * 8  # Total, ICT, Genferseeregion (other branches ignored), last 8 quarters
    periods = sorted({item.published_at.strftime("%Y-%m") for item in counts})
    assert periods[0] == "2024-09" and periods[-1] == "2026-06"

    ict = next(item for item in counts if item.id == "2026-06:ict-offene-stellen")
    assert ict.metrics == {"offene_stellen_tausend": 119.0}
    assert ict.region is None
    assert "noga-62-63" in ict.tags and "besta" in ict.tags
    assert ict.title == "Offene Stellen: Informationstechnologische und Informationsdienstl. (2026-06)"

    quotes = [item for item in out.items if "quote_pct" in item.metrics]
    assert len(quotes) == 3 * 8
    assert next(item for item in quotes if item.id == "2026-06:total-quote").metrics["quote_pct"] == pytest.approx(1.9)
    # counts and rate are different records for the same row and quarter - they must not collide
    assert len({item.id for item in out.items}) == len(out.items)


def test_normalize_writes_items_into_the_database(client, raw, tmp_path):
    from conftest import normalize

    sheet = canton_sheet(
        ["Kanton", "Total Asylgesuche", "Primär-Gesuche", "Sekundär-Gesuche"],
        [["Total", 2210, 1881, 329], ["Zürich", 179, 116, 63]])
    path = make_raw(tmp_path, {"CH-Kt": sheet}, "sem-asylum-applications").path
    raw.add("sem-asylum-applications", path.read_bytes(), ext="xlsx", period="2026-10",
            name="SEM · Asylgesuche (Tabelle 7-21)", report_url="https://www.sem.admin.ch/de/asylstatistik-oktober-2026",
            source_url="https://www.sem.admin.ch/dam/de/sd-web/x/7-21.xlsx")

    results = normalize()
    parsed = next(result for result in results if result.source == "sem-asylum-applications")

    assert parsed.status == "parsed" and parsed.items == 2 and parsed.observations == 0

    items = client.get("/api/items?category=D").json()
    assert {item["id"] for item in items} == {"2026-10:total", "2026-10:ZH"}
    zurich = next(item for item in items if item["region"] == "ZH")
    assert zurich["metrics"]["asylgesuche"] == 179.0
    assert zurich["source_name"] == "SEM · Asylgesuche (Tabelle 7-21)"

    sources = client.get("/api/sources").json()
    assert any(source["id"] == "sem-asylum-applications" for source in sources)
