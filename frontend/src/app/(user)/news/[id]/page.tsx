/* eslint-disable @next/next/no-img-element -- source domains are dynamic and images remain external */
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatNewsTime, newsTickers, SentimentBadge } from "@/components/news/news-card";
import { getNewsArticle } from "@/lib/api-client";

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let envelope;
  try {
    envelope = await getNewsArticle(id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) notFound();
    return (
      <main id="main-content" className="article-page">
        <div className="state-panel error-state"><span>Không thể tải bài viết.</span><Link href="/news">Quay lại trang tin</Link></div>
      </main>
    );
  }
  const article = envelope.data;
  const assets = new Map(article.images.flatMap((asset) => [[asset.id, asset], [asset.url, asset]]));
  const keyExcerpts = article.content_blocks
    .filter((block) => block.type === "paragraph" && block.text && block.text.length >= 80)
    .map((block) => block.text as string)
    .filter((text, index, values) => values.indexOf(text) === index && text !== article.description)
    .slice(0, 3);
  const paragraphCount = article.content_blocks.filter((block) => block.type === "paragraph").length;
  const sectionCount = article.content_blocks.filter((block) => block.type === "heading").length;
  const tickers = newsTickers(article);
  const horizonLabel = article.sentiment.horizon === "short_term" ? "Ngắn hạn" : article.sentiment.horizon === "medium_term" ? "Trung hạn" : article.sentiment.horizon === "long_term" ? "Dài hạn" : null;

  return (
    <main id="main-content" className="article-page">
      <nav className="breadcrumbs" aria-label="Đường dẫn"><Link href="/news">Tin tức</Link><span>/</span><span>{article.category ?? "Mới nhất"}</span></nav>
      <header className="article-header">
        <p className="eyebrow">{article.source.name}{article.category ? ` · ${article.category}` : ""}</p>
        <h1>{article.title}</h1>
        {article.description && <p className="article-lead">{article.description}</p>}
        <div className="article-byline">
          {article.authors.length > 0 && <span>{article.authors.join(", ")}</span>}
          <time dateTime={article.published_at ?? article.first_seen_at}>{article.published_at ? `Đăng ${formatNewsTime(article.published_at)}` : `Ghi nhận ${formatNewsTime(article.first_seen_at)}`}</time>
          {article.updated_at && <time dateTime={article.updated_at}>Cập nhật {formatNewsTime(article.updated_at)}</time>}
          <span>{article.reading_time_minutes} phút đọc</span>
        </div>
        <div className="article-actions">
          <div className="news-tags">{tickers.slice(0, 5).map((item) => item.href ? <Link className="symbol-chip" href={item.href} key={item.key}>{item.label}</Link> : <span className="symbol-chip source-symbol" title="Mã được nguồn bài viết nhắc đến" key={item.key}>{item.label}</span>)}{tickers.length > 5 && <span className="symbol-chip">+{tickers.length - 5}</span>}</div>
          <a className="source-button" href={article.url} target="_blank" rel="noopener noreferrer">Đọc tại {article.source.name} ↗</a>
        </div>
      </header>

      <div className="article-layout">
        <article className="article-content">
          {article.content_access !== "full_text" && <div className="content-notice">Nguồn này chỉ cung cấp thông tin tóm tắt tại InvestIQ. Chọn “Đọc tại nguồn” để xem đầy đủ.</div>}
          {article.extraction_status !== "complete" && <div className="content-notice warning">Bài viết được thu thập một phần; một số nội dung hoặc hình ảnh có thể còn thiếu.</div>}
          {(article.description || keyExcerpts.length > 0) && (
            <section className="article-overview" aria-labelledby="article-overview-title">
              <div className="article-overview-heading">
                <div><p className="eyebrow">Đọc nhanh</p><h2 id="article-overview-title">Các ý chính từ bài viết</h2></div>
                <div className="article-stats" aria-label="Thống kê nội dung">
                  <span>{paragraphCount} đoạn</span><span>{sectionCount} mục</span><span>{article.images.length} ảnh</span>
                </div>
              </div>
              {article.description && <p className="article-overview-lead">{article.description}</p>}
              {keyExcerpts.length > 0 && <ul className="article-excerpts">{keyExcerpts.map((excerpt) => <li key={excerpt}>{excerpt}</li>)}</ul>}
            </section>
          )}
          <div className="article-body-heading"><p className="eyebrow">Bài viết</p><h2>Nội dung đầy đủ</h2></div>
          {article.content_blocks.map((block) => {
            if (block.type === "heading") return block.level === 3 ? <h3 key={block.id}>{block.text}</h3> : <h2 key={block.id}>{block.text}</h2>;
            if (block.type === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
            if (block.type === "list") return <ul key={block.id}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
            if (block.type === "table") return <div className="article-table-wrap" key={block.id}><table><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
            if (block.type === "image" && block.url) {
              const asset = assets.get(block.url);
              return asset ? <figure key={block.id}><img src={asset.url} alt={asset.alt ?? ""} />{(asset.caption || asset.credit) && <figcaption>{asset.caption}{asset.credit ? ` — ${asset.credit}` : ""}</figcaption>}</figure> : null;
            }
            return <p key={block.id}>{block.text}</p>;
          })}
          {article.content_blocks.length === 0 && article.description && <p>{article.description}</p>}
          {article.attachments.length > 0 && <section className="attachments"><h2>Tài liệu đính kèm</h2>{article.attachments.map((asset) => <a href={asset.url} target="_blank" rel="noopener noreferrer" key={asset.id}>{asset.caption ?? "Mở tài liệu"} ↗</a>)}</section>}
          <footer className="article-footer"><span>Nguồn: <a href={article.url} target="_blank" rel="noopener noreferrer">{article.source.name}</a></span>{article.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</footer>
        </article>

        <aside className="analysis-panel">
          <p className="eyebrow">Đánh giá nội dung tự động</p>
          <div className="analysis-title"><SentimentBadge sentiment={article.sentiment} />{article.sentiment.score !== null && <span className="analysis-score">Điểm sắc thái <strong>{article.sentiment.score > 0 ? "+" : ""}{article.sentiment.score.toFixed(2)}</strong></span>}</div>
          <section className="analysis-section"><h2>Nhận định</h2><p>{article.sentiment.rationale ?? "Hệ thống đang phân tích nội dung bài viết."}</p></section>
          {article.sentiment.market_impact && <section className="market-impact"><div><p className="eyebrow">Ảnh hưởng đến thị trường chứng khoán</p>{horizonLabel && <span>{horizonLabel}</span>}</div><p>{article.sentiment.market_impact}</p>{article.sentiment.impact_scope && <small>Phạm vi: {article.sentiment.impact_scope}</small>}</section>}
          {tickers.length > 0 && <div className="analysis-tickers"><strong>Mã được nhắc đến</strong><div>{tickers.slice(0, 3).map((item) => <span className="symbol-chip" key={item.key}>{item.label}</span>)}{tickers.length > 3 && <span className="symbol-chip ticker-overflow">+{tickers.length - 3}</span>}</div></div>}
          {article.sentiment.evidence.length > 0 && <div className="evidence"><strong>Cơ sở nhận định</strong>{article.sentiment.evidence.map((item) => <span key={item}>“{item}”</span>)}</div>}
          <small>Đây là sắc thái của văn bản, không phải dự báo giá hay khuyến nghị đầu tư.</small>
          {article.symbols.length > 0 && <div className="symbol-analysis"><h2>Theo từng mã</h2>{article.symbols.map((item) => <div key={item.security_id}><strong>{item.symbol} · {item.exchange}</strong>{item.sentiment ? <SentimentBadge sentiment={item.sentiment} /> : <span className="muted-copy">Chưa phân tích</span>}</div>)}</div>}
        </aside>
      </div>
    </main>
  );
}
