import Link from "next/link";

import { NewsCard, formatNewsTime } from "@/components/news/news-card";
import { NewsFilterForm } from "@/components/news/news-filter-form";
import { getNews, getNewsSources } from "@/lib/api-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  query.set("limit", "10");
  for (const key of ["q", "source", "symbol", "sentiment", "window_days", "page"] as const) {
    const value = first(raw[key]);
    if (value) query.set(key, value);
  }

  let result;
  let sources;
  try {
    [result, sources] = await Promise.all([getNews(query), getNewsSources()]);
  } catch {
    return (
      <main id="main-content" className="news-page">
        <div className="state-panel error-state">
          <span>Không thể tải tin tức lúc này.</span>
          <Link href="/news">Thử lại</Link>
        </div>
      </main>
    );
  }

  const activeSources = sources.data.filter((source) => source.status === "active");
  const symbolCounts = new Map<string, number>();
  for (const article of result.data) {
    for (const mention of article.symbols) {
      const key = `${mention.exchange}:${mention.symbol}`;
      symbolCounts.set(key, (symbolCounts.get(key) ?? 0) + 1);
    }
  }
  const popularSymbols = [...symbolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const pageUrl = (page: number) => {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    return `/news?${params.toString()}`;
  };
  const { page, total_pages: totalPages } = result.pagination;
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, index) =>
    Math.max(1, Math.min(page - 2, totalPages - 4)) + index,
  );

  return (
    <main id="main-content" className="news-page">
      <section className="news-hero">
        <div>
          <p className="eyebrow">InvestIQ Newsroom</p>
          <h1>Tin tức thị trường</h1>
          <p>Đọc tin và theo dõi nội dung liên quan đến doanh nghiệp niêm yết tại Việt Nam.</p>
        </div>
        <div className="freshness">
          <span className={`status-dot ${result.meta.freshness}`} />
          {result.meta.last_ingested_at ? `Cập nhật ${formatNewsTime(result.meta.last_ingested_at)}` : "Chưa có lần thu thập thành công"}
        </div>
      </section>

      <NewsFilterForm sources={activeSources} />

      {result.data.length === 0 ? (
        <section className="state-panel empty-state">
          <span className="empty-icon">⌁</span>
          <h2>Không có tin khớp bộ lọc</h2>
          <p>Thử xóa bớt điều kiện hoặc kiểm tra lại mã chứng khoán.</p>
          <Link href="/news">Xóa bộ lọc</Link>
        </section>
      ) : (
        <div className="news-layout">
          <section className="news-feed" aria-label="Danh sách tin">
            {result.data.map((article, index) => <NewsCard article={article} featured={index === 0} key={article.id} />)}
            {totalPages > 1 && <nav className="news-pagination" aria-label="Phân trang tin tức">
              {page > 1 && <Link href={pageUrl(page - 1)}>Trang trước</Link>}
              {pageNumbers.map((number) => <Link key={number} href={pageUrl(number)} aria-current={number === page ? "page" : undefined}>{number}</Link>)}
              {page < totalPages && <Link href={pageUrl(page + 1)}>Trang sau</Link>}
            </nav>}
          </section>
          <aside className="news-sidebar">
            <section>
              <p className="eyebrow">Trong trang đang xem</p>
              <h2>Mã xuất hiện trong tin</h2>
              {popularSymbols.length ? popularSymbols.map(([symbol, count]) => (
                <Link href={`/news?symbol=${encodeURIComponent(symbol)}`} className="symbol-row" key={symbol}>
                  <strong>{symbol}</strong><span>{count} bài</span>
                </Link>
              )) : <p className="muted-copy">Chưa nhận diện được mã trong các bài đã tải.</p>}
            </section>
            <section>
              <p className="eyebrow">Nguồn dữ liệu</p>
              <h2>Tình trạng cập nhật</h2>
              {sources.data.map((source) => (
                <div className="source-row" key={source.slug}>
                  <span className={`status-dot ${source.status === "active" ? "fresh" : "unavailable"}`} />
                  <span><strong>{source.name}</strong><small>{source.status === "active" ? "Đã tích hợp" : "Đang đánh giá"}</small></span>
                </div>
              ))}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
