import type { LearningSource, StockBasicsLesson } from "@/types/learning";

export const learningSources: Record<string, LearningSource> = {
  investorIntroduction: {
    id: "investor-introduction",
    title: "Giới thiệu về đầu tư",
    publisher: "Investor.gov",
    url: "https://www.investor.gov/introduction-investing",
  },
  finraNewInvestors: {
    id: "finra-new-investors",
    title: "Lưu ý tài chính dành cho nhà đầu tư mới",
    publisher: "FINRA",
    url: "https://syndication.finra.org/content/financial-tips-new-investors",
  },
  hoseTradingRules: {
    id: "hose-trading-rules-2026",
    title: "Quy định cần biết khi giao dịch chứng khoán trên HOSE",
    publisher: "HOSE",
    url: "https://staticfile.hsx.vn/Uploads/UploadDocuments/2453338/HTGD_Quy%20dinh%20can%20biet%20khi%20GDCK%20tren%20HOSE_T2.2026.pdf",
  },
};

export const stockBasicsLessons: StockBasicsLesson[] = [
  {
    slug: "saving-or-investing",
    stage: 0,
    title: "Tiết kiệm hay đầu tư?",
    eyebrow: "BÀI 1 · NỀN TẢNG",
    estimatedMinutes: 5,
    objective: "Phân biệt tiền cần an toàn trong ngắn hạn với vốn có thể chấp nhận biến động.",
    scenario: "Bạn có một khoản tiền sẽ cần để đóng học phí sau ba tháng. Có nên mua cổ phiếu vì thị trường đang tăng không?",
    concepts: [
      {
        title: "Tiết kiệm ưu tiên khả năng sử dụng",
        body: "Tiền cho chi tiêu gần, quỹ dự phòng hoặc nghĩa vụ đã biết cần được giữ ở nơi phù hợp với thời hạn và khả năng rút tiền.",
      },
      {
        title: "Đầu tư chấp nhận biến động",
        body: "Giá chứng khoán có thể giảm đúng lúc bạn cần tiền. Lợi nhuận không cố định và vốn ban đầu có thể bị mất một phần hoặc toàn bộ.",
      },
      {
        title: "Mục tiêu đi trước mã cổ phiếu",
        body: "Trước khi chọn sản phẩm, hãy xác định mục tiêu, thời gian cần tiền và mức thiệt hại mà tình hình tài chính thực tế có thể chịu được.",
      },
    ],
    workedExample: {
      title: "Ví dụ đã làm: khoản học phí sau ba tháng",
      steps: [
        "Thời hạn rất ngắn nên không có nhiều thời gian chờ thị trường hồi phục nếu giá giảm.",
        "Khoản tiền có mục đích bắt buộc, vì vậy khả năng sử dụng đúng hạn quan trọng hơn kỳ vọng sinh lời.",
        "Kết luận: không mặc định dùng khoản tiền này để mua cổ phiếu; chỉ cân nhắc đầu tư bằng phần vốn không ảnh hưởng mục tiêu gần.",
      ],
    },
    misconception: "“Giá đã tăng nhiều ngày nên ngày mai sẽ tiếp tục tăng” không phải là một cam kết lợi nhuận. Diễn biến vừa xảy ra không xóa rủi ro của khoản đầu tư.",
    glossary: [
      { term: "Thời gian đầu tư", definition: "Khoảng thời gian dự kiến trước khi bạn cần sử dụng số tiền." },
      { term: "Khả năng chịu rủi ro", definition: "Mức tổn thất bạn vừa sẵn sàng chấp nhận vừa thực tế có thể chịu mà không phá vỡ mục tiêu tài chính." },
      { term: "Quỹ dự phòng", definition: "Khoản tiền dành cho chi phí bất ngờ, cần ưu tiên khả năng tiếp cận và an toàn phù hợp." },
    ],
    quiz: [
      {
        id: "near-term-money",
        prompt: "Khoản tiền chắc chắn cần dùng sau ba tháng nên được đánh giá đầu tiên theo yếu tố nào?",
        options: [
          { id: "hot-stock", label: "Mã nào đang tăng mạnh nhất", correct: false, feedback: "Đà tăng gần đây không làm mất rủi ro phải bán đúng lúc giá giảm." },
          { id: "liquidity", label: "Thời hạn và khả năng cần rút tiền", correct: true, feedback: "Đúng. Mục tiêu và thời điểm cần tiền phải được xác định trước khi chọn sản phẩm." },
          { id: "friends", label: "Bạn bè đang mua mã nào", correct: false, feedback: "Quyết định của người khác không thay thế hoàn cảnh và mục tiêu của bạn." },
        ],
      },
      {
        id: "guaranteed-return",
        prompt: "Phát biểu nào đúng về đầu tư cổ phiếu?",
        options: [
          { id: "guaranteed", label: "Có thể bảo đảm lợi nhuận nếu giữ đủ lâu", correct: false, feedback: "Không có thời hạn nào biến lợi nhuận cổ phiếu thành chắc chắn." },
          { id: "risk", label: "Có khả năng sinh lời nhưng luôn đi kèm rủi ro mất vốn", correct: true, feedback: "Đúng. Kỳ vọng lợi nhuận và khả năng chịu thua lỗ phải được xem cùng nhau." },
        ],
      },
    ],
    practice: {
      href: "/portfolio",
      label: "Xem danh mục mô phỏng",
      description: "Quan sát cách InvestIQ tách tiền mô phỏng, vị thế và lãi/lỗ mà không sử dụng tiền thật.",
    },
    sourceIds: ["investor-introduction", "finra-new-investors"],
    contentVersion: "1.0.0",
    reviewedAt: "2026-10-13",
  },
  {
    slug: "read-a-candle",
    stage: 2,
    title: "Đọc một cây nến",
    eyebrow: "BÀI 2 · DỮ LIỆU GIÁ",
    estimatedMinutes: 8,
    objective: "Đọc đúng bốn giá OHLC, khối lượng và giới hạn của thông tin trong một cây nến.",
    scenario: "Một cây nến xanh có đủ để kết luận cổ phiếu tốt và nên mua ngay không?",
    concepts: [
      {
        title: "Thân nến kể chuyện mở–đóng",
        body: "Open là giá mở, close là giá đóng của khoảng thời gian. Close cao hơn open tạo nến tăng; điều đó không tự động có nghĩa giá cao hơn phiên trước.",
      },
      {
        title: "Râu nến giữ biên độ",
        body: "High và low là mức cao nhất và thấp nhất đã quan sát trong khoảng thời gian. Chúng cho biết biên độ, không giải thích nguyên nhân biến động.",
      },
      {
        title: "Luôn đọc thời gian và nguồn",
        body: "Nến ngày và nến trong phiên mang ý nghĩa khác nhau. Dữ liệu trễ, phiên nghỉ hoặc nến chưa kết thúc phải được nhận diện trước khi diễn giải.",
      },
    ],
    workedExample: {
      title: "Ví dụ đã làm: đọc theo thứ tự, không đoán xu hướng",
      steps: [
        "Xác nhận mã, khoảng thời gian, múi giờ và trạng thái nguồn.",
        "Đọc open và close để biết hướng trong chính khoảng nến; đọc high và low để biết biên độ.",
        "Đọc khối lượng rồi so với nhiều nến trước. Không biến một cây nến thành dự báo cho phiên kế tiếp.",
      ],
    },
    misconception: "Nến xanh chỉ nói close cao hơn open trong chính khoảng nến. Nó không chứng minh doanh nghiệp tốt hơn, không bảo đảm phiên sau tăng và không thay thế việc xem giá tham chiếu.",
    glossary: [
      { term: "OHLC", definition: "Open, High, Low, Close — giá mở, cao nhất, thấp nhất và đóng của một khoảng thời gian." },
      { term: "Khối lượng", definition: "Số lượng chứng khoán được ghi nhận giao dịch trong khoảng dữ liệu." },
      { term: "Nến chưa hoàn tất", definition: "Nến của khoảng thời gian vẫn đang diễn ra; giá close hiện tại còn có thể thay đổi." },
    ],
    quiz: [
      {
        id: "green-candle",
        prompt: "Một nến ngày xanh cho biết chắc chắn điều gì?",
        options: [
          { id: "next-up", label: "Phiên sau sẽ tăng", correct: false, feedback: "Một nến không dự báo chắc chắn phiên tiếp theo." },
          { id: "close-over-open", label: "Giá đóng cao hơn giá mở trong ngày đó", correct: true, feedback: "Đúng. Đây là kết luận trực tiếp duy nhất về hướng của thân nến." },
          { id: "good-company", label: "Doanh nghiệp đang kinh doanh tốt", correct: false, feedback: "Giá trong một phiên không thay thế dữ liệu hoạt động của doanh nghiệp." },
        ],
      },
      {
        id: "wick",
        prompt: "High và low của nến dùng để đọc điều gì?",
        options: [
          { id: "range", label: "Biên độ giá đã quan sát trong khoảng nến", correct: true, feedback: "Đúng. High và low xác định hai đầu biên độ quan sát." },
          { id: "fair-value", label: "Giá trị hợp lý của doanh nghiệp", correct: false, feedback: "High và low là dữ liệu giao dịch, không phải mô hình định giá doanh nghiệp." },
        ],
      },
    ],
    practice: {
      href: "/market/indices?symbol=VNINDEX",
      label: "Mở biểu đồ VN-Index",
      description: "Dùng hover hoặc bàn phím trên biểu đồ chi tiết để tự đọc OHLC, khối lượng và thời gian.",
    },
    sourceIds: ["hose-trading-rules-2026"],
    contentVersion: "1.0.0",
    reviewedAt: "2026-10-13",
  },
];

export function sourcesForLesson(lesson: StockBasicsLesson): LearningSource[] {
  const byId = Object.values(learningSources).reduce<Record<string, LearningSource>>((result, source) => {
    result[source.id] = source;
    return result;
  }, {});
  return lesson.sourceIds.map((id) => byId[id]).filter((source): source is LearningSource => Boolean(source));
}
