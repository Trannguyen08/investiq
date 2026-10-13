import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/market-data-api/fundamentals/route";

describe("fundamentals BFF route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the provider cache as the source of truth and caches complete ratios", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { symbol: "FPT", pe: "15.53", pb: "3.7" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/market-data-api/fundamentals?symbols=FPT"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/market/instruments/FPT"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("does not shared-cache an unavailable ratio response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { symbol: "FPT", pe: null, pb: null },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await GET(new Request("http://localhost/market-data-api/fundamentals?symbols=FPT"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
