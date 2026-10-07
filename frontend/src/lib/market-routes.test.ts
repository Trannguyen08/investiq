import { describe, expect, it } from "vitest";

import { isMarketTab, legacyMarketDestination, marketPath } from "@/lib/market-routes";

describe("market routes", () => {
  it("builds one stable path per market tab", () => {
    expect(marketPath("stocks")).toBe("/market/stocks");
    expect(marketPath("watchlist")).toBe("/market/watchlist");
    expect(isMarketTab("indices")).toBe(true);
    expect(isMarketTab("unknown")).toBe(false);
  });

  it("redirects legacy tab URLs without losing filters", () => {
    expect(
      legacyMarketDestination({ tab: "events", symbol: "FPT", event_type: "earnings" }),
    ).toBe("/market/events?symbol=FPT&event_type=earnings");
  });

  it("falls back to stocks and preserves repeated query values", () => {
    expect(legacyMarketDestination({ tab: "bad", q: ["FPT", "HPG"] })).toBe(
      "/market/stocks?q=FPT&q=HPG",
    );
  });
});
