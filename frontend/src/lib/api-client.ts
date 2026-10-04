export type Source = {
  slug: string;
  name: string;
  url: string;
  status: "active" | "pending_review" | "paused" | "blocked";
  content_access: "full_text" | "metadata_only" | "link_only";
  last_success_at: string | null;
};

export type Sentiment = {
  status: "pending" | "ready" | "failed" | "stale";
  label: "positive" | "negative" | "neutral" | "mixed" | "unknown" | null;
  score: number | null;
  confidence: number | null;
  method: string | null;
  analyzer_version: string | null;
  analyzed_at: string | null;
  rationale: string | null;
  evidence: string[];
  market_impact: string | null;
  impact_scope: string | null;
  horizon: "short_term" | "medium_term" | "long_term" | null;
  topics: string[];
  event_types: string[];
};

export type Asset = {
  id: string;
  kind: string;
  role: string;
  url: string;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  position: number;
};

export type SymbolMention = {
  security_id: string;
  symbol: string;
  exchange: string;
  company_name: string;
  is_primary: boolean;
  match_method: string;
  match_confidence: number | null;
  evidence: string[];
  sentiment: Sentiment | null;
};

export type NewsSummary = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source: Source;
  published_at: string | null;
  updated_at: string | null;
  first_seen_at: string;
  feed_at: string;
  category: string | null;
  tags: string[];
  thumbnail: Asset | null;
  symbols: SymbolMention[];
  mentioned_symbols: string[];
  sentiment: Sentiment;
  extraction_status: string;
  content_access: string;
  duplicate_source_count: number;
};

export type ContentBlock = {
  id: string;
  type: "paragraph" | "heading" | "quote" | "image" | "list" | "table";
  text: string | null;
  level: number | null;
  url: string | null;
  caption: string | null;
  items: string[];
  rows: string[][];
};

export type NewsDetail = NewsSummary & {
  revision_id: string;
  content: string | null;
  content_blocks: ContentBlock[];
  authors: string[];
  fetched_at: string;
  images: Asset[];
  attachments: Asset[];
  quality_flags: string[];
  reading_time_minutes: number;
};

export type NewsCollection = {
  data: NewsSummary[];
  pagination: { next_cursor: string | null; has_more: boolean; page: number; page_size: number; total_items: number; total_pages: number };
  meta: { request_id: string; as_of: string; last_ingested_at: string | null; freshness: string };
};

type Envelope<T> = { data: T; meta: NewsCollection["meta"] };

const serverBase = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";

async function requestJson<T>(path: string, revalidate?: number): Promise<T> {
  const response = await fetch(`${serverBase}${path}`, revalidate ? { next: { revalidate } } : { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`InvestIQ API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getNews(query: URLSearchParams): Promise<NewsCollection> {
  const suffix = query.size ? `?${query.toString()}` : "";
  return requestJson<NewsCollection>(`/v1/news${suffix}`, 30);
}

export function getNewsArticle(id: string): Promise<Envelope<NewsDetail>> {
  return requestJson<Envelope<NewsDetail>>(`/v1/news/${encodeURIComponent(id)}`);
}

export function getNewsSources(): Promise<Envelope<Source[]>> {
  return requestJson<Envelope<Source[]>>("/v1/news-sources", 60);
}
