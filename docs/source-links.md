# Vollständige Quellenliste aus den Team-Mails

Die 17 unterschiedlichen Adressen aus Teil 1 und Teil 2 sind unten im ursprünglichen Wortlaut erfasst. Beide Mails nannten den BFS-Katalog. Der Abruf am 21. November 2026 speicherte 22 erfolgreiche öffentliche Antworten auf dem Acer, darunter CSV-Dateien, JSON, Webseiten und die Adzuna-Spezifikation. Die Abfragen mit Suchparametern liefern die jeweils beschriebene Auswahl.

Die vier Fotos und die Hinweise zu den Austauschformaten stehen beim Connector-Entwurf. [Connector-Fotos](connector-notes/README.md)

## Adressen und Abruf

### BFS-PxWeb-Katalog · Teil 1 und 2

`https://www.pxweb.bfs.admin.ch/api/v1/de/`

Katalog als JSON heruntergeladen. Die konkreten BFS-Wanderungstabellen und ihre POST-Abfragen stehen in den Quellenbelegen. [BFS-Katalog als JSON](https://www.pxweb.bfs.admin.ch/api/v1/de/)

### OWID-CSV-Export · Teil 1

`https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=true`

Das Muster enthält `{slug}`. Die zwei tatsächlich veröffentlichten CSVs für Nettomigration und Internetnutzung wurden vollständig abgerufen. [CSV Nettomigration](https://ourworldindata.org/grapher/net-migration-metrics.csv?v=1&csvType=full&useColumnShortNames=false&metric=net_migration) · [CSV Internetnutzung](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet.csv?v=1&csvType=full&useColumnShortNames=false)

### OWID-Metadaten · Teil 1

`https://ourworldindata.org/grapher/{slug}.metadata.json`

Das Muster enthält `{slug}`. Beide Original-Metadatendateien wurden als JSON abgerufen. [JSON Nettomigration](https://ourworldindata.org/grapher/net-migration-metrics.metadata.json?v=1&csvType=full&useColumnShortNames=false&metric=net_migration) · [JSON Internetnutzung](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet.metadata.json)

### OWID-Website · Teil 1

`http://ourworldindata.org`

Die HTTPS-Startseite wurde abgerufen. [OWID-Startseite](https://ourworldindata.org/)

### OWID-Datenseiten · Teil 1

`https://ourworldindata.org/grapher/{slug}`

Die konkreten Seiten für beide ausgewählten Datenreihen wurden abgerufen. [Nettomigration](https://ourworldindata.org/grapher/net-migration-metrics?metric=net_migration) · [Internetnutzung](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet)

### Adzuna-Stellensuche · Teil 2

`https://api.adzuna.com/v1/api/jobs/ch/search/{page}`

Die offizielle Spezifikation bestätigt den Schweizer Endpunkt. Datenabfragen verwenden `ADZUNA_APP_ID` und `ADZUNA_APP_KEY`. Im Test stand kein Schlüssel zur Verfügung.

### Adzuna-Histogramm · Teil 2

`https://api.adzuna.com/v1/api/jobs/ch/histogram`

Die offizielle Spezifikation bestätigt den Schweizer Endpunkt. Datenabfragen verwenden `ADZUNA_APP_ID` und `ADZUNA_APP_KEY`. Im Test stand kein Schlüssel zur Verfügung.

### Adzuna-Arbeitgeber · Teil 2

`https://api.adzuna.com/v1/api/jobs/ch/top_companies`

Die offizielle Spezifikation bestätigt den Schweizer Endpunkt. Datenabfragen verwenden `ADZUNA_APP_ID` und `ADZUNA_APP_KEY`. Im Test stand kein Schlüssel zur Verfügung.

### Adzuna-Berufskategorien · Teil 2

`https://api.adzuna.com/v1/api/jobs/ch/categories`

Die offizielle Spezifikation bestätigt den Schweizer Endpunkt. Datenabfragen verwenden `ADZUNA_APP_ID` und `ADZUNA_APP_KEY`. Im Test stand kein Schlüssel zur Verfügung.

### ESCO-Suche nach Kenntnissen · Teil 2

`https://ec.europa.eu/esco/api/search?language=de&type=skill&text={query}`

Geprüfte deutsche Suche mit dem Begriff «Softwareentwicklung», begrenzt auf ein Resultat. [Geprüfte ESCO-Abfrage](https://ec.europa.eu/esco/api/search?language=de&type=skill&text=Softwareentwicklung&limit=1)

### ESCO-Website · Teil 2

`http://esco.ec.europa.eu`

Die HTTPS-Startseite und die offizielle Download-Übersicht wurden abgerufen. [ESCO-Startseite](https://esco.ec.europa.eu/select-language?destination=/node/1) · [ESCO-Downloads](https://esco.ec.europa.eu/en/use-esco/download)

### BFS-Website · Teil 2

`http://bfs.admin.ch`

Die HTTPS-Adresse leitet zur aktuellen BFS-Startseite weiter. Diese wurde abgerufen. [BFS-Startseite](https://www.bfs.admin.ch/de)

### SEM-Statistikübersicht · Teil 2

`https://www.sem.admin.ch/sem/de/home/publiservice/statistik.html`

Die alte Mail-Adresse ergab HTTP 404. Die heutige Statistikübersicht sowie die beiden offiziellen Monatsübersichten wurden abgerufen. [SEM-Statistik](https://www.sem.admin.ch/de/statistiken) · [Ausländerstatistik](https://www.sem.admin.ch/de/auslaenderstatistik) · [Asylstatistik](https://www.sem.admin.ch/de/asylstatistik)

### opendata.swiss-Katalogsuche · Teil 2

`https://ckan.opendata.swiss/api/3/action/package_search?q={query}`

Geprüfte CKAN-Suche mit einem STATPOP-Katalogresultat. [STATPOP-Katalogtest](https://ckan.opendata.swiss/api/3/action/package_search?q=STATPOP&rows=1)

### Parlamentsgeschäfte auf Deutsch · Teil 2

`https://ws.parlament.ch/odata.svc/Business?$format=json&$filter=Language eq 'DE'`

Der wiederhergestellte Filter aus dem Mailtext wurde live mit einem deutschsprachigen Geschäft geprüft. Der aktuelle neue Parlamentsdienst hat eine eigene Schlüsselanmeldung. [Geprüfte OData-Abfrage](https://ws.parlament.ch/odata.svc/Business?%24filter=Language+eq+%27DE%27&%24top=1&%24select=ID%2CLanguage%2CTitle&%24format=json)

### Fedlex SPARQL · Teil 2

`https://fedlex.data.admin.ch/sparqlendpoint`

Die Endpunktseite und eine begrenzte Metadatenabfrage zu AIG, VZAE und AsylG wurden abgerufen. [Fedlex-SPARQL](https://fedlex.data.admin.ch/sparqlendpoint) · [Geprüfte SPARQL-Abfrage](https://fedlex.data.admin.ch/sparqlendpoint?query=SELECT%20DISTINCT%20%3Fact%20WHERE%20%7B%20VALUES%20%3Fact%20%7B%20%3Chttps%3A%2F%2Ffedlex.data.admin.ch%2Feli%2Fcc%2F2007%2F758%3E%20%3Chttps%3A%2F%2Ffedlex.data.admin.ch%2Feli%2Fcc%2F2007%2F759%3E%20%3Chttps%3A%2F%2Ffedlex.data.admin.ch%2Feli%2Fcc%2F1999%2F358%3E%20%7D%20%3Fact%20a%20%3Ftype%20.%20%7D%20LIMIT%203&format=application%2Fsparql-results%2Bjson)

### Nachrichten der Bundesverwaltung · Teil 2

`https://www.news.admin.ch/`

Die alte Adresse leitet zur heutigen Bundes-Newsseite weiter. Diese und die SEM-Nachrichtenübersicht wurden abgerufen. [Bundes-News](https://www.admin.ch/de/newnsb) · [SEM-News](https://www.sem.admin.ch/de/news-und-social-media)

Adzunas vier Adressen sind in der abgerufenen OpenAPI-Spezifikation beschrieben. Im Suchpfad wird `{page}` durch die Seitennummer ersetzt. [Adzuna-Dokumentation](https://developer.adzuna.com/activedocs) · [OpenAPI-JSON](https://developer.adzuna.com/swagger/spec/test2.json)

Der Mailtext nennt den Parlamentsfilter `Language eq 'DE'`. Der automatisch erzeugte Link endete bei `Language`. Die geprüfte Abfrage verwendet den vollständigen Filter und ein Ergebnis. [Aktuelle Parlaments-Webdienste](https://www.parlament.ch/de/%C3%BCber-das-parlament/fakten-und-zahlen/open-data-web-services)

## Formate und Beispieldaten

- Die BFS-Wanderungsabfragen liefern JSON-stat2. Die Beispieldatei im Branch enthält 160 ausgewählte Originalwerte als CSV. Die JSON-Begleitdatei enthält die drei genauen POST-Abfragen, Quellen und Prüfsummen. [BFS-Beispieldaten](../data/samples/bfs-migration.csv) · [Abfragen und Quellenbelege](../data/samples/bfs-migration-provenance.json)
- ITBoard veröffentlicht die Monatszahlen als CSV. Der Import verwendet ausgewählte Rollenwerte aus der CSV sowie Kenntniswerte aus öffentlich datierten Berufsprofilen als JSON für FastAPI. [ITBoard-Original-CSV](https://www.itboard.ch/arbeitsmarkt/daten.csv) · [Importanleitung](data-handoff.md)
- Das SEM veröffentlicht Monatsdateien als XLSX. Der Abrufcode findet und speichert die aktuellen Originale anhand der offiziellen Übersichten. [SEM-Asylstatistik](https://www.sem.admin.ch/de/asylstatistik) · [SEM-Ausländerstatistik](https://www.sem.admin.ch/de/auslaenderstatistik)
- Die Fedlex-Metadatenabfrage bestätigt die drei Rechtsakte. Die veröffentlichten Fassungen stehen direkt auf Fedlex. [AIG · SR 142.20](https://www.fedlex.admin.ch/eli/cc/2007/758/de) · [VZAE · SR 142.201](https://www.fedlex.admin.ch/eli/cc/2007/759/de) · [AsylG · SR 142.31](https://www.fedlex.admin.ch/eli/cc/1999/358/de)
