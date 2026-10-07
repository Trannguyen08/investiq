"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { changeTone, formatChange, formatCompact, formatEventDate, formatMarketTime, formatMoney, formatPercent } from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { MiniCandles } from "@/components/market/mini-candles";
import { mergeLiveIndex, mergeLiveInstrument } from "@/components/market/live-market";
import { WatchlistPanel } from "@/components/market/watchlist-panel";
import { MarketStreamProvider, useMarketStreamState } from "@/hooks/use-realtime-price";
import { marketPath, type MarketTab } from "@/lib/market-routes";
import type { EventCollection, IndexCollection, InstrumentCollection, MarketMeta, PeopleCollection } from "@/types/market";

const tabs: { value: MarketTab; label: string }[] = [
  { value: "stocks", label: "Cổ phiếu" },
  { value: "watchlist", label: "Watchlist" },
  { value: "indices", label: "Chỉ số" },
  { value: "events", label: "Sự kiện" },
  { value: "people", label: "Doanh nhân" },
];

export function MarketShell({ tab, meta, symbols, children }: { tab: MarketTab; meta: MarketMeta; symbols: string[]; children: ReactNode }) {
  return (
    <MarketStreamProvider symbols={symbols}>
      <main id="main-content" className="market-page">
        <header className="market-page-hero"><div><p className="eyebrow">INVESTIQ MARKET</p><h1>Trung tâm thị trường</h1><p>Dữ liệu giá, chỉ số, sự kiện và bối cảnh được trình bày cùng nguồn và thời điểm.</p></div></header>
        <MarketStatus meta={meta} />
        <nav className="market-tabs" aria-label="Các mục thị trường">{tabs.map((item) => <Link className={item.value === tab ? "active" : ""} aria-current={item.value === tab ? "page" : undefined} href={marketPath(item.value)} prefetch={false} key={item.value}>{item.label}</Link>)}</nav>
        {children}
        {meta.freshness === "fixture" && <p className="market-fixture-note">Toàn bộ số liệu trong màn hình này là dữ liệu minh họa phục vụ phát triển, không phải dữ liệu giao dịch hiện tại.</p>}
      </main>
    </MarketStreamProvider>
  );
}

function stockPageHref(filters: Record<string, string>, cursor: string | null) {
  const query = new URLSearchParams(filters);
  if (cursor) query.set("cursor", cursor);
  else query.delete("cursor");
  return `/market/stocks?${query.toString()}`;
}

export function StocksView({ collection, filters }: { collection: InstrumentCollection; filters: Record<string, string> }) {
  const stream = useMarketStreamState();
  const rows = collection.data.map((item) => mergeLiveInstrument(item, stream.items[item.symbol]));
  const isTcbs = collection.meta.provider === "tcbs-iflash";
  return <section className="market-tab-panel">
    <div className="market-tab-heading"><div><h2>Bảng giá cổ phiếu</h2><p>{collection.pagination.total_items} mã · 15 mã mỗi trang · VN30 hiển thị trước.</p></div><span className="table-preset">Ưu tiên VN30</span></div>
    <form className="stock-filter" action="/market/stocks">
      <label>Tìm mã hoặc công ty<input name="q" defaultValue={filters.q} placeholder="Ví dụ: FPT, Hòa Phát" /></label>
      <label>Sàn<select name="exchange" defaultValue={filters.exchange}><option value="">Tất cả sàn</option><option value="HOSE">HOSE</option><option value="HNX">HNX</option><option value="UPCOM">UPCoM</option></select></label>
      <label>Sắp xếp<select name="sort" defaultValue={filters.sort}><option value="vn30">VN30 trước</option><option value="symbol">Mã</option><option value="trending">Thanh khoản nổi bật</option><option value="change_percent">% thay đổi</option><option value="matched_value">Giá trị giao dịch</option><option value="market_cap">Vốn hóa</option></select></label>
      <label>Thứ tự<select name="direction" defaultValue={filters.direction}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
      <button type="submit">Áp dụng</button>
    </form>
    <div className="market-table-wrap"><table className="market-table stock-table">
      <thead><tr><th>Mã / Công ty</th><th>Giá</th><th>Thay đổi</th><th>Mở · Cao · Thấp</th><th>Khối lượng</th><th>GTGD</th><th>So TB20</th><th>{isTcbs ? "GT ngoại ròng ước tính" : "Khối ngoại ròng"}</th><th>Vốn hóa</th><th>P/E · P/B</th><th>Biểu đồ</th></tr></thead>
      <tbody>{rows.map((item) => <tr className={item.is_vn30 ? "vn30-row" : undefined} key={item.symbol}>
        <td className="stock-identity"><div><Link href={`/market/stocks/${item.symbol}`}>{item.symbol}</Link>{item.is_vn30 && <span className="vn30-badge">VN30</span>}</div><span>{item.name}</span><small>{item.exchange} · {item.sector}</small></td>
        <td><strong>{formatChange(item.price)}</strong><small>TC {formatChange(item.reference_price)}</small></td>
        <td className={changeTone(item.change_percent)}><strong>{formatPercent(item.change_percent)}</strong><small>{formatChange(item.change)}</small></td>
        <td>{formatChange(item.open_price)} · {formatChange(item.high_price)} · {formatChange(item.low_price)}</td>
        <td>{formatCompact(item.volume)}</td><td>{formatMoney(item.matched_value)}</td><td>{isTcbs ? "—" : `${item.volume_vs_20d}×`}</td>
        <td className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</td><td>{formatMoney(item.market_cap)}</td><td>{item.pe ?? "—"} · {item.pb ?? "—"}</td>
        <td className="table-chart"><Link href={`/market/stocks/${item.symbol}`} aria-label={`Xem biểu đồ và chi tiết ${item.symbol}`}><MiniCandles candles={item.candles} label={`Nến ngày ${item.symbol}`} /><span>Xem chi tiết →</span></Link></td>
      </tr>)}</tbody>
    </table></div>
    {!collection.data.length && <div className="market-empty"><h3>Không tìm thấy cổ phiếu</h3><p>Thử bỏ bớt bộ lọc hoặc tìm bằng mã khác.</p></div>}
    {collection.data.length > 0 && <nav className="market-pagination" aria-label="Phân trang cổ phiếu">
      {collection.pagination.previous_cursor ? <Link href={stockPageHref(filters, collection.pagination.previous_cursor)}>← Trang trước</Link> : <span />}
      <strong>Trang {collection.pagination.page} / {Math.max(1, collection.pagination.total_pages)}</strong>
      {collection.pagination.next_cursor ? <Link href={stockPageHref(filters, collection.pagination.next_cursor)}>Trang sau →</Link> : <span />}
    </nav>}
  </section>;
}

export function IndicesView({ collection, selected }: { collection: IndexCollection; selected: string }) {
  const stream = useMarketStreamState();
  const rows = collection.data.map((item) => mergeLiveIndex(item, stream.items[item.symbol]));
  const current = rows.find((item) => item.symbol === selected) ?? rows[0];
  const hasSessionOhlc = collection.meta.provider !== "tcbs-iflash";
  return <section className="market-tab-panel"><div className="market-tab-heading"><div><h2>Chỉ số thị trường</h2><p>Giá trị, độ rộng và thanh khoản theo từng chỉ số.</p></div></div><div className="market-index-selector">{rows.map((item) => <Link className={`${item.symbol === current?.symbol ? "active" : ""} index-${changeTone(item.change_percent)}`} href={`/market/indices?symbol=${item.symbol}`} key={item.symbol}><span>{item.name}</span><strong className={changeTone(item.change_percent)}>{formatChange(item.value)}</strong><small className={changeTone(item.change_percent)}>{formatPercent(item.change_percent)}</small></Link>)}</div>{current && <article className="index-detail"><div className="index-detail-heading"><div><p className="eyebrow">{current.symbol}</p><h2>{current.name}</h2><strong className={changeTone(current.change_percent)}>{formatChange(current.value)}</strong><span className={changeTone(current.change_percent)}>{formatChange(current.change)} · {formatPercent(current.change_percent)}</span></div><MiniCandles candles={current.candles} label={`Biểu đồ nến ${current.name}`} /></div><dl className="index-detail-stats"><div><dt>Mở cửa</dt><dd>{hasSessionOhlc ? formatChange(current.open_value) : "—"}</dd></div><div><dt>Cao nhất</dt><dd>{hasSessionOhlc ? formatChange(current.high_value) : "—"}</dd></div><div><dt>Thấp nhất</dt><dd>{hasSessionOhlc ? formatChange(current.low_value) : "—"}</dd></div><div><dt>Khối lượng</dt><dd>{formatCompact(current.volume)}</dd></div><div><dt>Giá trị GD</dt><dd>{formatMoney(current.matched_value)}</dd></div><div><dt>Tăng / Giảm / Đứng</dt><dd><span className="positive">{current.advances}</span> / <span className="negative">{current.declines}</span> / {current.unchanged}</dd></div></dl></article>}</section>;
}

export function EventsView({ collection, filters }: { collection: EventCollection; filters: { symbol: string; eventType: string } }) {
  const groups = new Map<string, typeof collection.data>();
  for (const event of collection.data) { const key = formatEventDate(event.event_at); groups.set(key, [...(groups.get(key) ?? []), event]); }
  const labels: Record<string, string> = { shareholder_meeting: "Đại hội cổ đông", cash_dividend: "Cổ tức tiền", stock_dividend: "Cổ tức cổ phiếu", earnings: "Kết quả kinh doanh", additional_listing: "Niêm yết bổ sung" };
  const emptyTitle = collection.meta.partial ? "Nguồn hiện tại chưa cung cấp lịch sự kiện" : "Không có sự kiện phù hợp";
  const emptyCopy = collection.meta.partial ? "TCBS iFlash đang cấp dữ liệu giá và chỉ số; lịch sự kiện chưa có trong tích hợp này." : "Thử bỏ mã hoặc chọn loại sự kiện khác.";
  return <section className="market-tab-panel"><div className="market-tab-heading"><div><h2>Lịch sự kiện</h2><p>Các mốc sắp tới, nhóm theo ngày thị trường Việt Nam.</p></div><span className="table-preset">30 ngày tới</span></div><form className="event-filter" action="/market/events"><label>Mã chứng khoán<input name="symbol" defaultValue={filters.symbol} maxLength={24} placeholder="Ví dụ: FPT" /></label><label>Loại sự kiện<select name="event_type" defaultValue={filters.eventType}><option value="">Tất cả sự kiện</option><option value="shareholder_meeting">Đại hội cổ đông</option><option value="cash_dividend">Cổ tức tiền</option><option value="stock_dividend">Cổ tức cổ phiếu</option><option value="earnings">Kết quả kinh doanh</option><option value="additional_listing">Niêm yết bổ sung</option></select></label><button type="submit">Lọc sự kiện</button></form>{groups.size ? <div className="event-groups">{[...groups].map(([date, events]) => <section key={date}><h3>{date}</h3><div>{events.map((event) => <article key={event.id}><time dateTime={event.event_at}>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(event.event_at))}</time><div className="event-symbol"><strong>{event.symbol}</strong><span>{labels[event.event_type] ?? event.event_type}</span></div><div className="event-copy"><h4>{event.title}</h4><p>{event.summary}</p><small>{event.source_name} · cập nhật {formatMarketTime(collection.meta.market_time)}</small></div><span className={`event-status ${event.status}`}>{event.status === "expected" ? "Dự kiến" : event.status === "official" ? "Chính thức" : "Đã hủy"}</span></article>)}</div></section>)}</div> : <div className="market-empty"><h3>{emptyTitle}</h3><p>{emptyCopy}</p></div>}</section>;
}

export function PeopleView({ collection }: { collection: PeopleCollection }) {
  if (!collection.data.length) {
    return <section className="market-tab-panel people-view"><div className="market-tab-heading"><div><h2>Doanh nhân & sở hữu công khai</h2><p>{collection.methodology.label}. Không phải tổng tài sản cá nhân.</p></div></div><div className="market-empty"><h3>Nguồn hiện tại chưa cung cấp dữ liệu sở hữu</h3><p>TCBS iFlash chưa trả hồ sơ doanh nhân và sở hữu trong tích hợp này.</p></div></section>;
  }
  const maximum = Math.max(...collection.data.map((person) => Number(person.estimated_listed_equity_value)), 1);
  return <section className="market-tab-panel people-view"><div className="market-tab-heading"><div><h2>Doanh nhân & sở hữu công khai</h2><p>{collection.methodology.label}. Không phải tổng tài sản cá nhân.</p></div></div><div className="people-summary"><article><span>Phạm vi thống kê</span><strong>{collection.data.length} hồ sơ</strong><p>Dữ liệu nghề nghiệp và sở hữu trực tiếp được công bố.</p></article><article className="people-chart"><span>Phân bố giá trị top hồ sơ</span><div>{collection.data.map((person) => <span style={{ height: `${Math.max(12, Number(person.estimated_listed_equity_value) / maximum * 100)}%` }} key={person.id} title={person.full_name} />)}</div></article><article><span>Phương pháp</span><strong>Direct holdings × price</strong><p>Ngày sở hữu và ngày giá luôn được hiển thị.</p></article></div><div className="people-list">{collection.data.map((person) => <article key={person.id}><span className="person-rank">{person.rank}</span><span className="person-avatar" aria-hidden="true">{person.initials}</span><div className="person-identity"><h3>{person.full_name}</h3><p>{person.role} · {person.company} · <strong>{person.symbols.join(", ")}</strong></p><small>{person.sector} · Công bố {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(person.holding_public_date))}</small></div><div className="person-holding"><strong>{formatMoney(person.estimated_listed_equity_value)}</strong><span>Giá trị cổ phiếu niêm yết ước tính</span><small className={changeTone(person.daily_change_percent)}>{formatPercent(person.daily_change_percent)} theo giá trong ngày</small></div><span className="person-arrow" aria-hidden="true">›</span></article>)}</div><details className="people-method"><summary>Giới hạn của phép tính</summary><p>{collection.methodology.description}</p><ul>{collection.methodology.excludes.map((item) => <li key={item}>{item}</li>)}</ul></details></section>;
}

export function WatchlistView({ instruments }: { instruments: InstrumentCollection }) {
  return <section className="market-tab-panel watchlist-panel"><WatchlistPanel instruments={instruments.data} /></section>;
}

