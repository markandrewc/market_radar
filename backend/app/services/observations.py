"""Writing clean numbers into the database (used by step 2)."""
from datetime import date, datetime

from ..db import Conn
from ..schemas import NormalizedObservation, Role


class InvalidObservations(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors[:5]) + (f" (+{len(errors) - 5} more)" if len(errors) > 5 else ""))
        self.errors = errors


def check(conn: Conn, roles: list[Role], observations: list[NormalizedObservation]) -> None:
    known = {r["id"] for r in conn.execute("SELECT id FROM roles")} | {r.id for r in roles}
    errors = []
    seen = set()
    for i, o in enumerate(observations):
        if o.roleId and o.roleId not in known:
            errors.append(f"observations[{i}]: unknown roleId '{o.roleId}' (add it to 'roles')")
        if o.metric == "skill" and (not o.skill or o.base is None):
            errors.append(f"observations[{i}]: metric 'skill' needs 'skill' and 'base'")
        if o.metric == "demand" and (o.skill or not o.roleId):
            errors.append(f"observations[{i}]: metric 'demand' needs a roleId and no 'skill'")
        key = (o.metric, o.roleId, o.skill, o.period)
        if key in seen:
            errors.append(f"observations[{i}]: duplicate {key}")
        seen.add(key)
    if errors:
        raise InvalidObservations(errors)


def upsert_source(conn: Conn, source_id: str, name: str, url: str, fetched_at: datetime,
                  data_as_of: date | None = None, licence: str | None = None, licence_url: str | None = None,
                  dataset_url: str | None = None, dataset_modified: date | None = None) -> None:
    """Creates or updates a source. fetched_at, data_as_of and dataset_modified only move forward."""
    conn.execute(
        """INSERT INTO sources (id, name, url, fetched_at, data_as_of, licence, licence_url,
                                dataset_url, dataset_modified)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url,
               fetched_at = GREATEST(sources.fetched_at, EXCLUDED.fetched_at),
               data_as_of = GREATEST(sources.data_as_of, EXCLUDED.data_as_of),
               licence = EXCLUDED.licence, licence_url = EXCLUDED.licence_url,
               dataset_url = COALESCE(EXCLUDED.dataset_url, sources.dataset_url),
               dataset_modified = GREATEST(sources.dataset_modified, EXCLUDED.dataset_modified)""",
        (source_id, name, url, fetched_at, data_as_of, licence, licence_url, dataset_url, dataset_modified))


def merge(conn: Conn, source_id: str, roles: list[Role], observations: list[NormalizedObservation]) -> None:
    """Writes one source's numbers and keeps its history: months contained in the new file are replaced (so the
    publisher's corrections win), all other months stay. Call inside a transaction, after check()."""
    periods = sorted({o.period for o in observations})
    with conn.cursor() as cur:
        cur.executemany("INSERT INTO roles (id, name) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
                        [(r.id, r.name) for r in roles])
        cur.execute("DELETE FROM observations WHERE source_id = %s AND period = ANY(%s)", (source_id, periods))
        cur.executemany(
            """INSERT INTO observations (source_id, metric, role_id, skill, period, value, base)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            [(source_id, o.metric, o.roleId, o.skill, o.period, o.value, o.base) for o in observations])
