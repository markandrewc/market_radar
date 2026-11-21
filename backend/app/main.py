"""FastAPI entry point. Dev: `uv run uvicorn app.main:app --reload --port 8787` (Vite proxies /api/ there)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, db
from .connectors import config as sources_config
from .routers import connectors as connectors_api
from .routers import employers, health, market, reports, sources
from .services import connectors as connectors_store

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
    with db.connect() as conn:
        db.init(conn)
        # sources.yaml -> connector_sources. Errors are logged, never fatal: the file
        # may live on a volume and a typo must not take the service down.
        loaded = sources_config.load(sources_config.ensure_file())
        applied = connectors_store.apply_config(conn, loaded)
        log.info("sources.yaml: %s source(s), %s added, %s updated, %s disabled",
                 applied.source_count, applied.added, applied.updated, applied.disabled)
        for problem in loaded.errors:
            log.warning("sources.yaml: %s", problem)
    yield


app = FastAPI(title="Market Radar API", lifespan=lifespan)
app.include_router(health.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(connectors_api.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(employers.router, prefix="/api")

# Production: serve the built React app (npm run build -> dist/). In dev, Vite serves the frontend.
if config.STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets", check_dir=False), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        root = config.STATIC_DIR.resolve()
        file = (root / path).resolve()
        if path and file.is_relative_to(root) and file.is_file():
            return FileResponse(file)
        return FileResponse(root / "index.html")
