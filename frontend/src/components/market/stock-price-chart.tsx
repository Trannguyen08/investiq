"use client";

import Link from "next/link";

import { changeTone, formatChange, formatCompact, formatDecimal, formatMoney, formatPercent } from "@/components/market/formatters";
import { mergeLiveInstrument } from "@/components/market/live-market";
import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { useMarketStreamState } from "@/hooks/use-realtime-price";
import type { MarketCandle, MarketInstrument } from "@/types/market";

export type StockChartRange = "day" | "week" | "month" | "year";

const ranges: { value: StockChartRange; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

function optionalRatio(value: string | null) {
  return value === null ? "Chưa có" : `${formatDecimal(value)} lần`;
}

function useLiveInstrument(item: MarketInstrument) {
  const stream = useMarketStreamState();
  return mergeLiveInstrument(item, stream.items[item.symbol]);
}

function sessionValue(value: string, hasTrades: boolean) {
  return hasTrades && Number(value) > 0 ? formatChange(value) : "Chưa phát sinh";
}

export function StockLivePrice({ item }: { item: MarketInstrument }) {
  const liveItem = useLiveInstrument(item);
  const hasTrades = Number(liveItem.volume) > 0 || Number(liveItem.matched_value) > 0;

  return <div className="stock-detail-price">
    <strong>{formatChange(liveItem.price)}</strong>
    <span className={changeTone(liveItem.change_percent)}>{formatChange(liveItem.change)} · {formatPercent(liveItem.change_percent)}</span>
    <small>{hasTrades ? `Tham chiếu ${formatChange(liveItem.reference_price)}` : "Giá dự kiến · chưa có khớp lệnh"}</small>
  </div>;
}

export function StockMetricsPanel({ item }: { item: MarketInstrument }) {
  const liveItem = useLiveInstrument(item);
  const hasTrades = Number(liveItem.volume) > 0 || Number(liveItem.matched_value) > 0;

  return <aside className="stock-metrics-panel" aria-label={`Thông tin thị trường ${liveItem.symbol}`}>
    <header className="stock-metrics-heading">
      <div><p className="eyebrow">CHỈ SỐ NHANH</p><h2>Đọc số liệu {liveItem.symbol}</h2></div>
      <span className={hasTrades ? "trading" : "waiting"}>{hasTrades ? "Đã có khớp lệnh" : "Chưa khớp lệnh"}</span>
    </header>
    <div className="stock-detail-grid">
      <article><span>Mở cửa</span><strong>{sessionValue(liveItem.open_price, hasTrades)}</strong><small>Giá khớp đầu tiên của phiên.</small></article>
      <article><span>Cao nhất</span><strong>{sessionValue(liveItem.high_price, hasTrades)}</strong><small>Giá khớp cao nhất trong phiên.</small></article>
      <article><span>Thấp nhất</span><strong>{sessionValue(liveItem.low_price, hasTrades)}</strong><small>Giá khớp thấp nhất trong phiên.</small></article>
      <article><span>Trần / Sàn</span><strong>{formatChange(liveItem.ceiling_price)} / {formatChange(liveItem.floor_price)}</strong><small>Biên giá tối đa và tối thiểu hôm nay.</small></article>
      <article><span>Khối lượng</span><strong>{hasTrades ? formatCompact(liveItem.volume) : "Chưa phát sinh"}</strong><small>Tổng số cổ phiếu đã khớp.</small></article>
      <article><span>Giá trị giao dịch</span><strong>{hasTrades ? formatMoney(liveItem.matched_value) : "Chưa phát sinh"}</strong><small>Tổng giá trị các lệnh đã khớp.</small></article>
      <article><span>GT ngoại ròng ước tính</span><strong className={hasTrades ? changeTone(liveItem.foreign_net_value) : undefined}>{hasTrades ? formatMoney(liveItem.foreign_net_value) : "Chưa phát sinh"}</strong><small>Mua trừ bán của nhà đầu tư nước ngoài.</small></article>
      <article><span>Vốn hóa ước tính</span><strong>{formatMoney(liveItem.market_cap)}</strong><small>Giá hiện tại nhân số cổ phiếu niêm yết.</small></article>
      <article><span>P/E</span><strong>{optionalRatio(liveItem.pe)}</strong><small>Giá thị trường trên lợi nhuận mỗi cổ phiếu.</small></article>
      <article><span>P/B</span><strong>{optionalRatio(liveItem.pb)}</strong><small>Giá thị trường trên giá trị sổ sách.</small></article>
      <article><span>EPS</span><strong>{liveItem.eps === null ? "Chưa có" : `${formatDecimal(liveItem.eps)} ₫`}</strong><small>Lợi nhuận tính trên mỗi cổ phiếu.</small></article>
      <article><span>ROE</span><strong>{liveItem.roe_percent === null ? "Chưa có" : formatPercent(liveItem.roe_percent)}</strong><small>Khả năng sinh lời trên vốn chủ sở hữu.</small></article>
    </div>
    {!hasTrades && <p className="stock-metrics-note">Trong ATO/ATC, nguồn có thể công bố giá dự kiến trước khi phát sinh khối lượng. InvestIQ không thay số chưa có bằng dữ liệu giả.</p>}
  </aside>;
}

export function StockPriceChart({ symbol, range, candles }: { symbol: string; range: StockChartRange; candles: MarketCandle[] }) {
  return <section className="stock-chart-card" aria-labelledby="stock-chart-title">
    <div className="stock-chart-heading"><div><p className="eyebrow">DIỄN BIẾN GIÁ</p><h2 id="stock-chart-title">Biểu đồ {symbol}</h2></div><nav aria-label="Khoảng thời gian biểu đồ">{ranges.map((item) => <Link className={item.value === range ? "active" : ""} href={`/market/stocks/${symbol}?range=${item.value}`} key={item.value}>{item.label}</Link>)}</nav></div>
    {candles.length > 1 ? <>
      <MarketCandlestickChart candles={candles} label={`Biểu đồ nến ${symbol}`} />
      <details className="stock-chart-data"><summary>Xem dữ liệu biểu đồ</summary><div className="market-table-wrap"><table className="market-table"><thead><tr><th>Thời gian</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Khối lượng</th></tr></thead><tbody>{candles.slice(-20).map((item) => <tr key={item.timestamp}><td>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: range === "day" ? "short" : undefined }).format(new Date(item.timestamp))}</td><td>{formatChange(item.open)}</td><td>{formatChange(item.high)}</td><td>{formatChange(item.low)}</td><td>{formatChange(item.close)}</td><td>{formatCompact(item.volume)}</td></tr>)}</tbody></table></div></details>
    </> : <div className="stock-chart-empty"><strong>Chưa có chuỗi giá cho khoảng này</strong><p>Nguồn dữ liệu hiện không cung cấp OHLC nhiều phiên hoặc chưa trả đủ dữ liệu cho khung đã chọn. InvestIQ không tạo dữ liệu giả để lấp khoảng trống.</p></div>}
  </section>;
}
