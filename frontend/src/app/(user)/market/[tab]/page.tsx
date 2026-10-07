import { notFound } from "next/navigation";

import {
  EventsView,
  IndicesView,
  MarketShell,
  PeopleView,
  WatchlistView,
} from "@/components/market/market-workspace";
import { StocksView } from "@/components/market/market-stocks-beginner";
import {
  getMarketCandles,
  getMarketEvents,
  getMarketIndices,
  getMarketInstruments,
  getMarketPeople,
} from "@/lib/api-client";
import { isMarketTab, type MarketSearchParams } from "@/lib/market-routes";

function value(params: MarketSearchParams, key: string, fallback = "") {
  const selected = params[key];
  return typeof selected === "string" ? selected : fallback;
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
  const tab = requestedTab;
  const indexCollection = await getMarketIndices();
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

  const query = new URLSearchParams();
  const filters = {
    q: value(queryParams, "q"),
    exchange: value(queryParams, "exchange"),
    sort: value(queryParams, "sort", tab === "watchlist" ? "trending" : "vn30"),
    direction: value(queryParams, "direction", "desc"),
    mode: value(queryParams, "mode", "basic") === "advanced" ? "advanced" : "basic",
  };
  for (const [key, selected] of Object.entries(filters).filter(([key]) => key !== "mode")) {
    if (selected) query.set(key, selected);
  }
  const cursor = value(queryParams, "cursor");
  if (cursor) query.set("cursor", cursor);
  query.set("limit", tab === "watchlist" ? "100" : "15");
  const summaryQuery = new URLSearchParams({
    sort: "matched_value",
    direction: "desc",
    limit: "100",
  });
  const [instruments, summary] = await Promise.all([
    getMarketInstruments(query),
    tab === "watchlist" ? Promise.resolve(null) : getMarketInstruments(summaryQuery),
  ]);
  const liveSymbols = [
    ...symbols,
    ...instruments.data.slice(0, 16).map((item) => item.symbol),
  ];
  const selectedSymbol = value(queryParams, "selected").toUpperCase();
  const selectedCandles = selectedSymbol
    ? await getMarketCandles(selectedSymbol, "1d", 90).catch(() => null)
    : null;
  return (
    <MarketShell tab={tab} meta={instruments.meta} symbols={liveSymbols}>
      {tab === "watchlist" ? (
        <WatchlistView instruments={instruments} />
      ) : (
        <StocksView
          collection={instruments}
          summary={summary ?? instruments}
          filters={filters}
          selected={selectedSymbol}
          selectedCandles={selectedCandles?.data ?? []}
          index={indexCollection.data.find((item) => item.symbol === "VNINDEX") ?? indexCollection.data[0]}
        />
      )}
    </MarketShell>
  );
}
