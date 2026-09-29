import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewsCard } from "@/components/news/news-card";
import type { NewsSummary } from "@/lib/api-client";

const article: NewsSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "FPT ghi nhận lợi nhuận tăng",
  description: "Kết quả kinh doanh mới nhất.",
  url: "https://vietstock.vn/fpt.htm",
  source: {
    slug: "vietstock",
    name: "Vietstock",
    url: "https://vietstock.vn",
    status: "active",
    content_access: "full_text",
    last_success_at: "2026-09-29T03:30:00Z",
  },
  published_at: "2026-09-29T03:20:00Z",
  updated_at: null,
  first_seen_at: "2026-09-29T03:20:00Z",
  feed_at: "2026-09-29T03:20:00Z",
  category: "Chứng khoán",
  tags: ["FPT"],
  thumbnail: null,
  symbols: [
    {
      security_id: "d428587b-c492-40f8-a3af-b99dd12de001",
      symbol: "FPT",
      exchange: "HOSE",
      company_name: "Công ty Cổ phần FPT",
      is_primary: true,
      match_method: "exchange_pattern",
      match_confidence: 1,
      evidence: ["HOSE:FPT"],
      sentiment: null,
    },
  ],
  mentioned_symbols: ["HOSE:VPB", "HNX:LHC", "UPCOM:HND", "HDC"],
  sentiment: {
    status: "ready",
    label: "positive",
    score: 0.5,
    confidence: null,
    method: "rules",
    analyzer_version: "rules-vi-2",
    analyzed_at: null,
    rationale: "Quan điểm: tích cực.",
    evidence: ["Lợi nhuận tăng trong quý."],
    market_impact: "Có thể hỗ trợ tâm lý ngắn hạn.",
    impact_scope: "cổ phiếu được nhắc đến",
    horizon: "short_term",
  },
  extraction_status: "complete",
  content_access: "full_text",
};

describe("NewsCard", () => {
  it("renders sentiment followed by at most three tickers and an overflow count", () => {
    render(<NewsCard article={article} />);

    expect(screen.getByRole("link", { name: article.title })).toHaveAttribute(
      "href",
      `/news/${article.id}`,
    );
    expect(screen.getByText("Vietstock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FPT · HOSE" })).toHaveAttribute(
      "href",
      "/news?symbol=HOSE%3AFPT",
    );
    expect(screen.getByText("Tích cực")).toBeInTheDocument();
    expect(screen.getByText("VPB · HOSE")).toBeInTheDocument();
    expect(screen.getByText("LHC · HNX")).toBeInTheDocument();
    expect(screen.queryByText("HND · UPCOM")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("distinguishes pending analysis from neutral sentiment", () => {
    render(
      <NewsCard
        article={{ ...article, sentiment: { ...article.sentiment, status: "pending", label: null } }}
      />,
    );

    expect(screen.getByText("Đang phân tích")).toBeInTheDocument();
    expect(screen.queryByText("Trung tính")).not.toBeInTheDocument();
  });
});
