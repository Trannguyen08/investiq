import Link from "next/link";

import { NewsCard, formatNewsTime } from "@/components/news/news-card";
import { getNews, getNewsSources } from "@/lib/api-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  query.set("limit", "30");
  for (const key of ["q", "source", "symbol", "sentiment", "window_days", "cursor"] as const) {
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
  const currentQuery = first(raw.q) ?? "";
  const currentSource = first(raw.source) ?? "";
  const currentSymbol = first(raw.symbol) ?? "";
  const currentSentiment = first(raw.sentiment) ?? "";
  const currentWindow = first(raw.window_days) ?? "7";
  const symbolCounts = new Map<string, number>();
  for (const article of result.data) {
    for (const mention of article.symbols) {
      const key = `${mention.exchange}:${mention.symbol}`;
      symbolCounts.set(key, (symbolCounts.get(key) ?? 0) + 1);
    }
  }
  const popularSymbols = [...symbolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const nextQuery = new URLSearchParams(query);
  if (result.pagination.next_cursor) nextQuery.set("cursor", result.pagination.next_cursor);

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

      <form action="/news" className="news-filters" role="search">
        <label className="search-wide">
          <span className="sr-only">Tìm kiếm tin</span>
          <input name="q" defaultValue={currentQuery} placeholder="Tìm tiêu đề, nội dung hoặc doanh nghiệp…" minLength={2} maxLength={200} />
        </label>
        <label>
          <span>Nguồn</span>
          <select name="source" defaultValue={currentSource}>
            <option value="">Tất cả nguồn</option>
            {activeSources.map((source) => <option value={source.slug} key={source.slug}>{source.name}</option>)}
          </select>
        </label>
        <label>
          <span>Mã chứng khoán</span>
          <input name="symbol" defaultValue={currentSymbol} placeholder="HOSE:FPT" pattern="(HOSE|HNX|UPCOM):[A-Za-z0-9]{3,8}" />
        </label>
        <label>
          <span>Thời gian</span>
          <select name="window_days" defaultValue={currentWindow}>
            <option value="1">24 giờ qua</option>
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="90">90 ngày qua</option>
          </select>
        </label>
        <label>
          <span>Sắc thái toàn bài</span>
          <select name="sentiment" defaultValue={currentSentiment}>
            <option value="">Tất cả</option>
            <option value="positive">Tích cực</option>
            <option value="negative">Tiêu cực</option>
            <option value="neutral">Trung tính</option>
            <option value="mixed">Trái chiều</option>
            <option value="unknown">Chưa đủ cơ sở</option>
          </select>
        </label>
        <button type="submit">Áp dụng</button>
        {(currentQuery || currentSource || currentSymbol || currentSentiment || currentWindow !== "7") && <Link className="clear-filters" href="/news">Xóa lọc</Link>}
      </form>

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
            {result.pagination.has_more && <Link className="load-more" href={`/news?${nextQuery.toString()}`}>Xem thêm tin</Link>}
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
