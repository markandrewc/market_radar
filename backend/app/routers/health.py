import sqlite3

from fastapi import APIRouter, Depends

from ..db import get_conn

router = APIRouter()


@router.get("/health")
def health(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    conn.execute("SELECT 1")
    return {"status": "ok"}
