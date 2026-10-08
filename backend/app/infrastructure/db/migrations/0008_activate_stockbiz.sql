UPDATE news_sources
SET status = 'active', adapter_key = 'stockbiz', parser_version = '1',
    storage_mode = 'metadata_only', display_mode = 'metadata_only',
    blocked_reason = NULL, row_version = row_version + 1, updated_at = now()
WHERE slug = 'stockbiz' AND status = 'pending_review';
