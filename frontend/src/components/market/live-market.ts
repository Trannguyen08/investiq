import type { MarketCandle, MarketIndex, MarketInstrument } from "@/types/market";

function liveString(live: Record<string, unknown> | undefined, key: string, fallback: string) {
  return typeof live?.[key] === "string" ? live[key] : fallback;
}

function liveCount(live: Record<string, unknown> | undefined, key: string, fallback: number) {
  return typeof live?.[key] === "number" && Number.isSafeInteger(live[key]) ? live[key] : fallback;
}

function isCandle(value: unknown): value is MarketCandle {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["timestamp", "open", "high", "low", "close", "volume"].every(
    (field) => typeof candidate[field] === "string",
  );
}

function liveCandles(live: Record<string, unknown> | undefined, fallback: MarketCandle[]) {
  const candles = live?.candles;
  return Array.isArray(candles) && candles.every(isCandle) ? candles : fallback;
}

export function mergeLiveInstrument(
  item: MarketInstrument,
  live: Record<string, unknown> | undefined,
): MarketInstrument {
  return {
    ...item,
    price: liveString(live, "price", item.price),
    reference_price: liveString(live, "reference_price", item.reference_price),
    ceiling_price: liveString(live, "ceiling_price", item.ceiling_price),
    floor_price: liveString(live, "floor_price", item.floor_price),
    open_price: liveString(live, "open_price", item.open_price),
    high_price: liveString(live, "high_price", item.high_price),
    low_price: liveString(live, "low_price", item.low_price),
    change: liveString(live, "change", item.change),
    change_percent: liveString(live, "change_percent", item.change_percent),
    volume: liveString(live, "volume", item.volume),
    matched_value: liveString(live, "matched_value", item.matched_value),
    foreign_net_value: liveString(live, "foreign_net_value", item.foreign_net_value),
    market_cap: liveString(live, "market_cap", item.market_cap),
  };
}

export function mergeLiveIndex(
  item: MarketIndex,
  live: Record<string, unknown> | undefined,
): MarketIndex {
  return {
    ...item,
    value: liveString(live, "value", item.value),
    reference_value: liveString(live, "reference_value", item.reference_value),
    open_value: liveString(live, "open_value", item.open_value),
    high_value: liveString(live, "high_value", item.high_value),
    low_value: liveString(live, "low_value", item.low_value),
    change: liveString(live, "change", item.change),
    change_percent: liveString(live, "change_percent", item.change_percent),
    volume: liveString(live, "volume", item.volume),
    matched_value: liveString(live, "matched_value", item.matched_value),
    advances: liveCount(live, "advances", item.advances),
    declines: liveCount(live, "declines", item.declines),
    unchanged: liveCount(live, "unchanged", item.unchanged),
    ceiling_count: liveCount(live, "ceiling_count", item.ceiling_count),
    floor_count: liveCount(live, "floor_count", item.floor_count),
    candles: liveCandles(live, item.candles),
  };
}
