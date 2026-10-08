import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMarketTime } from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { StockLivePrice, StockMetricsPanel, StockPriceChart, type StockChartRange } from "@/components/market/stock-price-chart";
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
  const selected = rangeConfig[range];
  const [instrumentResult, candles] = await Promise.all([
    getMarketInstrument(symbol).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const }),
    ),
    getMarketCandles(symbol, selected.interval, selected.limit).catch(() => null),
  ]);
  if (instrumentResult.status === "rejected") notFound();
  const envelope: InstrumentEnvelope = instrumentResult.value;
  const item = envelope.data;

  return <MarketStreamProvider symbols={[symbol]}><main id="main-content" className="market-page stock-detail-page">
    <Link className="stock-detail-back" href="/market/stocks">← Quay lại bảng giá</Link>
    <header className="stock-detail-hero"><div><p className="eyebrow">{item.exchange} · {item.is_vn30 ? "THÀNH PHẦN VN30" : "CỔ PHIẾU"}</p><h1>{item.symbol}</h1><p>{item.name} · {item.sector}</p></div><StockLivePrice item={item} /></header>
    <MarketStatus meta={envelope.meta} />
    <div className="stock-detail-market-layout"><StockPriceChart symbol={symbol} range={range} candles={candles?.data ?? []} /><StockMetricsPanel item={item} /></div>
    <footer className="stock-detail-source"><span>Nguồn: {envelope.meta.provider_name}</span><span>Thời điểm thị trường: {formatMarketTime(envelope.meta.market_time)}</span><span>Giá chưa điều chỉnh · VND</span></footer>
  </main></MarketStreamProvider>;
}
