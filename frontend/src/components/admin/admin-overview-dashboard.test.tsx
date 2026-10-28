import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminOverviewDashboard } from "@/components/admin/admin-overview-dashboard";
import type { AdminOverviewData } from "@/lib/server/admin-ops-api";

const mockOverview: AdminOverviewData = {
  total_users: 150,
  active_users: 142,
  disabled_users: 8,
  admin_users: 3,
  new_users_today: 5,
  new_users_7d: 18,
  new_users_30d: 55,

  total_portfolios: 80,
  total_trades: 520,
  total_starting_cash_vnd: 8000000000,
  total_cash_balance_vnd: 5200000000,
  total_realized_pnl_vnd: 125000000,

  total_theses: 45,
  active_theses: 30,
  hit_target_theses: 10,
  stopped_out_theses: 5,
  theses_win_rate: 66.7,
  bullish_theses: 28,
  bearish_theses: 12,
  neutral_theses: 5,

  total_news_articles: 12400,
  active_news_sources: 6,
  total_news_sources: 6,
  news_sources_stats: [
    {
      source_slug: "vietstock",
      name: "Vietstock",
      article_count: 5200,
      status: "active",
      last_success_at: "2026-10-28T08:00:00Z",
    },
  ],
  news_sentiment_breakdown: {
    positive: 6200,
    neutral: 4100,
    negative: 2100,
  },

  db_connected: true,
  redis_connected: true,
  uptime_seconds: 3600,

  top_traded_symbols: [
    { symbol: "HPG", trades_count: 120, total_volume_vnd: 500000000 },
    { symbol: "SSI", trades_count: 95, total_volume_vnd: 320000000 },
  ],
  activity_chart: [
    { date: "22/10", new_users: 2, trades_count: 15 },
    { date: "23/10", new_users: 5, trades_count: 32 },
  ],
  recent_audits: [
    {
      id: "aud-001",
      occurred_at: "2026-10-28T08:15:00Z",
      actor_email: "admin@investiq.vn",
      event_type: "user_login",
      target: "admin_portal",
      outcome: "succeeded",
    },
  ],
};

describe("AdminOverviewDashboard", () => {
  it("renders 4 core KPI cards and metrics", () => {
    render(<AdminOverviewDashboard data={mockOverview} />);

    expect(screen.getByText("Người dùng hệ thống")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();

    expect(screen.getByText("Paper Trading & Lệnh")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();

    expect(screen.getByText("Khuyến nghị Theses")).toBeInTheDocument();
    expect(screen.getAllByText("45")).toHaveLength(2);

    expect(screen.getByText("Tin tức thị trường")).toBeInTheDocument();
    expect(screen.getByText("12,400")).toBeInTheDocument();
  });

  it("renders top traded symbols and audit entries", () => {
    render(<AdminOverviewDashboard data={mockOverview} />);

    expect(screen.getByText(/#1 HPG/)).toBeInTheDocument();
    expect(screen.getByText(/120 lệnh/)).toBeInTheDocument();
    expect(screen.getByText("user_login")).toBeInTheDocument();
    expect(screen.getByText("admin@investiq.vn")).toBeInTheDocument();
  });

  it("opens audit detail modal on clicking detail button", () => {
    render(<AdminOverviewDashboard data={mockOverview} />);

    const detailBtn = screen.getByRole("button", { name: "Xem chi tiết" });
    fireEvent.click(detailBtn);

    expect(screen.getByRole("heading", { name: "Chi tiết sự kiện kiểm toán" })).toBeInTheDocument();
    expect(screen.getByText("aud-001")).toBeInTheDocument();
  });
});
