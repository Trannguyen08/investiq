CREATE TABLE news_sources (
    id uuid PRIMARY KEY,
    slug varchar(64) NOT NULL UNIQUE,
    name text NOT NULL,
    base_url text NOT NULL,
    status varchar(24) NOT NULL CHECK (status IN ('pending_review', 'active', 'paused', 'blocked')),
    adapter_key text,
    parser_version text,
    storage_mode varchar(24) NOT NULL CHECK (storage_mode IN ('full_text', 'metadata_only', 'link_only')),
    display_mode varchar(24) NOT NULL CHECK (display_mode IN ('full_text', 'metadata_only', 'link_only')),
    last_success_at timestamptz,
    blocked_reason text,
    row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE news_articles (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE RESTRICT,
    canonical_url text NOT NULL,
    canonical_url_hash char(64) NOT NULL,
    current_revision_id uuid,
    visibility varchar(20) NOT NULL DEFAULT 'published'
        CHECK (visibility IN ('draft', 'published', 'quarantined', 'withdrawn')),
    row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
    first_seen_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    feed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, canonical_url_hash),
    UNIQUE (id, source_id)
);

CREATE TABLE article_revisions (
    id uuid PRIMARY KEY,
    article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    revision_no integer NOT NULL CHECK (revision_no > 0),
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    content_text text,
    content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(content_blocks) = 'array'),
    authors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(authors) = 'array'),
    category_key text,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
    published_at timestamptz,
    source_updated_at timestamptz,
    fetched_at timestamptz NOT NULL,
    parser_version text NOT NULL,
    content_hash char(64) NOT NULL,
    revision_hash char(64) NOT NULL,
    extraction_status varchar(24) NOT NULL
        CHECK (extraction_status IN ('complete', 'partial', 'metadata_only')),
    quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quality_flags) = 'array'),
    search_document tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content_text, ''))
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (article_id, revision_no),
    UNIQUE (article_id, id)
);

ALTER TABLE news_articles
    ADD CONSTRAINT news_articles_current_revision_fk
    FOREIGN KEY (id, current_revision_id)
    REFERENCES article_revisions(article_id, id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE article_assets (
    id uuid PRIMARY KEY,
    revision_id uuid NOT NULL REFERENCES article_revisions(id) ON DELETE CASCADE,
    kind varchar(20) NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'document')),
    role varchar(20) NOT NULL CHECK (role IN ('thumbnail', 'inline', 'attachment')),
    position integer NOT NULL CHECK (position >= 0),
    original_url text NOT NULL,
    alt text,
    caption text,
    credit text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (revision_id, kind, position)
);

CREATE TABLE securities (
    id uuid PRIMARY KEY,
    issuer_name text NOT NULL,
    instrument_type varchar(24) NOT NULL DEFAULT 'stock',
    is_active boolean NOT NULL DEFAULT true,
    master_source text NOT NULL,
    master_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE security_identifiers (
    id uuid PRIMARY KEY,
    security_id uuid NOT NULL REFERENCES securities(id) ON DELETE RESTRICT,
    symbol varchar(12) NOT NULL,
    exchange varchar(12) NOT NULL CHECK (exchange IN ('HOSE', 'HNX', 'UPCOM')),
    valid_from date NOT NULL,
    valid_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to > valid_from),
    UNIQUE (security_id, id)
);

CREATE UNIQUE INDEX security_identifiers_current_symbol_uq
    ON security_identifiers (exchange, symbol) WHERE valid_to IS NULL;

CREATE TABLE article_mentions (
    id uuid PRIMARY KEY,
    revision_id uuid NOT NULL REFERENCES article_revisions(id) ON DELETE CASCADE,
    security_id uuid NOT NULL REFERENCES securities(id) ON DELETE RESTRICT,
    identifier_id uuid NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    method varchar(24) NOT NULL,
    confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (revision_id, security_id),
    UNIQUE (revision_id, id),
    FOREIGN KEY (security_id, identifier_id)
        REFERENCES security_identifiers(security_id, id) ON DELETE RESTRICT
);

CREATE TABLE sentiment_analyses (
    id uuid PRIMARY KEY,
    revision_id uuid NOT NULL REFERENCES article_revisions(id) ON DELETE CASCADE,
    mention_id uuid,
    method varchar(20) NOT NULL CHECK (method IN ('rules', 'model', 'manual')),
    analyzer_version text NOT NULL,
    input_hash char(64) NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
    label varchar(16) CHECK (label IN ('positive', 'negative', 'neutral', 'mixed', 'unknown')),
    score numeric(6,5) CHECK (score BETWEEN -1 AND 1),
    confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    rationale text,
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
    analyzed_at timestamptz,
    is_current boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (revision_id, mention_id)
        REFERENCES article_mentions(revision_id, id) ON DELETE CASCADE,
    CHECK ((status = 'ready') = (label IS NOT NULL)),
    CHECK (label <> 'unknown' OR score IS NULL),
    CHECK (NOT is_current OR status = 'ready')
);

CREATE UNIQUE INDEX sentiment_article_current_uq
    ON sentiment_analyses (revision_id) WHERE mention_id IS NULL AND is_current;
CREATE UNIQUE INDEX sentiment_mention_current_uq
    ON sentiment_analyses (revision_id, mention_id) WHERE mention_id IS NOT NULL AND is_current;

CREATE TABLE crawl_runs (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE RESTRICT,
    trigger varchar(16) NOT NULL CHECK (trigger IN ('scheduled', 'manual', 'backfill')),
    status varchar(16) NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
    started_at timestamptz,
    finished_at timestamptz,
    discovered_count integer NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_jobs (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES news_sources(id) ON DELETE RESTRICT,
    crawl_run_id uuid REFERENCES crawl_runs(id) ON DELETE SET NULL,
    article_id uuid REFERENCES news_articles(id) ON DELETE SET NULL,
    job_type varchar(16) NOT NULL CHECK (job_type IN ('discover', 'fetch', 'resolve', 'analyze')),
    payload_version smallint NOT NULL DEFAULT 1,
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    job_key text NOT NULL UNIQUE,
    status varchar(16) NOT NULL CHECK (status IN ('pending', 'dispatched', 'running', 'succeeded', 'failed', 'cancelled')),
    attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    fencing_token bigint NOT NULL DEFAULT 0,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (attempt_count <= max_attempts)
);

CREATE INDEX news_articles_feed_idx
    ON news_articles (feed_at DESC, id DESC) WHERE visibility = 'published';
CREATE INDEX article_revisions_search_idx ON article_revisions USING gin (search_document);
CREATE INDEX article_mentions_security_idx ON article_mentions (security_id, revision_id);
CREATE INDEX ingestion_jobs_due_idx ON ingestion_jobs (status, next_attempt_at);

INSERT INTO news_sources
    (id, slug, name, base_url, status, adapter_key, parser_version, storage_mode, display_mode, blocked_reason)
VALUES
    ('91d46443-4e4b-4c09-8ce0-36c8279a0001', 'vietstock', 'Vietstock', 'https://vietstock.vn', 'active', 'vietstock', '1', 'full_text', 'full_text', NULL),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0002', 'cafef', 'CafeF', 'https://cafef.vn', 'active', 'cafef', '1', 'full_text', 'full_text', NULL),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0003', 'hnx', 'HNX', 'https://www.hnx.vn', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Chưa xác nhận kênh ingestion công khai ổn định.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0004', 'hose', 'HOSE', 'https://www.hsx.vn', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Trang yêu cầu JavaScript; cần xác nhận luồng công khai.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0005', 'stockbiz', 'StockBiz', 'https://stockbiz.vn', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Chưa hoàn tất kiểm tra điều kiện sử dụng và chống trùng.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0006', 'fireant', 'FireAnt', 'https://fireant.vn', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Cần tách tin xuất bản khỏi nội dung cộng đồng.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0007', 'simplize', 'Simplize', 'https://simplize.vn', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Chưa xác nhận kênh bài viết công khai phù hợp.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0008', 'ssi-iboard', 'SSI iBoard', 'https://iboard.ssi.com.vn', 'blocked', NULL, NULL, 'link_only', 'link_only', 'Trang yêu cầu JavaScript; bảng điện ngoài phạm vi tin tức.'),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0009', 'tradingview', 'TradingView', 'https://vn.tradingview.com', 'pending_review', NULL, NULL, 'link_only', 'link_only', 'Chưa xác nhận quyền tích hợp tin và ý tưởng cộng đồng.')
ON CONFLICT (slug) DO NOTHING;
