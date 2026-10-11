import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketCandlestickChart } from "@/components/market/market-candlestick-chart";
import type { MarketCandle } from "@/types/market";

const candles: MarketCandle[] = [
  { timestamp: "2026-10-07T02:00:00Z", open: "100", high: "104", low: "99", close: "103", volume: "1000" },
  { timestamp: "2026-10-07T02:05:00Z", open: "103", high: "104", low: "100", close: "101", volume: "1500" },
  { timestamp: "2026-10-07T02:10:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1200" },
];

describe("MarketCandlestickChart", () => {
  it("renders rising and falling candles, volume, and a textual alternative", () => {
    const { container } = render(
      <MarketCandlestickChart candles={candles} label="Biểu đồ nến VN-Index" explain />,
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
});
