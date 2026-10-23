import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMarketTime } from "@/components/market/formatters";
import { MarketStatus } from "@/components/market/market-status";
import { StockLivePrice, StockMetricsPanel, StockPriceChart, type StockChartRange } from "@/components/market/stock-price-chart";
import { StockIntradayTable } from "@/components/market/stock-intraday-table";
import { StockRelatedNews } from "@/components/market/stock-related-news";
import { StockTradeActions } from "@/components/portfolio/stock-trade-actions";
import { MarketStreamProvider } from "@/hooks/use-realtime-price";
import { getMarketCandles, getMarketInstrument, getMarketIntradayTrades, getRelatedStockNews } from "@/lib/api-client";
import type { InstrumentEnvelope } from "@/types/market";

export const dynamic = "force-dynamic";

const rangeConfig: Record<StockChartRange, { interval: "1d" | "1h" | "30m" | "5m"; limit: number }> = {
  day: { interval: "5m", limit: 200 },
  week: { interval: "30m", limit: 500 },
  month: { interval: "1h", limit: 500 },
  year: { interval: "1d", limit: 500 },
};

function selectedRange(value: string | string[] | undefined): StockChartRange {
  return typeof value === "string" && value in rangeConfig ? value as StockChartRange : "day";
}

function safeReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.startsWith("//")) return "/market/stocks#stock-table";
  if (value === "/portfolio#paper-market-table" || value.startsWith("/market/stocks?")) return value;
  return "/market/stocks#stock-table";
}

export default async function StockDetailPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ range?: string | string[]; from?: string | string[] }> }) {
  const [{ symbol: rawSymbol }, query] = await Promise.all([params, searchParams]);
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) notFound();
  const range = selectedRange(query.range);
  const returnTo = safeReturnTo(query.from);
  const selected = rangeConfig[range];
  const candlesPromise = getMarketCandles(symbol, selected.interval, selected.limit).catch(() => null);
  const intradayPromise = getMarketIntradayTrades(symbol, 100).catch(() => null);
  const instrumentResult = await getMarketInstrument(symbol).then(
    (value) => ({ status: "fulfilled" as const, value }),
    () => ({ status: "rejected" as const }),
  );
  if (instrumentResult.status === "rejected") notFound();
  const envelope: InstrumentEnvelope = instrumentResult.value;
  const item = envelope.data;
  const [candles, intraday, relatedNews] = await Promise.all([
    candlesPromise,
    intradayPromise,
    getRelatedStockNews(item.exchange, item.symbol).catch(() => null),
  ]);

  return <MarketStreamProvider symbols={[symbol]}><main id="main-content" className="market-page stock-detail-page">
    <Link className="stock-detail-back" href={returnTo}>← Quay lại bảng giá</Link>
    <header className="stock-detail-hero"><div><p className="eyebrow">{item.exchange} · {item.is_vn30 ? "THÀNH PHẦN VN30" : "CỔ PHIẾU"}</p><h1>{item.symbol}</h1><p>{item.name} · {item.sector}</p><StockTradeActions symbol={item.symbol} name={item.name} price={item.price} /></div><StockLivePrice item={item} /></header>
    <MarketStatus meta={envelope.meta} />
    <div className="stock-detail-market-layout"><StockPriceChart symbol={symbol} range={range} candles={candles?.data ?? []} returnTo={returnTo} /><StockMetricsPanel item={item} /></div>
    <StockIntradayTable
      symbol={symbol}
      trades={intraday?.data ?? []}
      bidLevels={item.bid_levels ?? []}
      askLevels={item.ask_levels ?? []}
      meta={intraday?.meta ?? envelope.meta}
    />
    <StockRelatedNews articles={relatedNews?.data ?? null} exchange={item.exchange} symbol={item.symbol} />
    <footer className="stock-detail-source"><span>Nguồn: {envelope.meta.provider_name}</span><span>Thời điểm thị trường: {formatMarketTime(envelope.meta.market_time)}</span><span>Giá chưa điều chỉnh · VND</span></footer>
  </main></MarketStreamProvider>;
}
