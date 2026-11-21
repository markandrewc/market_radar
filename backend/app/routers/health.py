from fastapi import APIRouter, Depends

from ..db import Conn, get_conn

router = APIRouter()


@router.get("/health")
def health(conn: Conn = Depends(get_conn)) -> dict:
    conn.execute("SELECT 1")
    return {"status": "ok"}
