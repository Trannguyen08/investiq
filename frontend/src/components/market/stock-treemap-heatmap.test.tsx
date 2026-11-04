import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { computeSquarifiedTreemap, StockTreemapHeatmap } from "@/components/market/stock-treemap-heatmap";
import type { MarketInstrument, MarketSector } from "@/types/market";

function sampleInstrument(
  symbol: string,
  name: string,
  sector: string,
  changePercent: string,
  price: string,
  marketCap: string
): MarketInstrument {
  return {
    symbol,
    name,
    exchange: "HOSE",
    sector,
    price,
    reference_price: price,
    ceiling_price: "100000",
    floor_price: "10000",
    open_price: price,
    high_price: price,
    low_price: price,
    change: "1000",
    change_percent: changePercent,
    volume: "1000000",
    matched_value: "50000000000",
    foreign_net_value: "0",
    market_cap: marketCap,
    pe: "12",
    pb: "1.5",
    eps: "2000",
    roe_percent: "15",
    volume_vs_20d: "1.2",
    interest_score: "80",
    interest_reasons: [],
    is_vn30: true,
    candles: [],
  };
}

function sampleSector(name: string, changePercent: string, memberCount: number): MarketSector {
  return {
    name,
    change_percent: changePercent,
    member_count: memberCount,
    advances: 10,
    declines: 10,
    unchanged: 8,
    matched_value: "2000000000000",
    foreign_net_value: "0",
    market_cap: "100000000000000",
  };
}

describe("computeSquarifiedTreemap", () => {
  it("fills the bounding box completely without gaps or overflow", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      item: `STOCK_${i}`,
      value: (20 - i) * 100,
    }));
    const rects = computeSquarifiedTreemap(items, 1000, 600);

    expect(rects).toHaveLength(20);

    let minX = 100, minY = 100, maxX = 0, maxY = 0;
    for (const r of rects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }

    expect(minX).toBeCloseTo(0, 5);
    expect(minY).toBeCloseTo(0, 5);
    expect(maxX).toBeCloseTo(100, 5);
    expect(maxY).toBeCloseTo(100, 5);

    const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(10000, 1);
  });
});

describe("StockTreemapHeatmap", () => {
  const instruments: MarketInstrument[] = [
    sampleInstrument("VCB", "Ngân hàng TMCP Ngoại thương", "Ngân hàng", "-4.80", "89000", "500000000000000"),
    sampleInstrument("MBB", "Ngân hàng TMCP Quân đội", "Ngân hàng", "-2.05", "19100", "170000000000000"),
    sampleInstrument("VPB", "Ngân hàng TMCP Việt Nam Thịnh Vượng", "Ngân hàng", "-6.18", "21200", "160000000000000"),
    sampleInstrument("SSI", "CTCP Chứng khoán SSI", "Dịch vụ tài chính", "6.27", "20350", "61000000000000"),
    sampleInstrument("HPG", "CTCP Tập đoàn Hòa Phát", "Tài nguyên Cơ bản", "1.88", "21650", "180000000000000"),
  ];

  const sectors: MarketSector[] = [
    sampleSector("Ngân hàng", "-3.5", 28),
    sampleSector("Dịch vụ tài chính", "5.2", 48),
    sampleSector("Tài nguyên Cơ bản", "1.5", 100),
  ];

  it("renders treemap controls and representative stock tiles", () => {
    render(<StockTreemapHeatmap instruments={instruments} sectors={sectors} />);

    expect(screen.getByLabelText(/Ngành:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vốn hóa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GTGD" })).toBeInTheDocument();
    expect(screen.getByText(/Biến động trong ngày/)).toBeInTheDocument();

    // Default "Toàn bộ thị trường" shows top representative stocks
    expect(screen.getByText("VCB")).toBeInTheDocument();
    expect(screen.getByText("SSI")).toBeInTheDocument();
    expect(screen.getByText("HPG")).toBeInTheDocument();
  });

  it("filters stocks when a specific sector is selected", () => {
    render(<StockTreemapHeatmap instruments={instruments} sectors={sectors} />);

    const select = screen.getByLabelText(/Ngành:/);
    fireEvent.change(select, { target: { value: "Ngân hàng" } });

    expect(screen.getByText("VCB")).toBeInTheDocument();
    expect(screen.getByText("MBB")).toBeInTheDocument();
    expect(screen.getByText("VPB")).toBeInTheDocument();
    expect(screen.queryByText("SSI")).not.toBeInTheDocument();
    expect(screen.queryByText("HPG")).not.toBeInTheDocument();
  });

  it("toggles size metric between market cap and matched value", () => {
    render(<StockTreemapHeatmap instruments={instruments} sectors={sectors} />);

    const gtgdButton = screen.getByRole("button", { name: "GTGD" });
    fireEvent.click(gtgdButton);
    expect(gtgdButton).toHaveClass("bg-sky-600");

    const capButton = screen.getByRole("button", { name: "Vốn hóa" });
    fireEvent.click(capButton);
    expect(capButton).toHaveClass("bg-sky-600");
  });
});
