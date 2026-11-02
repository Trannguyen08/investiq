import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import type { AdminAnalyticsResponse } from "@/lib/server/admin-ops-api";

const mockAnalytics: AdminAnalyticsResponse = {
  generated_at: "2026-10-28T16:26:00Z",
  total_capital_deployed_vnd: 1545000000,
  average_portfolio_roi: 7.62,
  asset_allocation: {
    total_cash_vnd: 1460000000,
    total_equity_vnd: 1545000000,
    cash_share_percent: 48.6,
    equity_share_percent: 51.4,
  },
  top_traders: [
    {
      user_id: "user-001",
      user_name: "Trần Minh Quân",
      user_email: "analyst.minhquan@investiq.vn",
      nickname: "Dragon Capitalist",
      rank: 1,
      starting_cash: 1000000000,
      cash_balance: 320000000,
      realized_pnl: 145000000,
      roi_percent: 14.5,
      win_rate: 68.5,
      total_trades: 28,
      holdings_count: 5,
    },
    {
      user_id: "user-002",
      user_name: "Lê Hoàng Yến",
      user_email: "analyst.hoangyen@investiq.vn",
      nickname: "Alpha Vietnam",
      rank: 2,
      starting_cash: 1000000000,
      cash_balance: 480000000,
      realized_pnl: 98000000,
      roi_percent: 9.8,
      win_rate: 62.1,
      total_trades: 19,
      holdings_count: 4,
    },
  ],
  exchange_liquidity: [
    {
      exchange: "HOSE",
      total_symbols: 400,
      total_value_vnd: 18500000000000,
      share_percent: 85.5,
    },
    {
      exchange: "HNX",
      total_symbols: 300,
      total_value_vnd: 2100000000000,
      share_percent: 9.7,
    },
    {
      exchange: "UPCoM",
      total_symbols: 800,
      total_value_vnd: 1050000000000,
      share_percent: 4.8,
    },
  ],
  sector_theses: [
    {
      sector: "Bất động sản",
      theses_count: 15,
      bullish_count: 10,
      bearish_count: 5,
      win_rate: 70.0,
    },
    {
      sector: "Ngân hàng",
      theses_count: 20,
      bullish_count: 16,
      bearish_count: 4,
      win_rate: 75.0,
    },
  ],
};

describe("AnalyticsDashboard", () => {
  it("renders 4 core KPI cards with correct metric data", () => {
    render(<AnalyticsDashboard data={mockAnalytics} />);

    expect(screen.getByText("Vốn giải ngân thị trường")).toBeInTheDocument();
    expect(screen.getByText("1.5 Tỷ VND")).toBeInTheDocument();

    expect(screen.getByText("Tỷ trọng Tiền mặt / Cổ")).toBeInTheDocument();
    expect(screen.getByText("48.6% / 51.4%")).toBeInTheDocument();

    expect(screen.getByText("ROI bình quân Top Trader")).toBeInTheDocument();
    expect(screen.getAllByText("+7.62%").length).toBeGreaterThan(0);

    expect(screen.getByText("Xuất dữ liệu hệ thống")).toBeInTheDocument();
  });

  it("renders Top Trader leaderboard table with formatted rows", () => {
    render(<AnalyticsDashboard data={mockAnalytics} />);

    expect(screen.getByText("Bảng Xếp Hạng Top Nhà Đầu Tư (Leaderboard)")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Trần Minh Quân")).toBeInTheDocument();
    expect(screen.getByText("Dragon Capitalist")).toBeInTheDocument();
    expect(screen.getByText("+14.5%")).toBeInTheDocument();

    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("Lê Hoàng Yến")).toBeInTheDocument();
  });

  it("opens modal with detailed trader profile when view icon clicked", () => {
    render(<AnalyticsDashboard data={mockAnalytics} />);

    const viewBtns = screen.getAllByRole("button", { name: /Xem hồ sơ/i });
    fireEvent.click(viewBtns[0]);

    expect(screen.getByRole("heading", { name: /Hồ sơ Nhà Đầu Tư: Trần Minh Quân/i })).toBeInTheDocument();
    expect(screen.getAllByText("analyst.minhquan@investiq.vn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dragon Capitalist").length).toBeGreaterThan(0);
  });

  it("renders exchange liquidity bars and sector performance", () => {
    render(<AnalyticsDashboard data={mockAnalytics} />);

    expect(screen.getByText("Thanh khoản theo Sàn giao dịch")).toBeInTheDocument();
    expect(screen.getByText(/Sàn HOSE/)).toBeInTheDocument();
    expect(screen.getByText("Hiệu suất Luận điểm theo Ngành")).toBeInTheDocument();
    expect(screen.getByText(/Bất động sản/)).toBeInTheDocument();
  });
});
