import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketColorLegend, MarketLineChart, SectorHeatmap, SentimentGauge } from "@/components/market/beginner-market-ui";
import { DailyFeaturedNews } from "@/components/market/home-market-dashboard";
import { MarketStatus } from "@/components/market/market-status";
import type { NewsSummary } from "@/lib/api-client";
import type { MarketCandle, MarketSector } from "@/types/market";

const candles: MarketCandle[] = [
  { timestamp: "2026-10-06T00:00:00Z", open: "100", high: "103", low: "99", close: "101", volume: "1000" },
  { timestamp: "2026-10-07T00:00:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1200" },
];

function sector(name: string, changePercent: string, memberCount: number): MarketSector {
  return {
    name, change_percent: changePercent, member_count: memberCount,
    advances: memberCount, declines: 0, unchanged: 0, matched_value: "1000000",
    foreign_net_value: "0", market_cap: "1000000000",
  };
}

describe("beginner market UI", () => {
  it("renders the five Vietnamese market colors and a labeled line chart", () => {
    render(<><MarketColorLegend /><MarketLineChart candles={candles} label="Đường giá VN-Index" /></>);

    expect(screen.getByText("Xanh lá: tăng")).toBeInTheDocument();
    expect(screen.getByText("Tím: giá trần")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Đường giá VN-Index" })).toBeInTheDocument();
  });

  it("labels the sentiment gauge as an estimate", () => {
    render(<SentimentGauge score={25} />);

    expect(screen.getByLabelText(/Tâm lý phiên ước tính: Thận trọng/)).toBeInTheDocument();
    expect(screen.getByText(/không phải chỉ số Fear & Greed chính thức/)).toBeInTheDocument();
  });

  it("sizes sector links by absolute percentage move and opens the filtered market", () => {
    render(<SectorHeatmap sectors={[
      sector("Công nghệ", "4", 3),
      sector("Ngân hàng", "-1", 20),
    ]} headingId="sectors" />);

    const technology = screen.getByRole("link", { name: /Công nghệ: \+4%/ });
    const banking = screen.getByRole("link", { name: /Ngân hàng: -1%/ });
    expect(technology).toHaveAttribute("href", "/market/stocks?sector=C%C3%B4ng%20ngh%E1%BB%87");
    expect(Number(technology.style.flexGrow)).toBeGreaterThan(Number(banking.style.flexGrow));
    expect(screen.getByText("20 mã")).toBeInTheDocument();
  });

  it("shows one explicit timestamp for the latest market data", () => {
    render(<MarketStatus meta={{
      schema_version: "1", provider: "vnstock-kbs", provider_name: "KBS",
      market_time: "2026-10-08T03:15:00Z", received_at: "2026-10-08T03:15:05Z",
      delay_class: "source_delayed", freshness: "fresh", session: "open", partial: true,
      market_timezone: "Asia/Ho_Chi_Minh",
    }} />);

    expect(screen.getByText("Dữ liệu cập nhật gần nhất")).toBeInTheDocument();
    expect(screen.getByText(/10:15 08\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Đang trong giờ giao dịch")).toBeInTheDocument();
    expect(screen.getByText("Giá và khối lượng có thể tiếp tục thay đổi.")).toBeInTheDocument();
  });

  it("highlights the newest article supplied by the database-backed news API", () => {
    const article: NewsSummary = {
      id: "news-1", title: "Doanh nghiệp công bố kết quả quý", description: "Lợi nhuận tăng.",
      url: "https://example.com/news-1", published_at: "2026-10-08T02:00:00Z",
      updated_at: null, first_seen_at: "2026-10-08T02:01:00Z", feed_at: "2026-10-08T02:00:00Z",
      category: "doanh-nghiep", tags: [], thumbnail: null, symbols: [], mentioned_symbols: ["FPT"],
      extraction_status: "complete", content_access: "metadata_only", duplicate_source_count: 1,
      source: { slug: "vietstock", name: "Vietstock", url: "https://vietstock.vn", status: "active", content_access: "full_text", last_success_at: "2026-10-08T02:01:00Z" },
      sentiment: { status: "ready", label: "positive", score: 0.5, confidence: null, method: "rule", analyzer_version: "1", analyzed_at: "2026-10-08T02:01:00Z", rationale: null, evidence: [], market_impact: "Tác động tích cực ngắn hạn.", impact_scope: "company", horizon: "short_term", topics: [], event_types: [] },
    };

    const { container } = render(<DailyFeaturedNews news={[article]} />);

    expect(screen.getByRole("heading", { name: "Tin nổi bật trong ngày" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: article.title })).toHaveAttribute("href", "/news/news-1");
    expect(container.querySelector("article.featured")).toBeInTheDocument();
  });
});
