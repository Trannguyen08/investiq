import { describe, expect, it } from "vitest";

import { matchStockQuery } from "./ticker-matcher";

describe("matchStockQuery", () => {
  it("returns exact matches for valid stock symbols and company names", () => {
    const hpgRes = matchStockQuery("HPG");
    expect(hpgRes.isTypo).toBe(false);
    expect(hpgRes.exactMatches[0]?.symbol).toBe("HPG");

    const nameRes = matchStockQuery("hòa phát");
    expect(nameRes.isTypo).toBe(false);
    expect(nameRes.exactMatches[0]?.symbol).toBe("HPG");
  });

  it("suggests closest valid tickers when user enters mistyped tickers", () => {
    const hbgRes = matchStockQuery("hbg");
    expect(hbgRes.isTypo).toBe(true);
    expect(hbgRes.exactMatches).toHaveLength(0);
    expect(hbgRes.closestMatches.map((x) => x.symbol)).toContain("HPG");
    expect(hbgRes.closestMatches[0]?.symbol).toBe("HPG");

    const viccRes = matchStockQuery("vicc");
    expect(viccRes.isTypo).toBe(true);
    expect(viccRes.closestMatches[0]?.symbol).toBe("VIC");

    const fpttRes = matchStockQuery("fptt");
    expect(fpttRes.isTypo).toBe(true);
    expect(fpttRes.closestMatches[0]?.symbol).toBe("FPT");

    const mbRes = matchStockQuery("mb");
    expect(mbRes.exactMatches[0]?.symbol).toBe("MBB");
  });
});
