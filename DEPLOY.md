# Deployment auf Railway

Die App ist ein reines Vite/React-Frontend (SPA). Für Railway heißt das: bauen und
statisch ausliefern. Der SPA-Fallback ist zwingend nötig, weil `BrowserRouter`
direkte Aufrufe wie `/skills` sonst als 404 beim Webserver landen.

## Was im Repo dafür liegt

| Datei | Zweck |
| --- | --- |
| [`Dockerfile`](Dockerfile) | Multi-Stage-Build: `node:24-alpine` baut, `nginx:1.29-alpine` serviert |
| [`nginx/default.conf.template`](nginx/default.conf.template) | Port aus `$PORT`, SPA-Fallback, Cache-Header, `/healthz` |
| [`.dockerignore`](.dockerignore) | `node_modules`, `dist`, `.git`, `.env*` bleiben aus dem Image |
| [`.env.example`](.env.example) | Dokumentation der Variablen (`VITE_USE_MOCKS`) |

Railway erkennt ein `Dockerfile` im Repo-Root automatisch — es braucht **kein**
`railway.json` (siehe [Warum kein railway.json](#warum-kein-railwayjson)).

## Variante A — GitHub-Repo verbinden (empfohlen)

1. Railway → **New Project** → **Deploy from GitHub repo** → `markandrewc/market_radar`.
   Jeder Push auf `main` deployt automatisch.
2. Im Build-Log erscheint `Using detected Dockerfile!`; der Build dauert ca. 1–2 Minuten.
3. **Settings → Deploy → Healthcheck Path**: `/healthz` eintragen
   (Timeout 100 s reicht).
4. **Settings → Networking → Generate Domain** für eine `*.up.railway.app`-Adresse,
   oder eigene Domain über **Custom Domain** (CNAME auf das Railway-Ziel).
5. **Variables** (optional, siehe unten): `VITE_USE_MOCKS=0`, wenn das Demo-Banner weg soll.
6. **Settings → Region**: eine EU-Region wählen (z. B. `europe-west4`), damit die
   Latenz für Nutzer:innen in der Schweiz klein bleibt.

Der Port muss nichts konfiguriert werden: nginx hört auf `$PORT` (Default 8080), und
Railway setzt `PORT` selbst.

## Variante B — Railway CLI

```bash
npm i -g @railway/cli
railway login
railway link          # Projekt auswählen
railway up            # baut das Dockerfile und deployt
railway logs          # Build-/Runtime-Logs
```

## Variablen

| Variable | Wann | Wirkung |
| --- | --- | --- |
| `PORT` | von Railway gesetzt | Port, auf dem nginx lauscht (Default 8080) |
| `VITE_USE_MOCKS` | Build-Zeit | `1`/unset = Banner „Demo data“ sichtbar, `0` = aus |

**Wichtig zu `VITE_*`:** Vite ersetzt diese Variablen beim **Build** durch literale
Werte. Eine Änderung der Variable im Dashboard wirkt deshalb erst nach einem
Redeploy. Das Dockerfile deklariert `ARG VITE_USE_MOCKS`, damit Railway den Wert
als Build-Arg durchreicht.

## Lokal testen (genau derselbe Weg wie auf Railway)

```bash
docker build -t market-radar .
docker run --rm -p 8080:8080 -e PORT=8080 market-radar
# -> http://localhost:8080
curl -i http://localhost:8080/healthz        # 200 "ok"
curl -i http://localhost:8080/skills         # 200, liefert index.html (SPA-Fallback)
```

Ohne Docker, für die Entwicklung:

```bash
npm ci
npm run dev:web      # http://localhost:5173, /api/ wird nach :8787 geproxyt
npm run build        # prüft, ob der Railway-Build durchläuft
```

## Warum kein railway.json

Railway hat **Config as Code** (`railway.json` / `railway.toml`) abgekündigt
und liest bestehende Dateien nur noch bis **1. Dezember 2026**. Neue Services
können es nicht mehr aktivieren. Der Ersatz ist Infrastructure as Code über
`.railway/railway.ts` und `railway config plan/apply`.

Für dieses Projekt braucht es beides nicht: Das `Dockerfile` wird automatisch
gefunden, Healthcheck-Pfad und Region sind zwei Klicks im Dashboard. Wenn ihr
die Umgebung später als Code versionieren wollt:

```bash
railway config init     # erzeugt .railway/railway.ts
```

## Später: echtes API-Backend

Aktuell kommen die Daten aus [`src/web/api.ts`](src/web/api.ts) (Mocks). Sobald ein
zweites Railway-Service die API liefert, wird es über Railway **Private Networking**
angesprochen, z. B. `http://market-radar-api.railway.internal:8787`. Für den
gleichen Origin wie das Frontend einen Proxy-Block in
[`nginx/default.conf.template`](nginx/default.conf.template) ergänzen:

```nginx
location /api/ {
    proxy_pass http://market-radar-api.railway.internal:8787/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Troubleshooting

| Symptom | Ursache / Lösung |
| --- | --- |
| `404` beim Neuladen von `/skills` | SPA-Fallback fehlt — in diesem Setup übernimmt ihn `nginx/default.conf.template`; bei anderen Hostern `dist` als SPA konfigurieren |
| Deploy schlägt fehl mit `npm ci can only install with an existing package-lock.json` | `package-lock.json` nicht eingecheckt oder nicht synchron → lokal `npm install` und Lockfile committen |
| Build bricht mit `Rolldown failed to resolve import …` | Unvollständiges `node_modules`/kaputter npm-Cache. Lokal `rm -rf node_modules && npm ci` — im Container ist es frisch |
| Leere Seite nach Deploy, Konsole zeigt 404 auf `/assets/index-*.js` | Altes `index.html` aus dem Browser-Cache: `location = /index.html { expires -1; }` ist bereits gesetzt, einmal hart neu laden |
| Healthcheck schlägt fehl | Pfad `/healthz` eingetragen? Der Endpoint antwortet sofort mit `200 ok`, ohne Assets |
| „Demo data“-Banner verschwindet nicht | `VITE_USE_MOCKS=0` setzen **und** Redeploy auslösen (Build-Zeit-Variable) |
| Port-Fehler beim Start | `PORT` nicht überschreiben; nginx liest den Wert aus der Umgebung |
