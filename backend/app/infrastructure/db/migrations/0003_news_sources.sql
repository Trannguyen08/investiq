UPDATE news_sources
SET status = 'active',
    adapter_key = 'hnx',
    parser_version = '1',
    storage_mode = 'metadata_only',
    display_mode = 'metadata_only',
    blocked_reason = NULL,
    row_version = row_version + 1,
    updated_at = now()
WHERE slug = 'hnx';

INSERT INTO news_sources
    (id, slug, name, base_url, status, adapter_key, parser_version,
     storage_mode, display_mode, blocked_reason)
VALUES
    ('91d46443-4e4b-4c09-8ce0-36c8279a0010', 'vneconomy', 'VnEconomy',
     'https://vneconomy.vn', 'active', 'vneconomy', '1',
     'metadata_only', 'metadata_only', NULL),
    ('91d46443-4e4b-4c09-8ce0-36c8279a0011', 'vnexpress', 'VnExpress',
     'https://vnexpress.net', 'active', 'vnexpress', '1',
     'metadata_only', 'metadata_only', NULL)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    base_url = EXCLUDED.base_url,
    status = EXCLUDED.status,
    adapter_key = EXCLUDED.adapter_key,
    parser_version = EXCLUDED.parser_version,
    storage_mode = EXCLUDED.storage_mode,
    display_mode = EXCLUDED.display_mode,
    blocked_reason = EXCLUDED.blocked_reason,
    row_version = news_sources.row_version + 1,
    updated_at = now();
