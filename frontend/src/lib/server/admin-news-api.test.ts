import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEWS_ADMIN_TOKEN;
});

describe("news Admin API", () => {
  it("keeps the operational token in the server request boundary", async () => {
    process.env.NEWS_ADMIN_TOKEN = "test-operations-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getAdminNewsSources } = await import("@/lib/server/admin-news-api");

    await expect(getAdminNewsSources()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/admin/news/sources",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer test-operations-token" }),
      }),
    );
  });

  it("fails closed when the server token is absent", async () => {
    const { getAdminCrawlRuns } = await import("@/lib/server/admin-news-api");
    await expect(getAdminCrawlRuns()).rejects.toThrow("NEWS_ADMIN_TOKEN is not configured");
  });
});
