import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInstrumentDividends,
  getInstrumentFinancialStatements,
  getMarketDividendCalendar,
  getMarketInstruments,
  getNews,
  getNewsArticle,
  getRelatedStockNews,
} from "@/lib/api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("news API client", () => {
  it("forwards URL filters through the single API boundary", async () => {
    const payload = {
      data: [],
      pagination: { next_cursor: null, has_more: false, page: 1, page_size: 10, total_items: 0, total_pages: 0 },
      meta: { request_id: "test", as_of: "2026-09-29T00:00:00Z", last_ingested_at: null, freshness: "unavailable" },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const query = new URLSearchParams({ symbol: "HOSE:FPT", sentiment: "positive" });

    await expect(getNews(query)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/news?symbol=HOSE%3AFPT&sentiment=positive",
      { next: { revalidate: 30 } },
    );
  });

  it("turns a non-success response into an explicit error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getNewsArticle("article-id")).rejects.toThrow("InvestIQ API returned 503");
  });

  it("supports a short timeout for optional news blocks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getNews(new URLSearchParams({ limit: "3" }), 800);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/news?limit=3",
      expect.objectContaining({
        next: { revalidate: 30 },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("requests a bounded first page for a qualified stock symbol", async () => {
    const payload = { data: [], pagination: {}, meta: {} };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getRelatedStockNews("hose", "fpt");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/news?symbol=HOSE%3AFPT&limit=6&page=1",
      expect.objectContaining({
        next: { revalidate: 30 },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});

describe("market API client compatibility", () => {
  it("falls back only when an older backend rejects the VN30 sort contract", async () => {
    const legacyPayload = {
      data: [{ symbol: "FPT", candles: [] }],
      pagination: {
        next_cursor: null,
        has_more: false,
        limit: 15,
        total_items: 1,
      },
      meta: {},
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(legacyPayload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const query = new URLSearchParams({ sort: "vn30", direction: "desc", limit: "15" });

    const result = await getMarketInstruments(query);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/v1/market/instruments?sort=matched_value&direction=desc&limit=15",
      { next: { revalidate: 5 } },
    );
    expect(result.data[0].is_vn30).toBe(false);
    expect(result.pagination).toMatchObject({ previous_cursor: null, page: 1, total_pages: 1 });
  });

  it("fetches market dividend calendar", async () => {
    const payload = { data: { total: 1, events: [{ id: "1", symbol: "HPG", event_date: "2024-06-01", type: "cash", title: "Cổ tức tiền mặt" }] } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMarketDividendCalendar(10);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/market/dividends/calendar?limit=10",
      { next: { revalidate: 60 } },
    );
    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].symbol).toBe("HPG");
  });

  it("fetches instrument dividends", async () => {
    const payload = { data: { symbol: "HPG", summary: { symbol: "HPG", dividend_yield_percent: 4.2 }, events: [] } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInstrumentDividends("HPG");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/market/instruments/HPG/dividends",
      { next: { revalidate: 60 } },
    );
    expect(result.data.symbol).toBe("HPG");
  });

  it("fetches instrument financial statements", async () => {
    const payload = { data: { symbol: "HPG", period_type: "quarter", periods: ["Q1 2024"], charts: [], income_statement: [], balance_sheet: [], cash_flow: [] } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInstrumentFinancialStatements("HPG", "quarter", 4);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/market/instruments/HPG/financial-statements?period=quarter&limit=4",
      { next: { revalidate: 120 } },
    );
    expect(result.data.symbol).toBe("HPG");
    expect(result.data.period_type).toBe("quarter");
  });
});
