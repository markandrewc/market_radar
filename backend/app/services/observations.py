"""Writing clean numbers. Shared by POST /api/ingest and the parsers, so both follow the same rules."""
from datetime import datetime

from ..db import Conn
from ..schemas import IngestObservation, Role


class InvalidObservations(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors[:5]))
        self.errors = errors


def check(conn: Conn, roles: list[Role], observations: list[IngestObservation]) -> None:
    known = {r["id"] for r in conn.execute("SELECT id FROM roles")} | {r.id for r in roles}
    errors = []
    for i, o in enumerate(observations):
        if o.roleId not in known:
            errors.append(f"observations[{i}]: unknown roleId '{o.roleId}' (add it to 'roles')")
        if o.metric == "skill" and (not o.skill or o.base is None):
            errors.append(f"observations[{i}]: metric 'skill' needs 'skill' and 'base'")
        if o.metric == "demand" and o.skill:
            errors.append(f"observations[{i}]: metric 'demand' must not have 'skill'")
    if errors:
        raise InvalidObservations(errors)


def upsert_source(conn: Conn, source_id: str, name: str, url: str, fetched_at: datetime | str) -> None:
    """Creates or updates a source. fetched_at only moves forward."""
    conn.execute(
        """INSERT INTO sources (id, name, url, fetched_at) VALUES (%s, %s, %s, %s)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url,
               fetched_at = GREATEST(sources.fetched_at, EXCLUDED.fetched_at)""",
        (source_id, name, url, fetched_at))


def write(conn: Conn, source_id: str, roles: list[Role], observations: list[IngestObservation],
          replace: bool) -> None:
    """Call inside a transaction, after check()."""
    with conn.cursor() as cur:
        cur.executemany("INSERT INTO roles (id, name) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
                        [(r.id, r.name) for r in roles])
        if replace:
            cur.execute("DELETE FROM observations WHERE source_id = %s", (source_id,))
        cur.executemany(
            """INSERT INTO observations (source_id, metric, role_id, skill, period, value, base)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (source_id, metric, role_id, skill, period)
               DO UPDATE SET value = EXCLUDED.value, base = EXCLUDED.base""",
            [(source_id, o.metric, o.roleId, o.skill, o.period, o.value, o.base) for o in observations])
