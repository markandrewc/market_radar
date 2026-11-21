-- Postgres. Applied on every start; all statements are idempotent.

-- Every value belongs to a source, so the API can always show name, link and dates.
CREATE TABLE IF NOT EXISTS sources (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    url          TEXT NOT NULL,            -- page where the team can check the original
    fetched_at   TIMESTAMPTZ NOT NULL,     -- latest successful download (step 1)
    data_as_of   DATE,                     -- the publisher's last update, if stated
    licence      TEXT,
    licence_url  TEXT,
    comparable_from TEXT                   -- YYYY-MM: the source changed how it counts; earlier months differ
);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS data_as_of DATE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS licence TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS licence_url TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS comparable_from TEXT;

-- Step 2 bookkeeping: which raw file of which source was normalized, with what result.
CREATE TABLE IF NOT EXISTS raw_files (
    source_id      TEXT NOT NULL,
    sha256         TEXT NOT NULL,
    relative_path  TEXT NOT NULL,          -- inside the raw folder
    fetched_at     TIMESTAMPTZ,
    fetch_error    TEXT,                   -- step 1 could not download a newer file and kept this one
    status         TEXT NOT NULL CHECK (status IN ('parsed', 'error', 'no_parser')),
    parser         TEXT,
    observations   INTEGER NOT NULL DEFAULT 0,
    error          TEXT,
    processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, sha256)
);

-- Replaced by the raw folder.
DROP TABLE IF EXISTS raw_documents;

-- Roles come from the data, not from code.
CREATE TABLE IF NOT EXISTS roles (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL
);

-- Clean numbers for the dashboard, written by step 2.
-- metric = 'demand': value = postings for role_id in period; base = all postings in the sample (optional)
-- metric = 'skill':  value = postings mentioning skill; base = all postings in the sample
-- role_id = '' means all roles together.
CREATE TABLE IF NOT EXISTS observations (
    source_id  TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    metric     TEXT NOT NULL CHECK (metric IN ('demand', 'skill')),
    role_id    TEXT NOT NULL,
    skill      TEXT NOT NULL DEFAULT '',
    period     TEXT NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    value      DOUBLE PRECISION NOT NULL,
    base       DOUBLE PRECISION,
    PRIMARY KEY (source_id, metric, role_id, skill, period)
);
ALTER TABLE observations DROP CONSTRAINT IF EXISTS observations_role_id_fkey;
