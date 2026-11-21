# Market Radar – Datenübergabe

Der Branch verbindet die veröffentlichte ITBoard-Stichprobe mit dem FastAPI-Backend des Teams. Er enthält zusätzlich den geprüften Quellenkatalog und einen Wochenexport mit Originalnachweisen für die fünf Kantone Zürich, Bern, Luzern, Zug und Genf.

## Ersten Import vorführen

1. Wie im Backend-README beschrieben, FastAPI mit einer lokalen PostgreSQL-Datenbank starten. `DATABASE_URL` und einen eigenen `INGEST_TOKEN` in der Umgebung des Backend-Prozesses setzen. Vite kann die vorhandene Teamoberfläche mit `VITE_USE_MOCKS=0` gegen diese API starten. [Backend-README](../backend/README.md)
2. Im Projektordner den Import zuerst als Trockenlauf ausführen.

   ```sh
   node scripts/load-itboard-api.mjs
   ```

3. Beim Import dieselbe lokale URL und denselben geheimen Schlüssel in die Umgebung des Terminalprozesses setzen. Ohne `MARKET_RADAR_API_URL` verwendet das Skript `http://127.0.0.1:8787`. Der Adapter ruft `/api/ingest` mit bereits aggregierten Werten auf. Im API-Vertrag ist `/api/raw` für Text- und JSON-Originale mit anschliessender Verarbeitung vorgesehen. [API-Vertrag](api.md)

   ```sh
   node scripts/load-itboard-api.mjs --apply
   ```

4. Über `/api/demand` und `/api/skills?role=it-support` prüfen. Der Novemberstand enthält 34 Inserate für IT-Support und 184 für Softwareentwicklung. Das IT-Support-Profil führt ICT in 13 von 16 Inseraten. Ein zweiter Import hält die Zahl der Einträge bei 48 Rollenwerten und 22 Kenntniswerten.

Die veröffentlichte [ITBoard-Stichprobe](https://www.itboard.ch/arbeitsmarkt/november-2026) umfasst gezählte Inserate auf dem Portal. Der [Monatsdatensatz](https://www.itboard.ch/arbeitsmarkt/daten.csv) ist CC BY 4.0 mit Quellenangabe. Der Import verwendet ein rollenbezogenes Kenntnisprofil pro Quelle. Die Dateien im Branch enthalten die tatsächlich verwendeten [Monatszahlen](../src/web/data/itboard.json) und [Kenntnisprofile](../src/web/data/role-skills.json).

## Wochenstand erzeugen

Mit Node.js 24 oder neuer aus dem Projektordner starten.

```sh
node scripts/weekly-snapshot.mjs
```

Der Wochenlauf erzeugt `.market-radar/snapshots/JJJJ-Www/` mit `stats.csv`, Quellenstatus, Prüfsummen und einem Manifest. Die Kalenderwoche folgt der Zeitzone Europe/Zurich. Die BFS- und OWID-Beobachtungen bleiben Jahreswerte. Ihre Jahreszeilen enthalten deshalb keine Wochenkennzahl. Die jüngste erfolgreich abgelegte Originaldatei bleibt bei einem Quellenfehler erhalten. `MARKET_RADAR_RAW_DIR` kann auf ein beschreibbares Verzeichnis im Backend-Dienst zeigen.

- Die [BFS-Beispieldatei](../data/samples/bfs-migration.csv) enthält 160 Werte für 2025. Sie deckt für die fünf Kantone internationale und interkantonale Zu- und Wegzüge ab. Die [BFS-Quellenbelege](../data/samples/bfs-migration-provenance.json) dokumentieren Tabellen, Differenzierung und Prüfsumme. [BFS-Nutzungsbedingungen](https://www.bfs.admin.ch/de/nutzungsbedingungen)
- Der OWID-Abruf erfasst Länderwerte zur Internetnutzung und Nettomigration. Der ISO3-Code bezeichnet das Land der Beobachtung. Je nach Land und Thema unterscheidet sich das jüngste veröffentlichte Jahr. Originalanbieter und Datenhinweise stehen im lokalen Begleitbericht. [Nettomigration – UN World Population Prospects via OWID](https://ourworldindata.org/grapher/net-migration-metrics?metric=net_migration) · [Internetnutzung – ITU und Weltbank via OWID](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet)
- Die [SEM-Statistiken](https://www.sem.admin.ch/de/asylstatistik) und die [Ausländerstatistik](https://www.sem.admin.ch/de/auslaenderstatistik) liefern verlinkte Monatsdateien. Die Originale werden direkt beim Anbieter abgerufen und lokal abgelegt.
- Der Quellenkatalog enthält die geprüften Zugänge für ESCO, BFS, SEM, opendata.swiss, Parlament und Fedlex. Adzuna und der neue Webdienst des Parlaments benötigen eigene Schlüssel. Der Wochenlauf vermerkt ihren Zugriff als offen. [Quellenkatalog](../data/source-catalog.json) · [Adzuna-API-Dokumentation](https://developer.adzuna.com/activedocs) · [Parlaments-Webdienste](https://www.parlament.ch/de/%C3%BCber-das-parlament/fakten-und-zahlen/open-data-web-services)
- Für die Auswertung nach Kanton, Bewilligung, Altersklasse und Staatsangehörigkeit führt das BFS einen separaten Bestandsdatenwürfel. Die Beispieldatei erfasst Wanderungen. [BFS-Wohnbevölkerung nach Kanton, Bewilligung, Alter und Staatsangehörigkeit](https://statistik.admin.ch/de/asset/36734017) · [PxWeb-Metadaten](https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-0103010000_101/px-x-0103010000_101.px)

Die FastAPI des Teams übernimmt mit diesem Branch Stellen- und Kenntniswerte. Für BFS und OWID steht die CSV zur weiteren Verarbeitung bereit. Andere Ansichten des vorhandenen Team-Frontends, etwa Arbeitgeber und Befragungen, enthalten weiterhin Demodaten. Die Übernahme in das gemeinsame Hosting ist ein eigener Team-Schritt.
