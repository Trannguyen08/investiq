import Link from "next/link";

import type { NewsSummary } from "@/lib/api-client";

const labelMap = {
  positive: "Tích cực",
  negative: "Tiêu cực",
  neutral: "Trung tính",
  mixed: "Trái chiều",
  unknown: "Chưa đủ cơ sở",
} as const;

const eventTypeLabels: Record<string, string> = {
  earnings_result: "Kết quả kinh doanh",
  dividend: "Cổ tức",
  capital_action: "Hoạt động vốn",
  leadership_change: "Thay đổi lãnh đạo",
  regulatory_action: "Biện pháp quản lý",
  contract: "Hợp đồng",
};

const nonTickerAbbreviations = new Set(["CEO", "FDI", "GDP", "IMF", "IPO", "PTE", "UOB", "USD"]);

export function eventTypeLabel(value: string) {
  return eventTypeLabels[value] ?? "Sự kiện doanh nghiệp";
}

export function formatNewsTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function SentimentBadge({ sentiment }: Pick<NewsSummary, "sentiment">) {
  if (sentiment.status !== "ready" || !sentiment.label) {
    return <span className="sentiment pending">Đang phân tích</span>;
  }
  return <span className={`sentiment ${sentiment.label}`}>{labelMap[sentiment.label]}</span>;
}

export type NewsTicker = {
  key: string;
  symbol: string;
  exchange: string | null;
  label: string;
  href: string;
  verified: boolean;
};

export function newsTickers(
  article: Pick<NewsSummary, "symbols" | "mentioned_symbols" | "tags">,
): NewsTicker[] {
  const tickers = new Map<string, NewsTicker>();
  for (const item of article.symbols) {
    tickers.set(item.symbol, {
      key: item.security_id,
      symbol: item.symbol,
      exchange: item.exchange,
      label: `${item.symbol} · ${item.exchange}`,
      href: `/news?symbol=${encodeURIComponent(`${item.exchange}:${item.symbol}`)}`,
      verified: true,
    });
  }
  for (const value of article.mentioned_symbols) {
    const [exchange, symbol] = value.includes(":") ? value.split(":", 2) : [null, value];
    if (!symbol || tickers.has(symbol)) continue;
    tickers.set(symbol, {
      key: `mentioned-${value}`,
      symbol,
      exchange,
      label: exchange ? `${symbol} · ${exchange}` : symbol,
      href: `/news?q=${encodeURIComponent(symbol)}`,
      verified: false,
    });
  }
  for (const tag of article.tags) {
    const candidates = tag.match(/\b[A-Z][A-Z0-9]{2,7}\b/g) ?? [];
    for (const symbol of candidates) {
      const standaloneTickerTag = tag.trim() === symbol;
      if (symbol.length !== 3 || (!standaloneTickerTag && nonTickerAbbreviations.has(symbol)) || tickers.has(symbol)) continue;
      tickers.set(symbol, {
        key: `tag-${symbol}`,
        symbol,
        exchange: null,
        label: symbol,
        href: `/news?q=${encodeURIComponent(symbol)}`,
        verified: false,
      });
    }
  }
  return [...tickers.values()];
}

export function NewsCard({ article, featured = false }: { article: NewsSummary; featured?: boolean }) {
  const tickers = newsTickers(article);
  return (
    <article className={featured ? "news-card featured" : "news-card"}>
      <div className="news-thumbnail" aria-hidden={article.thumbnail ? undefined : true}>
        {article.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.thumbnail.url} alt={article.thumbnail.alt ?? ""} />
        ) : <span>IQ</span>}
      </div>
      <div className="news-card-body">
        <div className="news-meta">
          <span className="source-name">{article.source.name}</span>
          <time dateTime={article.published_at ?? article.first_seen_at}>
            {article.published_at ? formatNewsTime(article.published_at) : `Ghi nhận ${formatNewsTime(article.first_seen_at)}`}
          </time>
        </div>
        <h2><Link href={`/news/${article.id}`}>{article.title}</Link></h2>
        {article.description && <p>{article.description}</p>}
        <div className="news-tags">
          <SentimentBadge sentiment={article.sentiment} />
          {article.sentiment.event_types.slice(0, 1).map((event) => (
            <span className="event-badge" key={event}>{eventTypeLabel(event)}</span>
          ))}
          {article.duplicate_source_count > 1 && (
            <span className="partial-badge">{article.duplicate_source_count} nguồn cùng tin</span>
          )}
          {tickers.slice(0, 3).map((item) => (
            <Link href={item.href} className={`symbol-chip${item.verified ? "" : " source-symbol"}`} title={item.verified ? undefined : "Mã được nguồn bài viết nhắc đến"} key={item.key}>{item.label}</Link>
          ))}
          {tickers.length > 3 && <span className="symbol-chip ticker-overflow">+{tickers.length - 3}</span>}
        </div>
      </div>
    </article>
  );
}
