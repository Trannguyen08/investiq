import Link from "next/link";

import { formatChange, formatCompact } from "@/components/market/formatters";
import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import type { MarketCandle } from "@/types/market";

export type StockChartRange = "day" | "week" | "month" | "year";

const ranges: { value: StockChartRange; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

export function StockPriceChart({ symbol, range, candles }: { symbol: string; range: StockChartRange; candles: MarketCandle[] }) {
  return <section className="stock-chart-card" aria-labelledby="stock-chart-title">
    <div className="stock-chart-heading"><div><p className="eyebrow">DIỄN BIẾN GIÁ</p><h2 id="stock-chart-title">Biểu đồ {symbol}</h2></div><nav aria-label="Khoảng thời gian biểu đồ">{ranges.map((item) => <Link className={item.value === range ? "active" : ""} href={`/market/stocks/${symbol}?range=${item.value}`} key={item.value}>{item.label}</Link>)}</nav></div>
    {candles.length > 1 ? <>
      <MarketCandlestickChart candles={candles} label={`Biểu đồ nến ${symbol}`} />
      <details className="stock-chart-data"><summary>Xem dữ liệu biểu đồ</summary><div className="market-table-wrap"><table className="market-table"><thead><tr><th>Thời gian</th><th>Mở</th><th>Cao</th><th>Thấp</th><th>Đóng</th><th>Khối lượng</th></tr></thead><tbody>{candles.slice(-20).map((item) => <tr key={item.timestamp}><td>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: range === "day" ? "short" : undefined }).format(new Date(item.timestamp))}</td><td>{formatChange(item.open)}</td><td>{formatChange(item.high)}</td><td>{formatChange(item.low)}</td><td>{formatChange(item.close)}</td><td>{formatCompact(item.volume)}</td></tr>)}</tbody></table></div></details>
    </> : <div className="stock-chart-empty"><strong>Chưa có chuỗi giá cho khoảng này</strong><p>Nguồn dữ liệu hiện không cung cấp OHLC nhiều phiên hoặc chưa trả đủ dữ liệu cho khung đã chọn. InvestIQ không tạo dữ liệu giả để lấp khoảng trống.</p></div>}
  </section>;
}
