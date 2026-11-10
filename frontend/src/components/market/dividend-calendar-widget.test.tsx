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
    source_url: "https://cafef.vn/fpt-chot-ngay-phat-hanh-hon-171-trieu-co-phieu-thuong-1882609102017279.chn",
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
    source_url: "https://cafef.vn/du-lieu/HPG-2988819/hpg-nghi-quyet-hdqt-thong-qua-viec-tham-gia-mua-co-phan-chao-ban-de-tang-von-dieu-le-cua-cong-ty-co-phan-tap-doan-tuong-lai-song-hong.chn",
  },
];

const mockManyEvents: DividendItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `SYM${i}-2026-12-0${i + 1}`,
  symbol: `S${i}`,
  event_date: `2026-12-0${i + 1}`,
  ex_date: `2026-12-0${i + 1}`,
  record_date: null,
  payout_date: null,
  type: i % 2 === 0 ? "cash" : "stock",
  ratio: "10%",
  cash_value: i % 2 === 0 ? 1000 : null,
  title: `Sự kiện cổ tức của mã S${i}`,
  source: "CafeF / HOSE",
  source_url: `https://s.cafef.vn/lich-su-kien/S${i}/sub.chn`,
}));

describe("DividendCalendarWidget", () => {
  it("renders upcoming future dividend calendar title and cards", () => {
    render(<DividendCalendarWidget initialEvents={mockUpcomingEvents} />);

    expect(screen.getByText(/Lịch chia cổ tức sắp diễn ra/i)).toBeInTheDocument();
    expect(screen.getByText("FPT")).toBeInTheDocument();
    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.getAllByText(/Còn/i).length).toBeGreaterThan(0);
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

  it("sorts events closest to present date first", () => {
    // Event further away (Dec 2026) vs event closer (Nov 2026)
    const unsortedEvents: DividendItem[] = [
      {
        id: "LATE-2026-12-20",
        symbol: "LATE",
        event_date: "2026-12-20",
        ex_date: "2026-12-20",
        record_date: null,
        payout_date: null,
        type: "cash",
        ratio: "5%",
        cash_value: 500,
        title: "Chi trả cổ tức muộn",
        source: "Nghị quyết HĐQT",
      },
      {
        id: "EARLY-2026-12-01",
        symbol: "EARLY",
        event_date: "2026-12-01",
        ex_date: "2026-12-01",
        record_date: null,
        payout_date: null,
        type: "cash",
        ratio: "10%",
        cash_value: 1000,
        title: "Chi trả cổ tức sớm",
        source: "Nghị quyết HĐQT",
      },
    ];

    render(<DividendCalendarWidget initialEvents={unsortedEvents} />);

    const badges = screen.getAllByText(/EARLY|LATE/);
    expect(badges[0]).toHaveTextContent("EARLY");
    expect(badges[1]).toHaveTextContent("LATE");
  });

  it("supports pagination when there are more than 6 events", () => {
    render(<DividendCalendarWidget initialEvents={mockManyEvents} />);

    // Page 1 should render first 6 items: S0 -> S5
    expect(screen.getByText("S0")).toBeInTheDocument();
    expect(screen.getByText("S5")).toBeInTheDocument();
    expect(screen.queryByText("S6")).not.toBeInTheDocument();
    expect(screen.queryByText("S7")).not.toBeInTheDocument();

    // Check pagination bar
    expect(screen.getByText(/Hiển thị/i)).toBeInTheDocument();
    expect(screen.getByText("1 - 6")).toBeInTheDocument();

    // Click next page button "2"
    const page2Btn = screen.getByRole("button", { name: "Trang 2" });
    fireEvent.click(page2Btn);

    // Page 2 should render S6 and S7
    expect(screen.getByText("S6")).toBeInTheDocument();
    expect(screen.getByText("S7")).toBeInTheDocument();
    expect(screen.queryByText("S0")).not.toBeInTheDocument();
  });

  it("links directly to source info URL", () => {
    render(<DividendCalendarWidget initialEvents={mockUpcomingEvents} />);

    // Check link in title and footer
    const sourceLinks = screen.getAllByRole("link", { name: /Xem nguồn thông tin|Nguồn tin ↗/i });
    expect(sourceLinks.length).toBeGreaterThan(0);
    const fptLink = sourceLinks.find(
      (link) => link.getAttribute("href") === "https://cafef.vn/fpt-chot-ngay-phat-hanh-hon-171-trieu-co-phieu-thuong-1882609102017279.chn"
    );
    expect(fptLink).toBeDefined();
    expect(fptLink?.getAttribute("target")).toBe("_blank");
  });

  it("opens DividendDetailModal when clicking Chi tiết or card", () => {
    render(<DividendCalendarWidget initialEvents={mockUpcomingEvents} />);

    // Click "Chi tiết" button on the first card (FPT)
    const detailButtons = screen.getAllByRole("button", { name: "Chi tiết" });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    // Modal should now be open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/FPT — Tập đoàn FPT/i)).toBeInTheDocument();
    expect(screen.getByText(/Giá trị chi trả cổ tức/i)).toBeInTheDocument();
    expect(screen.getByText(/1.000 ₫ \/ CP/i)).toBeInTheDocument();
    expect(screen.getByText(/Mốc 1 • Ngày GDKHQ/i)).toBeInTheDocument();
    expect(screen.getByText(/Xem nghị quyết trên CafeF/i)).toBeInTheDocument();

    // Close the modal
    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
