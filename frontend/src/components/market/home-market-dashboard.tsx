"use client";

import Link from "next/link";

import { InfoTip, MarketColorLegend, MarketLineChart, SectorHeatmap, SentimentGauge } from "@/components/market/beginner-market-ui";
import { changeTone, formatChange, formatDecimal, formatEventDate, formatMarketTime, formatMoney, formatPercent } from "@/components/market/formatters";
import { mergeLiveIndex, mergeLiveInstrument } from "@/components/market/live-market";
import { MarketStatus } from "@/components/market/market-status";
import { MarketStreamProvider, useMarketStreamState } from "@/hooks/use-realtime-price";
import type { NewsSummary } from "@/lib/api-client";
import type { MarketEvent, MarketIndex, MarketInstrument, MarketMeta, MarketOverview, MarketSector } from "@/types/market";

function marketConclusion(index: MarketIndex | undefined, advances: number, declines: number) {
  const total = advances + declines;
  const declineRate = total ? declines / total : 0.5;
  if ((index && Number(index.change_percent) < -0.5) || declineRate >= 0.6) {
    return { emoji: "😟", title: "Thị trường đang thận trọng", detail: `${Math.round(declineRate * 100)}% số mã có biến động đang giảm.` };
  }
  if ((index && Number(index.change_percent) > 0.5) || declineRate <= 0.4) {
    return { emoji: "😀", title: "Thị trường đang nghiêng về tích cực", detail: `${Math.round((1 - declineRate) * 100)}% số mã có biến động đang tăng.` };
  }
  return { emoji: "😐", title: "Thị trường đang giằng co", detail: "Số mã tăng và giảm chưa tạo ra chênh lệch rõ ràng." };
}

function liquidityComparison(index: MarketIndex | undefined) {
  const volumes = (index?.candles ?? []).map((item) => Number(item.volume)).filter((item) => item > 0);
  if (volumes.length < 3) return null;
  const current = volumes.at(-1)!;
  const history = volumes.slice(Math.max(0, volumes.length - 21), -1);
  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  return average ? ((current / average) - 1) * 100 : null;
}

function plainNewsImpact(item: NewsSummary) {
  if (item.sentiment.market_impact) return item.sentiment.market_impact;
  if (item.mentioned_symbols.length) return `Tin có nhắc tới ${item.mentioned_symbols.slice(0, 3).join(", ")}; cần đọc nguồn gốc trước khi đánh giá tác động.`;
  return "Chưa có đủ dữ liệu để xác nhận nhóm cổ phiếu chịu tác động trực tiếp.";
}

export function DailyFeaturedNews({ news }: { news: NewsSummary[] }) {
  return <section className="beginner-news" aria-labelledby="news-title">
    <div className="beginner-heading"><div><p className="eyebrow">TIN TỪ CƠ SỞ DỮ LIỆU INVESTIQ</p><h2 id="news-title">Tin nổi bật trong ngày</h2><p>Các bài mới nhất trong 24 giờ, ưu tiên bài mới cập nhật.</p></div><Link href="/news">Xem tất cả tin →</Link></div>
    {news.length ? <div className="plain-news-grid">{news.map((item, index) => <article className={index === 0 ? "featured" : undefined} key={item.id}><div className="plain-news-meta"><span>{index === 0 ? "Nổi bật · " : ""}{item.source.name}</span><time dateTime={item.published_at ?? item.feed_at}>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(item.published_at ?? item.feed_at))}</time></div><h3><Link href={`/news/${item.id}`}>{item.title}</Link></h3><dl><div><dt>Chuyện gì xảy ra?</dt><dd>{item.description ?? "Mở bài viết để xem thông tin gốc."}</dd></div><div><dt>Ảnh hưởng gì?</dt><dd>{plainNewsImpact(item)}</dd></div><div><dt>Người mới nên hiểu gì?</dt><dd>Một tin riêng lẻ chưa đủ để mua hoặc bán. Hãy kiểm tra nguồn, thời điểm và rủi ro trước.</dd></div></dl></article>)}</div> : <div className="market-empty"><h3>Chưa có tin trong 24 giờ qua</h3><p>Khối này chỉ dùng bài đã lưu trong cơ sở dữ liệu; InvestIQ không tạo tin giả để lấp chỗ trống.</p></div>}
  </section>;
}

export function MarketSnapshotRibbon({ indices }: { indices: MarketIndex[] }) {
  return (
    <section className="home-index-ribbon" aria-labelledby="home-index-ribbon-title">
      <div className="home-index-ribbon-heading">
        <div><p className="eyebrow">SNAPSHOT CÁC SÀN</p><h2 id="home-index-ribbon-title">Chỉ số ngay lúc này</h2></div>
        <Link href="/market/indices">Mở chi tiết chỉ số →</Link>
      </div>
      {indices.length ? <div className="home-index-ribbon-grid">{indices.map((index) => (
        <Link className={changeTone(index.change_percent)} href={`/market/indices?symbol=${encodeURIComponent(index.symbol)}`} key={index.symbol}>
          <span>{index.name}<small>{index.symbol}</small></span>
          <strong>{formatDecimal(index.value)}</strong>
          <em>{formatChange(index.change)} · {formatPercent(index.change_percent)}</em>
          <small><b>{index.advances}</b> tăng · <b>{index.declines}</b> giảm</small>
        </Link>
      ))}</div> : <div className="market-empty compact"><p>Nguồn hiện tại chưa cung cấp snapshot chỉ số.</p></div>}
    </section>
  );
}

function StockPulseColumn({
  title,
  description,
  items,
  metric,
}: {
  title: string;
  description: string;
  items: MarketInstrument[];
  metric: "change" | "liquidity";
}) {
  return (
    <article className="home-stock-pulse-column">
      <header><div><h3>{title}</h3><p>{description}</p></div><span>{items.length} mã</span></header>
      {items.length ? <ol>{items.map((item, index) => (
        <li key={item.symbol}>
          <span className="home-stock-rank">{index + 1}</span>
          <Link href={`/market/stocks/${item.symbol}?from=${encodeURIComponent("/#home-stock-pulse")}`} prefetch={false}><strong>{item.symbol}</strong><small>{item.name}</small></Link>
          <span className="home-stock-price"><strong>{formatDecimal(item.price)}</strong><small className={changeTone(item.change_percent)}>{metric === "liquidity" ? formatMoney(item.matched_value) : formatPercent(item.change_percent)}</small></span>
        </li>
      ))}</ol> : <div className="market-empty compact"><p>Chưa có mã phù hợp trong snapshot.</p></div>}
    </article>
  );
}

export function HomeStockPulse({ instruments, meta }: { instruments: MarketInstrument[]; meta: MarketMeta }) {
  const gainers = [...instruments].filter((item) => Number(item.change_percent) > 0).sort((left, right) => Number(right.change_percent) - Number(left.change_percent)).slice(0, 4);
  const decliners = [...instruments].filter((item) => Number(item.change_percent) < 0).sort((left, right) => Number(left.change_percent) - Number(right.change_percent)).slice(0, 4);
  const liquid = [...instruments].sort((left, right) => Number(right.matched_value) - Number(left.matched_value)).slice(0, 4);
  return (
    <section id="home-stock-pulse" className="home-stock-pulse" aria-labelledby="home-stock-pulse-title">
      <div className="beginner-heading"><div><p className="eyebrow">BẢNG QUAN SÁT NHANH</p><h2 id="home-stock-pulse-title">Mã nào đang đáng chú ý?</h2><p>Xếp hạng trong {instruments.length} mã nổi bật do snapshot trang chủ cung cấp, không phải toàn bộ thị trường.</p></div><Link href="/market/stocks">Mở bảng giá đầy đủ →</Link></div>
      <div className="home-stock-pulse-grid">
        <StockPulseColumn title="Tăng nổi bật" description="Biến động dương lớn nhất" items={gainers} metric="change" />
        <StockPulseColumn title="Giảm đáng chú ý" description="Ưu tiên kiểm tra nguyên nhân" items={decliners} metric="change" />
        <StockPulseColumn title="Giao dịch sôi động" description="Xếp theo giá trị khớp" items={liquid} metric="liquidity" />
      </div>
      <p className="home-section-source">Quan sát lúc {formatMarketTime(meta.market_time)} · Nguồn {meta.provider_name} · {meta.partial ? "Phạm vi dữ liệu một phần" : "Phạm vi snapshot hiện có"}. Thứ hạng không phải khuyến nghị mua bán.</p>
    </section>
  );
}

const eventTypeLabels: Record<string, string> = {
  shareholder_meeting: "Đại hội cổ đông",
  cash_dividend: "Cổ tức tiền",
  stock_dividend: "Cổ tức cổ phiếu",
  earnings: "Kết quả kinh doanh",
  additional_listing: "Niêm yết bổ sung",
  insider_trading: "Giao dịch nội bộ",
  share_issuance: "Phát hành cổ phiếu",
  corporate_action: "Sự kiện doanh nghiệp",
};

const eventDateLabels: Record<string, string> = {
  announcement: "Ngày công bố",
  record_date: "Ngày đăng ký cuối cùng",
  ex_right_date: "Ngày giao dịch không hưởng quyền",
  payment_date: "Ngày thanh toán",
  meeting_date: "Ngày tổ chức",
  effective_date: "Ngày hiệu lực",
  issue_date: "Ngày phát hành",
  start_date: "Ngày bắt đầu",
  end_date: "Ngày kết thúc",
  event_date: "Ngày sự kiện",
};

export function HomeUpcomingEvents({ events, meta }: { events: MarketEvent[]; meta: MarketMeta }) {
  const visibleEvents = events.filter((event) => event.status !== "cancelled").slice(0, 4);
  return (
    <section className="home-event-timeline" aria-labelledby="home-events-title">
      <div className="beginner-heading"><div><p className="eyebrow">LỊCH CẦN NHỚ</p><h2 id="home-events-title">Sự kiện doanh nghiệp sắp tới</h2><p>30 ngày tới trong nhóm mã nổi bật; phân biệt rõ ngày dự kiến và ngày chính thức.</p></div><Link href="/market/events">Xem lịch 30 ngày →</Link></div>
      {visibleEvents.length ? <div className="home-event-grid">{visibleEvents.map((event) => (
        <article key={event.id}>
          <time dateTime={event.event_at}><strong>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit" }).format(new Date(event.event_at))}</strong><span>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", month: "2-digit", year: "numeric" }).format(new Date(event.event_at))}</span></time>
          <div className="home-event-copy">
            <div><Link href={`/market/events?symbol=${encodeURIComponent(event.symbol)}`} className="home-event-symbol">{event.symbol}</Link><span className={`event-status ${event.status}`}>{event.status === "official" ? "Chính thức" : "Dự kiến"}</span></div>
            <span>{eventTypeLabels[event.event_type] ?? event.event_type} · {eventDateLabels[event.date_type] ?? event.date_type}</span>
            <h3><Link href={`/market/events?symbol=${encodeURIComponent(event.symbol)}`}>{event.title}</Link></h3>
            <p>{event.summary}</p>
            <small>{event.source_url ? <a href={event.source_url} target="_blank" rel="noreferrer">Nguồn: {event.source_name} ↗</a> : `Nguồn: ${event.source_name}`} · {formatEventDate(event.event_at)}</small>
          </div>
        </article>
      ))}</div> : <div className="market-empty"><h3>Chưa có lịch sự kiện được nguồn cung cấp</h3><p>{meta.partial ? `${meta.provider_name} đang trả dữ liệu thị trường một phần và chưa có sự kiện trong payload này.` : "Không có sự kiện phù hợp trong cửa sổ sắp tới; InvestIQ không tạo mốc giả để lấp chỗ trống."}</p><Link className="market-primary-link" href="/market/events">Kiểm tra trang sự kiện</Link></div>}
    </section>
  );
}

function BeginnerDecisionGuide() {
  return (
    <section className="home-decision-guide" aria-labelledby="home-decision-title">
      <div className="home-decision-intro"><p className="eyebrow">TRƯỚC KHI MUA MỘT MÃ</p><h2 id="home-decision-title">Ba câu hỏi giúp người mới tránh quyết định vội</h2><p>InvestIQ đưa bạn từ bức tranh chung đến dữ liệu của doanh nghiệp, rồi mới tới thực hành phân bổ vốn.</p><Link className="market-primary-link" href="/portfolio">Mở danh mục mô phỏng →</Link></div>
      <ol>
        <li><span>01</span><div><strong>Thị trường chung đang ra sao?</strong><p>Đọc chỉ số, độ rộng và thanh khoản. Một chỉ số tăng chưa chắc phần lớn cổ phiếu cùng tăng.</p><Link href="/market/indices">Kiểm tra các chỉ số</Link></div></li>
        <li><span>02</span><div><strong>Điều gì đang tác động đến doanh nghiệp?</strong><p>Đọc tin gốc, thời điểm công bố và sự kiện; không quyết định chỉ từ một tiêu đề tích cực.</p><Link href="/news">Đối chiếu tin và nguồn</Link></div></li>
        <li><span>03</span><div><strong>Nếu sai, bạn chịu được bao nhiêu?</strong><p>Thử với số lượng nhỏ trong tài khoản mô phỏng và theo dõi tỷ trọng thay vì đặt cược toàn bộ.</p><Link href="/portfolio">Thực hành không dùng tiền thật</Link></div></li>
      </ol>
    </section>
  );
}

function HomeToolDirectory() {
  const tools = [
    { href: "/market/stocks", icon: "⌁", title: "Lọc cổ phiếu", detail: "Tìm theo biến động, thanh khoản, vốn hóa và VN30." },
    { href: "/market/watchlist", icon: "☆", title: "Watchlist riêng", detail: "Gom các mã cần theo dõi mà chưa cần mua." },
    { href: "/portfolio", icon: "◫", title: "Danh mục mô phỏng", detail: "Thực hành mua bán và xem lãi/lỗ với tiền giả định." },
    { href: "/market/events", icon: "◷", title: "Lịch doanh nghiệp", detail: "Theo dõi cổ tức, đại hội và kết quả kinh doanh." },
  ];
  return <section className="home-tool-directory" aria-labelledby="home-tools-title"><div className="beginner-heading"><div><p className="eyebrow">KHÁM PHÁ INVESTIQ</p><h2 id="home-tools-title">Chọn công cụ theo việc bạn cần làm</h2><p>Mỗi lối đi mở đúng màn hình và giữ nguyên nhãn nguồn, độ trễ của dữ liệu.</p></div></div><div>{tools.map((tool) => <Link aria-label={tool.title} href={tool.href} key={tool.href}><span aria-hidden="true">{tool.icon}</span><strong>{tool.title}</strong><p>{tool.detail}</p><em>Mở công cụ →</em></Link>)}</div></section>;
}

export function HomeMarketDashboard({ overview, sectors, news }: { overview: MarketOverview; sectors: MarketSector[]; news: NewsSummary[] }) {
  const symbols = [
    ...overview.data.indices.map((item) => item.symbol),
    ...overview.data.trending.slice(0, 6).map((item) => item.symbol),
  ];
  return <MarketStreamProvider symbols={symbols}><HomeMarketContent overview={overview} sectors={sectors} news={news} /></MarketStreamProvider>;
}

function HomeMarketContent({ overview, sectors, news }: { overview: MarketOverview; sectors: MarketSector[]; news: NewsSummary[] }) {
  const stream = useMarketStreamState();
  const indices = overview.data.indices.map((item) => mergeLiveIndex(item, stream.items[item.symbol]));
  const instruments = overview.data.trending.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const primary = indices.find((item) => item.symbol === "VNINDEX") ?? indices[0];
  const breadthIndices = indices.filter((item) => ["VNINDEX", "HNXINDEX", "UPCOMINDEX"].includes(item.symbol));
  const breadth = breadthIndices.reduce((value, item) => ({
    advances: value.advances + item.advances,
    declines: value.declines + item.declines,
    unchanged: value.unchanged + item.unchanged,
  }), { advances: 0, declines: 0, unchanged: 0 });
  const breadthTotal = breadth.advances + breadth.declines + breadth.unchanged || 1;
  const conclusion = marketConclusion(primary, breadth.advances, breadth.declines);
  const sentiment = 50 + (breadth.advances - breadth.declines) / breadthTotal * 38 + Number(primary?.change_percent ?? 0) * 3;
  const liquidity = liquidityComparison(primary);
  const foreignNet = instruments.reduce((sum, item) => sum + Number(item.foreign_net_value), 0);
  const strongestSector = [...sectors].sort((left, right) => Math.abs(Number(right.change_percent)) - Math.abs(Number(left.change_percent)))[0];
  const nextEvent = overview.data.upcoming_events[0];
  const newestArticle = news[0];

  return (
    <main id="main-content" className="market-home beginner-home">
      <MarketColorLegend />
      <MarketSnapshotRibbon indices={indices} />
      <MarketStatus meta={overview.meta} />
      <section className="beginner-hero" aria-labelledby="today-market-title">
        <div className="beginner-hero-copy">
          <p className="eyebrow">HÔM NAY THỊ TRƯỜNG THẾ NÀO?</p>
          <h1 id="today-market-title"><span aria-hidden="true">{conclusion.emoji}</span> {conclusion.title}</h1>
          <p>{conclusion.detail} Số liệu được trình bày để bạn hiểu nhanh trước khi đi sâu.</p>
          {primary && <div className="hero-index-value"><span>VN-Index</span><strong>{Number(primary.value).toLocaleString("vi-VN")}</strong><em className={changeTone(primary.change_percent)}>{formatPercent(primary.change_percent)}</em></div>}
          <SentimentGauge score={sentiment} />
        </div>
        <div className="beginner-hero-chart">
          <div className="beginner-card-title"><span>Đường giá VN-Index</span><InfoTip term="VN-Index">Chỉ số đại diện biến động của cổ phiếu niêm yết trên HOSE. Chỉ số tăng không có nghĩa mọi cổ phiếu đều tăng.</InfoTip></div>
          <MarketLineChart candles={primary?.candles ?? []} label="Đường giá VN-Index" />
          <Link href="/market/stocks">Xem toàn cảnh thị trường →</Link>
        </div>
      </section>

      <section className="today-focus" aria-labelledby="today-focus-title">
        <div className="beginner-heading"><div><p className="eyebrow">ĐIỂM CẦN CHÚ Ý</p><h2 id="today-focus-title">Nên xem gì tiếp theo?</h2><p>Ba lối đi được tạo từ dữ liệu đang hiển thị, không suy diễn nguyên nhân biến động.</p></div></div>
        <div className="today-focus-grid">
          <article><span>Độ rộng thị trường</span><h3>{breadth.declines > breadth.advances ? "Kiểm tra nhóm đang giảm" : "Kiểm tra mức lan tỏa của đà tăng"}</h3><p>{breadth.advances} mã tăng so với {breadth.declines} mã giảm trong phạm vi hiện có.</p><Link href={`/market/stocks?sort=change_percent&direction=${breadth.declines > breadth.advances ? "asc" : "desc"}`}>Mở danh sách đã sắp xếp →</Link></article>
          {strongestSector && <article><span>Ngành biến động nổi bật</span><h3>{strongestSector.name} · {formatPercent(strongestSector.change_percent)}</h3><p>Biến động tổng hợp từ {strongestSector.member_count} mã; mở ngành để kiểm tra cổ phiếu dẫn dắt.</p><Link href={`/market/stocks?sector=${encodeURIComponent(strongestSector.name)}#stock-table`}>Xem ngành {strongestSector.name} →</Link></article>}
          <article><span>{nextEvent ? "Sự kiện gần nhất" : newestArticle ? "Tin mới nhất" : "Lịch và tin tức"}</span>{nextEvent ? <><h3>{nextEvent.symbol} · {nextEvent.title}</h3><p>{nextEvent.summary}</p><Link href={`/market/events?symbol=${encodeURIComponent(nextEvent.symbol)}`}>Mở lịch sự kiện →</Link></> : newestArticle ? <><h3>{newestArticle.title}</h3><p>{newestArticle.mentioned_symbols.length ? `Có nhắc tới ${newestArticle.mentioned_symbols.slice(0, 3).join(", ")}.` : "Đọc nguồn gốc trước khi đánh giá tác động."}</p><Link href={`/news/${newestArticle.id}`}>Đọc tin và nguồn →</Link></> : <><h3>Chưa có mục mới được xác minh</h3><p>InvestIQ không tạo sự kiện hoặc tin giả để lấp chỗ trống.</p><Link href="/market/events">Kiểm tra lịch sự kiện →</Link></>}</article>
        </div>
      </section>

      <section className="beginner-section" aria-labelledby="one-minute-title">
        <div className="beginner-heading"><div><p className="eyebrow">THỊ TRƯỜNG TRONG 1 PHÚT</p><h2 id="one-minute-title">Ba điều nên biết trước tiên</h2></div></div>
        <div className="one-minute-grid">
          <article><div className="beginner-card-title"><h3>Tăng hay giảm?</h3><InfoTip term="Độ rộng thị trường">So sánh số cổ phiếu tăng, giảm và đứng giá. Nó cho biết mức tăng có lan tỏa hay chỉ do vài mã lớn kéo chỉ số.</InfoTip></div><strong>{breadth.advances > breadth.declines ? "Sắc xanh đang chiếm ưu thế" : breadth.advances < breadth.declines ? "Sắc đỏ đang chiếm ưu thế" : "Thị trường khá cân bằng"}</strong><div className="beginner-breadth"><span className="advance" style={{ width: `${breadth.advances / breadthTotal * 100}%` }} /><span className="unchanged" style={{ width: `${breadth.unchanged / breadthTotal * 100}%` }} /><span className="decline" style={{ width: `${breadth.declines / breadthTotal * 100}%` }} /></div><p><b className="positive">{breadth.advances} tăng</b> · {breadth.unchanged} đứng giá · <b className="negative">{breadth.declines} giảm</b></p></article>
          <article><div className="beginner-card-title"><h3>Tiền vào hay ra?</h3><InfoTip term="Thanh khoản">Lượng cổ phiếu và tiền được giao dịch. Thanh khoản cao cho thấy mua bán sôi động, không tự động đồng nghĩa giá sẽ tăng.</InfoTip></div><strong>{liquidity === null ? "Chưa đủ 20 phiên để so sánh" : `${liquidity >= 0 ? "Cao hơn" : "Thấp hơn"} bình thường ${Math.abs(liquidity).toFixed(0)}%`}</strong><p>So với trung bình tối đa 20 điểm dữ liệu gần nhất của VN-Index.</p></article>
          <article><div className="beginner-card-title"><h3>Khối ngoại trong nhóm nổi bật</h3><InfoTip term="Khối ngoại">Nhà đầu tư nước ngoài mua và bán cổ phiếu. Mua ròng nghĩa là giá trị mua lớn hơn giá trị bán.</InfoTip></div><strong className={changeTone(String(foreignNet))}>{foreignNet >= 0 ? "Mua ròng" : "Bán ròng"} {formatMoney(String(Math.abs(foreignNet)))}</strong><p>Cộng trên {instruments.length} mã trong snapshot trang chủ, không đại diện toàn thị trường.</p></article>
        </div>
      </section>

      <HomeStockPulse instruments={instruments} meta={overview.meta} />

      <SectorHeatmap sectors={sectors} headingId="home-sector-heatmap-title" />

      <HomeUpcomingEvents events={overview.data.upcoming_events} meta={overview.meta} />

      <DailyFeaturedNews news={news} />

      <BeginnerDecisionGuide />

      <div className="beginner-two-columns">
        <section className="beginner-glossary" aria-labelledby="term-title"><p className="eyebrow">THUẬT NGỮ HÔM NAY</p><h2 id="term-title">Giá tham chiếu là gì?</h2><p>Là mốc để tính cổ phiếu đang tăng hay giảm trong ngày. Trên bảng giá Việt Nam, giá bằng tham chiếu thường có màu vàng.</p><span className="term-example">Ví dụ: tham chiếu 50.000đ, giá 51.000đ nghĩa là tăng 2%.</span></section>
        <section className="beginner-glossary home-price-check" aria-labelledby="price-check-title"><p className="eyebrow">TRƯỚC KHI ĐỌC GIÁ</p><h2 id="price-check-title">Giá này thuộc thời điểm nào?</h2><p>Luôn nhìn trạng thái phiên, thời gian cập nhật và độ trễ ở đầu trang. Giá đóng cửa gần nhất không phải giá chắc chắn có thể mua hoặc bán ở phiên tiếp theo.</p><Link href="/market/stocks">Mở bảng giá có timestamp →</Link></section>
      </div>

      <HomeToolDirectory />

      <footer className="beginner-disclaimer"><strong>Thông tin tham khảo, không phải khuyến nghị đầu tư.</strong><span>Nguồn: {overview.meta.provider_name} · trạng thái độ trễ: {overview.meta.delay_class} · cập nhật theo thời gian ghi trên dữ liệu.</span></footer>
    </main>
  );
}
