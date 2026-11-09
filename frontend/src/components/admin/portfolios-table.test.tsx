import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  orders: [
    {
      id: "order-999",
      symbol: "VND",
      side: "buy",
      order_type: "LO",
      status: "open",
      quantity: 500,
      filled_quantity: 0,
      limit_price: 15200,
      reserved_cash: 7600000,
      reserved_quantity: 0,
      created_at: "2026-10-20T10:00:00Z",
      expires_at: "2026-10-20T15:00:00Z",
      cancelled_at: null,
    },
  ],
};

describe("PortfoliosTable", () => {
  it("renders portfolio table with user email and balances", () => {
    render(<PortfoliosTable portfolios={[mockItem]} loadDetail={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Danh sách tài khoản Paper Trading" })).toBeInTheDocument();
    expect(screen.getByText("investor@example.com")).toBeInTheDocument();
    expect(screen.getByText("Trần Nhà Đầu Tư")).toBeInTheDocument();
    expect(screen.getByText("2 mã")).toBeInTheDocument();
    expect(screen.getByText("8 lệnh")).toBeInTheDocument();
  });

  it("loads and displays portfolio detail modal with holdings, orders, and trades", async () => {
    const loadDetail = vi.fn().mockResolvedValue(mockDetail);
    render(<PortfoliosTable portfolios={[mockItem]} loadDetail={loadDetail} />);

    const detailBtn = screen.getByRole("button", { name: "Xem chi tiết" });
    fireEvent.click(detailBtn);

    expect(loadDetail).toHaveBeenCalledWith("pf-1111-2222");
    expect(await screen.findByRole("heading", { name: /Chi tiết danh mục: Trần Nhà Đầu Tư/i })).toBeInTheDocument();
    expect(screen.getByText(/Sổ lệnh giao dịch của người dùng/i)).toBeInTheDocument();
    expect(screen.getByText("VND")).toBeInTheDocument();
    expect(screen.getByText("Chờ khớp")).toBeInTheDocument();
    expect(screen.getByText(/Cổ phiếu đang nắm giữ/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử 20 lệnh gần nhất/i)).toBeInTheDocument();
  });

  it("allows admin to cancel an open order with reason and logs to audit", async () => {
    const loadDetail = vi.fn().mockResolvedValue(mockDetail);
    const cancelOrder = vi.fn().mockResolvedValue({
      status: "ok",
      message: "Hủy lệnh thành công.",
      order_id: "order-999",
    });

    render(
      <PortfoliosTable
        portfolios={[mockItem]}
        loadDetail={loadDetail}
        cancelOrder={cancelOrder}
      />
    );

    const detailBtn = screen.getByRole("button", { name: "Xem chi tiết" });
    fireEvent.click(detailBtn);

    expect(await screen.findByRole("heading", { name: /Chi tiết danh mục: Trần Nhà Đầu Tư/i })).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Hủy lệnh (Admin)" });
    fireEvent.click(cancelBtn);

    expect(screen.getByText(/Xác nhận hủy lệnh của người dùng: VND/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Nhập lý do hủy lệnh/i);
    fireEvent.change(input, { target: { value: "Can thiệp rủi ro thị trường theo yêu cầu sàn" } });

    const confirmBtn = screen.getByRole("button", { name: "Xác nhận hủy lệnh" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelOrder).toHaveBeenCalledWith(
        "pf-1111-2222",
        "order-999",
        "Can thiệp rủi ro thị trường theo yêu cầu sàn"
      );
    });

    expect(await screen.findByText(/Đã hủy thành công lệnh order-999/i)).toBeInTheDocument();
    expect(screen.getByText("Đã hủy")).toBeInTheDocument();
  });

  it("shows empty state when no portfolios are present", () => {
    render(<PortfoliosTable portfolios={[]} loadDetail={vi.fn()} />);

    expect(screen.getByText("Không tìm thấy danh mục giao dịch ảo nào.")).toBeInTheDocument();
  });
});
