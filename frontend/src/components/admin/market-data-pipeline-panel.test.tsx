import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(admin)/admin/actions", () => ({
  syncMarketDividendsAction: vi.fn(),
  clearMarketDataCacheAction: vi.fn(),
}));

import { MarketDataPipelinePanel } from "@/components/admin/market-data-pipeline-panel";
import type { AdminMarketPipelineStatus } from "@/lib/server/admin-ops-api";

const mockPipeline: AdminMarketPipelineStatus = {
  status: "healthy",
  as_of: "2026-10-30T12:00:00Z",
  crawlers: [
    {
      id: "dividend-crawler",
      name: "Crawler Lịch Cổ Tức & Quyền Doanh Nghiệp",
      source: "CafeF Ajax / Vnstock Fallback",
      status: "active",
      cache_entries: 30,
      cache_ttl_seconds: 3600,
      last_synced_at: "2026-10-30T11:45:00Z",
      detail: "Theo dõi 30 mã trụ cột VN30",
    },
    {
      id: "financial-statements-crawler",
      name: "Crawler Báo Cáo Tài Chính Đa Kỳ",
      source: "CafeF FinanceReport.ashx",
      status: "active",
      cache_entries: 12,
      cache_ttl_seconds: 7200,
      last_synced_at: null,
      detail: "Bóc tách doanh thu, lợi nhuận, nợ",
    },
  ],
  recent_events_sample: [
    {
      id: "HPG-1",
      symbol: "HPG",
      ex_date: "2024-06-20",
      type: "cash",
      cash_value: 1000,
      title: "Trả cổ tức bằng tiền 10%",
      source: "CafeF",
    },
  ],
};

describe("MarketDataPipelinePanel", () => {
  it("renders pipeline cards, sync and cache action buttons, and sample events", () => {
    render(<MarketDataPipelinePanel pipeline={mockPipeline} />);

    expect(screen.getByText("Thu thập Dữ liệu Thị trường & Doanh nghiệp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đồng bộ Lịch Cổ tức Ngay/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xóa Bộ đệm Cache/i })).toBeInTheDocument();

    expect(screen.getByText("Crawler Lịch Cổ Tức & Quyền Doanh Nghiệp")).toBeInTheDocument();
    expect(screen.getByText("Crawler Báo Cáo Tài Chính Đa Kỳ")).toBeInTheDocument();

    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.getByText("1.000 đ/cp")).toBeInTheDocument();
  });
});
