import Link from "next/link";
import { notFound } from "next/navigation";

import { changeTone, formatChange, formatCompact, formatMarketTime, formatMoney, formatPercent } from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { StockPriceChart, type StockChartRange } from "@/components/market/stock-price-chart";
import { MarketStreamProvider } from "@/hooks/use-realtime-price";
import { getMarketCandles, getMarketInstrument } from "@/lib/api-client";
import type { InstrumentEnvelope } from "@/types/market";

const rangeConfig: Record<StockChartRange, { interval: "1d" | "5m"; limit: number }> = {
  day: { interval: "5m", limit: 100 },
  week: { interval: "1d", limit: 5 },
  month: { interval: "1d", limit: 22 },
  year: { interval: "1d", limit: 252 },
};

function selectedRange(value: string | string[] | undefined): StockChartRange {
  return typeof value === "string" && value in rangeConfig ? value as StockChartRange : "day";
}

export default async function StockDetailPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ range?: string | string[] }> }) {
  const [{ symbol: rawSymbol }, query] = await Promise.all([params, searchParams]);
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) notFound();
  const range = selectedRange(query.range);
  let envelope: InstrumentEnvelope;
  try {
    envelope = await getMarketInstrument(symbol);
  } catch {
    notFound();
  }
  const selected = rangeConfig[range];
  const candles = await getMarketCandles(symbol, selected.interval, selected.limit).catch(() => null);
  const item = envelope.data;

  return <MarketStreamProvider symbols={[symbol]}><main id="main-content" className="market-page stock-detail-page">
    <Link className="stock-detail-back" href="/market/stocks">← Quay lại bảng giá</Link>
    <header className="stock-detail-hero"><div><p className="eyebrow">{item.exchange} · {item.is_vn30 ? "THÀNH PHẦN VN30" : "CỔ PHIẾU"}</p><h1>{item.symbol}</h1><p>{item.name} · {item.sector}</p></div><div className="stock-detail-price"><strong>{formatChange(item.price)}</strong><span className={changeTone(item.change_percent)}>{formatChange(item.change)} · {formatPercent(item.change_percent)}</span><small>Tham chiếu {formatChange(item.reference_price)}</small></div></header>
    <MarketStatus meta={envelope.meta} />
    <StockPriceChart symbol={symbol} range={range} candles={candles?.data ?? []} />
    <section className="stock-detail-grid" aria-label={`Thông tin thị trường ${symbol}`}>
      <article><span>Mở cửa</span><strong>{formatChange(item.open_price)}</strong></article>
      <article><span>Cao nhất</span><strong>{formatChange(item.high_price)}</strong></article>
      <article><span>Thấp nhất</span><strong>{formatChange(item.low_price)}</strong></article>
      <article><span>Trần / Sàn</span><strong>{formatChange(item.ceiling_price)} / {formatChange(item.floor_price)}</strong></article>
      <article><span>Khối lượng</span><strong>{formatCompact(item.volume)}</strong></article>
      <article><span>Giá trị giao dịch</span><strong>{formatMoney(item.matched_value)}</strong></article>
      <article><span>GT ngoại ròng ước tính</span><strong className={changeTone(item.foreign_net_value)}>{formatMoney(item.foreign_net_value)}</strong></article>
      <article><span>Vốn hóa ước tính</span><strong>{formatMoney(item.market_cap)}</strong></article>
      <article><span>P/E · P/B</span><strong>{item.pe ?? "—"} · {item.pb ?? "—"}</strong></article>
    </section>
    <footer className="stock-detail-source"><span>Nguồn: {envelope.meta.provider_name}</span><span>Thời điểm thị trường: {formatMarketTime(envelope.meta.market_time)}</span><span>Giá chưa điều chỉnh · VND</span></footer>
  </main></MarketStreamProvider>;
}
