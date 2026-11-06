import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectorTreemapHeatmap } from "@/components/market/sector-treemap-heatmap";
import type { MarketSector } from "@/types/market";

function sampleSector(
  name: string,
  changePercent: string,
  memberCount: number,
  marketCap: string,
  matchedValue: string
): MarketSector {
  return {
    name,
    change_percent: changePercent,
    member_count: memberCount,
    advances: 10,
    declines: 5,
    unchanged: 2,
    matched_value: matchedValue,
    foreign_net_value: "1000000000",
    market_cap: marketCap,
  };
}

describe("SectorTreemapHeatmap", () => {
  const sectors: MarketSector[] = [
    sampleSector("Ngân hàng", "2.40", 28, "1500000000000000", "5000000000000"),
    sampleSector("Bất động sản", "4.00", 113, "2800000000000000", "2600000000000"),
    sampleSector("Công nghệ Thông tin", "6.89", 27, "115000000000000", "690000000000"),
    sampleSector("Hóa chất", "-1.20", 67, "180000000000000", "450000000000"),
  ];

  it("renders sector tiles with correct name and change percent", () => {
    render(<SectorTreemapHeatmap sectors={sectors} />);

    expect(screen.getByText(/Biến động các ngành/i)).toBeInTheDocument();
    expect(screen.getByText("Ngân hàng")).toBeInTheDocument();
    expect(screen.getByText("Bất động sản")).toBeInTheDocument();
    expect(screen.getByText("Công nghệ Thông tin")).toBeInTheDocument();
    expect(screen.getByText("Hóa chất")).toBeInTheDocument();
    expect(screen.getByText("+6,89%")).toBeInTheDocument();
    expect(screen.getByText("-1,2%")).toBeInTheDocument();
  });

  it("calls onSelectSector when a sector tile is clicked", () => {
    const handleSelect = vi.fn();
    render(<SectorTreemapHeatmap sectors={sectors} onSelectSector={handleSelect} />);

    const cnttButton = screen.getByRole("button", { name: /Công nghệ Thông tin/i });
    fireEvent.click(cnttButton);

    expect(handleSelect).toHaveBeenCalledWith("Công nghệ Thông tin");
  });

  it("displays hover bar with sector details when hovered", () => {
    render(<SectorTreemapHeatmap sectors={sectors} />);

    const bankButton = screen.getByRole("button", { name: /Ngân hàng/i });
    fireEvent.mouseEnter(bankButton);

    expect(screen.getByText(/10 tăng/i)).toBeInTheDocument();
    expect(screen.getByText(/5 giảm/i)).toBeInTheDocument();
    expect(screen.getByText(/Mở bảng giá →/i)).toBeInTheDocument();
  });

  it("keeps detail bar visible when mouse leaves tile to click 'Mở bảng giá →'", () => {
    render(<SectorTreemapHeatmap sectors={sectors} />);

    const bankButton = screen.getByRole("button", { name: /Ngân hàng/i });
    fireEvent.mouseEnter(bankButton);
    expect(screen.getByText(/Mở bảng giá →/i)).toBeInTheDocument();

    // Mouse leaves tile moving towards the bottom action link
    fireEvent.mouseLeave(bankButton);
    expect(screen.getByText(/Mở bảng giá →/i)).toBeInTheDocument();
  });

  it("sizes sector tiles based on absolute percentage movement", () => {
    render(<SectorTreemapHeatmap sectors={sectors} />);

    expect(screen.getByText(/Độ to khối theo \|% biến động\|/i)).toBeInTheDocument();
  });
});
