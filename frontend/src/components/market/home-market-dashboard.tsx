import Link from "next/link";

import { formatChange, formatCompact, formatEventDate, formatMoney, formatPercent, changeTone } from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { MiniCandles } from "@/components/market/mini-candles";
import type { MarketOverview } from "@/types/market";

function SectionHeading({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <div className="market-section-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      <Link className="market-section-link" href={href} aria-label={label}>Xem chi tiết <span aria-hidden="true">↗</span></Link>
    </div>
  );
}

export function HomeMarketDashboard({ overview }: { overview: MarketOverview }) {
  const symbols = [
    ...overview.data.indices.map((item) => item.symbol),
    ...overview.data.trending.slice(0, 6).map((item) => item.symbol),
  ];
  const totalBreadth = overview.data.breadth.advances + overview.data.breadth.declines + overview.data.breadth.unchanged || 1;
  return (
    <main id="main-content" className="market-home">
      <header className="market-hero">
        <div>
          <p className="eyebrow">TOÀN CẢNH THỊ TRƯỜNG</p>
          <h1>Nhìn thị trường rõ hơn,<br />theo dõi điều đáng chú ý.</h1>
          <p>Chỉ số, thanh khoản, mã đang được quan tâm và sự kiện sắp tới trong một màn hình.</p>
        </div>
        <Link className="market-primary-link" href="/market?tab=stocks">Mở Trung tâm thị trường <span aria-hidden="true">→</span></Link>
      </header>
      <MarketStatus meta={overview.meta} symbols={symbols} />

      <section className="market-home-section" aria-labelledby="indices-title">
        <SectionHeading title="Chỉ số thị trường" description="Diễn biến các thước đo chính của thị trường Việt Nam." href="/market?tab=indices" label="Xem toàn bộ chỉ số" />
        <div className="index-card-grid">
          {overview.data.indices.map((item) => <article className="index-card" key={item.symbol}>
            <div className="index-card-top"><div><span>{item.symbol}</span><h3 id={item.symbol === "VNINDEX" ? "indices-title" : undefined}>{item.name}</h3></div><Link href={`/market?tab=indices&symbol=${item.symbol}`} aria-label={`Xem ${item.name}`}>↗</Link></div>
            <div className="index-value-row"><strong>{formatChange(item.value)}</strong><span className={changeTone(item.change_percent)}>{formatChange(item.change)} · {formatPercent(item.change_percent)}</span></div>
            <MiniCandles candles={item.candles} label={`Biểu đồ nến ngày của ${item.name}`} />
            <dl className="index-card-stats"><div><dt>GTGD</dt><dd>{formatMoney(item.matched_value)}</dd></div><div><dt>Độ rộng</dt><dd><span className="positive">{item.advances}</span> / <span className="negative">{item.declines}</span></dd></div></dl>
          </article>)}
        </div>
      </section>

      <div className="market-home-columns">
        <section className="market-panel trending-panel" aria-labelledby="trending-title">
          <SectionHeading title="Cổ phiếu đang được quan tâm" description="Kết hợp quan tâm trên InvestIQ và độ sôi động thị trường." href="/market?tab=stocks&sort=trending&direction=desc" label="Xem các cổ phiếu đang được quan tâm" />
          <div className="trending-list">
            {overview.data.trending.slice(0, 6).map((item, index) => <article className="trending-row" key={item.symbol}>
              <span className="trend-rank">{String(index + 1).padStart(2, "0")}</span>
              <div className="trend-company"><Link href={`/market?tab=stocks&q=${item.symbol}`}><strong>{item.symbol}</strong></Link><span>{item.name}</span></div>
              <div className="trend-reasons">{item.interest_reasons.slice(0, 2).map((reason) => <span key={reason}>{reason}</span>)}</div>
              <div className="trend-volume"><span>KL {formatCompact(item.volume)}</span><small>{item.volume_vs_20d}× TB20</small></div>
              <div className="trend-price"><strong>{formatChange(item.price)}</strong><span className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</span></div>
            </article>)}
          </div>
        </section>

        <aside className="market-home-aside">
          <section className="market-panel breadth-panel" aria-labelledby="breadth-title">
            <SectionHeading title="Độ rộng & thanh khoản" description="Tổng hợp bốn chỉ số đang hiển thị." href="/market?tab=indices&view=breadth" label="Xem chi tiết độ rộng thị trường" />
            <h3 id="breadth-title" className="sr-only">Độ rộng và thanh khoản</h3>
            <div className="breadth-total"><strong>{formatMoney(overview.data.breadth.matched_value)}</strong><span>Giá trị giao dịch minh họa</span></div>
            <div className="breadth-bar" aria-label={`${overview.data.breadth.advances} mã tăng, ${overview.data.breadth.declines} mã giảm, ${overview.data.breadth.unchanged} mã đứng giá`}><span className="advance" style={{ width: `${overview.data.breadth.advances / totalBreadth * 100}%` }} /><span className="unchanged" style={{ width: `${overview.data.breadth.unchanged / totalBreadth * 100}%` }} /><span className="decline" style={{ width: `${overview.data.breadth.declines / totalBreadth * 100}%` }} /></div>
            <dl className="breadth-legend"><div><dt>Tăng</dt><dd className="positive">{overview.data.breadth.advances}</dd></div><div><dt>Đứng giá</dt><dd>{overview.data.breadth.unchanged}</dd></div><div><dt>Giảm</dt><dd className="negative">{overview.data.breadth.declines}</dd></div><div><dt>Trần / Sàn</dt><dd>{overview.data.breadth.ceiling_count} / {overview.data.breadth.floor_count}</dd></div></dl>
          </section>

          <section className="market-panel event-preview" aria-labelledby="events-title">
            <SectionHeading title="Sự kiện sắp tới" description="Các mốc dự kiến cần theo dõi." href="/market?tab=events" label="Mở lịch sự kiện" />
            <h3 id="events-title" className="sr-only">Sự kiện sắp tới</h3>
            <div>{overview.data.upcoming_events.map((event) => <article key={event.id}><time dateTime={event.event_at}>{formatEventDate(event.event_at)}</time><div><strong>{event.symbol}</strong><p>{event.title}</p></div><span>{event.status === "expected" ? "Dự kiến" : "Chính thức"}</span></article>)}</div>
          </section>
        </aside>
      </div>
      <p className="market-fixture-note">Dữ liệu hiện tại là fixture phát triển cố định, chỉ dùng để hoàn thiện giao diện và luồng hệ thống. Không dùng cho quyết định đầu tư.</p>
    </main>
  );
}

