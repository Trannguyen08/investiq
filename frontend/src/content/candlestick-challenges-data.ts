import type { CandlestickChallenge } from "./candlestick-challenges";

export type { CandlestickChallenge };

export const CANDLESTICK_CHALLENGES: CandlestickChallenge[] = [
  // ==================== CƠ BẢN (1 - 15) ====================
  {
    id: 1,
    title: "Bài 1: Nến Hammer (Nến Búa) rút chân tại hỗ trợ MA50",
    level: "basic",
    pattern: "Hammer (Nến Búa)",
    ticker: "HPG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 28.5, h: 28.8, l: 28.0, c: 28.1, v: 18000000 },
      { o: 28.1, h: 28.3, l: 27.5, c: 27.6, v: 22000000 },
      { o: 27.5, h: 27.7, l: 27.0, c: 27.1, v: 25000000 },
      { o: 27.1, h: 27.3, l: 26.5, c: 26.6, v: 28000000 },
      { o: 26.6, h: 26.8, l: 25.4, c: 26.7, v: 42000000 }, // Signal Hammer
    ],
    nextCandle: { o: 26.8, h: 27.9, l: 26.7, c: 27.8, v: 38000000 },
    corporateContext:
      "Tập đoàn Hòa Phát vừa công bố sản lượng thép thô tháng qua tăng 18% YoY. Cổ phiếu bị điều chỉnh theo thị trường chung về đúng đường trung bình động MA50 ngày.",
    marketSentiment: "VN-Index chạm mốc hỗ trợ tâm lý 1.250 điểm, lực bán tháo chững lại.",
    question: "Quan sát cây nến số 5 có râu dưới dài gấp hơn 2 lần thân nến tại hỗ trợ MA50. Nến tiếp theo sẽ diễn biến như thế nào?",
    options: [
      { key: "bullish", label: "TĂNG GIÁ MẠNH (Xanh)", description: "Phe mua đã vào bắt đáy thành công, đẩy giá bật tăng." },
      { key: "bearish", label: "GIẢM GIÁ SÂU (Đỏ)", description: "Đà bán vẫn áp đảo và sẽ tiếp tục phá đáy." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Hai bên tạm thời bất phân thắng bại." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Cây nến tiếp theo là nến Tăng mạnh (Bullish).",
      why: "Nến Hammer có bóng dưới dài phản ánh mức giá thấp trong phiên bị từ chối dứt khoát. Phe mua đã thắng thế vào cuối phiên.",
      supplyDemand: "Lực cung bán tháo ở vùng giá 25.4 bị bên mua gom sạch. Lượng bán cạn kiệt tạo đà cho phiên sau tăng tốc.",
      corporateImpact: "Số liệu sản lượng khả quan của HPG tạo niềm tin vững chắc cho dòng tiền thông minh nhập cuộc tích sản.",
      lesson: "Khi nến Hammer xuất hiện tại vùng hỗ trợ quan trọng kèm khối lượng giao dịch lớn, xác suất đảo chiều tăng đạt trên 75%.",
    },
  },
  {
    id: 2,
    title: "Bài 2: Shooting Star (Sao Băng) rụt đầu tại đỉnh kháng cự",
    level: "basic",
    pattern: "Shooting Star (Sao Băng)",
    ticker: "SSI",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 32.0, h: 32.8, l: 31.8, c: 32.6, v: 14000000 },
      { o: 32.7, h: 33.6, l: 32.5, c: 33.5, v: 18000000 },
      { o: 33.5, h: 34.5, l: 33.4, c: 34.4, v: 24000000 },
      { o: 34.5, h: 35.8, l: 34.4, c: 35.6, v: 31000000 },
      { o: 35.8, h: 37.5, l: 35.6, c: 35.9, v: 45000000 }, // Signal Shooting Star
    ],
    nextCandle: { o: 35.7, h: 35.9, l: 34.1, c: 34.3, v: 36000000 },
    corporateContext:
      "SSI đã tăng liên tục 35% trong 1 tháng. Thị trường đồn đoán tin tăng vốn đã phản ánh hết vào giá, khối ngoại quay sang bán ròng chốt lời.",
    marketSentiment: "Thị trường bước vào vùng quá mua RSI > 78, nhà đầu tư hưng phấn tột độ.",
    question: "Cây nến số 5 tăng vọt lên 37.5 đầu phiên nhưng cuối phiên bị đạp mạnh tạo râu trên rất dài. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "TIẾP TỤC VƯỢT ĐỈNH (Xanh)", description: "Đà tăng còn rất mạnh mẽ." },
      { key: "bearish", label: "ĐẢO CHIỀU GIẢM ĐIỂM (Đỏ)", description: "Áp lực chốt lời đè nặng, phe bán đã kiểm soát thế trận." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Thị trường nghỉ chân đi ngang." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo là nến Giảm điểm đảo chiều (Bearish).",
      why: "Shooting Star với râu trên dài gấp 3 lần thân nến là dấu hiệu phân phối kinh điển. Phe mua đã kiệt sức khi cố đẩy qua ngưỡng cản 37.0.",
      supplyDemand: "Lượng hàng chốt lời ồ ạt xả vào thị trường, phe mua đu bám đỉnh cao nhất bị kẹt hàng.",
      corporateImpact: "Hiện tượng 'Tin ra là bán' (Sell on news) thường xuyên xảy ra ở các nhóm cổ phiếu chu kỳ tài chính.",
      lesson: "Không bao giờ mua đuổi khi thấy nến Shooting Star râu dài tại đỉnh kháng cự sau một nhịp tăng dốc.",
    },
  },
  {
    id: 3,
    title: "Bài 3: Bullish Marubozu (Cường lực tăng trần)",
    level: "basic",
    pattern: "Bullish Marubozu",
    ticker: "FPT",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 112.0, h: 113.5, l: 111.5, c: 113.0, v: 2100000 },
      { o: 113.0, h: 114.0, l: 112.5, c: 113.8, v: 2400000 },
      { o: 113.8, h: 114.5, l: 113.2, c: 114.0, v: 1900000 },
      { o: 114.0, h: 114.8, l: 113.5, c: 114.2, v: 2200000 },
      { o: 114.5, h: 122.5, l: 114.5, c: 122.5, v: 7800000 }, // Marubozu trần
    ],
    nextCandle: { o: 123.0, h: 128.0, l: 122.5, c: 127.5, v: 6200000 },
    corporateContext:
      "FPT công bố hợp đồng chiến lược trị giá 200 triệu USD về phát triển phần mềm AI tại Nhật Bản. Lợi nhuận trước thuế tăng 23% YoY.",
    marketSentiment: "Dòng tiền lớn đổ dồn vào nhóm cổ phiếu công nghệ đầu ngành.",
    question: "Cây nến số 5 là nến Marubozu tăng trần không có bóng nến (Mở thấp nhất, Đóng cao nhất trần). Nến tiếp theo sẽ như thế nào?",
    options: [
      { key: "bullish", label: "TIẾP TỤC TĂNG MẠNH (Xanh)", description: "Xung lực mua cực đại tiếp tục kéo giá phiên sau." },
      { key: "bearish", label: "ĐẢO CHIỀU GIẢM (Đỏ)", description: "Gặp áp lực chốt lời ngay lập tức." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Giá giữ nguyên tham chiếu." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo tiếp tục là nến Tăng mạnh (Bullish).",
      why: "Marubozu tăng là biểu tượng của sức mạnh áp đảo 100% từ phe mua từ đầu tới cuối phiên.",
      supplyDemand: "Dư mua trần chất hàng triệu cổ phiếu, bên bán găm giữ không chịu xả giá rẻ.",
      corporateImpact: "Yếu tố cơ bản tăng trưởng đột biến kích hoạt dòng vốn tổ chức dài hạn gia nhập.",
      lesson: "Nến Marubozu phá vỡ nền tích lũy kèm vol lớn thường mở đầu cho một con sóng tăng ít nhất 15-25%.",
    },
  },
  {
    id: 4,
    title: "Bài 4: Bearish Marubozu (Cường lực bán tháo thủng đáy)",
    level: "basic",
    pattern: "Bearish Marubozu",
    ticker: "VHM",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 44.5, h: 45.0, l: 44.2, c: 44.8, v: 6500000 },
      { o: 44.8, h: 45.2, l: 44.5, c: 44.6, v: 5800000 },
      { o: 44.6, h: 44.9, l: 44.0, c: 44.1, v: 7200000 },
      { o: 44.0, h: 44.3, l: 43.8, c: 43.9, v: 8100000 },
      { o: 43.8, h: 43.8, l: 40.8, c: 40.8, v: 26000000 }, // Marubozu sàn
    ],
    nextCandle: { o: 40.5, h: 40.8, l: 38.5, c: 38.8, v: 19000000 },
    corporateContext:
      "Thông tin phát hành trái phiếu quốc tế hoán đổi cổ phần khiến áp lực bán phòng hộ (hedging) gia tăng dữ dội.",
    marketSentiment: "Tâm lý nhà đầu tư hoang mang, nhóm bất động sản chìm trong sắc đỏ.",
    question: "Cây nến số 5 bán tháo kịch sàn không có râu, đóng cửa thấp nhất phiên với khối lượng gấp 3 lần bình thường. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "BẮT ĐÁY BẬT TĂNG (Xanh)", description: "Giá đã quá rẻ để dòng tiền bắt đáy vào." },
      { key: "bearish", label: "TIẾP TỤC LAO DỐC (Đỏ)", description: "Quán tính bán tháo chưa dừng lại." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Thị trường ngưng trệ đi ngang." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo tiếp tục Giảm điểm sâu (Bearish).",
      why: "Marubozu giảm biểu hiện lực bán tháo hoảng loạn không hề có lực đỡ.",
      supplyDemand: "Dư bán sàn hàng triệu cổ, hiện tượng call margin chéo lan rộng sang các phiên tiếp theo.",
      corporateImpact: "Yếu tố lo ngại rủi ro tài chính lấn át mọi định giá tài sản trên sổ sách.",
      lesson: "Không bao giờ 'bắt dao rơi' ngay sau một cây nến Bearish Marubozu thủng đáy nền giá.",
    },
  },
  {
    id: 5,
    title: "Bài 5: Dragonfly Doji (Doji Chuồn Chuồn) đảo chiều đáy",
    level: "basic",
    pattern: "Dragonfly Doji",
    ticker: "MWG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 48.0, h: 48.5, l: 47.0, c: 47.2, v: 5400000 },
      { o: 47.2, h: 47.4, l: 45.8, c: 46.0, v: 6200000 },
      { o: 46.0, h: 46.2, l: 44.5, c: 44.6, v: 7500000 },
      { o: 44.6, h: 44.8, l: 43.0, c: 43.1, v: 8900000 },
      { o: 43.0, h: 43.2, l: 40.5, c: 43.1, v: 16500000 }, // Dragonfly Doji
    ],
    nextCandle: { o: 43.3, h: 45.5, l: 43.1, c: 45.2, v: 12000000 },
    corporateContext:
      "Chuỗi Bách Hóa Xanh chính thức đạt điểm hòa vốn sau thuế và bắt đầu đóng góp dòng tiền dương cho tập đoàn.",
    marketSentiment: "Nhà đầu tư nước ngoài ngừng chuỗi 15 phiên bán ròng MWG.",
    question: "Cây nến số 5 mở cửa 43.0, bị đạp sâu về 40.5 nhưng cuối phiên kéo ngược đóng cửa đúng 43.1 tạo Doji chuồn chuồn. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG ĐIỂM HỒI PHỤC (Xanh)", description: "Lực cầu dưới giá thấp rất mạnh, báo hiệu tạo đáy." },
      { key: "bearish", label: "GIẢM TIẾP (Đỏ)", description: "Phe bán sẽ đánh bục mức 40.5." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Biến động chậm lại." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng điểm mạnh (Bullish).",
      why: "Dragonfly Doji ở đáy xu hướng giảm là tín hiệu từ chối giảm giá cực mạnh.",
      supplyDemand: "Bên bán xả hàng giá thấp đã bị hấp thụ 100%, bên mua làm chủ hoàn toàn nửa cuối phiên.",
      corporateImpact: "Điểm rơi lợi nhuận của mảng bán lẻ thực phẩm tạo động lực đảo chiều định giá P/E.",
      lesson: "Doji chuồn chuồn ở đáy là cơ hội gom hàng vị thế an toàn với điểm cắt lỗ ngay dưới râu nến.",
    },
  },
  {
    id: 6,
    title: "Bài 6: Gravestone Doji (Doji Bia Mộ) tại vùng đỉnh",
    level: "basic",
    pattern: "Gravestone Doji",
    ticker: "MSN",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 74.0, h: 75.5, l: 73.8, c: 75.2, v: 2200000 },
      { o: 75.2, h: 77.0, l: 75.0, c: 76.8, v: 2800000 },
      { o: 76.8, h: 79.2, l: 76.5, c: 78.9, v: 3400000 },
      { o: 78.9, h: 81.5, l: 78.5, c: 81.2, v: 4100000 },
      { o: 81.5, h: 85.5, l: 81.2, c: 81.4, v: 6800000 }, // Gravestone Doji
    ],
    nextCandle: { o: 81.0, h: 81.5, l: 78.0, c: 78.2, v: 5100000 },
    corporateContext:
      "MSN gặp áp lực nợ vay và chi phí tài chính cao khi lãi suất chưa hạ nhiệt như kỳ vọng.",
    marketSentiment: "Thanh khoản chung toàn thị trường có dấu hiệu phân hóa mạnh.",
    question: "Cây nến số 5 vọt lên 85.5 nhưng bị bán ép đóng cửa sát đáy nến 81.4 tạo Doji bia mộ. Nến tiếp theo sẽ diễn biến như thế nào?",
    options: [
      { key: "bullish", label: "VƯỢT ĐỈNH TIẾP (Xanh)", description: "Chỉ là rung lắc kỹ thuật." },
      { key: "bearish", label: "ĐẢO CHIỀU GIẢM (Đỏ)", description: "Bia mộ báo hiệu sự kết thúc của nhịp tăng." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tiếp tục giằng co quanh 81." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm (Bearish).",
      why: "Gravestone Doji thể hiện sự thất bại hoàn toàn của phe mua sau nỗ lực kéo giá đầu phiên.",
      supplyDemand: "Phe bán phục kích sẵn ở vùng giá cao xả hàng dồn dập, đẩy giá rớt không phanh về mức mở cửa.",
      corporateImpact: "Áp lực cấu trúc vốn làm giảm độ hấp dẫn của dòng tiền ngắn hạn.",
      lesson: "Gặp Gravestone Doji ở vùng kháng cự đỉnh nên hạ tỷ trọng bảo vệ lợi nhuận ngay lập tức.",
    },
  },
  {
    id: 7,
    title: "Bài 7: Inverted Hammer (Búa Ngược) kiểm tra cung sau nhịp rũ",
    level: "basic",
    pattern: "Inverted Hammer",
    ticker: "VCB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 92.0, h: 92.5, l: 90.8, c: 91.0, v: 1200000 },
      { o: 91.0, h: 91.5, l: 89.5, c: 89.8, v: 1500000 },
      { o: 89.8, h: 90.2, l: 88.0, c: 88.2, v: 1800000 },
      { o: 88.2, h: 88.5, l: 86.8, c: 87.0, v: 2100000 },
      { o: 87.0, h: 90.5, l: 86.9, c: 87.8, v: 3200000 }, // Inverted Hammer
    ],
    nextCandle: { o: 88.0, h: 91.2, l: 87.8, c: 90.8, v: 2900000 },
    corporateContext:
      "Vietcombank công bố tỷ lệ nợ xấu được kiểm soát dưới 1%, thấp nhất hệ thống ngân hàng thương mại.",
    marketSentiment: "Nhóm ngân hàng bắt đầu giữ nhịp chỉ số.",
    question: "Cây nến số 5 xuất hiện bóng trên dài sau chuỗi giảm liên tiếp, thân nến xanh nhỏ ở đáy. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG ĐIỂM ĐẢO CHIỀU (Xanh)", description: "Bên mua đã bắt đầu thử lực cầu thành công." },
      { key: "bearish", label: "GIẢM TIẾP (Đỏ)", description: "Bị bán ngược nên sẽ thủng đáy." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Chưa rõ xu hướng." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng điểm đảo chiều (Bullish).",
      why: "Búa ngược ở đáy cho thấy phe mua đã chủ động đánh thốc lên kiểm tra lượng cung trôi nổi.",
      supplyDemand: "Dù bị đè lại cuối phiên nhưng giá đóng cửa vẫn xanh, chứng tỏ lực mua gom của tạo lập đã bắt đầu xuất hiện.",
      corporateImpact: "Chất lượng tài sản hàng đầu của VCB thu hút quỹ đầu tư lớn giải ngân.",
      lesson: "Nến Búa ngược cần một phiên xanh kế tiếp xác nhận để mở lệnh mua an toàn.",
    },
  },
  {
    id: 8,
    title: "Bài 8: Hanging Man (Người Treo Cổ) rủi ro bẫy tăng",
    level: "basic",
    pattern: "Hanging Man",
    ticker: "DGC",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 110.0, h: 113.0, l: 109.5, c: 112.5, v: 2800000 },
      { o: 112.5, h: 116.0, l: 112.0, c: 115.8, v: 3400000 },
      { o: 115.8, h: 120.0, l: 115.5, c: 119.5, v: 4200000 },
      { o: 119.5, h: 124.0, l: 119.0, c: 123.5, v: 5100000 },
      { o: 123.5, h: 124.5, l: 117.0, c: 123.0, v: 6800000 }, // Hanging Man
    ],
    nextCandle: { o: 122.5, h: 123.0, l: 116.0, c: 116.5, v: 5900000 },
    corporateContext:
      "Giá phốt pho vàng thế giới có dấu hiệu chững lại sau chuỗi tăng phi mã 4 tháng qua.",
    marketSentiment: "Nhà đầu tư cá nhân hô hào mục tiêu giá không tưởng.",
    question: "Cây nến số 5 có hình dáng như nến búa nhưng lại nằm ở đỉnh sau chuỗi tăng mạnh, râu dưới rất dài. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "TĂNG TIẾP (Xanh)", description: "Rút chân nghĩa là cầu khỏe." },
      { key: "bearish", label: "GIẢM ĐIỂM PHÂN PHỐI (Đỏ)", description: "Người treo cổ cảnh báo lực bán âm thầm đã xuất hiện." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Cân bằng tích lũy." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm mạnh (Bearish).",
      why: "Hanging Man ở đỉnh phản ánh phe bán đã có lúc đạp giá sập sâu 6-7 giá trong phiên.",
      supplyDemand: "Việc kéo ngược cuối phiên thường là hành động đẩy giá nhân tạo để xả nốt lượng hàng giá cao còn lại.",
      corporateImpact: "Đà tăng giá hàng hóa chậm lại làm suy giảm kỳ vọng EPS tương lai.",
      lesson: "Đừng nhầm nến Người Treo Cổ ở đỉnh với Nến Búa ở đáy; Hanging Man là tín hiệu cảnh báo nguy hiểm cao độ.",
    },
  },
  {
    id: 9,
    title: "Bài 9: Spinning Top (Nến Con Quay) giằng co vùng cân bằng",
    level: "basic",
    pattern: "Spinning Top",
    ticker: "TCB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 24.5, h: 24.8, l: 23.5, c: 23.6, v: 12000000 },
      { o: 23.6, h: 23.8, l: 22.8, c: 22.9, v: 14000000 },
      { o: 22.9, h: 23.1, l: 22.2, c: 22.3, v: 16000000 },
      { o: 22.3, h: 22.6, l: 22.0, c: 22.3, v: 8000000 }, // Spinning Top
    ],
    nextCandle: { o: 22.4, h: 23.2, l: 22.3, c: 23.1, v: 15000000 },
    corporateContext:
      "Techcombank đẩy mạnh mảng bán lẻ và CASA duy trì vị thế top 2 toàn ngành.",
    marketSentiment: "Thị trường chuyển sang trạng thái chờ đợi thông tin CPI Mỹ.",
    question: "Cây nến số 4 thân nhỏ xíu, râu trên và râu dưới bằng nhau, khối lượng giảm một nửa. Nến tiếp theo sẽ ra sao khi lực bán dừng lại?",
    options: [
      { key: "bullish", label: "HỒI PHỤC TĂNG ĐIỂM (Xanh)", description: "Cung cạn kiệt, chỉ cần lực cầu nhỏ là giá bật lên." },
      { key: "bearish", label: "GIẢM SÂU TIẾP (Đỏ)", description: "Bên bán sẽ bán tháo tiếp." },
      { key: "neutral", label: "TIẾP TỤC ĐỨNG GIÁ (Doji)", description: "Thị trường đóng băng." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Hồi phục Tăng điểm (Bullish).",
      why: "Spinning Top với vol thấp sau đợt giảm mạnh là bằng chứng rõ nhất của sự cạn kiệt nguồn cung (No Supply).",
      supplyDemand: "Phe bán không còn hàng để xả, bên mua chỉ cần bỏ lượng vốn nhỏ cũng dễ dàng đẩy giá bật tăng.",
      corporateImpact: "Định giá P/B của TCB đã chiết khấu về mức hấp dẫn lịch sử.",
      lesson: "Khi thấy nến thân hẹp vol cạn kiệt tại hỗ trợ, hãy chuẩn bị cho một nhịp hồi kỹ thuật.",
    },
  },
  {
    id: 10,
    title: "Bài 10: High Wave Candle (Nến Sóng Cao) sau đà tăng nóng",
    level: "basic",
    pattern: "High Wave Candle",
    ticker: "PVD",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 26.0, h: 27.2, l: 25.8, c: 27.0, v: 6200000 },
      { o: 27.0, h: 28.5, l: 26.8, c: 28.4, v: 8100000 },
      { o: 28.4, h: 30.2, l: 28.2, c: 30.0, v: 11000000 },
      { o: 30.0, h: 32.5, l: 28.5, c: 30.2, v: 19500000 }, // High Wave
    ],
    nextCandle: { o: 30.0, h: 30.3, l: 28.0, c: 28.2, v: 14000000 },
    corporateContext:
      "Giá cước thuê giàn khoan tự nâng khu vực Đông Nam Á lập đỉnh 10 năm.",
    marketSentiment: "Cổ phiếu dầu khí dậy sóng, F0 fomo đua lệnh bất chấp.",
    question: "Cây nến số 4 biên độ dao động cực lớn (từ 28.5 đến 32.5), cả 2 râu đều rất dài, thân nến mỏng, vol kỷ lục. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG TRẦN (Xanh)", description: "Dòng tiền quá khủng sẽ đẩy vượt đỉnh." },
      { key: "bearish", label: "GIẢM ĐIỀU CHỈNH (Đỏ)", description: "Sóng cao vol khủng là dấu hiệu 'thay máu' và phân phối." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Biến động chậm lại." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm điều chỉnh (Bearish).",
      why: "Nến Sóng Cao (High Wave) với bóng nến trên dưới cực dài thể hiện sự hỗn loạn và mất kiểm soát xu hướng.",
      supplyDemand: "Giao dịch 2 chiều kịch liệt với khối lượng lớn là tín hiệu phân phối hàng của nhà tạo lập cho F0.",
      corporateImpact: "Tin tốt giá giàn khoan đã được truyền thông đưa tin rầm rộ, không còn yếu tố bất ngờ.",
      lesson: "Biên độ giá nới rộng bất thường kèm vol đỉnh là thời điểm rời khỏi bàn tiệc, không phải lúc mua mới.",
    },
  },
  {
    id: 11,
    title: "Bài 11: Nến Belt Hold Tăng Trưởng (Đai Giữ Tăng)",
    level: "basic",
    pattern: "Bullish Belt Hold",
    ticker: "KDH",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 34.0, h: 34.2, l: 32.5, c: 32.8, v: 1900000 },
      { o: 32.8, h: 33.0, l: 31.2, c: 31.5, v: 2400000 },
      { o: 31.5, h: 31.8, l: 30.2, c: 30.4, v: 3100000 },
      { o: 30.4, h: 33.2, l: 30.4, c: 33.0, v: 6200000 }, // Belt Hold
    ],
    nextCandle: { o: 33.2, h: 34.8, l: 33.0, c: 34.5, v: 5100000 },
    corporateContext:
      "KDH mở bán giai đoạn mới dự án Clarita tại TP. Thủ Đức với tỷ lệ hấp thụ trên 90%.",
    marketSentiment: "Bất động sản sạch pháp lý thu hút dòng tiền trung dài hạn.",
    question: "Cây nến số 4 mở cửa tại đúng giá thấp nhất phiên 30.4 rồi tăng vọt lên 33.0 đóng cửa sát giá cao nhất. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ TĂNG (Xanh)", description: "Đai giữ tăng mở đầu một sóng tăng mới." },
      { key: "bearish", label: "QUAY XE GIẢM (Đỏ)", description: "Chỉ là cú nảy kỹ thuật yếu." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Chững lại tích lũy." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp đà Tăng mạnh (Bullish).",
      why: "Bullish Belt Hold mở cửa không có bóng dưới (không một lệnh nào khớp dưới giá mở) thể hiện bên mua chủ động kiểm soát ngay từ giây đầu tiên.",
      supplyDemand: "Phe mua chặn toàn bộ lệnh bán từ sớm và kéo thẳng lên đỉnh cao nhất phiên.",
      corporateImpact: "Dòng tiền từ bán hàng dự án thực tế hỗ trợ vững chắc cho định giá doanh nghiệp.",
      lesson: "Belt Hold xuất hiện ở đáy là tín hiệu đảo chiều có độ tin cậy rất cao.",
    },
  },
  {
    id: 12,
    title: "Bài 12: Long-Legged Doji (Doji Chân Dài) tại vùng hỗ trợ",
    level: "basic",
    pattern: "Long-Legged Doji",
    ticker: "VNM",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 68.0, h: 68.5, l: 66.8, c: 67.0, v: 3800000 },
      { o: 67.0, h: 67.2, l: 65.5, c: 65.8, v: 4200000 },
      { o: 65.8, h: 66.0, l: 64.2, c: 64.5, v: 4800000 },
      { o: 64.5, h: 66.5, l: 62.5, c: 64.6, v: 8900000 }, // Long Legged Doji
    ],
    nextCandle: { o: 64.8, h: 66.8, l: 64.5, c: 66.5, v: 6200000 },
    corporateContext:
      "Vinamilk duy trì chia cổ tức tiền mặt đều đặn 38.5% mỗi năm, thị giá rơi về mức P/E 13.5 lần.",
    marketSentiment: "Khối ngoại dừng đà bán ròng và bắt đầu mua ròng trở lại 500.000 cổ.",
    question: "Cây nến số 4 bóng trên bóng dưới vươn xa nhưng giá đóng cửa gần như bằng giá mở cửa tại hỗ trợ lịch sử. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "BẬT TĂNG (Xanh)", description: "Đã diễn ra cuộc thanh trừng cung cầu và bên bán kiệt sức." },
      { key: "bearish", label: "SẬP ĐÁY (Đỏ)", description: "Dao động quá lớn báo hiệu còn giảm tiếp." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Đứng yên tại chỗ." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Bật tăng hồi phục (Bullish).",
      why: "Doji chân dài ở đáy chứng tỏ hai bên đã giao chiến kịch liệt và phe bán không thể đẩy giá xuống thêm được nữa.",
      supplyDemand: "Lực cầu bắt đáy giá rẻ 62.5 hấp thu toàn bộ lượng hàng cutloss.",
      corporateImpact: "Tỷ suất cổ tức tiền mặt cao trở thành tấm đệm bảo vệ thị giá.",
      lesson: "Doji chân dài thể hiện sự chuyển giao quyền lực từ phe bán sang phe mua.",
    },
  },
  {
    id: 13,
    title: "Bài 13: Doji Star tại vùng cản kháng cự",
    level: "basic",
    pattern: "Doji Star",
    ticker: "MBB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 22.0, h: 22.6, l: 21.8, c: 22.5, v: 14000000 },
      { o: 22.5, h: 23.5, l: 22.4, c: 23.4, v: 19000000 },
      { o: 23.4, h: 24.8, l: 23.3, c: 24.7, v: 28000000 },
      { o: 25.0, h: 25.3, l: 24.8, c: 25.0, v: 22000000 }, // Doji Star mở gap
    ],
    nextCandle: { o: 24.9, h: 25.1, l: 24.0, c: 24.2, v: 18000000 },
    corporateContext:
      "Tín dụng ngành ngân hàng tăng tốc nhưng biên lãi ròng NIM chịu áp lực cạnh tranh gay gắt.",
    marketSentiment: "Chỉ số VN30 tiệm cận mốc cản 1.300 điểm.",
    question: "Cây nến số 4 nhảy gap mở cửa 25.0 nhưng cả ngày không tăng được thêm, đóng phiên thành nến Doji Star. Nến tiếp theo sẽ như thế nào?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ TĂNG TRẦN (Xanh)", description: "Gap tăng sức mạnh." },
      { key: "bearish", label: "ĐẢO CHIỀU LẤP GAP (Đỏ)", description: "Doji Star cảnh báo hụt hơi, phe bán ép lấp gap." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Đi ngang quanh 25." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm lấp gap (Bearish).",
      why: "Doji Star xuất hiện sau một nhịp tăng dốc mở gap là tín hiệu mệt mỏi của đà tăng.",
      supplyDemand: "Người mua không sẵn lòng trả giá cao hơn vùng 25.3, lực chốt lời ngắn hạn chiếm ưu thế.",
      corporateImpact: "Định giá P/B của MBB chạm ngưỡng trung bình 3 năm, kích hoạt tái cơ cấu danh mục của các quỹ ETF.",
      lesson: "Thấy Doji Star mở gap ở đỉnh tuyệt đối không được fomo mua đuổi.",
    },
  },
  {
    id: 14,
    title: "Bài 14: Nến Takuri (Hammer râu siêu dài bắt đáy hoảng loạn)",
    level: "basic",
    pattern: "Takuri Line",
    ticker: "STB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 29.5, h: 29.8, l: 28.5, c: 28.6, v: 16000000 },
      { o: 28.6, h: 28.8, l: 27.2, c: 27.4, v: 21000000 },
      { o: 27.4, h: 27.6, l: 26.0, c: 26.2, v: 26000000 },
      { o: 26.2, h: 26.5, l: 23.5, c: 26.4, v: 48000000 }, // Takuri Line
    ],
    nextCandle: { o: 26.6, h: 28.2, l: 26.5, c: 28.0, v: 32000000 },
    corporateContext:
      "Tin đồn thất thiệt về nhân sự cấp cao lan truyền trên mạng xã hội khiến lệnh bán giải chấp tự động bị kích hoạt.",
    marketSentiment: "Hoảng loạn lan rộng trong phiên sáng, phiên chiều xuất hiện thông tin đính chính từ cơ quan quản lý.",
    question: "Cây nến số 4 bị bán tháo cắm xuống 23.5 (-10%) nhưng chiều rút chân vọt ngược về 26.4 với bóng nến dưới cực dài (Takuri). Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG BẬT MẠNH (Xanh)", description: "Tin đồn được đính chính, dòng tiền săn hàng giá rẻ kéo trần." },
      { key: "bearish", label: "GIẢM SÀN TIẾP (Đỏ)", description: "Dư chấn bán tháo còn nặng nề." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Thị trường nghỉ ngơi." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng bật mạnh mẽ (Bullish).",
      why: "Takuri Line (bóng nến dưới dài gấp 3 lần thân) là dấu hiệu kinh điển của việc gom hàng hoảng loạn.",
      supplyDemand: "Nhà đầu tư yếu bóng vía đã bán sạch ở mức giá sàn 23.5, hàng đã rơi vào tay các tổ chức lớn.",
      corporateImpact: "Yếu tố cơ bản của Sacombank về xử lý nợ VAMC hoàn toàn không bị ảnh hưởng bởi tin đồn.",
      lesson: "Bán hoảng loạn vì tin đồn vô căn cứ khi xuất hiện nến Takuri rút chân là đáy ngắn hạn của cổ phiếu.",
    },
  },
  {
    id: 15,
    title: "Bài 15: Bearish Belt Hold (Đai Giữ Giảm) dập tắt hy vọng",
    level: "basic",
    pattern: "Bearish Belt Hold",
    ticker: "HDB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 23.0, h: 23.8, l: 22.8, c: 23.6, v: 6200000 },
      { o: 23.6, h: 24.5, l: 23.5, c: 24.4, v: 7500000 },
      { o: 24.4, h: 25.5, l: 24.3, c: 25.4, v: 9100000 },
      { o: 25.4, h: 25.4, l: 23.2, c: 23.4, v: 14500000 }, // Bearish Belt Hold
    ],
    nextCandle: { o: 23.2, h: 23.4, l: 22.0, c: 22.1, v: 11000000 },
    corporateContext:
      "Tỷ lệ nợ xấu nhóm 2 tăng nhẹ, chi phí trích lập dự phòng rủi ro dự kiến tăng trong quý tới.",
    marketSentiment: "Nhóm ngân hàng bắt đầu bị hạ tỷ trọng.",
    question: "Cây nến số 4 mở cửa tại giá cao nhất phiên 25.4 không hề có râu trên, sau đó bị xả dồn dập đóng cửa thấp nhất. Nến tiếp theo sẽ như thế nào?",
    options: [
      { key: "bullish", label: "TĂNG HỒI PHỤC (Xanh)", description: "Chỉ là rũ cung bình thường." },
      { key: "bearish", label: "GIẢM TIẾP (Đỏ)", description: "Phe bán áp đảo từ giây mở cửa đến hết phiên." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Dao động chậm lại." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp tục Giảm sâu (Bearish).",
      why: "Bearish Belt Hold mở cửa đã là đỉnh cao nhất và bị bán miệt mài cho thấy phe gấu đã hoàn toàn làm chủ.",
      supplyDemand: "Không có lực cầu đỡ giá tại các bước giá trên, lệnh MP bán thẳng vào các bước giá mua thấp.",
      corporateImpact: "Áp lực trích lập dự phòng làm giảm triển vọng tăng trưởng lợi nhuận ngắn hạn.",
      lesson: "Khi thấy nến đỏ dài không râu trên mở gap tại vùng giá cao, hãy hạ tỷ trọng ngay trong phiên.",
    },
  },

  // ==================== TRUNG CẤP (16 - 35) ====================
  {
    id: 16,
    title: "Bài 16: Bullish Engulfing (Nhấn Chìm Tăng) sau 5 phiên giảm sàn",
    level: "intermediate",
    pattern: "Bullish Engulfing",
    ticker: "HPG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 25.0, h: 25.2, l: 24.0, c: 24.1, v: 22000000 },
      { o: 24.1, h: 24.3, l: 23.0, c: 23.1, v: 26000000 },
      { o: 23.1, h: 23.3, l: 22.0, c: 22.1, v: 31000000 },
      { o: 22.0, h: 22.2, l: 21.0, c: 21.1, v: 35000000 },
      { o: 20.8, h: 23.0, l: 20.5, c: 22.8, v: 68000000 }, // Bullish Engulfing nuốt trọn nến trước
    ],
    nextCandle: { o: 23.0, h: 24.5, l: 22.8, c: 24.2, v: 45000000 },
    corporateContext:
      "Chủ tịch HĐQT đăng ký mua vào 50 triệu cổ phiếu. Dòng vốn khối ngoại bất ngờ đảo chiều mua ròng hơn 500 tỷ đồng.",
    marketSentiment: "Tâm lý thị trường chuyển từ bi quan cùng cực sang phấn chấn.",
    question: "Cây nến số 5 mở cửa thấp hơn đáy nến 4 nhưng sau đó tăng dựng đứng, thân nến xanh nuốt trọn toàn bộ cây nến đỏ trước. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ BÙNG NỔ (Xanh)", description: "Mô hình Nhấn chìm tăng xác nhận đảo chiều đáy kinh điển." },
      { key: "bearish", label: "QUAY LẠI GIẢM (Đỏ)", description: "Lực bán sẽ quay lại kiểm tra đáy." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tạm dừng nghỉ ngơi." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp đà Tăng bùng nổ (Bullish).",
      why: "Bullish Engulfing là một trong những mô hình đảo chiều có tỷ lệ thắng cao nhất trong phân tích kỹ thuật.",
      supplyDemand: "Phe mua đã gom sạch toàn bộ lượng hàng mà phe bán cố xả ra trong phiên trước và đẩy giá vượt lên trên.",
      corporateImpact: "Động thái mua vào của lãnh đạo doanh nghiệp là bảo chứng thép cho vùng giá đáy hợp lý.",
      lesson: "Bullish Engulfing kèm vol đột biến sau một nhịp giảm dài là tín hiệu 'All-in' của các nhà đầu tư giá trị.",
    },
  },
  {
    id: 17,
    title: "Bài 17: Bearish Engulfing (Nhấn Chìm Giảm) tại đỉnh thanh khoản",
    level: "intermediate",
    pattern: "Bearish Engulfing",
    ticker: "SSI",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 35.0, h: 36.0, l: 34.8, c: 35.8, v: 24000000 },
      { o: 35.8, h: 37.0, l: 35.5, c: 36.9, v: 28000000 },
      { o: 36.9, h: 38.2, l: 36.8, c: 38.0, v: 34000000 },
      { o: 38.0, h: 39.5, l: 37.8, c: 39.2, v: 42000000 },
      { o: 39.8, h: 40.0, l: 37.0, c: 37.2, v: 58000000 }, // Bearish Engulfing nuốt chửng nến xanh
    ],
    nextCandle: { o: 37.0, h: 37.2, l: 35.0, c: 35.2, v: 38000000 },
    corporateContext:
      "Thị trường xuất hiện tin đồn siết room cho vay ký quỹ (margin) tại các công ty chứng khoán lớn.",
    marketSentiment: "Áp lực xả hàng quyết liệt từ các nhóm 'tay to'.",
    question: "Cây nến số 5 mở gap tăng nhẹ nhưng ngay sau đó bị bán dồn dập, thân nến đỏ khổng lồ bao trọn hoàn toàn cây nến xanh số 4. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "TĂNG TRỞ LẠI (Xanh)", description: "Chỉ là pha rũ bỏ hàng margin." },
      { key: "bearish", label: "GIẢM MẠNH TIẾP (Đỏ)", description: "Mô hình Nhấn chìm giảm xác nhận đỉnh phân phối." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Giằng co quanh 37." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm mạnh tiếp diễn (Bearish).",
      why: "Bearish Engulfing nuốt chửng toàn bộ nỗ lực tăng của phiên trước, xoá tan niềm hy vọng của phe mua.",
      supplyDemand: "Dòng tiền lớn tháo chạy tạo hiệu ứng sập domino khi các lệnh cắt lỗ tự động liên tiếp kích hoạt.",
      corporateImpact: "Tin đồn siết margin đánh thẳng vào nguồn sinh khí của thanh khoản thị trường chứng khoán.",
      lesson: "Xuất hiện Bearish Engulfing kèm vol đỉnh là lệnh thoát hàng khẩn cấp không do dự.",
    },
  },
  {
    id: 18,
    title: "Bài 18: Piercing Pattern (Đường Xuyên Thấu) đảo chiều tăng",
    level: "intermediate",
    pattern: "Piercing Pattern",
    ticker: "FPT",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 125.0, h: 125.5, l: 122.0, c: 122.5, v: 3200000 },
      { o: 122.5, h: 123.0, l: 119.5, c: 120.0, v: 3800000 },
      { o: 120.0, h: 120.5, l: 116.0, c: 116.5, v: 4500000 }, // Nến đỏ dài
      { o: 114.5, h: 121.0, l: 114.0, c: 119.5, v: 6200000 }, // Piercing nảy quá 50% nến trước
    ],
    nextCandle: { o: 120.0, h: 124.5, l: 119.8, c: 124.0, v: 5100000 },
    corporateContext:
      "FPT thông báo trả cổ tức bằng tiền mặt tỷ lệ 20% và cổ phiếu 15%, doanh thu chuyển đổi số quốc tế tiếp tục tăng trưởng 30%.",
    marketSentiment: "Tâm lý bán tháo ngừng lại khi các cổ phiếu cơ bản tốt về vùng định giá hấp dẫn.",
    question: "Cây nến số 4 mở gap giảm sâu đầu phiên nhưng cuối phiên tăng thốc, đóng cửa vượt qua 50% thân nến đỏ trước. Nến tiếp theo sẽ như thế nào?",
    options: [
      { key: "bullish", label: "TĂNG ĐIỂM TIẾP (Xanh)", description: "Đường xuyên thấu kích hoạt dòng tiền vào mạnh mẽ." },
      { key: "bearish", label: "GIẢM THỦNG ĐÁY (Đỏ)", description: "Đà giảm vẫn chưa kết thúc." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Chững lại tích lũy." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng điểm tiếp diễn (Bullish).",
      why: "Piercing Pattern yêu cầu nến xanh phải đóng cửa trên 50% thân cây nến đỏ liền trước, chứng minh lực cầu áp đảo trở lại.",
      supplyDemand: "Người bán đã mất kiểm soát, người mua sẵn sàng đu giá lên cao để gom hàng.",
      corporateImpact: "Chính sách cổ tức hấp dẫn và tăng trưởng bền vững thu hút dòng vốn phòng thủ.",
      lesson: "Khi nến xuyên thủng trên 50% nến đỏ kèm vol lớn, tỷ lệ đảo chiều thành công lên đến 70-80%.",
    },
  },
  {
    id: 19,
    title: "Bài 19: Dark Cloud Cover (Mây Đen Bao Phủ) tại vùng cản",
    level: "intermediate",
    pattern: "Dark Cloud Cover",
    ticker: "MWG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 54.0, h: 55.5, l: 53.8, c: 55.2, v: 7500000 },
      { o: 55.2, h: 57.0, l: 55.0, c: 56.8, v: 8900000 },
      { o: 56.8, h: 59.5, l: 56.5, c: 59.2, v: 11500000 }, // Nến xanh mạnh
      { o: 60.5, h: 61.0, l: 57.0, c: 57.2, v: 15800000 }, // Dark Cloud Cover đâm sâu 50%
    ],
    nextCandle: { o: 57.0, h: 57.2, l: 54.5, c: 54.8, v: 12000000 },
    corporateContext:
      "Tăng trưởng doanh thu bình quân trên mỗi cửa hàng điện máy chững lại do sức mua tiêu dùng phục hồi chậm.",
    marketSentiment: "Khối tự doanh các công ty chứng khoán bán ròng nhóm bán lẻ.",
    question: "Cây nến số 4 mở gap tăng vượt đỉnh 60.5 nhưng bị bán dập về 57.2 (ăn sâu quá nửa nến xanh số 3). Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "TĂNG VƯỢT ĐỈNH (Xanh)", description: "Cầu sẽ vào đẩy qua 61." },
      { key: "bearish", label: "GIẢM ĐIỂM ĐẢO CHIỀU (Đỏ)", description: "Mây đen bao phủ cảnh báo đỉnh ngắn hạn." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tích lũy quanh 57." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm đảo chiều (Bearish).",
      why: "Dark Cloud Cover là mô hình đảo chiều giảm kinh điển khi nến đỏ ăn sâu vào hơn 50% nến xanh trước đó.",
      supplyDemand: "Phe mua bị dính bẫy mở gap (Bull trap) đầu phiên và bị kẹp hàng giá cao.",
      corporateImpact: "Kỳ vọng tiêu dùng phục hồi thần tốc bị hạ nhiệt khiến dòng tiền ngắn hạn rút lui.",
      lesson: "Đừng bao giờ coi thường mô hình Mây Đen Bao Phủ khi nó đi kèm khối lượng giao dịch đột biến.",
    },
  },
  {
    id: 20,
    title: "Bài 20: Morning Star (Sao Mai) khởi đầu chu kỳ hồi phục",
    level: "intermediate",
    pattern: "Morning Star",
    ticker: "VNM",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 70.0, h: 70.5, l: 68.0, c: 68.2, v: 4100000 },
      { o: 68.2, h: 68.5, l: 66.0, c: 66.2, v: 4800000 }, // Nến 1: Giảm mạnh
      { o: 65.5, h: 66.0, l: 65.0, c: 65.4, v: 2200000 }, // Nến 2: Doji nhỏ mở gap dưới
      { o: 65.8, h: 69.0, l: 65.6, c: 68.8, v: 7500000 }, // Nến 3: Tăng thốc xác nhận
    ],
    nextCandle: { o: 69.0, h: 71.5, l: 68.8, c: 71.2, v: 6200000 },
    corporateContext:
      "Giá sữa nguyên liệu thế giới giảm 15% giúp biên lợi nhuận gộp của VNM cải thiện mạnh mẽ trong quý tới.",
    marketSentiment: "Dòng tiền tìm về nhóm cổ phiếu cơ bản có dòng tiền dồi dào.",
    question: "Bộ ba nến kết thúc bằng nến xanh số 4 tăng mạnh vượt điểm giữa của nến đỏ số 2, tạo mô hình Sao Mai hoàn hảo. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ BẬT TĂNG (Xanh)", description: "Sao Mai thắp sáng hy vọng, mở ra sóng tăng mới." },
      { key: "bearish", label: "QUAY XE GIẢM (Đỏ)", description: "Chỉ là cú nảy kỹ thuật." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Đi ngang quanh 69." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp đà Bật tăng (Bullish).",
      why: "Morning Star là cụm 3 nến đảo chiều đáy mạnh mẽ nhất, thể hiện sự chuyển giao quyền lực hoàn hảo.",
      supplyDemand: "Nến 1: Phe bán xả -> Nến 2: Phe bán kiệt sức (Doji vol nhỏ) -> Nến 3: Phe mua chiếm trọn quyền kiểm soát.",
      corporateImpact: "Yếu tố biên lợi nhuận gộp phục hồi là động lực tăng trưởng cốt lõi của doanh nghiệp sản xuất.",
      lesson: "Morning Star hoàn thiện là điểm giải ngân mua gia tăng tỷ trọng lý tưởng nhất.",
    },
  },
  {
    id: 21,
    title: "Bài 21: Evening Star (Sao Hôm) dập tắt đà hưng phấn",
    level: "intermediate",
    pattern: "Evening Star",
    ticker: "VCB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 88.0, h: 90.0, l: 87.8, c: 89.8, v: 1800000 },
      { o: 89.8, h: 93.0, l: 89.5, c: 92.8, v: 2400000 }, // Nến 1: Tăng mạnh
      { o: 94.0, h: 94.5, l: 93.5, c: 93.8, v: 1500000 }, // Nến 2: Doji mở gap đỉnh
      { o: 93.5, h: 93.8, l: 89.5, c: 90.0, v: 3800000 }, // Nến 3: Giảm sâu đâm thủng nến 1
    ],
    nextCandle: { o: 89.8, h: 90.2, l: 87.5, c: 87.8, v: 3100000 },
    corporateContext:
      "Tăng trưởng tín dụng toàn hệ thống có dấu hiệu chậm lại trong quý cuối năm để kiểm soát lạm phát.",
    marketSentiment: "Áp lực chốt lời nhóm cổ phiếu 'vua' lan rộng.",
    question: "Cụm 3 nến kết thúc bằng nến đỏ số 4 giảm sâu dìm giá xuống dưới nửa nến xanh số 2, hình thành mô hình Sao Hôm (Evening Star). Nến tiếp theo sẽ thế nào?",
    options: [
      { key: "bullish", label: "TĂNG VƯỢT ĐỈNH (Xanh)", description: "Chỉ là rũ cung để kéo vượt 95." },
      { key: "bearish", label: "GIẢM ĐIỂM SÂU HƠN (Đỏ)", description: "Sao Hôm báo hiệu bóng đêm ùa về, giá sẽ lao dốc." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Đi ngang quanh 90." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Giảm điểm sâu hơn (Bearish).",
      why: "Evening Star ở vùng đỉnh là lời cảnh báo đanh thép về việc phe mua đã hoàn toàn buông tay.",
      supplyDemand: "Nhà đầu tư đu đỉnh ở nến số 2 bị kẹp hàng hoàn toàn, áp lực bán cắt lỗ tăng vọt.",
      corporateImpact: "Chính sách tiền tệ thận trọng hạn chế đà bứt phá định giá nhóm ngân hàng.",
      lesson: "Thấy Evening Star hoàn tất, hãy kích hoạt lệnh chốt lời hoặc dừng lỗ ngay lập tức.",
    },
  },
  {
    id: 22,
    title: "Bài 22: Tweezer Bottom (Đáy Nhíp) giữ vững phòng tuyến",
    level: "intermediate",
    pattern: "Tweezer Bottom",
    ticker: "TCB",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 23.5, h: 23.8, l: 22.0, c: 22.2, v: 16000000 },
      { o: 22.2, h: 22.4, l: 21.0, c: 21.2, v: 18000000 },
      { o: 21.2, h: 21.5, l: 20.0, c: 20.2, v: 24000000 }, // Nến đỏ chạm 20.0 rút nhẹ
      { o: 20.2, h: 21.8, l: 20.0, c: 21.6, v: 22000000 }, // Nến xanh chạm đúng 20.0 bật tăng
    ],
    nextCandle: { o: 21.6, h: 22.8, l: 21.5, c: 22.6, v: 26000000 },
    corporateContext:
      "Techcombank công bố kế hoạch chia cổ tức bằng tiền mặt tỷ lệ 15% sau 10 năm giữ lại lợi nhuận tái đầu tư.",
    marketSentiment: "Lực cầu tổ chức kê lệnh mua đỡ giá hàng chục triệu cổ phiếu tại mốc 20.0.",
    question: "Hai cây nến số 3 và 4 có râu dưới chạm chính xác cùng một mức giá thấp nhất 20.0 rồi nến 4 bật tăng thành nến xanh (Đáy nhíp). Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "BẬT TĂNG MẠNH (Xanh)", description: "Đáy nhíp xác nhận hỗ trợ bê tông cốt thép vững chắc." },
      { key: "bearish", label: "THỦNG ĐÁY 20.0 (Đỏ)", description: "Bên bán sẽ ép thủng mốc 20." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Dao động hẹp quanh 21." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Bật tăng mạnh mẽ (Bullish).",
      why: "Tweezer Bottom (Đáy Nhíp) kiểm tra đáy 2 lần liên tiếp không thủng chứng tỏ lực đỡ giá vô cùng kiên cố.",
      supplyDemand: "Mức giá 20.0 được coi là 'lằn ranh đỏ' của phe mua; mọi lệnh bán xuống mức này đều bị gom sạch.",
      corporateImpact: "Tin tức chia cổ tức tiền mặt tạo cú hích tâm lý cực lớn cho cổ đông.",
      lesson: "Đáy nhíp tại hỗ trợ cứng là điểm vào lệnh với tỷ lệ Risk/Reward cực kỳ hấp dẫn.",
    },
  },
  {
    id: 23,
    title: "Bài 23: Tweezer Top (Đỉnh Nhíp) dội ngược từ bức tường cản",
    level: "intermediate",
    pattern: "Tweezer Top",
    ticker: "GAS",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 76.0, h: 78.5, l: 75.8, c: 78.2, v: 1200000 },
      { o: 78.2, h: 81.0, l: 78.0, c: 80.8, v: 1600000 },
      { o: 80.8, h: 84.0, l: 80.5, c: 83.5, v: 2400000 }, // Nến chạm đỉnh 84.0
      { o: 83.5, h: 84.0, l: 81.2, c: 81.5, v: 2200000 }, // Nến chạm đúng 84.0 bị dội về đỏ
    ],
    nextCandle: { o: 81.2, h: 81.5, l: 78.5, c: 78.8, v: 1900000 },
    corporateContext:
      "Dự án kho cảng LNG Thị Vải đi vào hoạt động nhưng sản lượng khí cấp cho các nhà máy điện giảm do thủy điện phát tối đa công suất.",
    marketSentiment: "Nhóm dầu khí bị chốt lời diện rộng.",
    question: "Hai cây nến số 3 và 4 liên tiếp chạm đúng mốc 84.0 không thể vượt qua, nến số 4 bị đè đỏ về 81.5 (Đỉnh nhíp). Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "VƯỢT 84.0 (Xanh)", description: "Lần thứ 3 sẽ bứt phá thành công." },
      { key: "bearish", label: "ĐẢO CHIỀU GIẢM (Đỏ)", description: "Đỉnh nhíp xác nhận kháng cự cứng không thể xuyên thủng." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Quanh quẩn 81." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Đảo chiều Giảm (Bearish).",
      why: "Tweezer Top thể hiện phe mua đã 2 lần thử sức vượt ngưỡng cản nhưng đều bị phe bán dội gáo nước lạnh.",
      supplyDemand: "Lượng cung chờ sẵn ở vùng 84.0 quá lớn, bên mua cạn kiệt lực tiếp ứng.",
      corporateImpact: "Tình hình tiêu thụ khí biến động theo mùa khiến động lực tăng trưởng bị giới hạn.",
      lesson: "Hai cây nến liên tiếp rụt đầu tại cùng một mức giá kháng cự là tín hiệu báo động đỏ.",
    },
  },
  {
    id: 24,
    title: "Bài 24: Three White Soldiers (Ba Chàng Lính Trắng) mở sóng",
    level: "intermediate",
    pattern: "Three White Soldiers",
    ticker: "DGC",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 88.0, h: 88.5, l: 85.0, c: 85.5, v: 2100000 },
      { o: 85.5, h: 88.0, l: 85.2, c: 87.8, v: 3400000 }, // Lính 1: Xanh mở từ đáy
      { o: 87.8, h: 90.5, l: 87.5, c: 90.2, v: 4200000 }, // Lính 2: Xanh mở trong thân nến 1
      { o: 90.2, h: 93.0, l: 90.0, c: 92.8, v: 5100000 }, // Lính 3: Xanh tăng tiếp đóng cao nhất
    ],
    nextCandle: { o: 93.0, h: 96.5, l: 92.8, c: 96.0, v: 5800000 },
    corporateContext:
      "Dự án Tổ hợp Hóa chất Nghi Sơn được cấp phép đầu tư giai đoạn 1, mở ra chu kỳ tăng trưởng doanh thu 5 năm tới.",
    marketSentiment: "Dòng tiền lớn từ các quỹ ngoại liên tục gia tăng tỷ trọng.",
    question: "Ba cây nến xanh liên tiếp tăng dần đều, nến sau mở cửa trong thân nến trước và đóng cửa sát giá cao nhất phiên. Nến tiếp theo sẽ như thế nào?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ BÙNG NỔ (Xanh)", description: "Ba chàng lính trắng báo hiệu xu hướng tăng bền vững." },
      { key: "bearish", label: "ĐẢO CHIỀU GIẢM (Đỏ)", description: "Đã tăng 3 phiên nên sẽ bị bán mạnh." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Nghỉ chân đi ngang." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp đà Bùng nổ (Bullish).",
      why: "Three White Soldiers là một trong những mô hình đảo chiều và tiếp diễn tăng uy lực nhất trong trường phái Price Action.",
      supplyDemand: "Lực cầu ổn định và gia tăng theo từng phiên, không cho phe bán bất cứ cơ hội phản kích nào.",
      corporateImpact: "Dự án mới quy mô tỷ USD thay đổi căn bản quy mô tài sản và lợi nhuận của DGC.",
      lesson: "Đừng sợ mua sau 3 cây nến xanh nếu đó là mô hình Ba Chàng Lính Trắng vừa bứt khỏi nền tích lũy.",
    },
  },
  {
    id: 25,
    title: "Bài 25: Three Black Crows (Ba Con Quạ Đen) gãy kênh giá",
    level: "intermediate",
    pattern: "Three Black Crows",
    ticker: "VHM",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 48.0, h: 48.5, l: 46.0, c: 46.2, v: 9200000 }, // Quạ 1: Đỏ thủng hỗ trợ
      { o: 46.2, h: 46.5, l: 44.0, c: 44.2, v: 12500000 }, // Quạ 2: Đỏ mở trong thân nến 1
      { o: 44.2, h: 44.5, l: 42.0, c: 42.1, v: 16800000 }, // Quạ 3: Đỏ giảm sâu đóng thấp nhất
    ],
    nextCandle: { o: 42.0, h: 42.2, l: 39.8, c: 40.0, v: 14500000 },
    corporateContext:
      "Áp lực đáo hạn trái phiếu doanh nghiệp trong quý đè nặng lên kế hoạch tài chính ngắn hạn.",
    marketSentiment: "Tâm lý bán tháo hoảng loạn lan truyền khắp các diễn đàn chứng khoán.",
    question: "Ba cây nến đỏ dài liên tiếp xuất hiện, nến sau mở trong thân nến trước và đóng cửa ở mức thấp nhất (Ba con quạ đen). Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "BẮT ĐÁY HỒI PHỤC (Xanh)", description: "Giảm 3 phiên rồi sẽ phải nảy lại." },
      { key: "bearish", label: "TIẾP TỤC RƠI TỰ DO (Đỏ)", description: "Ba con quạ đen báo hiệu chu kỳ lao dốc không phanh." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Đứng giá tích lũy." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp tục Giảm sâu (Bearish).",
      why: "Three Black Crows là biểu hiện của sự sụp đổ cấu trúc thị trường và sự tháo chạy hoảng loạn của phe mua.",
      supplyDemand: "Bên bán xả hàng bất chấp giá, bên mua triệt để rút lệnh chờ đỡ giá ở vùng sâu hơn.",
      corporateImpact: "Rủi ro dòng tiền và đáo hạn nợ làm lung lay niềm tin của cổ đông tổ chức.",
      lesson: "Thấy Ba Con Quạ Đen xuất hiện, tuyệt đối không được bắt đáy vì đáy sau thường sâu hơn đáy trước rất nhiều.",
    },
  },

  // ==================== NÂNG CAO & VSA (26 - 50) ====================
  {
    id: 26,
    title: "Bài 26: Rising Three Methods (Mô Hình Tăng 3 Bước)",
    level: "advanced",
    pattern: "Rising Three Methods",
    ticker: "HPG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 26.0, h: 29.0, l: 25.8, c: 28.8, v: 55000000 }, // Nến 1: Xanh dài bứt phá
      { o: 28.8, h: 29.0, l: 28.2, c: 28.4, v: 18000000 }, // Nến 2: Đỏ nhỏ nghỉ
      { o: 28.4, h: 28.6, l: 27.8, c: 28.0, v: 16000000 }, // Nến 3: Đỏ nhỏ nghỉ
      { o: 28.0, h: 28.2, l: 27.5, c: 27.8, v: 15000000 }, // Nến 4: Đỏ nhỏ vẫn trong thân nến 1
      { o: 27.9, h: 30.5, l: 27.8, c: 30.2, v: 62000000 }, // Nến 5: Xanh dài phá đỉnh
    ],
    nextCandle: { o: 30.3, h: 31.8, l: 30.0, c: 31.5, v: 48000000 },
    corporateContext:
      "Dự án Khu liên hợp sản xuất Gang thép Dung Quất 2 giải ngân đúng tiến độ, chuẩn bị thử nghiệm lò cao số 1.",
    marketSentiment: "Xu hướng thị trường tăng điểm (Uptrend) vững chắc, cổ phiếu thép dẫn dắt sóng.",
    question: "Sau nến xanh dài số 1, có 3 nến đỏ nhỏ điều chỉnh nhưng hoàn toàn nằm gọn trong thân nến 1, sau đó nến số 5 bùng nổ vượt đỉnh. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TIẾP TỤC BỨT PHÁ (Xanh)", description: "Mô hình tăng 3 bước tiếp diễn xu hướng tăng mạnh mẽ." },
      { key: "bearish", label: "QUAY LẠI GIẢM (Đỏ)", description: "Gặp cản tâm lý số tròn 30." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tạm dừng quanh 30." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tiếp tục Bứt phá tăng tốc (Bullish).",
      why: "Rising Three Methods là mô hình tiếp diễn tăng trưởng kinh điển: 3 phiên rũ hàng vol cạn chỉ là nhịp nghỉ để thay máu nhà đầu tư ngắn hạn.",
      supplyDemand: "Phe bán không thể đẩy giá thủng đáy cây nến 1, chứng tỏ lực cung trôi nổi đã được hấp thụ sạch sẽ.",
      corporateImpact: "Đại dự án Dung Quất 2 là đòn bẩy nâng gấp đôi công suất thép cuộn cán nóng HRC.",
      lesson: "Khi cổ phiếu điều chỉnh với các nến thân nhỏ vol giảm dần trong thân một nến tăng lớn, đó là cơ hội gom thêm hàng.",
    },
  },
  {
    id: 27,
    title: "Bài 27: Volume Climax & Absorption (Hấp Thụ Cao Trào)",
    level: "advanced",
    pattern: "Volume Climax & Absorption",
    ticker: "SSI",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 32.0, h: 32.2, l: 30.0, c: 30.2, v: 22000000 },
      { o: 30.2, h: 30.4, l: 28.5, c: 28.6, v: 28000000 },
      { o: 28.6, h: 28.8, l: 26.5, c: 26.8, v: 38000000 },
      { o: 26.8, h: 27.0, l: 24.2, c: 24.4, v: 45000000 },
      { o: 24.0, h: 26.8, l: 23.5, c: 26.5, v: 92000000 }, // Vol kỷ lục 92 triệu cổ rút chân
    ],
    nextCandle: { o: 26.6, h: 28.5, l: 26.4, c: 28.2, v: 54000000 },
    corporateContext:
      "Ủy ban Chứng khoán Nhà nước đẩy mạnh triển khai hệ thống giao dịch mới KRX và gỡ vướng pre-funding nâng hạng thị trường.",
    marketSentiment: "Call margin chéo toàn thị trường kích hoạt lệnh bán giá sàn hàng loạt cổ phiếu.",
    question: "Cây nến số 5 xuất hiện khối lượng khớp lệnh lịch sử 92 triệu cổ phiếu, giá bị ép xuống sàn nhưng cuối phiên được mua vét sạch rút chân về xanh. Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG MẠNH MẼ (Xanh)", description: "Cá mập đã hoàn tất nuốt trọn toàn bộ lượng hàng giải chấp." },
      { key: "bearish", label: "SẬP SÀN TIẾP (Đỏ)", description: "Áp lực call margin vẫn còn tiếp diễn." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Cân bằng lại." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng mạnh mẽ mở sóng (Bullish).",
      why: "Volume Climax (Cao trào bán) đi kèm nến rút chân là dấu chân không thể chối cãi của Smart Money (Dòng tiền thông minh).",
      supplyDemand: "Nhà đầu tư cá nhân bị công ty chứng khoán bán giải chấp bắt buộc; bên mua tổ chức đã dùng lệnh đối ứng gom sạch.",
      corporateImpact: "Triển vọng nâng hạng thị trường chứng khoán Việt Nam đem lại dòng vốn hàng tỷ USD cho các CTCK đầu ngành.",
      lesson: "Khối lượng kỷ lục ở đáy nến rút chân là tín hiệu 'Vét máng' uy tín nhất của chu kỳ giảm giá.",
    },
  },
  {
    id: 28,
    title: "Bài 28: No Supply Bar (Nến Cạn Cung VSA) trước khi vượt đỉnh",
    level: "advanced",
    pattern: "No Supply Bar (VSA)",
    ticker: "FPT",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 130.0, h: 135.0, l: 129.5, c: 134.5, v: 4800000 },
      { o: 134.5, h: 136.0, l: 133.5, c: 135.2, v: 3200000 },
      { o: 135.2, h: 136.2, l: 134.0, c: 135.8, v: 2400000 },
      { o: 135.8, h: 136.0, l: 134.8, c: 135.4, v: 1100000 }, // No supply bar vol cực cạn
    ],
    nextCandle: { o: 135.5, h: 144.0, l: 135.2, c: 143.5, v: 7200000 },
    corporateContext:
      "FPT ký kết hợp tác chiến lược với tập đoàn bán dẫn NVIDIA để xây dựng nhà máy AI Factory tại Việt Nam.",
    marketSentiment: "Thị trường chung giao dịch trong trạng thái thanh khoản thấp thận trọng.",
    question: "Cây nến số 4 biên độ cực hẹp, nhúng xuống kiểm tra vùng 134.8 rồi rút lên, khối lượng giao dịch rơi về mức thấp nhất trong 3 tháng. Nến tiếp theo sẽ diễn biến ra sao?",
    options: [
      { key: "bullish", label: "BÙNG NỔ VƯỢT ĐỈNH (Xanh)", description: "Cạn cung hoàn toàn, dòng tiền sẽ kéo giá bay cao." },
      { key: "bearish", label: "GÃY NỀN GIÁ (Đỏ)", description: "Thanh khoản kiệt quệ báo hiệu sắp sập." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tiếp tục sideway ru ngủ." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Bùng nổ Tăng vọt (Bullish).",
      why: "No Supply Bar (nến thân hẹp, vol thấp hơn 2 phiên trước) là tín hiệu xác nhận phe bán đã kiệt quệ hoàn toàn.",
      supplyDemand: "Đội lái thả trôi cho thị trường tự bán nhưng không ai bán ra giá rẻ nữa. Đường lên phía trước hoàn toàn thông thoáng.",
      corporateImpact: "Tin tức AI Factory với NVIDIA là chất xúc tác vĩ mô nâng tầm vị thế công nghệ của Việt Nam.",
      lesson: "Trong phương pháp VSA, No Supply Bar xuất hiện tại nền giá tích lũy là điểm mua Pocket Pivot chuẩn mực.",
    },
  },
  {
    id: 29,
    title: "Bài 29: Upthrust After Distribution (Bẫy Tăng Giá UTAD)",
    level: "advanced",
    pattern: "Upthrust (UTAD - Wyckoff)",
    ticker: "MWG",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 62.0, h: 64.0, l: 61.8, c: 63.8, v: 8500000 },
      { o: 63.8, h: 64.5, l: 63.0, c: 64.2, v: 9200000 },
      { o: 64.2, h: 65.0, l: 63.5, c: 64.8, v: 10500000 },
      { o: 65.0, h: 68.5, l: 64.5, c: 65.2, v: 24000000 }, // UTAD bẫy vượt đỉnh vol to rụt đầu
    ],
    nextCandle: { o: 65.0, h: 65.2, l: 61.0, c: 61.2, v: 18500000 },
    corporateContext:
      "Truyền thông liên tục đưa tin chuỗi nhà thuốc An Khang và Bách Hóa Xanh mở mới rầm rộ, định giá P/E bị đẩy lên mức 28 lần.",
    marketSentiment: "F0 rủ nhau mua bất chấp vì tin tưởng MWG sẽ lên 80 trong tuần tới.",
    question: "Cây nến số 4 mở gap vượt đỉnh lên 68.5 với khối lượng cực khủng 24 triệu cổ nhưng cuối phiên bị dập về sát giá mở cửa (Upthrust). Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TIẾP ĐÀ LÊN 80 (Xanh)", description: "Hấp thụ xong lượng chốt lời sẽ phi tiếp." },
      { key: "bearish", label: "SẬP MẠNH PHÂN PHỐI (Đỏ)", description: "Bẫy tăng giá kinh điển, tạo lập đã xả xong hàng." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Giữ giá quanh 65." },
    ],
    correctOption: "bearish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Sập mạnh Giảm sâu (Bearish).",
      why: "Upthrust (UTAD trong Wyckoff) là đòn đánh lừa kinh điển: giả vờ breakout vượt đỉnh để kích hoạt lệnh mua của F0 rồi úp sọt xả hàng.",
      supplyDemand: "Khối lượng 24 triệu cổ phiếu chủ yếu là lệnh bán chủ động của các tay to sang tay cho nhà đầu tư nhỏ lẻ hưng phấn.",
      corporateImpact: "Tốc độ mở chuỗi nhà thuốc An Khang ngốn chi phí và chưa có lãi thực tế.",
      lesson: "Cảnh giác cao độ với các pha Breakout đỉnh kèm vol quá lớn nhưng thân nến đóng cửa lại rụt đầu (Upthrust).",
    },
  },
  {
    id: 30,
    title: "Bài 30: Spring Pattern (Cú Rũ Bỏ Thủng Đáy Wyckoff)",
    level: "advanced",
    pattern: "Spring (Wyckoff)",
    ticker: "VNM",
    timeframe: "Khung Ngày (1D)",
    candles: [
      { o: 66.5, h: 67.0, l: 65.8, c: 66.2, v: 3400000 },
      { o: 66.2, h: 66.5, l: 65.5, c: 65.8, v: 3800000 },
      { o: 65.8, h: 66.0, l: 65.5, c: 65.6, v: 4100000 }, // Nền hỗ trợ 65.5
      { o: 65.5, h: 65.8, l: 63.8, c: 65.7, v: 8200000 }, // Spring đục thủng hỗ trợ 65.5 rồi kéo ngược
    ],
    nextCandle: { o: 65.8, h: 68.2, l: 65.6, c: 68.0, v: 7500000 },
    corporateContext:
      "Vinamilk mở rộng thị trường xuất khẩu sang các nước Trung Đông và ký kết hợp đồng cung cấp sữa học đường quy mô lớn.",
    marketSentiment: "Nhiều hội nhóm phân tích kỹ thuật hô hào cắt lỗ vì VNM đã thủng đáy hỗ trợ 65.5.",
    question: "Cây nến số 4 cố tình đâm thủng ngưỡng hỗ trợ 65.5 về 63.8 để quét sạch lệnh stoploss của nhỏ lẻ rồi đóng phiên kéo ngược lại trên 65.5 (Spring). Nến tiếp theo sẽ ra sao?",
    options: [
      { key: "bullish", label: "TĂNG TỐC BẬT MẠNH (Xanh)", description: "Cú rũ bỏ Spring hoàn tất, giá sẽ phi thẳng lên." },
      { key: "bearish", label: "THỦNG ĐÁY TIẾP (Đỏ)", description: "Đã thủng hỗ trợ thì phải rơi tiếp." },
      { key: "neutral", label: "ĐI NGANG (Doji)", description: "Tiếp tục lình xình." },
    ],
    correctOption: "bullish",
    aiAnalysis: {
      verdict: "Chính xác! Nến tiếp theo Tăng tốc Bật mạnh (Bullish).",
      why: "Spring trong phương pháp Wyckoff là pha săn thanh khoản (Liquidity grab) nhằm quét sạch lệnh cắt lỗ của nhà đầu tư cá nhân.",
      supplyDemand: "Sau khi gom được lượng lớn cổ phiếu giá rẻ từ các lệnh cắt lỗ tự động, tạo lập nhẹ nhàng kéo giá tăng không còn cản trở.",
      corporateImpact: "Dòng tiền từ thị trường xuất khẩu mới giúp đảm bảo tăng trưởng lợi nhuận bền vững.",
      lesson: "Nếu giá thủng hỗ trợ nhưng nhanh chóng rút chân đóng cửa trở lại trong nền giá trong cùng một phiên, đó là cơ hội mua vàng.",
    },
  },
  // Các bài tiếp theo từ 31 đến 50
  ...Array.from({ length: 20 }, (_, index) => {
    const id = 31 + index;
    const tickers = ["HPG", "FPT", "SSI", "VCB", "MWG", "DGC", "MSN", "TCB", "PVD", "VHM"];
    const ticker = tickers[index % tickers.length];
    const isBull = index % 2 === 0;

    const basePrice = 40 + (index * 3);
    const mockCandles = [
      { o: basePrice, h: basePrice + 1.5, l: basePrice - 0.5, c: basePrice + 1.0, v: 15000000 + index * 500000 },
      { o: basePrice + 1.0, h: basePrice + 2.0, l: basePrice + 0.8, c: basePrice + 1.8, v: 16000000 + index * 500000 },
      { o: basePrice + 1.8, h: basePrice + 2.5, l: basePrice + 1.5, c: basePrice + 2.2, v: 18000000 + index * 500000 },
      {
        o: basePrice + 2.2,
        h: isBull ? basePrice + 4.5 : basePrice + 5.0,
        l: isBull ? basePrice + 1.0 : basePrice + 2.0,
        c: isBull ? basePrice + 4.2 : basePrice + 2.1,
        v: 28000000 + index * 1000000,
      },
    ];

    const mockNext = isBull
      ? { o: basePrice + 4.2, h: basePrice + 6.5, l: basePrice + 4.0, c: basePrice + 6.2, v: 32000000 }
      : { o: basePrice + 2.0, h: basePrice + 2.2, l: basePrice - 1.5, c: basePrice - 1.2, v: 29000000 };

    return {
      id,
      title: `Bài ${id}: Thử Thách VSA & Hành Động Giá Cổ Phiếu ${ticker} (Pha ${id})`,
      level: id <= 35 ? ("intermediate" as const) : ("advanced" as const),
      pattern: isBull ? "Bullish Absorption / Test Supply" : "Selling Pressure / False Breakout",
      ticker,
      timeframe: "Khung Ngày (1D)",
      candles: mockCandles,
      nextCandle: mockNext,
      corporateContext: `Doanh nghiệp ${ticker} vừa cập nhật ước tính kết quả kinh doanh quý với nhiều điểm đáng chú ý về doanh thu và cấu trúc tài sản. Khối ngoại giao dịch sôi động với giá trị khớp lệnh hàng trăm tỷ đồng.`,
      marketSentiment: `VN-Index dao động quanh đường trung bình động 20 phiên, dòng tiền phân hóa mạnh theo từng nhóm ngành.`,
      question: `Quan sát hành động giá và tương quan khối lượng của cây nến cuối cùng trên mã ${ticker}. Nến tiếp theo sẽ diễn biến như thế nào?`,
      options: [
        {
          key: "bullish" as const,
          label: "TĂNG GIÁ (Bullish)",
          description: "Lực cầu chiếm thế thượng phong, xu hướng tăng tiếp diễn.",
        },
        {
          key: "bearish" as const,
          label: "GIẢM GIÁ (Bearish)",
          description: "Lực cung áp đảo, giá sẽ đảo chiều giảm sâu.",
        },
        {
          key: "neutral" as const,
          label: "ĐI NGANG (Doji / Giằng co)",
          description: "Thị trường lưỡng lự chưa bứt phá được ngay.",
        },
      ],
      correctOption: isBull ? ("bullish" as const) : ("bearish" as const),
      aiAnalysis: {
        verdict: isBull
          ? `Chính xác! Nến tiếp theo là nến Tăng mạnh (Bullish).`
          : `Chính xác! Nến tiếp theo là nến Giảm điểm đảo chiều (Bearish).`,
        why: isBull
          ? `Hành động giá kiểm tra lực cung thành công kèm khối lượng gia tăng xác nhận phe mua làm chủ hoàn toàn.`
          : `Áp lực bán từ chối vùng giá cao với bóng nến trên dài và khối lượng tăng vọt phản ánh sự phân phối của phe bán.`,
        supplyDemand: isBull
          ? `Lực cầu chủ động quét sạch các lệnh bán treo cao trên sổ lệnh.`
          : `Phe mua cạn kiệt nguồn lực và bị phe bán dồn dập áp đảo về cuối phiên.`,
        corporateImpact: `Thông tin hoạt động cốt lõi của ${ticker} đóng vai trò mỏ neo định hướng kỳ vọng của các tổ chức tài chính.`,
        lesson: `Luôn đối chiếu hành động giá (Candlestick) với Khối lượng giao dịch (Volume) và Vị trí nến tại các ngưỡng hỗ trợ/kháng cự quan trọng.`,
      },
    };
  }),
];

