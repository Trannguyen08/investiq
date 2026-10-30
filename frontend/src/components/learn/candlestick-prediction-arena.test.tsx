import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandlestickPredictionArena } from "@/components/learn/candlestick-prediction-arena";

describe("CandlestickPredictionArena", () => {
  it("renders theory panel, challenge question, and 3 options", () => {
    render(<CandlestickPredictionArena />);

    expect(screen.getByText("Đấu Trường Dự Đoán Nến & AI Nhận Xét")).toBeInTheDocument();
    expect(
      screen.getByText(/Cẩm Nang Cốt Lõi: Nguyên Tắc Nến/i)
    ).toBeInTheDocument();

    // Check 3 prediction buttons
    expect(screen.getByRole("button", { name: /TĂNG GIÁ MẠNH/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GIẢM GIÁ SÂU/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ĐI NGANG/i })).toBeInTheDocument();
  });

  it("handles user choice and reveals AI verdict and next candle explanation", () => {
    render(<CandlestickPredictionArena />);

    // Click bullish button on challenge 1
    const bullishBtn = screen.getByRole("button", { name: /TĂNG GIÁ MẠNH/i });
    fireEvent.click(bullishBtn);

    // Should reveal AI analysis
    expect(screen.getByText(/Dự đoán CHÍNH XÁC/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Price Action Engine nhận xét/i)).toBeInTheDocument();
    expect(screen.getByText(/Động thái Cung - Cầu trên sổ lệnh/i)).toBeInTheDocument();
    expect(screen.getByText(/Bài học thực chiến rút ra/i)).toBeInTheDocument();
  });
});

