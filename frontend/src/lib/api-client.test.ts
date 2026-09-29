import { afterEach, describe, expect, it, vi } from "vitest";

import { getNews, getNewsArticle } from "@/lib/api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("news API client", () => {
  it("forwards URL filters through the single API boundary", async () => {
    const payload = {
      data: [],
      pagination: { next_cursor: null, has_more: false },
      meta: { request_id: "test", as_of: "2026-09-29T00:00:00Z", last_ingested_at: null, freshness: "unavailable" },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const query = new URLSearchParams({ symbol: "HOSE:FPT", sentiment: "positive" });

    await expect(getNews(query)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/news?symbol=HOSE%3AFPT&sentiment=positive",
      { cache: "no-store" },
    );
  });

  it("turns a non-success response into an explicit error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getNewsArticle("article-id")).rejects.toThrow("InvestIQ API returned 503");
  });
});
