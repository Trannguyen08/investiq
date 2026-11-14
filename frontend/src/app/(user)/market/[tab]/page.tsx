import { notFound, redirect } from "next/navigation";

import {
  EcosystemsView,
  EventsView,
  IndicesView,
  MarketShell,
  PeopleView,

} from "@/components/market/market-workspace";
import { StocksView } from "@/components/market/market-stocks-beginner";
import {
  getMarketCandles,
  getMarketEcosystemDetail,
  getMarketEcosystems,
  getMarketEvents,
  getMarketGrowth,
  getMarketIndices,
  getMarketInstrument,
  getMarketInstruments,
  getMarketPeople,
  getMarketSectors,
} from "@/lib/api-client";
import { isMarketTab, type MarketSearchParams } from "@/lib/market-routes";

export const dynamic = "force-dynamic";

const MARKET_UNIVERSE_PAGE_SIZE = 100;
const MARKET_UNIVERSE_PAGE_COUNT = 5;

async function getMarketUniverseSummary() {
  let firstPage: Awaited<ReturnType<typeof getMarketInstruments>> | null = null;
  let cursor: string | null = null;
  const data: Awaited<ReturnType<typeof getMarketInstruments>>["data"] = [];

  for (let page = 0; page < MARKET_UNIVERSE_PAGE_COUNT; page += 1) {
    const query = new URLSearchParams({
      sort: "matched_value",
      direction: "desc",
      limit: String(MARKET_UNIVERSE_PAGE_SIZE),
    });
    if (cursor) query.set("cursor", cursor);
    let result: Awaited<ReturnType<typeof getMarketInstruments>>;
    try {
      result = await getMarketInstruments(query, 30);
    } catch (error) {
      if (!firstPage) throw error;
      break;
    }
    firstPage ??= result;
    data.push(...result.data);
    cursor = result.pagination?.next_cursor ?? null;
    if (!cursor) break;
  }

  return firstPage ? { ...firstPage, data } : null;
}

function value(params: MarketSearchParams, key: string, fallback = "") {
  const selected = params[key];
  return typeof selected === "string" ? selected : fallback;
}

function selectedValue(params: MarketSearchParams, key: string, allowed: readonly string[], fallback = "") {
  const selected = value(params, key, fallback);
  return allowed.includes(selected) ? selected : fallback;
}

function numericValue(params: MarketSearchParams, key: string, minimum: number, maximum: number) {
  const selected = value(params, key);
  if (!selected.trim()) return "";
  const parsed = Number(selected);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? selected : "";
}

function comparisonSymbols(params: MarketSearchParams) {
  const seen = new Set<string>();
  return value(params, "compare")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9._-]{1,24}$/.test(symbol))
    .filter((symbol) => {
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    })
    .slice(0, 3);
}

export default async function MarketTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<MarketSearchParams>;
}) {
  const [{ tab: requestedTab }, queryParams] = await Promise.all([params, searchParams]);
  if (!isMarketTab(requestedTab)) notFound();
  if (requestedTab === "watchlist") redirect("/market/stocks");
  const tab = requestedTab;
  const indexCollection = await getMarketIndices(undefined, 10);
  const symbols = indexCollection.data.map((item) => item.symbol);

  if (tab === "indices") {
    return (
      <MarketShell tab={tab} meta={indexCollection.meta} symbols={symbols}>
        <IndicesView
          collection={indexCollection}
          selected={value(queryParams, "symbol", "VNINDEX").toUpperCase()}
        />
      </MarketShell>
    );
  }

  if (tab === "events") {
    const eventFilters = {
      symbol: value(queryParams, "symbol").toUpperCase(),
      eventType: value(queryParams, "event_type"),
    };
    const query = new URLSearchParams();
    if (eventFilters.symbol) query.set("symbol", eventFilters.symbol);
    if (eventFilters.eventType) query.set("event_type", eventFilters.eventType);
    const collection = await getMarketEvents(query);
    return (
      <MarketShell tab={tab} meta={collection.meta} symbols={symbols}>
        <EventsView collection={collection} filters={eventFilters} />
      </MarketShell>
    );
  }

  if (tab === "people") {
    const collection = await getMarketPeople();
    return (
      <MarketShell tab={tab} meta={collection.meta} symbols={symbols}>
        <PeopleView collection={collection} />
      </MarketShell>
    );
  }

  if (tab === "ecosystems") {
    const requestedEcoId = value(queryParams, "eco") || "vingroup";
    const [ecosystemsRes, detailRes] = await Promise.all([
      getMarketEcosystems(),
      getMarketEcosystemDetail(requestedEcoId).catch(() => null),
    ]);
    return (
      <MarketShell tab={tab} meta={ecosystemsRes.meta ?? indexCollection.meta} symbols={symbols}>
        <EcosystemsView
          initialEcosystems={ecosystemsRes.data}
          initialEcoId={value(queryParams, "eco") || undefined}
          initialDetail={detailRes?.data ?? null}
        />
      </MarketShell>
    );
  }

  const query = new URLSearchParams();
  const minimumChange = numericValue(queryParams, "min_change", -100, 100);
  const maximumChange = numericValue(queryParams, "max_change", -100, 100);
  const validChangeRange = !minimumChange || !maximumChange || Number(minimumChange) <= Number(maximumChange);
  const filters = {
    q: value(queryParams, "q").slice(0, 120),
    exchange: selectedValue(queryParams, "exchange", ["HOSE", "HNX", "UPCOM"]),
    sector: value(queryParams, "sector").slice(0, 120),
    min_change: validChangeRange ? minimumChange : "",
    max_change: validChangeRange ? maximumChange : "",
    min_matched_value_billion: numericValue(queryParams, "min_matched_value_billion", 0, 1_000_000_000),
    min_market_cap_billion: numericValue(queryParams, "min_market_cap_billion", 0, 1_000_000_000),
    min_volume_ratio: numericValue(queryParams, "min_volume_ratio", 0, 1000),
    vn30: value(queryParams, "vn30") === "true" ? "true" : "",
    sort: selectedValue(queryParams, "sort", ["vn30", "symbol", "price", "change_percent", "volume", "matched_value", "trending", "market_cap", "volume_vs_20d"], "vn30"),
    direction: selectedValue(queryParams, "direction", ["asc", "desc"], "desc"),
  };
  for (const [key, selected] of Object.entries(filters)) {
    if (selected) query.set(key, selected);
  }
  const cursor = value(queryParams, "cursor");
  if (cursor) query.set("cursor", cursor);
  query.set("limit", "15");
  const [instruments, summary, sectors] = await Promise.all([
    getMarketInstruments(query, 10),
    getMarketUniverseSummary(),
    getMarketSectors(undefined, 30),
  ]);
  const liveSymbols = [
    ...symbols,
    ...instruments.data.slice(0, 16).map((item) => item.symbol),
  ];
  const selectedSymbol = value(queryParams, "selected").toUpperCase();
  const requestedComparisons = comparisonSymbols(queryParams);
  const [selectedCandles, comparison] = await Promise.all([
    selectedSymbol
      ? getMarketCandles(selectedSymbol, "1d", 90).catch(() => null)
      : Promise.resolve(null),
    Promise.all(requestedComparisons.map(async (symbol) => {
      const [instrumentResult, candleResult, growthResult] = await Promise.allSettled([
        getMarketInstrument(symbol),
        getMarketCandles(symbol, "1d", 90),
        getMarketGrowth(symbol),
      ]);
      if (instrumentResult.status !== "fulfilled") return null;
      return {
        instrument: instrumentResult.value.data,
        candles: candleResult.status === "fulfilled" ? candleResult.value.data : [],
        growth: growthResult.status === "fulfilled" ? growthResult.value.data : null,
      };
    })).then((items) => items.filter((item) => item !== null)),
  ]);
  return (
    <MarketShell tab={tab} meta={instruments.meta} symbols={liveSymbols}>
      {false ? (
        null
      ) : (
        <StocksView
          collection={instruments}
          summary={summary ?? instruments}
          sectors={sectors!}
          filters={filters}
          selected={selectedSymbol}
          selectedCandles={selectedCandles?.data ?? []}
          index={indexCollection.data.find((item) => item.symbol === "VNINDEX") ?? indexCollection.data[0]}
          comparisonSymbols={requestedComparisons}
          comparison={comparison}
          comparisonOptions={summary?.data ?? instruments.data}
        />
      )}
    </MarketShell>
  );
}
