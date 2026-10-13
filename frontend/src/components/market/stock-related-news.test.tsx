import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockRelatedNews } from "@/components/market/stock-related-news";
import type { NewsSummary } from "@/lib/api-client";

function article(id: string, title: string, feedAt: string): NewsSummary {
  return {
    id,
    title,
    description: `Nội dung ${title}`,
    url: `https://example.test/${id}`,
    source: { slug: "vietstock", name: "Vietstock", url: "https://vietstock.vn", status: "active", content_access: "full_text", last_success_at: feedAt },
    published_at: feedAt,
    updated_at: null,
    first_seen_at: feedAt,
    feed_at: feedAt,
    category: "Chứng khoán",
    tags: ["FPT"],
    thumbnail: null,
    symbols: [],
    mentioned_symbols: [],
    sentiment: { status: "ready", label: "neutral", score: 0, confidence: null, method: "rules", analyzer_version: "rules-vi-2", analyzed_at: feedAt, rationale: null, evidence: [], market_impact: null, impact_scope: null, horizon: null, topics: [], event_types: [] },
    extraction_status: "complete",
    content_access: "full_text",
    duplicate_source_count: 1,
  };
}

describe("StockRelatedNews", () => {
  it("sorts related articles from newest to oldest", () => {
    const { container } = render(
      <StockRelatedNews
        articles={[
          article("older", "Tin cũ", "2026-10-12T02:00:00Z"),
          article("newest", "Tin mới", "2026-10-13T08:00:00Z"),
          article("middle", "Tin giữa", "2026-10-13T03:00:00Z"),
        ]}
        exchange="HOSE"
        symbol="FPT"
      />,
    );

    const titles = [...container.querySelectorAll(".stock-related-news-list .news-card h2 a")]
      .map((element) => element.textContent);
    expect(titles).toEqual(["Tin mới", "Tin giữa", "Tin cũ"]);
    expect(screen.getByRole("link", { name: "Xem tất cả tin FPT →" })).toHaveAttribute(
      "href",
      "/news?symbol=HOSE%3AFPT",
    );
  });

  it("distinguishes an empty result from a failed optional request", () => {
    const { rerender } = render(<StockRelatedNews articles={[]} exchange="HOSE" symbol="FPT" />);
    expect(screen.getByText("Chưa có tin được gắn mã FPT")).toBeInTheDocument();

    rerender(<StockRelatedNews articles={null} exchange="HOSE" symbol="FPT" />);
    expect(screen.getByRole("status")).toHaveTextContent("Chưa thể tải tin liên quan lúc này");
  });
});
