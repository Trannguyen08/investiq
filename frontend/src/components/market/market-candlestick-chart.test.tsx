import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import { IndicesView } from "@/components/market/market-workspace";
import type { IndexCollection, MarketCandle } from "@/types/market";

const candles: MarketCandle[] = [
  { timestamp: "2026-10-07T02:00:00Z", open: "100", high: "104", low: "99", close: "103", volume: "1000" },
  { timestamp: "2026-10-07T02:05:00Z", open: "103", high: "104", low: "100", close: "101", volume: "1500" },
  { timestamp: "2026-10-07T02:10:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1200" },
];

describe("MarketCandlestickChart", () => {
  afterEach(() => cleanup());

  it("renders rising and falling candles, volume, and a textual alternative", () => {
    const { container } = render(
      <MarketCandlestickChart candles={candles} label="Biểu đồ nến VN-Index" range="day" explain />,
    );

    expect(screen.getByRole("img", { name: /3 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".financial-chart-candles .up")).toHaveLength(2);
    expect(container.querySelectorAll(".financial-chart-candles .down")).toHaveLength(1);
    const accessibleTable = screen.getByRole("table", { name: "Biểu đồ nến VN-Index" });
    expect(accessibleTable).toBeInTheDocument();
    expect(accessibleTable.parentElement).toHaveClass("sr-only");
    expect(accessibleTable).not.toHaveClass("sr-only");
    expect(screen.getAllByText(/MA5/)).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Giải thích biểu đồ" })).toHaveTextContent("MA5 màu vàng");
    expect(screen.getByRole("region", { name: "Giải thích biểu đồ" })).toHaveTextContent("Đường ngang nét đứt");
    expect(screen.getByText("07/10 09:00")).toBeInTheDocument();
  });

  it("shows OHLC, volume, and candle movement on hover and keyboard focus", () => {
    render(<MarketCandlestickChart candles={candles} label="Biểu đồ nến VN-Index" />);

    const candleTargets = screen.getAllByRole("button", { name: /Xem nến/ });
    fireEvent.mouseEnter(candleTargets[0]);

    const tooltip = screen.getByLabelText("Thông tin cây nến đang chọn");
    expect(within(tooltip).getByText("100")).toBeInTheDocument();
    expect(within(tooltip).getByText("104")).toBeInTheDocument();
    expect(within(tooltip).getByText("99")).toBeInTheDocument();
    expect(within(tooltip).getByText("103")).toBeInTheDocument();
    expect(within(tooltip).getByText("1 N")).toBeInTheDocument();
    expect(within(tooltip).getByText("+3.00%")).toBeInTheDocument();

    fireEvent.mouseLeave(candleTargets[0]);
    expect(screen.queryByLabelText("Thông tin cây nến đang chọn")).not.toBeInTheDocument();
    fireEvent.focus(candleTargets[1]);
    expect(screen.getByLabelText("Thông tin cây nến đang chọn")).toBeInTheDocument();
  });

  it("shows an honest empty state when fewer than two candles are available", () => {
    const { container } = render(
      <MarketCandlestickChart candles={candles.slice(0, 1)} label="Biểu đồ nến FPT" />,
    );

    expect(screen.getByText("Chưa có đủ nến để vẽ biểu đồ")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("stops panning at the release position even when the pointer keeps moving", () => {
    const history = [
      ...candles.map((item) => ({ ...item, timestamp: item.timestamp.replace("2026-10-07", "2026-10-06") })),
      ...candles,
    ];
    const { container } = render(
      <MarketCandlestickChart candles={history} label="Biểu đồ nến FPT" range="day" />,
    );
    const stage = container.querySelector<HTMLElement>(".financial-chart-stage")!;
    Object.assign(stage, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, width: 300 } as DOMRect);

    fireEvent.pointerDown(stage, { pointerId: 7, button: 0, clientX: 0 });
    fireEvent.pointerMove(stage, { pointerId: 7, clientX: 120 });
    fireEvent.pointerUp(stage, { pointerId: 7, clientX: 120 });
    const releasedAt = screen.getAllByRole("button", { name: /Xem nến/ })[0].getAttribute("aria-label");

    fireEvent.pointerMove(stage, { pointerId: 7, clientX: -200 });

    expect(screen.getAllByRole("button", { name: /Xem nến/ })[0]).toHaveAttribute("aria-label", releasedAt);
    expect(stage).not.toHaveClass("dragging");
  });

  it("uses two-month year labels and clamps navigation at the present", () => {
    const history: MarketCandle[] = [
      "2025-01-03", "2025-03-03", "2025-05-05", "2025-07-03", "2025-09-03",
      "2025-11-03", "2026-01-05", "2026-03-03", "2026-05-04",
    ].map((date, index) => ({
      timestamp: `${date}T03:00:00Z`,
      open: String(100 + index), high: String(103 + index), low: String(99 + index),
      close: String(102 + index), volume: "1000",
    }));

    render(<MarketCandlestickChart candles={history} label="Biểu đồ nến FPT" range="year" />);

    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
    const present = screen.getByRole("button", { name: "Về hiện tại →" });
    expect(present).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "← Dữ liệu cũ hơn" }));
    expect(present).not.toBeDisabled();
    fireEvent.click(present);
    expect(present).toBeDisabled();
  });

  it("zooms the year chart with the mouse wheel within a bounded candle count", () => {
    const history: MarketCandle[] = Array.from({ length: 90 }, (_, index) => {
      const timestamp = new Date(Date.UTC(2026, 0, index + 1, 3)).toISOString();
      return {
        timestamp,
        open: String(100 + index), high: String(103 + index), low: String(99 + index),
        close: String(102 + index), volume: "1000",
      };
    });
    const { container } = render(
      <MarketCandlestickChart candles={history} label="Biểu đồ nến FPT" range="year" />,
    );
    const stage = container.querySelector<HTMLElement>(".financial-chart-stage")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);

    expect(screen.getByRole("img", { name: /90 nến giá xanh đỏ/ })).toBeInTheDocument();
    fireEvent.wheel(stage, { deltaY: -100, clientX: 500 });
    expect(screen.getByRole("img", { name: /74 nến giá xanh đỏ/ })).toBeInTheDocument();

    for (let index = 0; index < 20; index += 1) fireEvent.wheel(stage, { deltaY: -100, clientX: 500 });
    expect(screen.getByRole("img", { name: /10 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phóng to biểu đồ năm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thu nhỏ biểu đồ năm" })).not.toBeDisabled();
  });

  it("keeps a month wheel gesture inside the chart while zooming", () => {
    const history: MarketCandle[] = Array.from({ length: 72 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 9, 9, index)).toISOString(),
      open: String(100 + index), high: String(103 + index), low: String(99 + index),
      close: String(102 + index), volume: "1000",
    }));
    const { container } = render(
      <MarketCandlestickChart candles={history} label="Biểu đồ nến FPT" range="month" />,
    );
    const stage = container.querySelector<HTMLElement>(".financial-chart-stage")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);
    const pageWheel = vi.fn();
    window.addEventListener("wheel", pageWheel);
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      deltaY: -100,
    });

    const dispatched = fireEvent(stage, wheel);
    window.removeEventListener("wheel", pageWheel);

    expect(dispatched).toBe(false);
    expect(wheel.defaultPrevented).toBe(true);
    expect(pageWheel).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: /59 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Thu phóng biểu đồ tháng" })).toBeInTheDocument();
  });

  it("shows dates for daily candles and wheel-zooms a 30-candle snapshot", () => {
    const history: MarketCandle[] = Array.from({ length: 30 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
      open: String(100 + index), high: String(103 + index), low: String(99 + index),
      close: String(102 + index), volume: "1000",
    }));
    const { container } = render(
      <MarketCandlestickChart candles={history} label="Biểu đồ nến VN-Index" />,
    );
    const stage = container.querySelector<HTMLElement>(".financial-chart-stage")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);

    expect(container.querySelector(".financial-chart-axis")).toHaveTextContent(/01.*09/);
    expect(screen.queryByText("07:00")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Thu phóng biểu đồ snapshot" })).toBeInTheDocument();

    fireEvent.wheel(stage, { deltaY: -100, clientX: 500 });

    expect(screen.getByRole("img", { name: /25 nến giá xanh đỏ/ })).toBeInTheDocument();
  });
});

describe("IndicesView chart detail", () => {
  afterEach(() => cleanup());

  it("keeps the detailed index chart between 70 and 170 visible sessions", () => {
    const dailyCandles: MarketCandle[] = Array.from({ length: 190 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 8, index + 1, 3)).toISOString(),
      open: String(1700 + index),
      high: String(1710 + index),
      low: String(1695 + index),
      close: String(1705 + index),
      volume: String(500_000_000 + index * 1_000_000),
    }));
    const collection: IndexCollection = {
      data: [{
        symbol: "VNINDEX",
        name: "VN-Index",
        value: "1734",
        reference_value: "1733",
        open_value: "1729",
        high_value: "1739",
        low_value: "1724",
        change: "1",
        change_percent: "0.06",
        volume: "529000000",
        matched_value: "12000000000000",
        advances: 220,
        declines: 180,
        unchanged: 80,
        ceiling_count: 5,
        floor_count: 2,
        candles: dailyCandles,
      }],
      meta: {
        schema_version: "1",
        provider: "vnstock-kbs",
        provider_name: "Vnstock · nguồn KBS/VCI (có độ trễ)",
        market_time: "2026-09-30T08:00:00Z",
        received_at: "2026-09-30T08:01:00Z",
        delay_class: "source_delayed",
        freshness: "fresh",
        session: "closed",
        partial: false,
        market_timezone: "Asia/Ho_Chi_Minh",
      },
    };

    const { container } = render(<IndicesView collection={collection} selected="VNINDEX" />);

    expect(screen.getByText("170 nến ngày gần nhất")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Biểu đồ nến chi tiết VN-Index, 170 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Biểu đồ nến chi tiết VN-Index" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Giải thích biểu đồ" })).toHaveTextContent("MA20 màu xanh");
    expect(screen.getAllByRole("button", { name: /Xem nến/ })).toHaveLength(170);
    const stage = container.querySelector<HTMLElement>(".financial-chart-stage")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);
    fireEvent.wheel(stage, { deltaY: -100, clientX: 500 });
    expect(screen.getByRole("img", { name: /139 nến giá xanh đỏ/ })).toBeInTheDocument();
    for (let index = 0; index < 4; index += 1) fireEvent.wheel(stage, { deltaY: -100, clientX: 500 });
    expect(screen.getByRole("img", { name: /70 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phóng to biểu đồ năm" })).toBeDisabled();
    for (let index = 0; index < 5; index += 1) fireEvent.wheel(stage, { deltaY: 100, clientX: 500 });
    expect(screen.getByRole("img", { name: /170 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thu nhỏ biểu đồ năm" })).toBeDisabled();
    expect(container.querySelector(".index-detail .mini-candles")).not.toBeInTheDocument();
  }, 25_000);
});
