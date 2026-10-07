import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockPriceChart } from "@/components/market/stock-price-chart";
import type { MarketCandle } from "@/types/market";

const candles: MarketCandle[] = [
  { timestamp: "2026-10-07T02:00:00Z", open: "100", high: "102", low: "99", close: "101", volume: "1000" },
  { timestamp: "2026-10-07T02:05:00Z", open: "101", high: "104", low: "100", close: "103", volume: "1500" },
];

describe("StockPriceChart", () => {
  it("renders accessible range controls and a chart when observations exist", () => {
    render(<StockPriceChart symbol="FPT" range="day" candles={candles} />);

    expect(screen.getByRole("img", { name: /Biểu đồ nến FPT/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ngày" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Năm" })).toHaveAttribute(
      "href",
      "/market/stocks/FPT?range=year",
    );
  });

  it("explains provider limitations instead of fabricating yearly history", () => {
    render(<StockPriceChart symbol="FPT" range="year" candles={[]} />);

    expect(screen.getByText("Chưa có chuỗi giá cho khoảng này")).toBeInTheDocument();
    expect(screen.getByText(/không cung cấp OHLC nhiều phiên/)).toBeInTheDocument();
  });
});
