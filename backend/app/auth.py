import secrets

from fastapi import Header, HTTPException

from . import config


def require_token(authorization: str | None = Header(default=None)) -> None:
    """Write endpoints: `Authorization: Bearer <INGEST_TOKEN>`."""
    if not config.INGEST_TOKEN:
        raise HTTPException(503, "Writing is disabled: set INGEST_TOKEN on the server.")
    if not authorization or not secrets.compare_digest(authorization, f"Bearer {config.INGEST_TOKEN}"):
        raise HTTPException(401, "Missing or wrong token.")
