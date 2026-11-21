-- Every value belongs to a source, so the API can always show name, link and as-of date.
CREATE TABLE IF NOT EXISTS sources (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    fetched_at  TEXT NOT NULL            -- ISO 8601, when we retrieved the data
);

-- Roles come from the data sources, not from code.
CREATE TABLE IF NOT EXISTS roles (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL
);

-- metric = 'demand': value = number of postings for role_id in period (skill = '')
-- metric = 'skill':  value = postings mentioning skill, base = postings in the sample
CREATE TABLE IF NOT EXISTS observations (
    source_id  TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    metric     TEXT NOT NULL CHECK (metric IN ('demand', 'skill')),
    role_id    TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    skill      TEXT NOT NULL DEFAULT '',
    period     TEXT NOT NULL,            -- YYYY-MM
    value      REAL NOT NULL,
    base       REAL,
    PRIMARY KEY (source_id, metric, role_id, skill, period)
);
