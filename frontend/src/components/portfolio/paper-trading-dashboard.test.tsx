import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaperTradingDashboard } from "@/components/portfolio/paper-trading-dashboard";
import type { PaperDashboard } from "@/types/portfolio";

const useAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => useAuth() }));

const dashboard: PaperDashboard = {
  account: {
    id: "portfolio-1", currency: "VND", starting_cash: "100000000",
    cash_balance: "89985000", invested_cost: "10015000", market_value: "10200000",
    total_value: "100185000", realized_pnl: "0", unrealized_pnl: "185000",
    total_pnl: "185000", total_return_percent: "0.19", version: 2,
    valuation_partial: false,
    created_at: "2026-10-08T02:00:00Z", updated_at: "2026-10-08T02:00:00Z",
  },
  holdings: [{
    symbol: "FPT", name: "CTCP FPT", exchange: "HOSE", sector: "Công nghệ",
    quantity: 100, average_cost: "100150", total_cost_basis: "10015000",
    current_price: "102000", market_value: "10200000", unrealized_pnl: "185000",
    unrealized_pnl_percent: "1.85", daily_change_percent: "2.00",
    portfolio_weight_percent: "10.18",
    price_history: [
      { timestamp: "2026-10-07T08:00:00Z", close: "100000" },
      { timestamp: "2026-10-08T08:00:00Z", close: "102000" },
    ],
  }],
  trades: [],
  equity_curve: [
    { timestamp: "2026-10-07T08:00:00Z", value: "99985000" },
    { timestamp: "2026-10-08T08:00:00Z", value: "100185000" },
  ],
  equity_curve_method: "current_holdings_replay",
  notices: [{ level: "info", symbol: "FPT", title: "Danh mục đang ổn định", message: "Tiếp tục quan sát." }],
  opportunities: [{ symbol: "HPG", name: "Hòa Phát", price: "29150", change_percent: "2.64", volume: "1000000", matched_value: "29150000000", interest_reasons: [] }],
  assumptions: { starting_cash: "100000000", broker_fee_rate: "0.0015", sell_tax_rate: "0.001", fill_model: "latest_observed_price", max_holdings: 20, disclaimer: "Mô phỏng giáo dục." },
  market: { provider: "fixture", provider_name: "InvestIQ fixture", market_time: "2026-10-08T02:00:00Z", received_at: "2026-10-08T02:00:00Z", delay_class: "development_fixture", freshness: "fixture", session: "closed", partial: false },
};

describe("PaperTradingDashboard", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => dashboard }));
  });

  it("shows private cash, holdings, profit and observed-data disclaimers", async () => {
    render(<PaperTradingDashboard positiveNews={[]} />);

    expect(await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" })).toBeInTheDocument();
    expect(screen.getAllByText("100.185.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getByText("89.985.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("185.000 ₫ · 1.85%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lịch sử giá FPT" })).toBeInTheDocument();
    expect(screen.getByText(/không định nghĩa lượt mua\/bán chủ động/)).toBeInTheDocument();
    expect(screen.getByText(/không dự báo giá tương lai/)).toBeInTheDocument();
  });

  it("places a CSRF-protected simulated order and refreshes the dashboard", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => dashboard })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: dashboard,
          trade: { side: "buy", symbol: "HPG", quantity: 100, execution_price: "29150" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<PaperTradingDashboard positiveNews={[]} />);

    await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" });
    fireEvent.change(screen.getByLabelText("Mã cổ phiếu"), { target: { value: "hpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Mua bằng tiền mô phỏng" }));

    expect(await screen.findByText(/Đã mua 100 HPG/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe("/portfolio-api/orders");
    expect(fetchMock.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("csrf");
  });

  it("requires login before creating a private simulation account", () => {
    useAuth.mockReturnValue({ status: "anonymous", user: null });
    render(<PaperTradingDashboard positiveNews={[]} />);

    expect(screen.getByRole("link", { name: "Đăng nhập để bắt đầu" })).toHaveAttribute("href", "/login");
  });
});
