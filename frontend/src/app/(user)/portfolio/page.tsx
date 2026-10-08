import { PaperTradingDashboard } from "@/components/portfolio/paper-trading-dashboard";
import { getNews } from "@/lib/api-client";
import type { PositivePaperNews } from "@/types/portfolio";

export default async function PortfolioPage() {
  const query = new URLSearchParams({ sentiment: "positive", window_days: "1", limit: "12" });
  const collection = await getNews(query, 800).catch(() => null);
  const positiveNews: PositivePaperNews[] = (collection?.data ?? []).flatMap((article) => {
    const symbols = [
      ...article.symbols.map((item) => item.symbol),
      ...article.mentioned_symbols,
    ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 4);
    if (!symbols.length) return [];
    return [{
      id: article.id,
      title: article.title,
      summary: article.sentiment.market_impact ?? article.description ?? "Mở bài viết để xem nội dung.",
      source: article.source.name,
      publishedAt: article.published_at,
      symbols,
    }];
  }).slice(0, 6);
  return <PaperTradingDashboard positiveNews={positiveNews} />;
}
