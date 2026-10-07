import { describe, expect, it } from "vitest";

import { mergeLiveIndex, mergeLiveInstrument } from "@/components/market/live-market";
import type { MarketIndex, MarketInstrument } from "@/types/market";

const instrument: MarketInstrument = {
  symbol: "FPT", name: "FPT", exchange: "HOSE", sector: "", price: "100",
  reference_price: "99", ceiling_price: "106", floor_price: "93", open_price: "100",
  high_price: "101", low_price: "98", change: "1", change_percent: "1.01",
  volume: "1000", matched_value: "100000", foreign_net_value: "0", market_cap: "1000000",
  pe: null, pb: null, eps: null, roe_percent: null, volume_vs_20d: "0",
  interest_score: "100000", interest_reasons: [], candles: [],
  is_vn30: true,
};

const index: MarketIndex = {
  symbol: "VNINDEX", name: "VN-Index", value: "1300", reference_value: "1290",
  open_value: "1295", high_value: "1302", low_value: "1288", change: "10",
  change_percent: "0.78", volume: "1000", matched_value: "2000", advances: 200,
  declines: 100, unchanged: 30, ceiling_count: 5, floor_count: 2, candles: [],
};

describe("live market snapshot merging", () => {
  it("applies valid live instrument fields without losing REST metadata", () => {
    const merged = mergeLiveInstrument(instrument, { price: "102", volume: "1500" });

    expect(merged.price).toBe("102");
    expect(merged.volume).toBe("1500");
    expect(merged.name).toBe("FPT");
    expect(merged.reference_price).toBe("99");
  });

  it("rejects malformed live types and preserves the last valid index snapshot", () => {
    const candle = {
      timestamp: "2026-10-07T02:00:00Z",
      open: "1300",
      high: "1302",
      low: "1299",
      close: "1301",
      volume: "1000",
    };
    const merged = mergeLiveIndex(index, {
      value: 1400,
      advances: 205,
      declines: 100.5,
      unchanged: "31",
      candles: [candle],
    });

    expect(merged.value).toBe("1300");
    expect(merged.advances).toBe(205);
    expect(merged.declines).toBe(100);
    expect(merged.unchanged).toBe(30);
    expect(merged.candles).toEqual([candle]);
  });
});
