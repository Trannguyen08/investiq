import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StockTradeActions } from "@/components/portfolio/stock-trade-actions";
import type { PaperDashboard } from "@/types/portfolio";

const useAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => useAuth() }));

const closedSessionDashboard: PaperDashboard = {
  account: {
    id: "portfolio-1", currency: "VND", starting_cash: "100000000", cash_balance: "100000000",
    available_cash: "100000000", reserved_cash: "0", invested_cost: "0", market_value: "0",
    total_value: "100000000", realized_pnl: "0", unrealized_pnl: "0", total_pnl: "0",
    total_return_percent: "0", valuation_partial: false, version: 1,
    created_at: "2026-10-11T02:00:00Z", updated_at: "2026-10-11T02:00:00Z",
  },
  holdings: [], orders: [], trades: [], equity_curve: [], equity_curve_method: "current_holdings_replay",
  notices: [], opportunities: [],
  assumptions: {
    starting_cash: "100000000", broker_fee_rate: "0.0015", sell_tax_rate: "0.001",
    fill_model: "automatic_latest_observed_price", max_holdings: 20, disclaimer: "Mô phỏng giáo dục.",
  },
  market: {
    provider: "fixture", provider_name: "InvestIQ fixture", market_time: "2026-10-09T08:33:00Z",
    received_at: "2026-10-11T02:00:00Z", delay_class: "development_fixture", freshness: "fixture",
    session: "closed", partial: false,
  },
};

describe("StockTradeActions", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useAuth.mockReturnValue({ status: "anonymous", user: null });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("opens the shared paper-order workflow from a stock detail", () => {
    render(<StockTradeActions symbol="FPT" name="CTCP FPT" price="102000" />);

    expect(screen.getByRole("button", { name: "Mua FPT" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bán FPT" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mua FPT" }));
    expect(screen.getByRole("dialog", { name: "Mua FPT" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  });

  it("only shows sell when the authenticated user owns available shares", async () => {
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ holdings: [{ symbol: "FPT", available_quantity: 100 }] }),
    }));

    render(<StockTradeActions symbol="FPT" name="CTCP FPT" price="102000" />);

    expect(await screen.findByRole("button", { name: "Bán FPT" })).toBeInTheDocument();
  });

  it("allows an authenticated paper buy while the real market session is closed", async () => {
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => closedSessionDashboard })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: closedSessionDashboard,
          order: { status: "filled", symbol: "FPT" },
          trade: { quantity: 100, symbol: "FPT", execution_price: "102000" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<StockTradeActions symbol="FPT" name="CTCP FPT" price="102000" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/kể cả cuối tuần/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mua FPT" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận mua" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByText(/Đã tự động khớp 100 FPT/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/portfolio-api/orders");
  });
});
