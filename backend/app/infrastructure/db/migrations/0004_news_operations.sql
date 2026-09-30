ALTER TABLE article_revisions
    ADD COLUMN duplicate_group_key char(64);

CREATE INDEX article_revisions_duplicate_group_idx
    ON article_revisions (duplicate_group_key)
    WHERE duplicate_group_key IS NOT NULL;

ALTER TABLE sentiment_analyses
    ADD COLUMN topics jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(topics) = 'array'),
    ADD COLUMN event_types jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(event_types) = 'array');

ALTER TABLE crawl_runs
    ADD COLUMN queued_count integer NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
    ADD COLUMN skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    ADD COLUMN succeeded_count integer NOT NULL DEFAULT 0 CHECK (succeeded_count >= 0),
    ADD COLUMN failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    ADD COLUMN error_code text;

CREATE TABLE news_admin_audit (
    id uuid PRIMARY KEY,
    request_id text NOT NULL,
    action text NOT NULL,
    target text NOT NULL,
    outcome varchar(16) NOT NULL CHECK (outcome IN ('accepted', 'succeeded', 'rejected', 'failed')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_retention_idx ON news_articles (feed_at, id);
CREATE INDEX crawl_runs_recent_idx ON crawl_runs (created_at DESC, id DESC);
