import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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



  });

  it("opens a read-only unrealized P&L scenario and recalculates only from quantity", async () => {

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" });

    fireEvent.click(screen.getByRole("button", { name: /Lãi\/lỗ chưa chốt/ }));

    const dialog = screen.getByRole("dialog", { name: "Lãi/lỗ dự kiến nếu bán" });

    const quantity = screen.getByRole("spinbutton", { name: "Khối lượng bán giả định FPT" });

    expect(dialog).toHaveTextContent("Chỉ đọc, không bán");

    expect(dialog).toHaveTextContent("159.500 ₫");

    expect(dialog).toHaveTextContent("+1,59%");

    expect(quantity).toHaveValue(100);

    expect(quantity).toHaveAttribute("max", "100");

    expect(screen.queryByRole("button", { name: /xác nhận bán/i })).not.toBeInTheDocument();

    fireEvent.change(quantity, { target: { value: "50" } });

    expect(quantity).toHaveValue(50);

    expect(dialog).toHaveTextContent("79.750 ₫");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Lãi/lỗ dự kiến nếu bán" })).not.toBeInTheDocument();

  });

  it("attributes realized gains and losses to their completed sell trades", async () => {

    const dashboardWithSales: PaperDashboard = {

      ...dashboard,

      account: { ...dashboard.account, realized_pnl: "371750" },

      trades: [

        {

          id: "sale-profit", side: "sell", symbol: "FPT", name: "CTCP FPT", exchange: "HOSE",

          quantity: 50, execution_price: "110000", gross_amount: "5500000", fee_amount: "8250",

          tax_amount: "5500", cash_effect: "5486250", realized_pnl: "478750", provider: "fixture",

          price_at: "2026-10-08T02:00:00Z", received_at: "2026-10-08T02:00:00Z",

          delay_class: "development_fixture", created_at: "2026-10-08T02:00:00Z",

        },

        {

          id: "sale-loss", side: "sell", symbol: "HPG", name: "Tập đoàn Hòa Phát", exchange: "HOSE",

          quantity: 100, execution_price: "28000", gross_amount: "2800000", fee_amount: "4200",

          tax_amount: "2800", cash_effect: "2793000", realized_pnl: "-107000", provider: "fixture",

          price_at: "2026-10-07T02:00:00Z", received_at: "2026-10-07T02:00:00Z",

          delay_class: "development_fixture", created_at: "2026-10-07T02:00:00Z",

        },

      ],

    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => dashboardWithSales }));

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" });

    fireEvent.click(screen.getByRole("button", { name: /Lãi\/lỗ đã chốt/ }));

    const dialog = screen.getByRole("dialog", { name: "Lãi/lỗ thực tế đã chốt" });

    expect(screen.getByRole("table", { name: "Chi tiết lãi lỗ thực tế theo giao dịch bán" })).toBeInTheDocument();

    expect(dialog).toHaveTextContent("FPT");

    expect(dialog).toHaveTextContent("Lãi từ giao dịch bán");

    expect(dialog).toHaveTextContent("478.750 ₫");

    expect(dialog).toHaveTextContent("HPG");

    expect(dialog).toHaveTextContent("Lỗ từ giao dịch bán");

    expect(dialog).toHaveTextContent("-107.000 ₫");

    expect(dialog).toHaveTextContent("Giá vốn bình quân đã gồm phí mua");

    expect(dialog).toHaveTextContent("Chỉ để đối chiếu hiện tại");

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

    expect(await screen.findByRole("status")).toHaveTextContent(/Mua thành công: Đã tự động khớp 100 HPG/);

    expect(screen.queryByRole("dialog", { name: "Mua HPG" })).not.toBeInTheDocument();

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

    expect(await screen.findByText("18.5 / 4.2")).toBeInTheDocument();

    expect(fetchMock.mock.calls[1][0]).toContain("/market-data-api/fundamentals?symbols=FPT");

    const marketTable = screen.getByRole("table", { name: "Bảng cổ phiếu nâng cao để giao dịch mô phỏng" });

    const row = within(marketTable).getByRole("row", { name: /FPT/ });

    expect(within(row).getByText("+102.000")).toHaveClass("price-up");

    expect(within(row).getByText("TC +100.000")).toHaveClass("price-reference");

  });

  it("loads fundamental ratios in bounded batches as each page becomes visible", async () => {

    const instruments = Array.from({ length: 16 }, (_, index) => ({

      ...marketInstrument,

      symbol: `S${String(index).padStart(2, "0")}`,

      pe: null,

      pb: null,

    }));

    const fetchMock = vi.fn()

      .mockResolvedValueOnce({ ok: true, json: async () => dashboard })

      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    vi.stubGlobal("fetch", fetchMock);

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={instruments} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(decodeURIComponent(String(fetchMock.mock.calls[1][0])).split(",")).toHaveLength(15);

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    expect(String(fetchMock.mock.calls[2][0])).toContain("S15");

  });

  it("keeps the market table in view when changing pages", async () => {

    const instruments = Array.from({ length: 16 }, (_, index) => ({

      ...marketInstrument,

      symbol: `S${String(index).padStart(2, "0")}`,

    }));

    const scrollIntoView = vi.fn();

    Object.defineProperty(Element.prototype, "scrollIntoView", {

      configurable: true,

      value: scrollIntoView,

    });

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {

      callback(0);

      return 1;

    });

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={instruments} />);

    await screen.findByRole("heading", { name: /Danh mục mô phỏng/ });

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    expect(screen.getByText("S15")).toBeInTheDocument();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });

  });

  it("requires login before creating a private simulation account", () => {

    useAuth.mockReturnValue({ status: "anonymous", user: null });

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    expect(screen.getByRole("link", { name: "Đăng nhập để bắt đầu" })).toHaveAttribute("href", "/login");

  });

  it("renders AI daily portfolio report section and handles instant send", async () => {

    useAuth.mockReturnValue({ status: "authenticated", user: { id: "u-1", email: "trader@gmail.com" } });

    const fetchMock = vi.fn()

      .mockResolvedValueOnce({ ok: true, json: async () => dashboard })

      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf-token-123" }) })

      .mockResolvedValueOnce({ ok: true, json: async () => ({ is_active: true, email: "trader@gmail.com" }) })

      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, message: "OK" }) });

    vi.stubGlobal("fetch", fetchMock);

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    await screen.findByRole("heading", { name: "Danh mục mô phỏng của bạn" });

    expect(screen.getByText("Báo cáo kết quả và nhận xét AI hàng ngày qua Email")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Gửi báo cáo phân tích AI ngay bây giờ" })).toBeInTheDocument();

    const emailInput = screen.getByLabelText("Địa chỉ Email nhận báo cáo:");

    fireEvent.change(emailInput, { target: { value: "trader@gmail.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo phân tích AI ngay bây giờ" }));

    expect(await screen.findByText(/Đã gửi báo cáo tổng kết danh mục & nhận xét AI thành công/)).toBeInTheDocument();

  });

  it("supports Option B exchange_hours mode toggle, T+2 cash advance, waiting order actions, and MP/orderbook depth order placement", async () => {
    const exchangeSimDashboard: PaperDashboard = {
      ...dashboard,
      orders: [pendingOrder],
      exchange_simulation: {
        execution_mode: "exchange_hours",
        session_active: false,
        session_message: "Thị trường nghỉ cuối tuần. Lệnh được lưu chờ phiên sáng Thứ Hai.",
        supported_order_types: ["LO", "MP", "ATO", "ATC"],
        price_bands: { HOSE: "7%", HNX: "10%", UPCoM: "15%" },
        t2_settlement: {
          cycle_rule: "T+2 (Chuẩn VSDC Việt Nam)",
          advance_fee_rate_per_day: "0.0003",
          pending_buy_shares_by_symbol: { FPT: 100 },
          pending_buy_settlements: [],
          pending_sell_settlements: [],
          receivable_cash_t2: "10000000",
          already_advanced_cash: "0",
          advanceable_cash: "10000000",
          estimated_advance_fee: "6000",
          net_advance_available: "9994000",
          recent_advances: [],
        },
        conditional_triggers: [],
        order_meta: {
          [pendingOrder.id]: {
            display_order_type: "ATO",
            lot_type: "even",
            slippage_vnd: "0",
            slippage_bps: "0",
            quarantine_until: null,
            pending_reason: "Chờ phiên khớp lệnh định kỳ mở cửa (ATO 09:00 - 09:15).",
            stop_loss_price: null,
            take_profit_price: null,
          },
        },
      },
    };

    const fetchMock = vi.fn()
      // 1. Initial dashboard load
      .mockResolvedValueOnce({ ok: true, json: async () => exchangeSimDashboard })
      // 2. CSRF + Cash advance
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf-adv" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          advance: { net_received: "9994000", fee_amount: "6000" },
          data: exchangeSimDashboard,
        }),
      })
      // 3. CSRF + Force-fill waiting order
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf-fill" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: exchangeSimDashboard,
          order: { ...pendingOrder, status: "filled" },
          trade: { symbol: "HPG", quantity: 100, execution_price: "28000" },
        }),
      })
      // 4. CSRF + Place MP order with Stop-Loss / Take-Profit that rests in orderbook outside session
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf-order" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: exchangeSimDashboard,
          order: pendingOrder,
          trade: null,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<PaperTradingDashboard positiveNews={[]} marketInstruments={marketInstruments} />);

    expect(
      await screen.findByRole("heading", {
        name: /Chế độ Giờ sàn thật HOSE\/HNX/,
      })
    ).toBeInTheDocument();

    // Verify T+2 pending shares and receivable cash are displayed
    expect(screen.getByText("FPT: 100 CP")).toBeInTheDocument();
    expect(screen.getByText("10.000.000 ₫")).toBeInTheDocument();

    // Click T+2 Cash Advance button
    fireEvent.click(screen.getByRole("button", { name: /Ứng trước tiền bán/ }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      /Ứng trước tiền bán T\+2 thành công: Thực nhận 9.994.000 ₫/
    );

    // In exchange_hours mode, waiting order shows "Khớp nhanh" and "Hủy lệnh"
    expect(screen.getByText("Mua (ATO)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy lệnh" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Khớp nhanh HPG" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      /Đã khớp nhanh 100 HPG tại giá 28.000 ₫/
    );

    // Open Buy dialog for HPG, select MP order type, test percentage pills and submit
    fireEvent.click(screen.getByRole("button", { name: "Mua HPG" }));
    const typeSelect = screen.getByLabelText("Loại lệnh sàn HOSE/HNX");
    fireEvent.change(typeSelect, { target: { value: "MP" } });

    // Click quick percentage pills for Stop-Loss and Take-Profit
    fireEvent.click(screen.getByRole("button", { name: "-7%" }));
    expect(await screen.findByText(/Kích hoạt khi ≤ 27.100/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+15%" }));
    expect(await screen.findByText(/Kích hoạt khi ≥ 33.500/)).toBeInTheDocument();

    // Custom direct price input also works seamlessly
    fireEvent.change(screen.getByLabelText("Cắt lỗ tự động (Stop-Loss)"), {
      target: { value: "27000" },
    });
    fireEvent.change(screen.getByLabelText("Chốt lời tự động (Take-Profit)"), {
      target: { value: "33000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mua" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /Đã đặt lệnh chờ Mua 100 HPG \(MP\)/
    );
  });

});
