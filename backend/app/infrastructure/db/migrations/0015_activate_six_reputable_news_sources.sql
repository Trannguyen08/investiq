-- Activate 6 reputable Vietnamese financial news sources with full text extraction
UPDATE news_sources
SET status = 'active',
    storage_mode = 'full_text',
    display_mode = 'full_text',
    blocked_reason = NULL,
    row_version = row_version + 1,
    updated_at = now()
WHERE slug IN ('vietstock', 'cafef', 'vneconomy', 'vnexpress', 'stockbiz', 'hnx');
