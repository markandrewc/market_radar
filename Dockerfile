# syntax=docker/dockerfile:1
#
# Market Radar – statisches Frontend (Vite + React) für Railway.
#
# Stage 1 baut die App, Stage 2 serviert das Ergebnis über nginx.
# Railway erkennt dieses Dockerfile automatisch (Dateiname "Dockerfile" im Repo-Root).

# ---------------------------------------------------------------- build stage
FROM node:24-alpine AS build
WORKDIR /app

# Abhängigkeiten zuerst kopieren -> Layer-Cache bleibt bei Code-Änderungen gültig
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Vite schreibt VITE_*-Variablen beim Build fest in das Bundle.
# Railway stellt Service-Variablen als Build-Args bereit, sofern sie per ARG deklariert sind.
ARG VITE_USE_MOCKS
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}

COPY . .
RUN npm run build

# -------------------------------------------------------------- runtime stage
FROM nginx:1.29-alpine AS runtime

# Railway routet auf den Port aus $PORT; 8080 ist der Default, falls nicht gesetzt.
ENV PORT=8080

# Das offizielle nginx-Image rendert /etc/nginx/templates/*.template beim Start
# per envsubst nach /etc/nginx/conf.d/ – so landet $PORT korrekt in der Config.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

# nginx:alpine startet über den Entrypoint von selbst (envsubst + nginx -g daemon off)
