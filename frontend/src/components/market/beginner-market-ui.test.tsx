import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketColorLegend, MarketLineChart, SentimentGauge } from "@/components/market/beginner-market-ui";
import type { MarketCandle } from "@/types/market";

const candles: MarketCandle[] = [
  { timestamp: "2026-10-06T00:00:00Z", open: "100", high: "103", low: "99", close: "101", volume: "1000" },
  { timestamp: "2026-10-07T00:00:00Z", open: "101", high: "106", low: "100", close: "105", volume: "1200" },
];

describe("beginner market UI", () => {
  it("renders the five Vietnamese market colors and a labeled line chart", () => {
    render(<><MarketColorLegend /><MarketLineChart candles={candles} label="Đường giá VN-Index" /></>);

    expect(screen.getByText("Xanh lá: tăng")).toBeInTheDocument();
    expect(screen.getByText("Tím: giá trần")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Đường giá VN-Index" })).toBeInTheDocument();
  });

  it("labels the sentiment gauge as an estimate", () => {
    render(<SentimentGauge score={25} />);

    expect(screen.getByLabelText(/Tâm lý phiên ước tính: Thận trọng/)).toBeInTheDocument();
    expect(screen.getByText(/không phải chỉ số Fear & Greed chính thức/)).toBeInTheDocument();
  });
});
