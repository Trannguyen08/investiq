import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaperTradingDashboard } from "@/components/portfolio/paper-trading-dashboard";
import type { MarketInstrument } from "@/types/market";
import type { PaperDashboard } from "@/types/portfolio";

const useAuth = vi.fn();
const refresh = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => useAuth() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const dashboard: PaperDashboard = {
  account: {
    id: "portfolio-1", currency: "VND", starting_cash: "100000000",
    cash_balance: "89985000", invested_cost: "10015000", market_value: "10200000",
    available_cash: "89985000", reserved_cash: "0",
    total_value: "100185000", realized_pnl: "0", unrealized_pnl: "185000",
    total_pnl: "185000", total_return_percent: "0.19", version: 2,
    valuation_partial: false,
    created_at: "2026-10-08T02:00:00Z", updated_at: "2026-10-08T02:00:00Z",
  },
  holdings: [{
    symbol: "FPT", name: "CTCP FPT", exchange: "HOSE", sector: "Công nghệ",
    quantity: 100, available_quantity: 100, average_cost: "100150", total_cost_basis: "10015000",
    current_price: "102000", market_value: "10200000", unrealized_pnl: "185000",
    unrealized_pnl_percent: "1.85", daily_change_percent: "2.00",
    portfolio_weight_percent: "10.18",
    price_history: [
      { timestamp: "2026-10-07T08:00:00Z", close: "100000" },
      { timestamp: "2026-10-08T08:00:00Z", close: "102000" },
    ],
  }],
  orders: [],
  trades: [],
  equity_curve: [
    { timestamp: "2026-10-07T08:00:00Z", value: "99985000" },
    { timestamp: "2026-10-08T08:00:00Z", value: "100185000" },
  ],
  equity_curve_method: "current_holdings_replay",
  notices: [{ level: "info", symbol: "FPT", title: "Danh mục đang ổn định", message: "Tiếp tục quan sát." }],
  opportunities: [{ symbol: "HPG", name: "Hòa Phát", price: "29150", change_percent: "2.64", volume: "1000000", matched_value: "29150000000", interest_reasons: [] }],
  assumptions: { starting_cash: "100000000", broker_fee_rate: "0.0015", sell_tax_rate: "0.001", fill_model: "automatic_latest_observed_price", max_holdings: 20, disclaimer: "Mô phỏng giáo dục." },
  market: { provider: "fixture", provider_name: "InvestIQ fixture", market_time: "2026-10-08T02:00:00Z", received_at: "2026-10-08T02:00:00Z", delay_class: "development_fixture", freshness: "fixture", session: "closed", partial: false },
};

const marketInstrument: MarketInstrument = {
  symbol: "FPT",
  name: "Công ty Cổ phần FPT",
  exchange: "HOSE",
  sector: "Công nghệ Thông tin",
  price: "102000",
  reference_price: "100000",
  ceiling_price: "107000",
  floor_price: "93000",
  open_price: "100500",
  high_price: "103000",
  low_price: "99500",
  change: "2000",
  change_percent: "2.00",
  volume: "1000000",
  matched_value: "102000000000",
  foreign_net_value: "1000000000",
  market_cap: "150000000000000",
  pe: "18.5",
  pb: "4.2",
  eps: "5500",
  roe_percent: "22",
  volume_vs_20d: "1.2",
  interest_score: "2",
  interest_reasons: [],
  is_vn30: true,
  candles: [],
};

const marketInstruments = [
  marketInstrument,
  { ...marketInstrument, symbol: "HPG", name: "Tập đoàn Hòa Phát", price: "29150", change_percent: "2.64", is_vn30: false },
];

const pendingOrder = {
  id: "12345678-1234-4234-8234-123456789012",
  side: "buy" as const,
  order_type: "LO" as const,
  status: "open" as const,
  symbol: "HPG",
  name: "Tập đoàn Hòa Phát",
  exchange: "HOSE",
  quantity: 100,
  filled_quantity: 0,
  limit_price: "28000",
  reserved_cash: "2804200",
  reserved_quantity: 0,
  provider: "fixture",
  price_at: "2026-10-08T02:00:00Z",
  received_at: "2026-10-08T02:00:00Z",
  delay_class: "development_fixture",
  created_at: "2026-10-08T02:00:00Z",
  updated_at: "2026-10-08T02:00:00Z",
  expires_at: "2026-10-08T08:00:00Z",
  cancelled_at: null,
};

describe("PaperTradingDashboard", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => dashboard }));
  });

  it("shows private cash, holdings, profit and observed-data disclaimers", async () => {
    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    expect(await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" })).toBeInTheDocument();
    expect(screen.getAllByText("100.185.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getByText("89.985.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("185.000 ₫ · 1.85%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lịch sử giá FPT" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Bảng cổ phiếu nâng cao để giao dịch mô phỏng" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Bảng quản lý cổ phiếu đã mua" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mua HPG" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bán HPG" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bán FPT" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Bán FPT" })[0]);
    expect(screen.getByRole("dialog", { name: "Bán FPT" })).toBeInTheDocument();
    expect(screen.getByLabelText("Số lượng cổ phiếu")).toHaveValue(100);
    expect(screen.getByLabelText("Số lượng cổ phiếu")).toHaveAttribute("max", "100");
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
          order: { status: "filled", order_type: "LO", symbol: "HPG" },
          trade: { side: "buy", symbol: "HPG", quantity: 100, execution_price: "29150" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" });
    fireEvent.click(screen.getByRole("button", { name: "Mua HPG" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mua" }));

    expect(await screen.findByText(/Đã tự động khớp 100 HPG/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe("/portfolio-api/orders");
    expect(fetchMock.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("csrf");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      side: "buy", order_type: "LO", symbol: "HPG", quantity: 100, limit_price: "29150",
    });
  });

  it("shows a recoverable market-data error instead of disguising it as an empty board", async () => {
    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={[]} marketLoadError />);

    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent("Không thể tải bảng giá");
    expect(screen.queryByRole("table", { name: "Bảng cổ phiếu nâng cao để giao dịch mô phỏng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("explains automatic educational fills and omits the status filter", async () => {
    const waitingDashboard: PaperDashboard = {
      ...dashboard,
      account: { ...dashboard.account, available_cash: "87180800", reserved_cash: "2804200" },
      orders: [pendingOrder],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => waitingDashboard }));
    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    expect(await screen.findByText(/Tự động khớp trong môi trường học tập/)).toBeInTheDocument();
    expect(screen.getByText(/lệnh có thể chờ, khớp một phần hoặc không khớp/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Trạng thái")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hủy lệnh" })).not.toBeInTheDocument();
  });

  it("loads P/E and P/B for visible rows that do not include fundamentals", async () => {
    const instrumentWithoutRatios = { ...marketInstrument, pe: null, pb: null };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => dashboard })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ symbol: "FPT", pe: "18.5", pb: "4.2" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={[instrumentWithoutRatios]} />);

    expect(await screen.findByText("18.5 · 4.2")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toContain("/market-data-api/fundamentals?symbols=FPT");
  });

  it("requires login before creating a private simulation account", () => {
    useAuth.mockReturnValue({ status: "anonymous", user: null });
    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    expect(screen.getByRole("link", { name: "Đăng nhập để bắt đầu" })).toHaveAttribute("href", "/login");
  });
});
