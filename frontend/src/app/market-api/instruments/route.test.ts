import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/market-api/instruments/route";

describe("market instruments BFF route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies query parameters and returns instruments collection with cache header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { symbol: "FPT", name: "Công ty FPT", sector: "Công nghệ Thông tin", price: "120000", is_vn30: true },
          ],
          pagination: {
            total_items: 1,
            limit: 30,
            page: 1,
            total_pages: 1,
            has_more: false,
          },
          meta: { total: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost:3000/market-api/instruments?sector=C%C3%B4ng%20ngh%E1%BB%87%20Th%C3%B4ng%20tin&limit=30");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].symbol).toBe("FPT");
  });

  it("returns 500 when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failed")));

    const request = new Request("http://localhost:3000/market-api/instruments?sector=H%C3%B3a%20ch%E1%BA%A5t");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBeDefined();
    expect(json.data).toEqual([]);
  });
});
