import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StocksView } from "@/components/market/market-stocks-beginner";
import type { InstrumentCollection, MarketIndex, MarketInstrument, SectorCollection } from "@/types/market";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const instrument: MarketInstrument = {
  symbol: "FPT",
  name: "Công ty Cổ phần FPT",
  exchange: "HOSE",
  sector: "Công nghệ Thông tin",
  price: "100000",
  reference_price: "99000",
  ceiling_price: "106000",
  floor_price: "92000",
  open_price: "99500",
  high_price: "101000",
  low_price: "98500",
  change: "1000",
  change_percent: "1.01",
  volume: "1000000",
  matched_value: "100000000000",
  foreign_net_value: "1000000000",
  market_cap: "150000000000000",
  pe: null,
  pb: null,
  eps: null,
  roe_percent: null,
  volume_vs_20d: "1",
  interest_score: "1",
  interest_reasons: [],
  is_vn30: true,
  candles: [],
};

const meta = {
  schema_version: "1",
  provider: "vnstock-kbs",
  provider_name: "Vnstock · nguồn KBS",
  market_time: "2026-10-07T00:00:00Z",
  received_at: "2026-10-07T00:00:01Z",
  delay_class: "source_delayed",
  freshness: "fresh" as const,
  session: "closed",
  partial: true,
  market_timezone: "Asia/Ho_Chi_Minh",
};

const collection: InstrumentCollection = {
  data: [instrument],
  pagination: { next_cursor: null, previous_cursor: null, has_more: false, limit: 15, total_items: 1, page: 1, total_pages: 1 },
  meta,
};

const sectors: SectorCollection = {
  data: [
    { name: "Ngân hàng", change_percent: "-0.4", member_count: 20, advances: 8, declines: 10, unchanged: 2, matched_value: "0", foreign_net_value: "0", market_cap: "2000000000000000" },
    { name: "Công nghệ Thông tin", change_percent: "1.01", member_count: 1, advances: 1, declines: 0, unchanged: 0, matched_value: "100000000000", foreign_net_value: "1000000000", market_cap: "150000000000000" },
  ],
  meta,
};

const index: MarketIndex = {
  symbol: "VNINDEX",
  name: "VN-Index",
  value: "1800",
  reference_value: "1790",
  open_value: "1795",
  high_value: "1810",
  low_value: "1780",
  change: "10",
  change_percent: "0.56",
  volume: "1000",
  matched_value: "1000000",
  advances: 1,
  declines: 0,
  unchanged: 0,
  ceiling_count: 0,
  floor_count: 0,
  candles: [],
};

describe("StocksView navigation", () => {
  beforeEach(() => { push.mockReset(); });
  afterEach(cleanup);

  it("uses App Router navigation when a stock row is clicked", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    fireEvent.click(screen.getByRole("row", { name: /FPT/ }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("selected=FPT"));
  });

  it("supports opening the row with the keyboard", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    fireEvent.keyDown(screen.getByRole("row", { name: /FPT/ }), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(expect.stringContaining("selected=FPT"));
  });

  it("shows sector counts and breadth from the complete aggregate", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    expect(screen.getByText("20 mã")).toBeInTheDocument();
    expect(screen.getByText(/toàn bộ 21 cổ phiếu/)).toBeInTheDocument();
    expect(screen.getByText("9 tăng")).toBeInTheDocument();
  });

  it("fits the basic table in its frame and maps volatility levels to the requested tones", () => {
    const low = { ...instrument, symbol: "LOW", change_percent: "0.5" };
    const medium = { ...instrument, symbol: "MID", change_percent: "2" };
    const high = { ...instrument, symbol: "HIG", change_percent: "4" };
    const values = {
      ...collection,
      data: [low, medium, high],
      pagination: { ...collection.pagination, total_items: 3 },
    };

    render(<StocksView collection={values} summary={values} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    expect(screen.getByRole("table", { name: "Bảng cổ phiếu dễ đọc" })).toHaveClass("simple-stock-table", "basic");
    expect(screen.getByText("Thấp")).toHaveClass("low");
    expect(screen.getByText("Vừa")).toHaveClass("medium");
    expect(screen.getByText("Cao")).toHaveClass("high");
  });

  it("marks the advanced table for the compact nine-column layout", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "advanced" }} selected="" selectedCandles={[]} index={index} />);

    expect(screen.getByRole("table", { name: "Bảng cổ phiếu nâng cao" })).toHaveClass("simple-stock-table", "advanced");
  });

  it("shows explicit thresholds in shareable presets and removes saved browser views", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "FPT", exchange: "HOSE", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    expect(screen.getByRole("link", { name: /Tăng mạnh/ })).toHaveAttribute("href", expect.stringContaining("min_change=2"));
    expect(screen.getByText("+2% trở lên")).toBeInTheDocument();
    expect(screen.getByText("−2% trở xuống")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Góc nhìn đã lưu" })).not.toBeInTheDocument();
  });

  it("opens the advanced fields from the button beside the ordering control", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} />);

    const trigger = screen.getByRole("button", { name: "Lọc nâng cao" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("% tăng tối thiểu")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("% tăng tối thiểu")).toBeInTheDocument();
  });

  it("selects, removes and reloads up to three stocks in a comparison dialog", () => {
    const second = { ...instrument, symbol: "HPG", name: "Tập đoàn Hòa Phát", change_percent: "-1.2", is_vn30: false };
    const values = { ...collection, data: [instrument, second], pagination: { ...collection.pagination, total_items: 2 } };
    render(<StocksView collection={values} summary={values} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} comparisonOptions={[instrument, second]} />);

    fireEvent.click(screen.getByRole("button", { name: "So sánh cổ phiếu" }));
    expect(screen.getByRole("dialog", { name: "So sánh cổ phiếu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thêm FPT vào so sánh" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm HPG vào so sánh" }));

    expect(screen.getByText("Đã chọn 2/3")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có đánh giá AI đã kiểm định")).toHaveLength(2);
    expect(screen.getAllByText("Chưa có").length).toBeGreaterThan(0);
    const metricGroups = document.querySelectorAll(".comparison-metrics");
    expect(metricGroups).toHaveLength(2);
    metricGroups.forEach((group) => {
      expect(group.children).toHaveLength(7);
      expect(Array.from(group.children).every((metric) => metric.classList.contains("comparison-metric"))).toBe(true);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Gỡ HPG khỏi so sánh" })[0]);
    expect(screen.getByText("Đã chọn 1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thêm HPG vào so sánh" }));
    fireEvent.click(screen.getByRole("button", { name: "Tải dữ liệu so sánh" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("compare=FPT%2CHPG"));
  });

  it("closes the comparison dialog with Escape and returns focus to its trigger", () => {
    render(<StocksView collection={collection} summary={collection} sectors={sectors} filters={{ q: "", exchange: "", sort: "vn30", direction: "desc", mode: "basic" }} selected="" selectedCandles={[]} index={index} comparisonOptions={[instrument]} />);

    const trigger = screen.getByRole("button", { name: "So sánh cổ phiếu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "So sánh cổ phiếu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
