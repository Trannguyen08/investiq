import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MarketColorLegend, MarketLineChart, SectorHeatmap, SentimentGauge } from "@/components/market/beginner-market-ui";
import { DailyFeaturedNews, HomeMarketDashboard, HomeStockPulse, HomeUpcomingEvents } from "@/components/market/home-market-dashboard";
import { MarketStatus } from "@/components/market/market-status";
import type { NewsSummary } from "@/lib/api-client";
import type { MarketCandle, MarketIndex, MarketInstrument, MarketMeta, MarketOverview, MarketSector } from "@/types/market";

vi.mock("@/hooks/use-realtime-price", () => ({
  MarketStreamProvider: ({ children }: { children: ReactNode }) => children,
  useMarketStreamState: () => ({ items: {}, lastUpdate: null, state: "disconnected" }),
}));

const candles: MarketCandle[] = [
  { timestamp: "2026-10-06T00:00:00Z", open: "100", high: "103", low: "99", close: "101", volume: "1000" },
  { timestamp: "2026-10-07T00:00:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1200" },
];

const marketMeta: MarketMeta = {
  schema_version: "1", provider: "vnstock-kbs", provider_name: "KBS",
  market_time: "2026-10-08T03:15:00Z", received_at: "2026-10-08T03:15:05Z",
  delay_class: "source_delayed", freshness: "fresh", session: "open", partial: false,
  market_timezone: "Asia/Ho_Chi_Minh",
};

function marketIndex(symbol: string, name: string, changePercent: string): MarketIndex {
  return {
    symbol, name, value: "1275.50", reference_value: "1265", open_value: "1268",
    high_value: "1280", low_value: "1260", change: "10.50", change_percent: changePercent,
    volume: "1000000", matched_value: "25000000000000", advances: 210, declines: 130,
    unchanged: 45, ceiling_count: 8, floor_count: 2, candles,
  };
}

function instrument(symbol: string, changePercent: string, matchedValue: string): MarketInstrument {
  return {
    symbol, name: `Công ty ${symbol}`, exchange: "HOSE", sector: "Công nghệ",
    price: "102000", reference_price: "100000", ceiling_price: "107000", floor_price: "93000",
    open_price: "100500", high_price: "103000", low_price: "99500", change: "2000",
    change_percent: changePercent, volume: "1000000", matched_value: matchedValue,
    foreign_net_value: "1000000000", market_cap: "150000000000000", pe: "18.5", pb: "4.2",
    eps: "5500", roe_percent: "22", volume_vs_20d: "1.2", interest_score: "2",
    interest_reasons: [], is_vn30: true, candles,
  };
}

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
    expect(technology).toHaveAttribute("href", "/market/stocks?sector=C%C3%B4ng%20ngh%E1%BB%87#stock-table");
    expect(Number(technology.style.flexGrow)).toBeGreaterThan(Number(banking.style.flexGrow));
    expect(screen.getByText("20 mã")).toBeInTheDocument();
  });

  it("packs 16 movement-weighted tiles into two proportional rows", () => {
    const sectors = Array.from({ length: 15 }, (_, index) => (
      sector(`Ngành ${index + 1}`, String(index + 1), index + 1)
    ));
    sectors.push(sector("Du lịch và Giải trí", "-0.39", 46));

    const { container } = render(<SectorHeatmap sectors={sectors} headingId="sectors" />);

    const rows = Array.from(container.querySelectorAll<HTMLElement>(".heatmap-row"));
    const tiles = Array.from(container.querySelectorAll<HTMLElement>(".heatmap-row > a"));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.children.length)).toEqual([8, 8]);
    expect(tiles).toHaveLength(16);
    expect(screen.getByRole("link", { name: /Ngành 15: \+15%/ }).style.flexGrow).toBe("15");
    expect(screen.getByRole("link", { name: /Du lịch và Giải trí: -0,39%/ }).style.flexGrow).toBe("0.39");
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

  it("builds a data-scoped beginner home with indices, movers, events and real tool routes", () => {
    const overview: MarketOverview = {
      data: {
        indices: [
          marketIndex("VNINDEX", "VN-Index", "0.83"),
          marketIndex("VN30", "VN30-Index", "0.52"),
          marketIndex("HNXINDEX", "HNX-Index", "-0.21"),
          marketIndex("UPCOMINDEX", "UPCoM-Index", "0.10"),
        ],
        trending: [
          instrument("FPT", "3.20", "500000000000"),
          instrument("HPG", "1.10", "800000000000"),
          instrument("VNM", "-2.40", "300000000000"),
          instrument("VCB", "-0.80", "900000000000"),
        ],
        breadth: { advances: 210, declines: 130, unchanged: 45, ceiling_count: 8, floor_count: 2, matched_value: "25000000000000" },
        upcoming_events: [{
          id: "event-1", symbol: "FPT", event_type: "insider_trading", title: "Đăng ký giao dịch cổ phiếu",
          summary: "Mốc thời gian theo lịch đã công bố của doanh nghiệp.", date_type: "end_date",
          event_at: "2026-10-20T02:00:00Z", status: "official", source_name: "VCI qua Vnstock",
          source_url: "https://example.com/event-1",
        }],
      },
      meta: marketMeta,
    };

    render(<HomeMarketDashboard overview={overview} sectors={[sector("Công nghệ", "1.5", 20)]} news={[]} />);

    expect(screen.getByRole("heading", { name: "Chỉ số ngay lúc này" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /VN-Index/ })).toHaveAttribute("href", "/market/indices?symbol=VNINDEX");
    expect(screen.queryByText("+1.275,5")).not.toBeInTheDocument();
    expect(screen.queryByText("+102.000")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mã nào đang đáng chú ý?" })).toBeInTheDocument();
    expect(screen.getByText(/Xếp hạng trong 4 mã nổi bật/)).toBeInTheDocument();
    expect(screen.getByText("Tăng nổi bật")).toBeInTheDocument();
    expect(screen.getByText("Giảm đáng chú ý")).toBeInTheDocument();
    expect(screen.getByText("Giao dịch sôi động")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sự kiện doanh nghiệp sắp tới" })).toBeInTheDocument();
    expect(screen.getByText("Chính thức")).toBeInTheDocument();
    expect(screen.getByText("Giao dịch nội bộ · Ngày kết thúc")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nguồn: VCI qua Vnstock/ })).toHaveAttribute("href", "https://example.com/event-1");
    expect(screen.getByRole("heading", { name: "Ba câu hỏi giúp người mới tránh quyết định vội" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Danh mục mô phỏng" })).toHaveAttribute("href", "/portfolio");
    expect(screen.queryByText("Cộng đồng học cùng nhau")).not.toBeInTheDocument();
  });

  it("states that events are unavailable when a partial provider omits them", () => {
    render(<HomeUpcomingEvents events={[]} meta={{ ...marketMeta, partial: true }} />);

    expect(screen.getByRole("heading", { name: "Chưa có lịch sự kiện được nguồn cung cấp" })).toBeInTheDocument();
    expect(screen.getByText(/đang trả dữ liệu thị trường một phần/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kiểm tra trang sự kiện" })).toHaveAttribute("href", "/market/events");
  });

  it("filters HomeStockPulse movers by time ranges (day, week, month, 3 months, 6 months, year)", () => {
    const customCandles: MarketCandle[] = [
      { timestamp: "2026-09-01T00:00:00Z", open: "80", high: "82", low: "79", close: "80", volume: "1000" },
      { timestamp: "2026-10-01T00:00:00Z", open: "90", high: "95", low: "89", close: "92", volume: "1100" },
      { timestamp: "2026-10-06T00:00:00Z", open: "100", high: "103", low: "99", close: "100", volume: "1200" },
      { timestamp: "2026-10-07T00:00:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1500" },
    ];

    const stockA = { ...instrument("FPT", "3.20", "500000000000"), price: "105000", candles: customCandles };
    const stockB = { ...instrument("VNM", "-2.40", "300000000000"), price: "68000", candles: customCandles };

    const { container } = render(<HomeStockPulse instruments={[stockA, stockB]} meta={marketMeta} />);

    // Check dropdown select exists with all 6 options
    const select = within(container).getByRole("combobox", { name: /mốc thời gian biến động/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("1D");

    const optionLabels = [
      "Theo ngày (1 phiên)",
      "Theo tuần (5 phiên)",
      "Theo tháng (21 phiên)",
      "Theo 3 tháng (1 quý)",
      "Theo 6 tháng (Nửa năm)",
      "Theo năm (1 năm)",
    ];
    for (const label of optionLabels) {
      expect(within(select).getByRole("option", { name: label })).toBeInTheDocument();
    }

    // Change to "1W" (Tuần)
    fireEvent.change(select, { target: { value: "1W" } });
    expect(select).toHaveValue("1W");

    // Change to "1M" (Tháng)
    fireEvent.change(select, { target: { value: "1M" } });
    expect(select).toHaveValue("1M");
  });
});
