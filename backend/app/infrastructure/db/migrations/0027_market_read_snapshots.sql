-- 0027_market_read_snapshots.sql
-- Last-known-good public market read models. Served (marked stale) only when the live
-- provider is unavailable, e.g. during the upstream maintenance window or a cold start.
CREATE TABLE IF NOT EXISTS market_read_snapshots (
    cache_key text PRIMARY KEY CHECK (length(cache_key) <= 256),
    resource text NOT NULL CHECK (length(resource) <= 64),
    payload jsonb NOT NULL,
    stored_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_read_snapshots_resource_idx
    ON market_read_snapshots (resource, stored_at DESC);
