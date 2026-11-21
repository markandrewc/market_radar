# syntax=docker/dockerfile:1
#
# Market Radar – ein Railway-Service: FastAPI liefert die API und das gebaute
# React-Bundle aus, die Daten kommen aus PostgreSQL (DATABASE_URL).
# Railway erkennt ein Dockerfile im Repo-Root automatisch.

# ------------------------------------------------------------------ web build
FROM node:24-alpine AS web
WORKDIR /app

# Abhängigkeiten zuerst -> Layer-Cache bleibt bei Code-Änderungen gültig
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Vite backt VITE_*-Variablen beim Build fest ins Bundle. Railway reicht
# Service-Variablen als Build-Args durch, sofern sie per ARG deklariert sind.
ARG VITE_USE_MOCKS=1
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}

COPY . .
RUN npm run build

# -------------------------------------------------------------------- runtime
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PORT=8080
WORKDIR /app/backend

RUN pip install --no-cache-dir uv

# Abhängigkeiten zuerst; --no-dev lässt pytest/pgserver draußen.
# --no-install-project, weil das Backend kein Build-Backend hat.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
# Declarative sources. Keep the baked copy: it seeds a fresh volume (SOURCES_FILE).
COPY sources.yaml /app/sources.yaml
COPY --from=web /app/dist /app/dist

RUN useradd --create-home --uid 10001 app && chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8080') + '/api/health').read()"

# --forwarded-allow-ips=* : Railway terminiert TLS vor dem Container.
# Ohne DATABASE_URL bricht der Start bewusst mit einer klaren Meldung ab.
CMD ["sh", "-c", "exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips=*"]
