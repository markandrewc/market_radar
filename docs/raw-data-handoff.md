# Rohdatenübergabe an das BI-Team

Der Sammellauf archiviert veröffentlichte Originaldateien bytegenau und protokolliert ihre Herkunft. Das BI-Team liest die Dateien, ordnet Felder und Einheiten zu und übernimmt Datenbank und FastAPI. Das [Quellenregister](../src/web/data/source-register.json) beschreibt die Quellen und ihre Aussagegrenzen.

## Sammeln und aktuelle Version lesen

Im Projektordner `node scripts/stage-raw-sources.mjs` starten. Der Standardordner ist `.market-radar/raw`. Für einen anderen Speicherort dient `MARKET_RADAR_RAW_DIR`. Ein relativer Wert bezieht sich auf den Arbeitsordner.

- `latest.json` enthält `schema_version` (derzeit 1), `updated_at` und das Array `sources`. Der Sammler legt die Dateien zuerst ab und ersetzt das Manifest anschliessend atomar. Über `id` den Eintrag auswählen. Die Originaldatei liegt relativ zum Rohdatenordner unter `relative_path` und trägt die SHA-256-Prüfsumme im Namen. `sha256` und `bytes` erlauben die Prüfung vor dem Import.
- `source_url` belegt den Originaldownload. `discovery_url` und `report_url` verweisen auf die Quelle der Ermittlung und den Bericht. `period` oder `period_end`, `report_date` und `report_date_basis` erläutern den fachlichen Zeitbezug. `fetched_at` beschreibt den Abruf, `first_staged_at` die erste Ablage und `last_attempt_at` die letzte Prüfung.
- `downloaded` und `unchanged` kennzeichnen einen erfolgreichen Abruf. Bei `retained` bleibt die letzte erfolgreich abgelegte und erneut geprüfte Datei verfügbar. `last_attempt_at` und `error` beschreiben dann den fehlgeschlagenen Versuch. `unavailable` heisst, dass kein verwendbarer Dateistand vorliegt. Schlägt ein Abruf fehl, meldet der Sammler dies auch über Exitcode 1.
- Für den BI-Import einen Eintrag einmal lesen und die angegebene Dateiversion verwenden. Bereits importierte Paare aus `id` und `sha256` überspringen. Bei `retained` den bisherigen Datenstand weiterführen und den Abruffehler anzeigen. Bei `unavailable` oder einer abweichenden Prüfsumme den Import der betroffenen Quelle aussetzen.

Der Sammler umfasst sechs Dateiarten.

| Quellen-ID | Original |
| --- | --- |
| `itboard-monthly` | Fortlaufende Monats-CSV. [ITBoard](https://www.itboard.ch/arbeitsmarkt/daten.csv) |
| `bfs-besta-regions` | BESTA-Excel-Arbeitsmappe mit Quartalsindikatoren nach Wirtschaftsabteilung und Grossregion. [Fortlaufende BFS-Tabellennummer](https://www.bfs.admin.ch/asset/de/je-d-06.02.00.02.01) · [Geprüfte Ausgabe bis Juni 2026](https://statistik.admin.ch/de/asset/36829793) |
| `sem-asylum-applications` | Primär- und Sekundärgesuche im Asylbereich, Tabelle 7-21. [SEM](https://www.sem.admin.ch/de/asylstatistik) |
| `sem-provisional-employment` | Erwerbstätigkeit vorläufig aufgenommener Personen, Tabelle 6-22. [SEM](https://www.sem.admin.ch/de/asylstatistik) |
| `sem-status-s-monthly` | Gesuche, Erledigungen und Beendigungen zum Schutzstatus S, Tabelle 7-70. [SEM](https://www.sem.admin.ch/de/asylstatistik) |
| `sem-immigration-canton-nationality` | Einwanderung der ausländischen Wohnbevölkerung nach Kanton und Staatsangehörigkeit, Tabelle 3-25. [SEM](https://www.sem.admin.ch/de/auslaenderstatistik) |

## Datenumfang und Quellenangabe

| Quelle | Beim Auswerten und Weitergeben beachten |
| --- | --- |
| ITBoard | Die veröffentlichte Monats-CSV zählt Inserate in der ITBoard-Portalstichprobe. Die Prozentwerte brauchen die jeweils passende Bezugsgrösse. Für die CSV gilt CC BY 4.0. Bei Weitergabe ITBoard und die Quelle nennen, die Lizenz verlinken und Bearbeitungen kennzeichnen. [ITBoard-Arbeitsmarktmonitor](https://www.itboard.ch/arbeitsmarkt) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| BFS | BESTA veröffentlicht Quartalsdaten zu offenen Stellen nach Grossregion oder Wirtschaftsabteilung. Die Branche bezeichnet den Betrieb. Die Daten sind unter OPEN BY nutzbar. Als Quelle das BFS, den Tabellentitel und den jeweiligen Link angeben. [Grossregionen](https://www.bfs.admin.ch/asset/de/px-x-0602000000_104) · [Wirtschaftsabteilungen](https://www.bfs.admin.ch/asset/de/px-x-0602000000_103) · [BFS-Nutzungsbedingungen](https://www.bfs.admin.ch/de/nutzungsbedingungen) |
| SEM | Gesuche, Erledigungen und Personenbestände haben unterschiedliche Bezugsgrössen. Die Ausländerstatistik und die Asylstatistik erfassen verschiedene Bevölkerungsgruppen. Für eine öffentliche Weiterverbreitung der Originaldateien die jeweilige Freigabe prüfen. Die amtlichen Downloadseiten können direkt verlinkt werden. [SEM-Asylstatistik](https://www.sem.admin.ch/de/asylstatistik) · [SEM-Ausländerstatistik](https://www.sem.admin.ch/de/auslaenderstatistik) |

Der Bestand umfasst aggregierte Veröffentlichungen. Individuelle Bewerbungen, Kontaktdaten, Aufenthaltsdossiers und private Inseratstexte liegen ausserhalb der Datensammlung. Fehlende, gesperrte oder unterdrückte Tabellenwerte bleiben im BI-Import als solche erkennbar. Berichtsperiode, Abrufzeit und amtliches Veröffentlichungsdatum sind getrennte Angaben.

## Zugriff aus FastAPI

Lokal lesen Sammler und BI-Import aus dem gleichen eingerichteten Ordner. Für Railway kann der FastAPI-Dienst ein persistentes Volume zur Laufzeit einbinden. Ein Railway-Volume gehört zu einem Dienst. Falls Acer weiterhin sammelt, ist eine separate autorisierte Dateiübertragung zum FastAPI-Dienst erforderlich. Dasselbe gilt bei einem separaten Sammlerdienst. Die Übergabe nutzt dann zuerst die Dateien des Laufs und veröffentlicht den Zeiger auf den aktuellen Stand zuletzt. [Railway-Volumes](https://docs.railway.com/volumes) · [Railway-Infrastrukturreferenz](https://docs.railway.com/infrastructure-as-code/reference)

Wenn der FastAPI-Dienst zur Laufzeit ein Volume unter `/data` einbindet, dort `MARKET_RADAR_RAW_DIR=/data/market-radar/raw` setzen. Das folgende Python-Beispiel lässt sich auch lokal aus dem Projektordner ausführen. Es prüft die ITBoard-Datei und zeigt Dateiname, Status und Original-URL.

```python
import hashlib
import json
import os
from pathlib import Path

root = Path(os.environ.get("MARKET_RADAR_RAW_DIR", ".market-radar/raw")).resolve()
manifest = json.loads((root / "latest.json").read_text(encoding="utf-8"))
if manifest["schema_version"] != 1:
    raise ValueError("Unbekannte Manifestversion")

entry = next(item for item in manifest["sources"] if item["id"] == "itboard-monthly")
if entry["status"] not in {"downloaded", "unchanged", "retained"}:
    raise RuntimeError(f"Kein verwendbarer Dateistand: {entry.get('error')}")

raw_file = (root / entry["relative_path"]).resolve()
if raw_file.parent != root or raw_file.stat().st_size != entry["bytes"]:
    raise ValueError("Unerwarteter Dateipfad oder Dateigrösse")

digest = hashlib.sha256()
with raw_file.open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
if digest.hexdigest() != entry["sha256"]:
    raise ValueError("SHA-256 stimmt nicht mit dem Manifest überein")

print(f"{entry['status']} {raw_file.name} {entry['source_url']}")
```
