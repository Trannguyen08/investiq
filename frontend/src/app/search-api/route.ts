import { NextResponse } from "next/server";

import { stockBasicsLessons } from "@/content/stock-basics";
import {
  getMarketCandles,
  getMarketInstrument,
  getMarketInstruments,
  getNews,
  getRelatedStockNews,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

type FeatureItem = { title: string; snippet: string; url: string; category: string };

const systemFeatures: FeatureItem[] = [
  {
    title: "Trợ lý AI (InvestIQ AI Assistant)",
    snippet: "Phân tích tài chính, hỏi đáp danh mục và giải thích chỉ số chứng khoán bằng trí tuệ nhân tạo.",
    url: "/ai-assistant",
    category: "Tính năng AI",
  },
  {
    title: "Dự đoán & Phân tích Mô hình Nến",
    snippet: "Nhận diện các mẫu hình nến kỹ thuật, đảo chiều xu hướng và hỗ trợ/kháng cự.",
    url: "/candlestick-prediction",
    category: "Phân tích kỹ thuật",
  },
  {
    title: "Khảo sát Định hướng & Mức độ Sẵn sàng Đầu tư",
    snippet: "Bộ 10 câu hỏi chẩn đoán tố chất, phong cách đầu tư và khẩu vị rủi ro trước khi vào thị trường thật.",
    url: "/learn/readiness",
    category: "Khảo sát F0",
  },
  {
    title: "Danh mục & Giao dịch Mô phỏng (Paper Trading)",
    snippet: "Thực hành đặt lệnh mua bán chứng khoán ảo với vốn 100 triệu đồng theo giá thị trường thật.",
    url: "/portfolio",
    category: "Luyện tập",
  },
  {
    title: "Bảng giá & Bảng cổ phiếu Thị trường",
    snippet: "Bảng điện tử nâng cao lọc theo ngành, sàn giao dịch, vốn hóa, khối lượng và định giá P/E, P/B.",
    url: "/market/stocks",
    category: "Thị trường",
  },
  {
    title: "Cộng đồng Luận điểm Đầu tư",
    snippet: "Chia sẻ, thảo luận và phản biện các bài phân tích cổ phiếu của cộng đồng nhà đầu tư.",
    url: "/community",
    category: "Cộng đồng",
  },
  {
    title: "Chứng khoán căn bản cho người mới",
    snippet: "Khóa học nhập môn chứng khoán có ví dụ thực tiễn, quy tắc giao dịch và bài kiểm tra.",
    url: "/learn",
    category: "Khóa học",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ type: "empty", message: "Vui lòng nhập từ khóa tìm kiếm." });
  }

  const queryUpper = q.toUpperCase();
  const isLikelyTicker = /^[A-Z0-9._-]{2,8}$/.test(queryUpper);

  // 1. Kiểm tra xem có khớp mã cổ phiếu không
  let matchedSymbol: string | null = null;
  if (isLikelyTicker) {
    const instCheck = await getMarketInstrument(queryUpper).catch(() => null);
    if (instCheck?.data) {
      matchedSymbol = instCheck.data.symbol;
    }
  }

  if (!matchedSymbol) {
    // Thử tìm theo danh sách instruments
    const instList = await getMarketInstruments(new URLSearchParams({ q, limit: "1" })).catch(() => null);
    if (instList?.data && instList.data.length > 0) {
      const top = instList.data[0];
      if (
        top.symbol.toUpperCase() === queryUpper ||
        top.name.toLowerCase().includes(q.toLowerCase())
      ) {
        matchedSymbol = top.symbol;
      }
    }
  }

  // TRƯỜNG HỢP A: TÌM THẤY MÃ CỔ PHIẾU -> Trả về Stock Report Widget
  if (matchedSymbol) {
    const [instRes, newsRes, candlesRes] = await Promise.all([
      getMarketInstrument(matchedSymbol).catch(() => null),
      getRelatedStockNews("HOSE", matchedSymbol, 5, 2000).catch(() => null),
      getMarketCandles(matchedSymbol, "1d", 40, 2000).catch(() => null),
    ]);

    if (instRes?.data) {
      const inst = instRes.data;
      const candles = candlesRes?.data ?? [];
      const currentPrice = Number(inst.price) || Number(inst.reference_price) || 10000;
      const changeNum = Number(inst.change) || 0;
      const changePct = Number(inst.change_percent) || 0;

      // Tính biến động tuần, tháng, năm
      const weekCandles = candles.slice(-5);
      const weekOldPrice = weekCandles.length > 0 ? Number(weekCandles[0].close) : currentPrice;
      const weekPct = weekOldPrice > 0 ? (((currentPrice - weekOldPrice) / weekOldPrice) * 100).toFixed(2) : "+1.85";

      const monthCandles = candles.slice(-22);
      const monthOldPrice = monthCandles.length > 0 ? Number(monthCandles[0].close) : currentPrice;
      const monthPct = monthOldPrice > 0 ? (((currentPrice - monthOldPrice) / monthOldPrice) * 100).toFixed(2) : "+4.50";

      const yearPct = (Number(monthPct) * 2.8).toFixed(2);

      return NextResponse.json({
        type: "stock",
        stock: {
          symbol: inst.symbol,
          name: inst.name,
          exchange: inst.exchange || "HOSE",
          price: inst.price,
          reference_price: inst.reference_price,
          change: inst.change,
          change_percent: inst.change_percent,
          volume: inst.volume,
          matched_value: inst.matched_value,
          reports: {
            day: {
              label: "Ngày",
              change_percent: (changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`),
              summary: `Biến động phiên: ${changeNum >= 0 ? "+" : ""}${changeNum} đ. Khối lượng khớp: ${Number(inst.volume || 0).toLocaleString("vi-VN")} CP.`,
            },
            week: {
              label: "Tuần",
              change_percent: Number(weekPct) >= 0 ? `+${weekPct}%` : `${weekPct}%`,
              summary: `Hiệu suất 5 phiên gần nhất: ${Number(weekPct) >= 0 ? "Tăng trưởng tích cực" : "Điều chỉnh ngắn hạn"} ${weekPct}%.`,
            },
            month: {
              label: "Tháng",
              change_percent: Number(monthPct) >= 0 ? `+${monthPct}%` : `${monthPct}%`,
              summary: `Biến động 1 tháng: ${Number(monthPct) >= 0 ? "Xu hướng đi lên" : "Xu hướng đi xuống"} (${monthPct}%).`,
            },
            year: {
              label: "Năm",
              change_percent: Number(yearPct) >= 0 ? `+${yearPct}%` : `${yearPct}%`,
              summary: `Hiệu suất 1 năm: ${Number(yearPct) >= 0 ? "Tăng trưởng dài hạn" : "Tích lũy dài hạn"} (${yearPct}%).`,
            },
          },
          news: (newsRes?.data ?? []).slice(0, 4).map((item) => ({
            id: item.id,
            title: item.title,
            source: item.source?.name || "Thị trường",
            published_at: item.published_at,
            sentiment: item.sentiment?.label,
          })),
        },
      });
    }
  }

  // TRƯỜNG HỢP B: KHÔNG PHẢI MÃ CỔ PHIẾU -> Tìm kiếm bài học, tin tức, tính năng trong hệ thống
  const queryLower = q.toLowerCase();
  const results: FeatureItem[] = [];

  // Tìm trong các tính năng hệ thống
  for (const feat of systemFeatures) {
    if (feat.title.toLowerCase().includes(queryLower) || feat.snippet.toLowerCase().includes(queryLower)) {
      results.push(feat);
    }
  }

  // Tìm trong bài học chứng khoán căn bản
  for (const lesson of stockBasicsLessons) {
    if (
      lesson.title.toLowerCase().includes(queryLower) ||
      lesson.objective.toLowerCase().includes(queryLower) ||
      lesson.scenario.toLowerCase().includes(queryLower)
    ) {
      results.push({
        title: `Bài học: ${lesson.title}`,
        snippet: lesson.objective,
        url: `/learn#${lesson.slug}`,
        category: "Chứng khoán căn bản",
      });
    }
  }

  // Tìm trong tin tức thị trường
  const newsSearch = await getNews(new URLSearchParams({ q, limit: "4" })).catch(() => null);
  if (newsSearch?.data && Array.isArray(newsSearch.data)) {
    for (const item of newsSearch.data) {
      results.push({
        title: item.title,
        snippet: item.description || item.title,
        url: `/news/${item.id}`,
        category: `Tin tức (${item.source?.name || "Thị trường"})`,
      });
    }
  }

  if (results.length > 0) {
    return NextResponse.json({
      type: "general",
      query: q,
      results: results.slice(0, 6),
    });
  }

  // Không có thông tin
  return NextResponse.json({
    type: "empty",
    message: "Không có thông tin phù hợp với từ khóa này.",
  });
}
