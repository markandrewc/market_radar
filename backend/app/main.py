"""FastAPI entry point. Dev: `uv run uvicorn app.main:app --reload --port 8787` (Vite proxies /api/ there)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, db
from .routers import health, ingest, market


@asynccontextmanager
async def lifespan(_: FastAPI):
    conn = db.connect()
    db.init(conn)
    conn.close()
    yield


app = FastAPI(title="Market Radar API", lifespan=lifespan)
app.include_router(health.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")

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
