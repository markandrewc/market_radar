-- Postgres. Applied on every start; all statements are idempotent.

-- Every value belongs to a source, so the API can always show name, link and as-of date.
CREATE TABLE IF NOT EXISTS sources (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL      -- latest retrieval of this source's data
);

-- Raw store: documents exactly as the ingestion team delivered them.
-- JSON is stored as-is; text formats (CSV, HTML, ...) are stored as a JSON string.
CREATE TABLE IF NOT EXISTS raw_documents (
    id            BIGSERIAL PRIMARY KEY,
    source_id     TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    url           TEXT,                   -- where this document came from, if known
    fetched_at    TIMESTAMPTZ NOT NULL,   -- when the ingestion team retrieved it
    content_type  TEXT NOT NULL,
    content       JSONB NOT NULL,
    sha256        TEXT NOT NULL,          -- of the content; the same document is stored only once
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'error')),
    error         TEXT,
    parsed_at     TIMESTAMPTZ,
    UNIQUE (source_id, sha256)
);
CREATE INDEX IF NOT EXISTS raw_documents_source_status ON raw_documents (source_id, status);

-- Roles come from the data, not from code.
CREATE TABLE IF NOT EXISTS roles (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL
);

-- Clean numbers for the dashboard (written by the parsers or POST /api/ingest).
-- metric = 'demand': value = number of postings for role_id in period (skill = '')
-- metric = 'skill':  value = postings mentioning skill, base = postings in the sample
CREATE TABLE IF NOT EXISTS observations (
    source_id  TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    metric     TEXT NOT NULL CHECK (metric IN ('demand', 'skill')),
    role_id    TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    skill      TEXT NOT NULL DEFAULT '',
    period     TEXT NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    value      DOUBLE PRECISION NOT NULL,
    base       DOUBLE PRECISION,
    PRIMARY KEY (source_id, metric, role_id, skill, period)
);
