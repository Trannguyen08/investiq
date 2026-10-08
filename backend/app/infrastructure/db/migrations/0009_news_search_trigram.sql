CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION news_unaccent(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT public.unaccent('public.unaccent'::regdictionary, value)
$$;

CREATE INDEX article_revisions_search_unaccent_trgm_idx
ON article_revisions USING gin (
    news_unaccent(lower(coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' || coalesce(content_text, ''))) gin_trgm_ops
);
