UPDATE news_articles AS article
SET visibility = 'withdrawn',
    row_version = row_version + 1,
    updated_at = now()
FROM article_revisions AS revision
WHERE revision.id = article.current_revision_id
  AND revision.extraction_status <> 'complete'
  AND article.visibility = 'published';
