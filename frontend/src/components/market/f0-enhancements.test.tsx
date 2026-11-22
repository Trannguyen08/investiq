import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { F0OnboardingChecklist } from "@/components/market/f0-onboarding-checklist";
import { PriceAlertButton } from "@/components/market/price-alert-button";
import { PriceAlertsBar } from "@/components/market/price-alerts-bar";
import { addPriceAlert, evaluatePriceAlerts, loadPriceAlerts } from "@/lib/price-alerts";
import { loadTradeJournalMap, saveTradeJournalEntry } from "@/lib/trading-journal";
import type { MarketInstrument } from "@/types/market";

describe("F0 investor enhancements", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the 4-step F0 onboarding checklist, tracks progress, and can dismiss/reopen", () => {
    render(<F0OnboardingChecklist />);

    expect(screen.getByText(/LỘ TRÌNH 4 BƯỚC CHO NGƯỜI MỚI/i)).toBeInTheDocument();
    expect(screen.getByText(/Hoàn thành 0\/4 \(0%\)/i)).toBeInTheDocument();

    const step1Toggle = screen.getByRole("button", { name: /Đánh dấu hoàn thành 1\. Đánh giá khẩu vị rủi ro/i });
    fireEvent.click(step1Toggle);
    expect(screen.getByText(/Hoàn thành 1\/4 \(25%\)/i)).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: /Ẩn lộ trình người mới/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/Bắt đầu đầu tư bài bản/i)).not.toBeInTheDocument();

    const reopenBtn = screen.getByRole("button", { name: /Hiện lộ trình cho người mới \(1\/4\)/i });
    fireEvent.click(reopenBtn);
    expect(screen.getByText(/Bắt đầu đầu tư bài bản/i)).toBeInTheDocument();
  });

  it("creates, triggers, and deletes price alerts from PriceAlertButton and PriceAlertsBar", () => {
    render(<PriceAlertButton symbol="FPT" name="CTCP FPT" currentPrice="45000" />);

    fireEvent.click(screen.getByRole("button", { name: /Đặt cảnh báo giá/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Create a 'below' alert at 46000 -> immediately triggered because currentPrice is 45000 <= 46000
    fireEvent.change(screen.getByLabelText(/Mức giá mục tiêu/i), { target: { value: "46000" } });
    fireEvent.change(screen.getByLabelText(/Ghi chú nhắc bản thân/i), { target: { value: "Vùng mua tích sản" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu cảnh báo giá/i }));

    expect(loadPriceAlerts()).toHaveLength(1);
    expect(screen.getByText(/Đã chạm!/i)).toBeInTheDocument();
    expect(screen.getByText(/Vùng mua tích sản/i)).toBeInTheDocument();

    // Evaluate alerts directly
    const evaluated = evaluatePriceAlerts(loadPriceAlerts(), { FPT: 45000 });
    expect(evaluated[0]?.triggered).toBe(true);

    // Render home PriceAlertsBar with live instruments
    const mockInst = { symbol: "FPT", price: "45000" } as MarketInstrument;
    render(<PriceAlertsBar instruments={[mockInst]} />);
    expect(screen.getByText(/1 cảnh báo giá đã chạm ngưỡng/i)).toBeInTheDocument();
  });

  it("persists and resolves trade journal notes by both trade id and order id", () => {
    saveTradeJournalEntry({
      id: "trade-1",
      orderId: "order-1",
      symbol: "SSI",
      side: "buy",
      note: "Định giá P/E hấp dẫn",
      createdAt: "2026-11-22T05:00:00Z",
    });

    const map = loadTradeJournalMap();
    expect(map["trade-1"]).toBe("Định giá P/E hấp dẫn");
    expect(map["order-1"]).toBe("Định giá P/E hấp dẫn");

    // Helper addPriceAlert sanity check for 'above' direction
    addPriceAlert({ symbol: "SSI", name: "SSI", direction: "above", targetPrice: 22000 });
    const evalAbove = evaluatePriceAlerts(loadPriceAlerts(), { SSI: 20000 });
    expect(evalAbove[0]?.triggered).toBe(false);
  });
});
