import Link from "next/link";

import { NewsCard } from "@/components/news/news-card";
import type { NewsSummary } from "@/lib/api-client";

function newestFirst(left: NewsSummary, right: NewsSummary) {
  return new Date(right.feed_at).getTime() - new Date(left.feed_at).getTime();
}

export function StockRelatedNews({
  articles,
  exchange,
  symbol,
}: {
  articles: NewsSummary[] | null;
  exchange: string;
  symbol: string;
}) {
  const qualifiedSymbol = `${exchange}:${symbol}`;
  const allNewsHref = `/news?symbol=${encodeURIComponent(qualifiedSymbol)}`;
  const sortedArticles = articles === null ? null : [...articles].sort(newestFirst);

  return (
    <section className="stock-related-news" aria-labelledby="stock-related-news-title">
      <header>
        <div>
          <p className="eyebrow">TIN DOANH NGHIỆP</p>
          <h2 id="stock-related-news-title">Tin tức liên quan đến {symbol}</h2>
          <p>Các bài đã gắn mã {qualifiedSymbol}, sắp xếp từ mới nhất đến cũ hơn.</p>
        </div>
        <Link href={allNewsHref}>Xem tất cả tin {symbol} →</Link>
      </header>
      {sortedArticles === null ? (
        <div className="stock-related-news-state" role="status">
          <strong>Chưa thể tải tin liên quan lúc này</strong>
          <p>Dữ liệu giá vẫn hiển thị bình thường. Bạn có thể mở trang Tin tức để thử lại.</p>
        </div>
      ) : sortedArticles.length === 0 ? (
        <div className="stock-related-news-state">
          <strong>Chưa có tin được gắn mã {symbol}</strong>
          <p>InvestIQ chỉ hiển thị bài đã xác minh mã hoặc được nguồn bài viết nêu mã trực tiếp.</p>
        </div>
      ) : (
        <div className="stock-related-news-list" aria-label={`Tin mới nhất về ${symbol}`}>
          {sortedArticles.map((article) => <NewsCard article={article} key={article.id} />)}
        </div>
      )}
    </section>
  );
}
