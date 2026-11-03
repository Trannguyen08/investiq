import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StockGrowthPanel } from "@/components/market/stock-growth-panel";
import type { StockGrowthData } from "@/types/market";

afterEach(() => {
  cleanup();
});

const mockGrowthData: StockGrowthData = {
  symbol: "HPG",
  company_name: "Tập đoàn Hòa Phát",
  sector: "Thép & Vật liệu xây dựng",
  health_status: "expanding",
  health_title: "Bứt phá tăng trưởng",
  health_summary: "Tập đoàn Hòa Phát (HPG) đang thể hiện đà tăng trưởng vượt trội trong ngành.",
  market_cap: "185,240 tỷ",
  market_cap_growth_1m: "+3.5%",
  market_cap_growth_3m: "+8.2%",
  market_cap_growth_6m: "+14.6%",
  market_cap_growth_1y: "+25.1%",
  volume_growth_20d: "1.25x (+25.0% vs TB 20 phiên)",
  pe: "12.40",
  pb: "1.80",
  eps: "2,850 đ",
  roe_percent: "17.4%",
  quarters: [
    { period: "Q3/2025", revenue_growth_yoy: "+10.2%", profit_growth_yoy: "+18.5%", roe: "12.0%", net_margin: "9.5%" },
    { period: "Q4/2025", revenue_growth_yoy: "+12.4%", profit_growth_yoy: "+22.1%", roe: "13.5%", net_margin: "10.1%" },
    { period: "Q1/2026", revenue_growth_yoy: "+14.8%", profit_growth_yoy: "+25.4%", roe: "15.2%", net_margin: "11.0%" },
    { period: "Q2/2026", revenue_growth_yoy: "+18.2%", profit_growth_yoy: "+29.1%", roe: "17.4%", net_margin: "12.3%" },
  ],
  insights: [
    "Hiệu quả vốn (ROE): Đạt 17.4%, thuộc nhóm sinh lời cao vượt trội trong ngành.",
    "Định giá P/E: Hiện ở mức 12.4 lần với quy mô vốn hóa 185,240 tỷ VNĐ.",
    "Dòng tiền & Khuyến nghị F0: Thanh khoản đạt 1.25x TB 20 phiên. Chia vốn giải ngân từng phần.",
  ],
};

describe("StockGrowthPanel", () => {
  it("renders health status badge, title, and company summary", () => {
    render(<StockGrowthPanel growth={mockGrowthData} />);

    expect(screen.getAllByText("Bứt phá tăng trưởng").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Thép & Vật liệu xây dựng")).toBeInTheDocument();
    expect(
      screen.getByText("Tập đoàn Hòa Phát (HPG) đang thể hiện đà tăng trưởng vượt trội trong ngành."),
    ).toBeInTheDocument();
  });

  it("renders 4 market cap growth horizons", () => {
    render(<StockGrowthPanel growth={mockGrowthData} />);

    expect(screen.getByText("+3.5%")).toBeInTheDocument();
    expect(screen.getByText("+8.2%")).toBeInTheDocument();
    expect(screen.getByText("+14.6%")).toBeInTheDocument();
    expect(screen.getByText("+25.1%")).toBeInTheDocument();
  });

  it("renders core financial metrics matrix", () => {
    render(<StockGrowthPanel growth={mockGrowthData} />);

    expect(screen.getByText("185,240 tỷ")).toBeInTheDocument();
    expect(screen.getByText("1.25x (+25.0% vs TB 20 phiên)")).toBeInTheDocument();
    expect(screen.getByText("12.40 lần")).toBeInTheDocument();
    expect(screen.getByText("1.80 lần")).toBeInTheDocument();
    expect(screen.getByText("2,850 đ")).toBeInTheDocument();
    expect(screen.getAllByText("17.4%").length).toBeGreaterThanOrEqual(1);
  });

  it("renders quarterly growth chart and financial table with all periods", () => {
    render(<StockGrowthPanel growth={mockGrowthData} />);

    expect(screen.getAllByText("Q3/2025").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Q4/2025").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Q1/2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Q2/2026").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 3 educational investor insights", () => {
    render(<StockGrowthPanel growth={mockGrowthData} />);

    expect(
      screen.getByText("Hiệu quả vốn (ROE): Đạt 17.4%, thuộc nhóm sinh lời cao vượt trội trong ngành."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Định giá P/E: Hiện ở mức 12.4 lần với quy mô vốn hóa 185,240 tỷ VNĐ."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dòng tiền & Khuyến nghị F0: Thanh khoản đạt 1.25x TB 20 phiên. Chia vốn giải ngân từng phần."),
    ).toBeInTheDocument();
  });
});
