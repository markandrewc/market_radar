# Market Radar für Powercoders

Das Dashboard zeigt Schweizer IT-Stellen, gefragte Kenntnisse und amtliche Hinweise für die Ausbildungs- und Praktikumsplanung. Der Rundgang erklärt Bezugsgrössen, Berufsprofile und mögliche nächste Schritte. Die Oberfläche bietet Deutsch, Englisch, Französisch, Italienisch, Ukrainisch und Arabisch.

## Lokal starten

```sh
npm ci
npm run dev:web
```

Mit `npm run typecheck` prüfst du die Typen. `npm run build` erstellt den Produktionsbuild und `npm run preview` öffnet die lokale Vorschau. Die Vorschau enthält einen verifizierten Datenstand.

## Quellen an das BI-Team übergeben

Das [Quellenregister](src/web/data/source-register.json) enthält die fortlaufenden Einstiege, Formate, Veröffentlichungsrhythmen und Wege zur neuesten Ausgabe. Auf der Startseite ist es unter **Datenquellen** zu finden.

1. **Nachfrage und Kenntnisse zuerst.** Die [ITBoard-Monats-CSV](https://www.itboard.ch/arbeitsmarkt/daten.csv) führt die Rollen, die gesamtschweizerische Portalstichprobe, Juniorzahlen und Technologie-Nennungen. Der [Arbeitsmarktmonitor](https://www.itboard.ch/arbeitsmarkt) belegt den Erhebungsstichtag pro Ausgabe. Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
2. **Kontext ergänzen.** Das BFS liefert [Quartalszahlen pro Grossregion](https://www.bfs.admin.ch/asset/de/px-x-0602000000_104) und [nach Wirtschaftsabteilung](https://www.bfs.admin.ch/asset/de/px-x-0602000000_103). Die API-Metadaten liefern das neueste verfügbare Quartal. Das SEM verlinkt unter [Asylstatistik](https://www.sem.admin.ch/de/asylstatistik) und [Ausländerstatistik](https://www.sem.admin.ch/de/auslaenderstatistik) jeweils die neuesten Monatsdateien.
3. **Regeländerungen einordnen.** [SEM zum Arbeitszugang](https://www.sem.admin.ch/de/arbeit-asylbereich) und das [SECO zur Stellenmeldepflicht](https://www.arbeit.swiss/de/arbeitgebende/stellenmeldepflichten) geben den praktischen Einstieg. [Fedlex](https://fedlex.data.admin.ch/de-CH/home) und [Curia Vista](https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista) belegen Rechtsstatus und Verfahrensstand.

Das Datenteam pflegt die Quellenlinks. Das BI-Team baut den Import in seine Datenbank und stellt normalisierte, aggregierte Beobachtungen per REST bereit. Ein Beobachtungssatz braucht Kennzahl, Gruppe, Periode, Wert, Einheit, gegebenenfalls Bezugsgrösse, Original-URL und Erhebungsstichtag. Abrufdatum und Veröffentlichungsdatum werden separat geführt. Für eine Auswertung von Inseratstexten mit KI muss die Quelle den Zugriff erlauben. Jede extrahierte Kenntnis braucht einen Beleg im Text.

### Vorhandene Checks auf dem Acer

`node scripts/import-itboard.mjs` aktualisiert die ITBoard-Auszüge für den Build. `node scripts/check-official-sources.mjs` prüft die Erreichbarkeit amtlicher Links und erkennt das zuletzt verlinkte Monatsheft für Asyl und Ausländerstatistik sowie das jüngste BFS-Quartal. Neue amtliche Werte werden nach Prüfung der Quelle und Bezugsgrösse übernommen. Die Tagesprüfung und der Veröffentlichungstakt der Quelle sind getrennt.
