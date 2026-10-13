import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LearningJourney } from "@/components/learn/learning-journey";
import { stockBasicsLessons } from "@/content/stock-basics";
import { LEARNING_PROGRESS_KEY } from "@/lib/learning-progress";
import type { LearningMarketExample } from "@/types/learning";

const marketExample: LearningMarketExample = {
  symbol: "VNINDEX",
  name: "VN-Index",
  timestamp: "2026-10-13T08:00:00Z",
  open: "1718.84",
  high: "1726.35",
  low: "1710.95",
  close: "1719.42",
  volume: "560900000",
  providerName: "Vnstock KBS/VCI",
  marketTime: "2026-10-13T08:33:20Z",
  timezone: "Asia/Ho_Chi_Minh",
  freshness: "fresh",
  delayClass: "source_delayed",
};

describe("beginner learning journey", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("renders the Vietnamese learning path with sourced live candle context", () => {
    render(<LearningJourney lessons={stockBasicsLessons} marketExample={marketExample} />);

    expect(screen.getByRole("heading", { name: /Từ con số 0/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tiết kiệm hay đầu tư?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đọc một cây nến" })).toBeInTheDocument();
    expect(screen.getByText("Nguồn: Vnstock KBS/VCI")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu còn trong ngưỡng cập nhật")).toBeInTheDocument();
    expect(screen.getByText(/Nến ngày:/)).toBeInTheDocument();
    expect(screen.queryByText(/07:00/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mở biểu đồ VN-Index/ })).toHaveAttribute("href", "/market/indices?symbol=VNINDEX");
  });

  it("labels delayed market context instead of presenting it as current", () => {
    render(<LearningJourney lessons={stockBasicsLessons} marketExample={{ ...marketExample, freshness: "stale" }} />);

    expect(screen.getByText("Dữ liệu đang trễ")).toBeInTheDocument();
    expect(screen.getByText("Nguồn: Vnstock KBS/VCI")).toBeInTheDocument();
    expect(screen.getByText("Độ trễ: Theo độ trễ của nguồn")).toBeInTheDocument();
  });

  it("teaches through feedback and persists completion only after every answer is correct", async () => {
    render(<LearningJourney lessons={stockBasicsLessons} marketExample={marketExample} />);

    fireEvent.click(screen.getByRole("button", { name: "Mã nào đang tăng mạnh nhất" }));
    expect(screen.getByRole("status")).toHaveTextContent("Chưa đúng. Đà tăng gần đây");
    expect(localStorage.getItem(LEARNING_PROGRESS_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thời hạn và khả năng cần rút tiền" }));
    fireEvent.click(screen.getByRole("button", { name: "Có khả năng sinh lời nhưng luôn đi kèm rủi ro mất vốn" }));

    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(LEARNING_PROGRESS_KEY) ?? "{}")).toEqual({
      version: 1,
      completedLessons: ["saving-or-investing"],
    });
    expect(screen.getByText("✓ Đã nắm bài")).toBeInTheDocument();
  });

  it("restores progress without storing quiz answers or financial details", async () => {
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      version: 1,
      completedLessons: ["saving-or-investing"],
      answers: { secret: "must-not-be-used" },
    }));

    render(<LearningJourney lessons={stockBasicsLessons} marketExample={marketExample} />);

    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Học tiếp: Đọc một cây nến/ })).toHaveAttribute("href", "#lesson-read-a-candle");
  });

  it("keeps lessons available and reports when persistent storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<LearningJourney lessons={stockBasicsLessons} marketExample={null} />);

    expect(screen.getByRole("heading", { name: "Chưa lấy được nến thị trường" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Trình duyệt đang chặn lưu trữ/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Kiểm tra biểu đồ VN-Index/ })).toBeInTheDocument();
  });
});
