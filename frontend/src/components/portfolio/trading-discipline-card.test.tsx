import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradingDisciplineCard } from "./trading-discipline-card";
import type { DisciplineMetrics } from "@/types/assessment";

const mockMetrics: DisciplineMetrics = {
  cut_loss_score: 95.0,
  diversification_score: 80.0,
  cash_management_score: 90.0,
  emotional_pacing_score: 85.0,
  overall_discipline_score: 88.0,
  badge: "Kỷ luật thép",
  strengths: ["Không có vị thế nào bị âm sâu quá -7%"],
  weaknesses: [],
  recommendations: ["Duy trì kỷ luật hiện tại"],
};

describe("TradingDisciplineCard", () => {
  it("renders discipline indicators and badge accurately", () => {
    render(<TradingDisciplineCard initialMetrics={mockMetrics} />);

    expect(screen.getByText("Chỉ số Kỷ luật Giao dịch")).toBeDefined();
    expect(screen.getByText("Kỷ luật thép (88/100)")).toBeDefined();

    // 4 indicators
    expect(screen.getByText("Kỷ luật cắt lỗ (-7%)")).toBeDefined();
    expect(screen.getByText("95 / 100")).toBeDefined();
    expect(screen.getByText("Đa dạng hóa danh mục")).toBeDefined();
    expect(screen.getByText("80 / 100")).toBeDefined();
    expect(screen.getByText("Quản trị tiền mặt")).toBeDefined();
    expect(screen.getByText("90 / 100")).toBeDefined();

    // Strengths
    expect(screen.getByText(/Không có vị thế nào bị âm sâu/)).toBeDefined();

    // Link
    expect(screen.getByText(/Xem Báo cáo Đánh giá Mức độ Sẵn sàng/)).toBeDefined();
  });
});
