import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortfoliosTable } from "@/components/admin/portfolios-table";
import type { AdminPortfolioDetail, AdminPortfolioItem } from "@/lib/server/admin-ops-api";

const mockItem: AdminPortfolioItem = {
  id: "pf-1111-2222",
  user_id: "u-1",
  user_email: "investor@example.com",
  user_name: "Trần Nhà Đầu Tư",
  starting_cash: 100000000,
  cash_balance: 65000000,
  realized_pnl: 5200000,
  is_public: true,
  nickname: "TranInvestor",
  holdings_count: 2,
  trades_count: 8,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
};

const mockDetail: AdminPortfolioDetail = {
  portfolio: mockItem,
  holdings: [
    {
      symbol: "HPG",
      quantity: 1000,
      avg_price: 28500,
      total_cost_basis: 28500000,
      updated_at: "2026-10-20T09:30:00Z",
    },
  ],
  recent_trades: [
    {
      id: "tr-1",
      symbol: "HPG",
      side: "buy",
      quantity: 1000,
      execution_price: 28500,
      gross_amount: 28500000,
      fee_amount: 28500,
      tax_amount: 0,
      realized_pnl: null,
      created_at: "2026-10-20T09:30:00Z",
    },
  ],
};

describe("PortfoliosTable", () => {
  it("renders portfolio table with user email and balances", () => {
    render(<PortfoliosTable portfolios={[mockItem]} loadDetail={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Danh sách tài khoản Paper Trading" })).toBeInTheDocument();
    expect(screen.getByText("investor@example.com")).toBeInTheDocument();
    expect(screen.getByText("Trần Nhà Đầu Tư")).toBeInTheDocument();
    expect(screen.getByText("2 cổ phiếu")).toBeInTheDocument();
    expect(screen.getByText("8 lệnh")).toBeInTheDocument();
  });

  it("loads and displays portfolio detail modal with holdings and trades", async () => {
    const loadDetail = vi.fn().mockResolvedValue(mockDetail);
    render(<PortfoliosTable portfolios={[mockItem]} loadDetail={loadDetail} />);

    const detailBtn = screen.getByRole("button", { name: "Xem chi tiết" });
    fireEvent.click(detailBtn);

    expect(loadDetail).toHaveBeenCalledWith("pf-1111-2222");
    expect(await screen.findByRole("heading", { name: /Chi tiết danh mục: Trần Nhà Đầu Tư/i })).toBeInTheDocument();
    expect(screen.getByText(/Cổ phiếu đang nắm giữ/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử khớp lệnh gần đây/i)).toBeInTheDocument();
  });

  it("shows empty state when no portfolios are present", () => {
    render(<PortfoliosTable portfolios={[]} loadDetail={vi.fn()} />);

    expect(screen.getByText("Không tìm thấy danh mục giao dịch ảo nào.")).toBeInTheDocument();
  });
});
