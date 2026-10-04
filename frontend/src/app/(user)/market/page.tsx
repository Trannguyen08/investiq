import { EventsView, IndicesView, MarketShell, PeopleView, StocksView, WatchlistView, type MarketTab } from "@/components/market/market-workspace";
import { getMarketEvents, getMarketIndices, getMarketInstruments, getMarketPeople } from "@/lib/api-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const selected = params[key];
  return typeof selected === "string" ? selected : fallback;
}

export default async function MarketPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedTab = value(params, "tab", "stocks");
  const tab: MarketTab = ["stocks", "watchlist", "indices", "events", "people"].includes(requestedTab) ? requestedTab as MarketTab : "stocks";
  const indexCollection = await getMarketIndices();
  const symbols = indexCollection.data.map((item) => item.symbol);

  if (tab === "indices") return <MarketShell tab={tab} meta={indexCollection.meta} symbols={symbols}><IndicesView collection={indexCollection} selected={value(params, "symbol", "VNINDEX").toUpperCase()} /></MarketShell>;
  if (tab === "events") { const eventFilters = { symbol: value(params, "symbol").toUpperCase(), eventType: value(params, "event_type") }; const query = new URLSearchParams(); if (eventFilters.symbol) query.set("symbol", eventFilters.symbol); if (eventFilters.eventType) query.set("event_type", eventFilters.eventType); const collection = await getMarketEvents(query); return <MarketShell tab={tab} meta={collection.meta} symbols={symbols}><EventsView collection={collection} filters={eventFilters} /></MarketShell>; }
  if (tab === "people") { const collection = await getMarketPeople(); return <MarketShell tab={tab} meta={collection.meta} symbols={symbols}><PeopleView collection={collection} /></MarketShell>; }

  const query = new URLSearchParams();
  const filters = { q: value(params, "q"), exchange: value(params, "exchange"), sort: value(params, "sort", tab === "watchlist" ? "trending" : "symbol"), direction: value(params, "direction", tab === "watchlist" ? "desc" : "asc") };
  for (const [key, selected] of Object.entries(filters)) if (selected) query.set(key, selected);
  const cursor = value(params, "cursor"); if (cursor) query.set("cursor", cursor);
  query.set("limit", tab === "watchlist" ? "100" : "50");
  const instruments = await getMarketInstruments(query);
  const liveSymbols = [...symbols, ...instruments.data.slice(0, 16).map((item) => item.symbol)];
  return <MarketShell tab={tab} meta={instruments.meta} symbols={liveSymbols}>{tab === "watchlist" ? <WatchlistView instruments={instruments} /> : <StocksView collection={instruments} filters={filters} />}</MarketShell>;
}

