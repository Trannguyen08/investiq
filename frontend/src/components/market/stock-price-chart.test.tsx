import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STOCK_DETAIL_CHART_LIMITS, StockLivePrice, StockMetricsPanel, StockPriceChart } from "@/components/market/stock-price-chart";
import type { MarketCandle, MarketInstrument } from "@/types/market";

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

  it("renders provider fundamentals in the metrics panel beside the chart", () => {
    const item: MarketInstrument = {
      symbol: "FPT", name: "FPT", exchange: "HOSE", sector: "Công nghệ",
      price: "102000", reference_price: "100000", ceiling_price: "107000",
      floor_price: "93000", open_price: "100500", high_price: "103000",
      low_price: "99500", change: "2000", change_percent: "2", volume: "2000000",
      matched_value: "204000000000", foreign_net_value: "1020000000",
      market_cap: "150000000000000", pe: "15.53", pb: "3.7", eps: "6500",
      roe_percent: "5.89", volume_vs_20d: "1", interest_score: "1",
      interest_reasons: [], is_vn30: true, candles: [],
    };

    render(<StockMetricsPanel item={item} />);

    expect(screen.getByText("15,53 lần")).toBeInTheDocument();
    expect(screen.getByText("3,7 lần")).toBeInTheDocument();
    expect(screen.getByText("Giá thị trường trên lợi nhuận mỗi cổ phiếu.")).toBeInTheDocument();
    expect(screen.getByLabelText("Thông tin thị trường FPT")).toHaveClass("stock-metrics-panel");
  });

  it("labels pre-match quote fields as unavailable instead of displaying misleading zeros", () => {
    const item: MarketInstrument = {
      symbol: "VCB", name: "Vietcombank", exchange: "HOSE", sector: "Ngân hàng",
      price: "57000", reference_price: "57200", ceiling_price: "61200",
      floor_price: "53200", open_price: "0", high_price: "0", low_price: "0",
      change: "-200", change_percent: "-0.35", volume: "0", matched_value: "0",
      foreign_net_value: "0", market_cap: "476300000000000", pe: "12.38", pb: "2.33",
      eps: "5008.22", roe_percent: "4.13", volume_vs_20d: "0", interest_score: "0",
      interest_reasons: [], is_vn30: true, candles: [],
    };

    render(<><StockLivePrice item={item} /><StockMetricsPanel item={item} /></>);

    expect(screen.getByText("Giá dự kiến · chưa có khớp lệnh")).toBeInTheDocument();
    expect(screen.getByText("Chưa khớp lệnh")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa phát sinh")).toHaveLength(6);
    expect(screen.getByText(/InvestIQ không thay số chưa có bằng dữ liệu giả/)).toBeInTheDocument();
  });

  it("enforces minimum candle boundaries: 70 for day/week, 100 for month, 150 for year", () => {
    expect(STOCK_DETAIL_CHART_LIMITS.day.minimum).toBe(70);
    expect(STOCK_DETAIL_CHART_LIMITS.week.minimum).toBe(70);
    expect(STOCK_DETAIL_CHART_LIMITS.month.minimum).toBe(100);
    expect(STOCK_DETAIL_CHART_LIMITS.year.minimum).toBe(150);

    const manyCandles: MarketCandle[] = Array.from({ length: 200 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 0, index + 1, 3)).toISOString(),
      open: "100", high: "105", low: "98", close: "102", volume: "1000",
    }));

    // In day view, with 200 candles, initial/minimum visible candles should be 70
    const { rerender } = render(<StockPriceChart symbol="FPT" range="day" candles={manyCandles} />);
    expect(screen.getByRole("img", { name: /70 nến giá xanh đỏ/ })).toBeInTheDocument();

    // In week view, with 200 candles, initial/minimum visible candles should be 70
    rerender(<StockPriceChart symbol="FPT" range="week" candles={manyCandles} />);
    expect(screen.getByRole("img", { name: /70 nến giá xanh đỏ/ })).toBeInTheDocument();

    // In month view, with 200 candles, initial/minimum visible candles should be 100
    rerender(<StockPriceChart symbol="FPT" range="month" candles={manyCandles} />);
    expect(screen.getByRole("img", { name: /100 nến giá xanh đỏ/ })).toBeInTheDocument();

    // In year view, with 200 candles, zooming in clamps at exactly minimum 150 candles
    rerender(<StockPriceChart symbol="FPT" range="year" candles={manyCandles} />);
    const zoomIn = screen.getByRole("button", { name: "Phóng to biểu đồ năm" });
    while (!zoomIn.hasAttribute("disabled")) {
      fireEvent.click(zoomIn);
    }
    expect(screen.getByRole("img", { name: /150 nến giá xanh đỏ/ })).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });
});
