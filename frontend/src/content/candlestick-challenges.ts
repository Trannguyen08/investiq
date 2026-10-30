export type CandlestickLevel = "basic" | "intermediate" | "advanced";

export type CandleData = {
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  date?: string;
};

export type CandlestickChallenge = {
  id: number;
  title: string;
  level: CandlestickLevel;
  pattern: string;
  ticker: string;
  timeframe: string;
  candles: CandleData[];
  nextCandle: CandleData;
  corporateContext: string;
  marketSentiment: string;
  question: string;
  options: {
    key: "bullish" | "bearish" | "neutral";
    label: string;
    description: string;
  }[];
  correctOption: "bullish" | "bearish" | "neutral";
  aiAnalysis: {
    verdict: string;
    why: string;
    supplyDemand: string;
    corporateImpact: string;
    lesson: string;
  };
};

export const CANDLESTICK_THEORY = {
  anatomy: {
    title: "1. Cấu Tạo Cơ Bản Của Nến Nhật (Candlestick Anatomy)",
    content:
      "Mỗi cây nến đại diện cho hành động giá trong một khung thời gian xác định (1 phút, 1 ngày, 1 tuần...). Nến gồm 2 phần chính: Thân nến (Real Body) và Bóng nến / Râu nến (Shadows / Wicks). Có 4 mức giá quan trọng: Mở cửa (Open), Cao nhất (High), Thấp nhất (Low), Đóng cửa (Close).",
    rules: [
      "Nến XANH (Bullish): Giá đóng cửa cao hơn giá mở cửa (Close > Open). Phe Mua chiếm ưu thế.",
      "Nến ĐỎ (Bearish): Giá đóng cửa thấp hơn giá mở cửa (Close < Open). Phe Bán chiếm ưu thế.",
      "Bóng nến trên: Thể hiện mức giá cao nhất trong phiên trước khi bị phe bán đẩy lùi.",
      "Bóng nến dưới: Thể hiện mức giá thấp nhất trong phiên trước khi phe mua nhảy vào bắt đáy.",
    ],
  },
  movement: {
    title: "2. Điều Gì Làm Nến Tăng Hoặc Giảm?",
    content:
      "Thị trường vận hành theo quy luật Cung - Cầu trên sổ lệnh (Order Book):",
    rules: [
      "Điều gì làm nến TĂNG: Lực Cầu (phe mua) chủ động mua quét lên các mức giá bán cao hơn. Khi lệnh chờ bán bị nuốt sạch nhanh hơn lệnh mới xuất hiện, giá khớp lệnh liên tục tăng vọt, tạo nên cây nến xanh.",
      "Điều gì làm nến GIẢM: Lực Cung (phe bán) bán tháo hoặc thoát hàng hạ giá, khớp thẳng vào lệnh chờ mua bên dưới. Khi bên mua rút lui hoặc bị hấp thụ hết, giá trượt dốc tạo thành cây nến đỏ.",
    ],
  },
  bodyLength: {
    title: "3. Chiều Dài Thân Nến Dài Hay Ngắn Phụ Thuộc Vào Yếu Tố Gì?",
    content:
      "Thân nến là thước đo chênh lệch thực tế giữa giá Mở cửa và giá Đóng cửa. Thân nến dài hay ngắn phản ánh trực tiếp 3 yếu tố cốt lõi:",
    rules: [
      "1. Mức độ mất cân bằng Cung - Cầu: Thân nến CÀNG DÀI chứng tỏ một phe hoàn toàn áp đảo phe còn lại trong suốt phiên (ví dụ nến Marubozu tăng trần). Thân nến CÀNG NGẮN chứng tỏ hai bên giằng co, cung và cầu gần như triệt tiêu nhau.",
      "2. Biên độ biến động giá (Volatility): Thân nến dài xuất hiện khi thị trường có biến động mạnh (tin tức bất ngờ, dòng tiền lớn nhập cuộc). Nến thân ngắn xuất hiện khi thị trường ảm đạm hoặc tích lũy nén biên độ.",
      "3. Khối lượng giao dịch (Volume xác nhận): Thân nến dài đi kèm Khối lượng đột biến (High Volume) chứng tỏ dòng tiền của các Nhà đầu tư tổ chức (Smart Money / Cá mập) nhập cuộc dứt khoát. Nếu thân nến dài nhưng khối lượng teo tóp, khả năng cao là bẫy giá thanh khoản ảo (Liquidity Trap).",
      "4. Bóng nến dài (Râu nến): Râu nến dài phản ánh lực Từ chối giá quyết liệt (Price Rejection). Râu dưới dài = phe mua từ chối giá thấp (rút chân). Râu trên dài = phe bán từ chối giá cao (xả hàng rụt đầu).",
    ],
  },
};

