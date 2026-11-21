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
    items          INTEGER NOT NULL DEFAULT 0,   -- parsed context records written to market_items
    error          TEXT,
    processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, sha256)
);

ALTER TABLE raw_files ADD COLUMN IF NOT EXISTS items INTEGER NOT NULL DEFAULT 0;

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

-- --------------------------------------------------------------------------
-- Config-driven connectors (docs/ADDING_SOURCES.md). sources.yaml is applied
-- into connector_sources on start and on POST /api/connectors/reload. market_items
-- holds the normalised records (docs/market-item.schema.json).
CREATE TABLE IF NOT EXISTS connector_sources (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    source_url      TEXT NOT NULL,
    categories      TEXT[] NOT NULL,
    adapter_type    TEXT NOT NULL CHECK (adapter_type IN ('rest_api', 'rss_atom', 'csv_url')),
    endpoint        TEXT,
    endpoints       TEXT[] NOT NULL DEFAULT '{}',
    refresh_rate    TEXT NOT NULL,
    refresh_seconds INTEGER,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    auth_env        TEXT[] NOT NULL DEFAULT '{}',
    params          JSONB NOT NULL DEFAULT '{}'::jsonb,
    headers         JSONB NOT NULL DEFAULT '{}'::jsonb,
    filter_keywords TEXT[] NOT NULL DEFAULT '{}',
    filter_regions  BOOLEAN NOT NULL DEFAULT false,
    region          TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    field_map       JSONB NOT NULL DEFAULT '{}'::jsonb,
    items_path      TEXT,
    pages           INTEGER NOT NULL DEFAULT 1,
    max_items       INTEGER NOT NULL DEFAULT 2000,
    timeout         DOUBLE PRECISION NOT NULL DEFAULT 20,
    delimiter       TEXT NOT NULL DEFAULT ',',
    licence         TEXT,
    licence_url     TEXT,
    config_hash     TEXT NOT NULL,
    in_config       BOOLEAN NOT NULL DEFAULT true,
    last_sync_at    TIMESTAMPTZ,
    last_error      TEXT,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which sources.yaml version was applied last (single row).
CREATE TABLE IF NOT EXISTS connector_state (
    id            BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    config_file   TEXT,
    config_sha256 TEXT,
    source_count  INTEGER NOT NULL DEFAULT 0,
    errors        JSONB NOT NULL DEFAULT '[]'::jsonb,
    applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalised connector records (docs/market-item.schema.json). One row per record of a
-- configured source; payload keeps the raw record for the AI skill matcher and is not served.
CREATE TABLE IF NOT EXISTS market_items (
    -- Written by connectors (connector_sources) and by pipeline parsers (sources); hence no FK.
    source_id    TEXT NOT NULL,
    id           TEXT NOT NULL,
    category     TEXT NOT NULL CHECK (category IN ('A', 'B', 'C', 'D', 'E')),
    categories   TEXT[] NOT NULL,
    title        TEXT NOT NULL,
    summary      TEXT NOT NULL DEFAULT '',
    metrics      JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload      JSONB,
    tags         TEXT[] NOT NULL DEFAULT '{}',
    region       TEXT,
    source_name  TEXT NOT NULL,
    source_url   TEXT NOT NULL,
    url          TEXT,
    published_at TIMESTAMPTZ,
    fetched_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (source_id, id)
);
CREATE INDEX IF NOT EXISTS market_items_category ON market_items (category, published_at DESC);
CREATE INDEX IF NOT EXISTS market_items_fetched ON market_items (fetched_at DESC);
CREATE INDEX IF NOT EXISTS market_items_tags ON market_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS market_items_region ON market_items (region);
ALTER TABLE market_items DROP CONSTRAINT IF EXISTS market_items_source_id_fkey;
CREATE INDEX IF NOT EXISTS market_items_source ON market_items (source_id);

-- --------------------------------------------------------------------------
-- Level 2: e-mailed briefings. The e-mail address is the only personal datum:
-- stored only to deliver, never returned by a read endpoint, and deleted
-- together with the subscription on unsubscribe (docs/REPORTS.md).
CREATE TABLE IF NOT EXISTS report_subscriptions (
    id                  TEXT PRIMARY KEY,           -- generated in Python, no extension needed
    email               TEXT NOT NULL,
    role_ids            TEXT[] NOT NULL DEFAULT '{}',
    include_policy      BOOLEAN NOT NULL DEFAULT true,
    include_target_group BOOLEAN NOT NULL DEFAULT true,
    cadence             TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'monthly')),
    active              BOOLEAN NOT NULL DEFAULT true,
    unsubscribe_token   TEXT NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sent_at        TIMESTAMPTZ,
    last_error          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS report_subscriptions_email ON report_subscriptions (lower(email));
CREATE INDEX IF NOT EXISTS report_subscriptions_due ON report_subscriptions (active, cadence, last_sent_at);

-- What was actually sent, for the team's audit: the same digest text that left the server.
CREATE TABLE IF NOT EXISTS report_sends (
    id              BIGSERIAL PRIMARY KEY,
    subscription_id TEXT REFERENCES report_subscriptions(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL CHECK (status IN ('sent', 'dry_run', 'error')),
    provider        TEXT NOT NULL DEFAULT 'resend',
    subject         TEXT NOT NULL,
    digest          TEXT NOT NULL,
    sources         JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider_id     TEXT,
    error           TEXT
);
CREATE INDEX IF NOT EXISTS report_sends_email_sent ON report_sends (email, sent_at DESC);
