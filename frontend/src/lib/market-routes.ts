export const MARKET_TABS = ["stocks", "watchlist", "indices", "events", "people"] as const;

export type MarketTab = (typeof MARKET_TABS)[number];
export type MarketSearchParams = Record<string, string | string[] | undefined>;

export function isMarketTab(value: string): value is MarketTab {
  return MARKET_TABS.some((tab) => tab === value);
}

export function marketPath(tab: MarketTab): `/market/${MarketTab}` {
  return `/market/${tab}`;
}

export function legacyMarketDestination(params: MarketSearchParams): string {
  const requestedTab = typeof params.tab === "string" ? params.tab : "stocks";
  const tab = isMarketTab(requestedTab) ? requestedTab : "stocks";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return `${marketPath(tab)}${suffix}`;
}
