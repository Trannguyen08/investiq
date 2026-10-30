import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockGoldBankComparator } from "@/components/market/stock-gold-bank-comparator";

describe("StockGoldBankComparator", () => {
  it("renders 3 asset cards and timeline controls", () => {
    render(<StockGoldBankComparator initialSymbol="HPG" />);

    expect(
      screen.getByText(/Hiệu Suất Đầu Tư: Cổ Phiếu/i)
    ).toBeInTheDocument();

    // 3 asset cards / indicators
    expect(screen.getAllByText(/CỔ PHIẾU/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VÀNG MIẾNG SJC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TIẾT KIỆM NGÂN HÀNG/i).length).toBeGreaterThan(0);

    // Table of subsequent years
    expect(
      screen.getByText(/Bảng Chi Tiết Số Tiền Lũy Kế/i)
    ).toBeInTheDocument();
  });

  it("updates calculations when start year or capital is changed", () => {
    render(<StockGoldBankComparator initialSymbol="FPT" />);

    // Select different start year
    const startYearSelect = screen.getByLabelText(/Năm bắt đầu:/i);
    fireEvent.change(startYearSelect, { target: { value: "2020" } });

    // Should include year 2020 in table
    expect(screen.getAllByText(/2020/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);

    // Click 200 triệu pill
    const pill200M = screen.getByRole("button", { name: /200 triệu/i });
    fireEvent.click(pill200M);

    expect(pill200M).toHaveClass("active");
  });
});
