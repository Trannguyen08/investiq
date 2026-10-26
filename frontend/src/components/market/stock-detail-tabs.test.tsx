import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StockDetailTabs } from "@/components/market/stock-detail-tabs";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe("StockDetailTabs", () => {
  it("renders 3 accessible tabs with chart tab active by default", () => {
    render(
      <StockDetailTabs
        symbol="HPG"
        newsCount={5}
        chartContent={<div data-testid="chart-content">Biểu đồ nến HPG</div>}
        growthContent={<div data-testid="growth-content">Tăng trưởng HPG</div>}
        newsContent={<div data-testid="news-content">Tin tức HPG</div>}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent("Biểu đồ & Sổ lệnh");
    expect(tabs[1]).toHaveTextContent("Tăng trưởng & Tài chính");
    expect(tabs[2]).toHaveTextContent("Tin tức doanh nghiệp");
    expect(tabs[2]).toHaveTextContent("5");

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");

    const chartPanel = document.getElementById("panel-chart");
    const growthPanel = document.getElementById("panel-growth");
    const newsPanel = document.getElementById("panel-news");

    expect(chartPanel).toHaveClass("visible");
    expect(growthPanel).toHaveClass("hidden");
    expect(newsPanel).toHaveClass("hidden");
  });

  it("switches to growth tab when clicked", () => {
    render(
      <StockDetailTabs
        symbol="HPG"
        newsCount={3}
        chartContent={<div data-testid="chart-content">Biểu đồ</div>}
        growthContent={<div data-testid="growth-content">Tăng trưởng</div>}
        newsContent={<div data-testid="news-content">Tin tức</div>}
      />,
    );

    const growthTab = screen.getByRole("tab", { name: /Tăng trưởng & Tài chính/i });
    fireEvent.click(growthTab);

    expect(growthTab).toHaveAttribute("aria-selected", "true");
    const chartTab = screen.getByRole("tab", { name: /Biểu đồ & Sổ lệnh/i });
    expect(chartTab).toHaveAttribute("aria-selected", "false");

    const growthPanel = document.getElementById("panel-growth");
    const chartPanel = document.getElementById("panel-chart");
    expect(growthPanel).toHaveClass("visible");
    expect(chartPanel).toHaveClass("hidden");
  });

  it("switches to news tab when clicked", () => {
    render(
      <StockDetailTabs
        symbol="HPG"
        newsCount={3}
        chartContent={<div data-testid="chart-content">Biểu đồ</div>}
        growthContent={<div data-testid="growth-content">Tăng trưởng</div>}
        newsContent={<div data-testid="news-content">Tin tức</div>}
      />,
    );

    const newsTab = screen.getByRole("tab", { name: /Tin tức doanh nghiệp/i });
    fireEvent.click(newsTab);

    expect(newsTab).toHaveAttribute("aria-selected", "true");
    const newsPanel = document.getElementById("panel-news");
    expect(newsPanel).toHaveClass("visible");
  });
});
