# Kế hoạch “Chứng khoán căn bản”

Trạng thái: **đã được duyệt; PR 1 đã triển khai trên `feature/stock-basic`, PR 2–4 chưa triển khai**

Nhánh chuẩn bị: `feature/stock-basic`

Ngày nghiên cứu: 13/10/2026

## 1. Kết quả người dùng cần đạt

Trang này thay thế mục `Dự báo AI` đang trống bằng một lộ trình cho người chưa biết gì về chứng
khoán. Sau lộ trình nền tảng, người học phải có thể:

1. phân biệt tiết kiệm, đầu tư và đầu cơ; biết đầu tư có thể mất vốn;
2. xác định mục tiêu, thời gian đầu tư và khả năng chịu rủi ro trước khi chọn mã;
3. đọc được bảng giá, màu giá, nến, khối lượng và trạng thái dữ liệu;
4. hiểu doanh nghiệp ở mức cơ bản qua doanh thu, lợi nhuận, EPS, P/E, P/B, ROE và dòng tiền;
5. biết phí, thuế, thanh khoản, đa dạng hóa và rủi ro tập trung ảnh hưởng kết quả ra sao;
6. kiểm tra nguồn tin, nhận diện lời mời “lợi nhuận cao/rủi ro thấp” và không mua chỉ vì FOMO;
7. lập một luận điểm đầu tư ngắn, thực hành bằng danh mục mô phỏng và tự đánh giá lại quyết định.

Đích đến không phải là khiến người dùng giao dịch thật sớm hơn. Đích đến là giúp họ **chưa đầu tư
khi chưa hiểu**, sau đó biết thực hành có quy trình và tự chịu trách nhiệm cho quyết định của mình.

## 2. Quyết định sản phẩm được đề xuất

- Đổi nhãn menu `Dự báo AI` thành **`Chứng khoán căn bản`**.
- Dùng route chính mới **`/learn`** để tên đường dẫn đúng với chức năng; `/predictions` chuyển hướng
  vĩnh viễn sang `/learn` để không làm hỏng bookmark cũ.
- Không đặt dự báo giá, “mã nên mua”, điểm mua/bán hoặc chatbot AI ở trang này trong MVP.
- Không yêu cầu đăng nhập để học. Đăng nhập chỉ cần khi chuyển sang danh mục mô phỏng hoặc khi sau này
  cần đồng bộ tiến độ nhiều thiết bị.
- Nội dung tiếng Việt, ví dụ theo thị trường Việt Nam; quy tắc phiên/lệnh/lô/bước giá phải có nguồn
  chính thức, ngày rà soát và phiên bản nội dung.
- MVP không thêm database, package hay dịch vụ mới. Bài học là dữ liệu TypeScript có schema; tiến độ
  cục bộ là tùy chọn và không chứa số tiền, danh mục hoặc câu trả lời tài chính nhạy cảm.

## 3. Trải nghiệm tổng thể

### 3.1 Trang đầu: “Bắt đầu từ đâu?”

Không mở bằng một danh sách 30 bài. Phần đầu chỉ hỏi ba câu không nhạy cảm:

- Bạn đã từng xem bảng giá chưa?
- Bạn muốn hiểu thị trường, đọc doanh nghiệp hay luyện một quyết định đầu tư?
- Bạn có 5, 15 hay 30 phút hôm nay?

Kết quả chỉ chọn điểm bắt đầu và thời lượng, không chấm “khẩu vị rủi ro” hay đưa lời khuyên cá nhân.
Ngay dưới đó là một CTA duy nhất: **Học bài 5 phút đầu tiên**. Người đã biết cơ bản có thể làm bài
kiểm tra nhanh để bỏ qua phần đã nắm.

### 3.2 Nhịp của mỗi bài học

Mỗi bài kéo dài 5–8 phút và luôn theo cùng một nhịp để giảm tải nhận thức:

1. **Tình huống:** một câu hỏi thật, ví dụ “Giá tăng 5% có nghĩa doanh nghiệp tốt hơn 5% không?”.
2. **Khái niệm:** tối đa ba ý chính, câu ngắn, có glossary ngay tại từ mới.
3. **Ví dụ đã làm mẫu:** chỉ rõ cách đọc một bảng giá/nến/chỉ số và vì sao từng bước đúng.
4. **Bạn quyết định:** chọn một trong 2–3 hành động trong tình huống, không dùng tiền thật.
5. **Nhớ lại:** 1–3 câu hỏi ngắn có giải thích vì sao đúng/sai, được thử lại không phạt điểm.
6. **Làm ngay trên InvestIQ:** mở đúng bộ lọc Thị trường, mã minh họa hoặc Danh mục mô phỏng.

Nghiên cứu retrieval practice cho thấy việc chủ động nhớ lại hỗ trợ lưu giữ dài hạn tốt hơn chỉ đọc
lại; vì vậy quiz dùng để học và nhận phản hồi, không phải để tạo áp lực thi cử.

### 3.3 Giữ hứng thú mà không gây nghiện

- Hiển thị bản đồ 7 chặng (đánh số 0–6), phần trăm hoàn thành và “bước nhỏ tiếp theo”.
- Mở khóa huy hiệu năng lực có nghĩa như `Đọc được một cây nến`, không dùng điểm XP vô nghĩa.
- Không leaderboard, không đếm streak mất đi nếu bỏ một ngày, không confetti sau hành động giao dịch.
- Xen kẽ đọc, kéo thanh mô phỏng, chọn tình huống, xem dữ liệu thật và paper trading.
- Mỗi bài có một “hiểu lầm phổ biến” và một ví dụ phản chứng.
- Người học được chọn thứ tự sau chặng nền tảng; hệ thống không khóa toàn bộ nội dung theo tuyến cứng.

## 4. Lộ trình kiến thức

### Chặng 0 — Trước khi mua cổ phiếu

- Tiết kiệm khác đầu tư thế nào; vốn đầu tư không được bảo đảm.
- Quỹ dự phòng, nợ lãi cao, mục tiêu và thời gian cần tiền.
- Khả năng chịu rủi ro gồm cả “sẵn sàng chịu” và “có khả năng chịu”.
- Thực hành: mô phỏng một mục tiêu và xem tác động của thời gian/lãi kép; không biến giả định lợi suất
  thành cam kết.

Điều kiện hoàn thành: người học giải thích được vì sao tiền cần dùng sớm không nên mặc định đưa hết
vào cổ phiếu.

### Chặng 1 — Thị trường Việt Nam vận hành ra sao

- Cổ phiếu và quyền sở hữu; HOSE, HNX, UPCoM ở mức cần dùng.
- Tài khoản chứng khoán, ký quỹ tiền/chứng khoán, lô chẵn/lô lẻ.
- Giá tham chiếu, trần, sàn; LO/ATO/ATC và ưu tiên khớp lệnh ở mức nhập môn.
- Phiên giao dịch, khớp lệnh khác đặt lệnh; trạng thái chờ/khớp một phần/hủy.
- Thanh toán và quy định giao dịch là nội dung có thể thay đổi, luôn dẫn nguồn hiện hành.

Thực hành: đọc một dòng trên bảng giá InvestIQ và chỉ ra đâu là dữ liệu quan sát, đâu là quy tắc sàn.

### Chặng 2 — Đọc giá, nến và khối lượng

- Giá mở/cao/thấp/đóng; thân, râu và màu nến.
- Nến ngày khác nến trong phiên; timezone, phiên nghỉ và dữ liệu trễ.
- Khối lượng, thanh khoản, biên độ; một nến không đủ để kết luận xu hướng.
- MA5/MA20 là chỉ báo dẫn xuất từ dữ liệu quá khứ, không phải dự báo chắc chắn.

Thực hành: dùng biểu đồ nến hiện có, hover/focus một nến, trả lời bốn giá OHLC và thời điểm của nó.

### Chặng 3 — Hiểu doanh nghiệp và định giá cơ bản

- Doanh nghiệp kiếm tiền thế nào; doanh thu, lợi nhuận, tài sản, nợ, dòng tiền.
- EPS, P/E, P/B, ROE: công thức, đơn vị, ý nghĩa và trường hợp chỉ số gây hiểu sai.
- Không so P/E khác ngành như cùng một thước đo; P/E âm hoặc thiếu không được biến thành 0.
- Tin doanh nghiệp, báo cáo tài chính và công bố thông tin quan trọng hơn lời đồn.

Thực hành: so sánh tối đa ba mã bằng màn hình hiện có và viết một nhận xét có điều kiện, không chọn
“mã thắng”.

### Chặng 4 — Rủi ro, danh mục, phí và thuế

- Rủi ro doanh nghiệp, ngành, thị trường, thanh khoản và hành vi.
- Phân bổ tài sản và đa dạng hóa; đa dạng hóa giảm rủi ro tập trung nhưng không bảo đảm không lỗ.
- Phí/thuế làm giảm lợi nhuận; tác động của giao dịch quá nhiều.
- Vị thế, tỷ trọng, mức lỗ tối đa chấp nhận được và lý do không dùng toàn bộ tiền cho một mã.

Thực hành: kéo tỷ trọng ba mã trong sandbox, quan sát cảnh báo tập trung và chi phí mô phỏng.

### Chặng 5 — Tin tức, nguồn và bẫy tâm lý

- Phân biệt sự kiện, ý kiến, phân tích sentiment và dự báo giá.
- Kiểm tra nguồn gốc, thời điểm, mã liên quan và công bố chính thức.
- FOMO, neo giá, xác nhận thiên kiến, “room phím hàng”, cam kết lợi nhuận và thúc ép chuyển tiền.
- Dữ liệu social sentiment có thể cũ, thiếu, sai hoặc bị thao túng.

Thực hành: phân loại ba thẻ tin thành “dữ kiện cần kiểm tra”, “ý kiến” và “dấu hiệu nguy hiểm”, rồi
mở bài gốc từ trang Tin tức.

### Chặng 6 — Quy trình quyết định đầu tiên

- Checklist năm câu: hiểu doanh nghiệp không, nguồn ở đâu, kỳ vọng nào đã phản ánh vào giá, rủi ro
  chính là gì, điều gì làm luận điểm sai.
- Viết luận điểm ngắn: lý do, bằng chứng, rủi ro, thời hạn xem lại và điều kiện thoát khỏi giả định.
- Tạo giao dịch mô phỏng, ghi lý do trước khi bấm xác nhận, xem lại sau một tuần/tháng.
- Kết thúc bằng một kế hoạch học tiếp, không bằng lời thúc giục mở tài khoản thật.

Điều kiện hoàn thành: hoàn thiện checklist và một giao dịch mô phỏng có lý do; lợi nhuận mô phỏng
không ảnh hưởng điểm học.

## 5. Bố cục UI/UX đề xuất

Trang dùng theme navy hiện có và các design token chung, không tạo một “ứng dụng con” khác phong cách.

```text
┌──────────────────────────────────────────────────────────────┐
│ Chứng khoán căn bản       0 → quyết định đầu tư có hiểu biết │
│ [Học tiếp: Nến là gì? · 5 phút]   [Xem lộ trình]             │
├──────────────────────────────────────────────────────────────┤
│ Tiến độ  2/7 chặng   ○──●──○──○──○──○──○                    │
├───────────────────────────────┬──────────────────────────────┤
│ Bài phù hợp hôm nay           │ Thực hành trên InvestIQ     │
│ tình huống + khái niệm        │ bảng giá / nến / paper      │
│ ví dụ + câu hỏi nhớ lại       │ trading + trạng thái nguồn  │
├───────────────────────────────┴──────────────────────────────┤
│ Hiểu lầm phổ biến · Thuật ngữ · Nguồn đã kiểm chứng          │
└──────────────────────────────────────────────────────────────┘
```

Trên mobile, CTA học tiếp đứng đầu; bản đồ chặng cuộn ngang có nhãn; phần thực hành nằm sau bài học.
Không dùng hover làm cách duy nhất để đọc giải thích. Mọi tương tác đạt vùng chạm tối thiểu 44px,
có focus rõ, hỗ trợ bàn phím, reduced motion và tương phản WCAG.

Các trạng thái bắt buộc: lần đầu, đang học, đã hoàn thành, nội dung không tải được, dữ liệu thị trường
không có/trễ, anonymous và authenticated. Dữ liệu thật không có thì bài học vẫn đọc được, nhưng phần
thực hành phải nói rõ “chưa có dữ liệu”, không thay bằng fixture giả như dữ liệu hiện tại.

## 6. Thiết kế nội dung và kỹ thuật

### 6.1 Mô hình nội dung

Mỗi lesson là dữ liệu có kiểu, không viết cả khóa học trực tiếp trong JSX:

```ts
type Lesson = {
  slug: string;
  module: string;
  title: string;
  estimatedMinutes: number;
  objectives: string[];
  blocks: LessonBlock[];
  quiz: QuizQuestion[];
  practiceAction?: PracticeAction;
  sourceIds: string[];
  contentVersion: string;
  reviewedAt: string;
};
```

`LessonBlock` chỉ cho phép các khối đã kiểm soát như giải thích, ví dụ đã làm, cảnh báo, glossary,
tình huống và dữ liệu thị trường. Không render HTML tùy ý. Mọi khẳng định về quy tắc giao dịch có
`sourceIds`, `reviewedAt` và người chịu trách nhiệm rà soát.

### 6.2 Ranh giới code được đề xuất khi triển khai

- `frontend/src/app/(user)/learn/page.tsx`: Server Component dựng trang và nội dung khởi đầu.
- `frontend/src/app/(user)/predictions/page.tsx`: redirect tương thích, không còn scaffold tiếng Anh.
- `frontend/src/components/learn/`: ranh giới client nhỏ cho quiz, progress và sandbox.
- `frontend/src/content/stock-basics.ts`: nội dung có schema và phiên bản.
- `frontend/src/types/learning.ts`: hợp đồng lesson/progress/source.
- Tái sử dụng formatter, trạng thái nguồn, biểu đồ nến, so sánh mã và link paper trading hiện có.

MVP không cần backend. Tiến độ ẩn danh có thể lưu bằng key versioned trong local storage; nội dung
vẫn hoạt động nếu storage bị chặn. Nếu sau review cần đồng bộ nhiều thiết bị, thiết kế API riêng ở
phase sau với user ownership và `no-store`, không nhét tiến độ vào contract market/news.

### 6.3 Quyền riêng tư và an toàn tài chính

- Không hỏi thu nhập, tuổi, tài sản, nợ, số điện thoại hoặc khẩu vị rủi ro chi tiết trong MVP.
- Không gửi câu trả lời quiz, mã đang xem, số tiền mô phỏng hay danh mục vào analytics.
- Event đo lường chỉ gồm lesson/module/version và trạng thái hoàn thành tổng quát.
- Luôn phân biệt nội dung giáo dục, dữ liệu quan sát, phân tích dẫn xuất và giao dịch mô phỏng.
- Mọi CTA tới paper trading nói rõ không kết nối broker và không dùng tiền thật.
- Không diễn đạt nội dung như tư vấn cá nhân; không hứa lợi nhuận; không dùng thành tích lời/lỗ làm
  điểm xếp hạng học tập.

## 7. Nguồn tham khảo và chính sách biên tập

### Nguồn chính cho thị trường Việt Nam

- [HOSE — Quy định cần biết khi giao dịch chứng khoán trên HOSE (02/2026)](https://staticfile.hsx.vn/Uploads/UploadDocuments/2453338/HTGD_Quy%20dinh%20can%20biet%20khi%20GDCK%20tren%20HOSE_T2.2026.pdf): phiên, loại lệnh, đơn vị giao dịch, bước giá và biên độ.
- [HNX — Giao dịch cổ phiếu](https://cbtd.hnx.vn/vi-vn/huong-dan/chi-tiet-thu-tuc-31-24.html): mở tài khoản, ký quỹ và nguyên tắc đặt lệnh.
- Nội dung pháp lý/quy tắc thị trường chỉ xuất bản sau khi đối chiếu thêm văn bản hiện hành từ
  UBCKNN, VNX, HNX, HOSE hoặc VSDC. Bài học phải chỉ rõ sàn áp dụng; không suy rộng quy tắc HOSE cho
  toàn bộ thị trường.

### Nền tảng năng lực nhà đầu tư

- [IOSCO — Core Competencies Framework on Financial Literacy for Investors](https://www.iosco.org/library/pubdocs/pdf/IOSCOPD639.pdf): khung kiến thức, thái độ và hành vi để ra quyết định có hiểu biết.
- [Investor.gov — Introduction to Investing](https://www.investor.gov/introduction-investing): tiết kiệm/đầu tư, lãi kép, thời gian, rủi ro và đa dạng hóa.
- [FINRA — Financial Tips for New Investors](https://syndication.finra.org/content/financial-tips-new-investors): quỹ dự phòng, nợ lãi cao, mục tiêu, risk tolerance, đa dạng hóa và phí.
- [Investor.gov — Understanding Fees](https://www.investor.gov/introduction-investing/getting-started/understanding-fees): tác động dài hạn của phí.
- [Investor.gov — Five Questions to Ask Before You Invest](https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest): nguồn, rủi ro/lợi ích và nguyên tắc không đầu tư vào thứ chưa hiểu.
- [Investor.gov — Red Flags of Investment Fraud](https://www.investor.gov/protect-your-investments/fraud/how-avoid-fraud/red-flags-investment-fraud-checklist): cam kết lợi nhuận, “không rủi ro”, thúc ép và lời chào mời đáng ngờ.
- [FINRA/SEC — Social Sentiment Investing Tools](https://www.finra.org/investors/insights/social-sentiment-investing-tools): dữ liệu social có thể sai, cũ, bị thao túng và kích thích quyết định cảm tính.

### Cơ sở tổ chức bài học

- [Karpicke & Roediger (Science, 2008) — The Critical Importance of Retrieval for Learning](https://doi.org/10.1126/science.1152408): dùng câu hỏi nhớ lại và phản hồi thay cho chỉ đọc lại.
- Investor.gov cung cấp quiz, calculator và hoạt động tình huống; plan học theo tinh thần “học rồi
  làm”, nhưng toàn bộ quy tắc/tình huống được Việt hóa và không sao chép nội dung có bản quyền.

Chính sách rà soát đề xuất: quy tắc thị trường mỗi tháng và ngay khi sàn/VSDC công bố thay đổi; kiến
thức nền mỗi quý; nguồn lỗi hoặc quá hạn làm block liên quan hiện “đang rà soát” thay vì tiếp tục khẳng
định. Không dùng bài SEO hoặc nội dung môi giới làm nguồn chuẩn cho luật/quy tắc.

## 8. Phạm vi triển khai theo lát cắt

### PR 1 — Nền tảng học thật, không còn trang trống — đã triển khai

- Đổi nhãn menu, tạo `/learn`, redirect `/predictions`.
- Hero, bản đồ chặng, glossary và hai bài hoàn chỉnh: “Tiết kiệm hay đầu tư?” và “Đọc một cây nến”.
- Quiz có phản hồi, progress cục bộ versioned, CTA sang biểu đồ thật.
- Component tests, responsive/a11y checks và kiểm thử navigation.

Đây là vertical slice nên triển khai đầu tiên sau khi plan được duyệt. Nó đủ để kiểm chứng nhịp học
trước khi viết hàng chục bài.

Hiện trạng triển khai 13/10/2026: `/learn` mở công khai với hai bài hoàn chỉnh, quiz có giải thích,
tiến độ localStorage versioned chỉ lưu slug bài đã hoàn thành, ví dụ nến VN-Index từ read model hiện
có cùng nguồn/thời điểm/freshness, và trạng thái thiếu dữ liệu không sinh số giả. Menu desktop/mobile
dùng nhãn mới; `/predictions` chuyển hướng vĩnh viễn. Các contract test bảo vệ nội dung, navigation,
redirect, tiến độ lỗi/bị chặn, quiz, dữ liệu fresh/stale/thiếu, breakpoint 390px và reduced motion.
Việc mở PR 2 vẫn phụ thuộc quan sát sử dụng theo mục 10, không tự động tiếp nối từ PR này.

### PR 2 — Thị trường và doanh nghiệp

- Hoàn thiện chặng 1–3.
- Ví dụ có nguồn cho HOSE/HNX/UPCoM; bài tương tác P/E/P/B và so sánh ba mã.
- Trạng thái dữ liệu trễ/thiếu và review metadata hiển thị được.

### PR 3 — Rủi ro và thực hành

- Hoàn thiện chặng 4–6.
- Sandbox tỷ trọng, bài nhận diện tin/bẫy, checklist luận điểm.
- Deep link vào paper trading kèm ngữ cảnh bài học, nhưng không tự đặt lệnh.

### PR 4 — Học liên tục (chỉ sau khi có bằng chứng sử dụng)

- Đồng bộ tiến độ nhiều thiết bị cho tài khoản đăng nhập.
- Nhắc ôn tự nguyện dựa trên câu sai; không notification/streak gây áp lực.
- Dashboard biên tập nội dung/version nếu khối lượng bài vượt khả năng quản lý bằng code review.

Không triển khai PR 2–4 cùng lúc. Sau PR 1 cần quan sát người dùng có bắt đầu bài, hoàn thành và chuyển
được sang thao tác thực tế hay không rồi mới mở rộng.

## 9. Tiêu chí nghiệm thu cho PR 1

- Menu desktop/mobile hiển thị `Chứng khoán căn bản`; không còn chữ `Dự báo AI` hoặc scaffold tiếng Anh.
- `/learn` có nội dung hữu ích khi chưa đăng nhập; `/predictions` không 404 và chuyển đúng route.
- Người dùng hoàn thành được hai bài bằng bàn phím và screen reader; trạng thái focus/đúng/sai không
  phụ thuộc duy nhất vào màu.
- Reload không mất tiến độ nếu storage hoạt động; storage hỏng/bị chặn không làm trang lỗi.
- Quiz giải thích đáp án và cho thử lại; không dùng lời/lỗ hoặc tốc độ để xếp hạng.
- Ví dụ nến hiển thị nguồn, market time, timezone và freshness; thiếu dữ liệu không tạo số giả.
- Nội dung về HOSE/HNX có link nguồn, content version và ngày rà soát.
- Mobile 390px không tràn ngang ngoài vùng lộ trình chủ đích; touch target tối thiểu 44px.
- ESLint, TypeScript và toàn bộ frontend tests đạt; có test riêng cho navigation, lesson schema,
  progress migration, quiz, redirect, empty/stale data và reduced-motion behavior.
- Không có migration, dependency, public API hay dữ liệu cá nhân mới trong lát cắt đầu.

## 10. Chỉ số để biết tính năng có thực sự giúp người mới

Chỉ đo tổng hợp, không thu danh mục hay câu trả lời tài chính:

- tỷ lệ bấm “Học bài đầu tiên” từ trang vào;
- tỷ lệ hoàn thành bài 1, bài 2 và quay lại trong 7 ngày;
- tỷ lệ trả lời đúng khi thử lại (đo học được, không chỉ click hết bài);
- tỷ lệ mở đúng thao tác thực hành ở Market/News/Paper Portfolio;
- câu hỏi một lần sau bài: “Bạn có tự giải thích lại được không?”;
- số lần báo nội dung khó hiểu hoặc nguồn lỗi/thời hạn review quá hạn.

Không tối ưu theo số lệnh mô phỏng hay thời gian màn hình. Một người hiểu ra rằng mình **chưa nên
đầu tư** vẫn là kết quả thành công.

## 11. Nội dung đã được duyệt cho PR 1

Phạm vi người dùng đã duyệt và được dùng để triển khai PR 1:

1. dùng tên `Chứng khoán căn bản` và route chính `/learn`;
2. giữ `/predictions` bằng redirect;
3. mở không cần đăng nhập, lưu tiến độ cục bộ ở MVP;
4. bắt đầu bằng đúng hai bài “Tiết kiệm hay đầu tư?” và “Đọc một cây nến”;
5. không đưa AI dự báo hoặc khuyến nghị mã vào khu vực học;
6. chỉ làm PR 1 trong lần triển khai này; PR 2–4 tiếp tục giữ ở trạng thái kế hoạch.
