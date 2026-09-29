ALTER TABLE article_revisions
    ADD COLUMN candidate_symbols jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(candidate_symbols) = 'array');

ALTER TABLE sentiment_analyses
    ADD COLUMN market_impact text,
    ADD COLUMN impact_scope text,
    ADD COLUMN horizon varchar(24)
        CHECK (horizon IS NULL OR horizon IN ('short_term', 'medium_term', 'long_term'));
