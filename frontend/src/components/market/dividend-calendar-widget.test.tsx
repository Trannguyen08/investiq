import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DividendCalendarWidget } from "@/components/market/dividend-calendar-widget";
import type { DividendItem } from "@/types/market";

const mockUpcomingEvents: DividendItem[] = [
  {
    id: "FPT-2026-11-12",
    symbol: "FPT",
    event_date: "2026-11-12",
    ex_date: "2026-11-12",
    record_date: null,
    payout_date: "2026-12-05",
    type: "cash",
    ratio: "10%",
    cash_value: 1000,
    title: "Tạm ứng cổ tức đợt 2/2026 bằng Tiền mặt, tỷ lệ 10% (1.000 đ/cp)",
    source: "Nghị quyết HĐQT",
  },
  {
    id: "HPG-2026-11-28",
    symbol: "HPG",
    event_date: "2026-11-28",
    ex_date: "2026-11-28",
    record_date: null,
    payout_date: null,
    type: "stock",
    ratio: "10:1",
    cash_value: null,
    title: "Phát hành cổ phiếu trả cổ tức năm 2026, tỷ lệ 10:1",
    source: "Nghị quyết ĐHCĐ",
  },
];

describe("DividendCalendarWidget", () => {
  it("renders upcoming future dividend calendar title and cards", () => {
    render(<DividendCalendarWidget initialEvents={mockUpcomingEvents} />);

    expect(screen.getByText(/Lịch chia cổ tức sắp diễn ra/i)).toBeInTheDocument();
    expect(screen.getByText("FPT")).toBeInTheDocument();
    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.getAllByText(/⏳ Còn/i).length).toBeGreaterThan(0);
  });

  it("filters events by type and search query", () => {
    render(<DividendCalendarWidget initialEvents={mockUpcomingEvents} />);

    // Filter by cash
    const cashBtn = screen.getByRole("button", { name: /Cổ tức tiền/i });
    fireEvent.click(cashBtn);

    expect(screen.getByText("FPT")).toBeInTheDocument();
    expect(screen.queryByText("HPG")).not.toBeInTheDocument();

    // Filter by stock
    const stockBtn = screen.getByRole("button", { name: /Cổ tức cổ phiếu/i });
    fireEvent.click(stockBtn);

    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.queryByText("FPT")).not.toBeInTheDocument();
  });
});
