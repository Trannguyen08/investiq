import type { Metadata } from "next";
import { CandlestickPredictionArena } from "@/components/learn/candlestick-prediction-arena";

export const metadata: Metadata = {
  title: "Đấu Trường Dự Đoán Nến Nhật & AI Nhận Xét | InvestIQ",
  description:
    "Học nguyên tắc cấu tạo nến, điều gì làm nến tăng giảm và dài hay ngắn. Thực hành dự đoán nến qua 50 bài tập thực chiến từ cơ bản đến nâng cao cùng AI phân tích.",
};

export default function CandlestickPredictionPage() {
  return (
    <main id="main-content" className="market-page candlestick-prediction-page w-full min-h-screen bg-[#06111f] text-slate-100">
      <CandlestickPredictionArena />
    </main>
  );
}
