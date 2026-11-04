# Current Task

## AI Chatbox 5-Item Urgent Polish: Deduplicate Sources, Synchronize Ratio Highlights, Remove Horizontal Scroll, Daily Market Snapshot & Compact Drawer Widget UI - 2026-11-04 (completed)
- **User Request**:
  1. **Ảnh 1 — Xóa hiển thị trùng 2 lần nguồn tham khảo**: Hiện tại vừa hiển thị đoạn bullet `Nguồn tham khảo:` trong thân tin nhắn vừa hiển thị khối `NGUỒN THAM KHẢO ĐÃ KIỂM CHUẨN:` bên dưới, đồng thời bị lặp 5 lần cùng 1 link `Nguồn công bố: CafeF Data`.
  2. **Ảnh 2 — Đồng bộ highlight cho mọi tỷ lệ & làm sạch chuỗi tỷ lệ**: Trong lịch cổ tức MBB, tỷ lệ `10%` và `1,000 đ` có highlight nhưng `10:1`, `100:15`, `100:32`, `100:3` lại không có highlight; dòng cuối bị lặp chữ `Tỷ lệ: Cổ tức bằng Tiền, tỷ lệ 100:3`.
  3. **Ảnh 3 — Bỏ thanh scroll ngang khi ở tab nhỏ (`AiChatDrawer`)**: Xóa hoàn toàn thanh cuộn ngang màu xám ở đáy khung chat nhỏ.
  4. **Ảnh 4 — Cho model AI học dữ liệu thị trường mỗi ngày**: Khi hỏi `"hôm nay cổ phiếu nào được biến động nhiều nhất"`, AI phải tổng hợp dữ liệu thị trường thực tế trong ngày (Top biến động mạnh nhất, Top tăng/giảm giá, Top thanh khoản, Khối ngoại, Nhóm ngành, VN-Index thực tế `1.733,02 (+1,97%)`) thay vì trả lời nhầm sang bài học lý thuyết.
  5. **Ảnh 5 — Thiết kế lại UI của Widget trong tab nhỏ**: Sửa lỗi `StockScoreCardWidget` bị chồng chéo chữ (`10.0x2.3x 22.6%`), rớt chữ `đ`, gãy dòng `ĐÁNH GIÁ` / `TÍCH CỰC` và tràn biểu đồ Radar trong tab nhỏ `AiChatDrawer`.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Bổ sung hàm `_clean_dividend_ratio(raw_ratio, div_type, cash_val)` chuẩn hóa các chuỗi như `"Cổ tức bằng Tiền, tỷ lệ 100:3"` thành tỷ lệ gọn `"100:3"` và tự động suy luận mệnh giá tiền mặt `300 đ/cp`.
    - Bổ sung phương thức `_get_daily_market_snapshot()` tổng hợp trực tiếp dữ liệu toàn thị trường trong ngày từ `MarketService` (`vnindex`, `vn30`, `hnx`, `breadth`, `top_movers`, `top_gainers`, `top_losers`, `top_liquidity`, `top_foreign_buy`, `top_foreign_sell`, `top_sectors`).
    - Sửa lỗi đọc `self._market.overview().get("data", {})` để lấy đúng điểm số VN-Index thực tế thay vì fallback mặc định `1250.0`.
    - Mở rộng nhận diện `is_market_general` và phân nhánh trả lời chi tiết cho các câu hỏi về cổ phiếu biến động nhiều nhất, tăng mạnh nhất, giảm mạnh nhất, thanh khoản cao nhất, khối ngoại mua/bán ròng, nhóm ngành dẫn dắt và nhịp đập thị trường.
    - Khử trùng lặp danh sách `sources` theo `url` trước khi tạo trích dẫn và trả về.
    - Nâng `_CACHE_KEY_PREFIX` lên `"ai:chat:v2"` để vô hiệu hóa các bản ghi cache cũ bị lỗi.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Trong `HighlightedText`: mở rộng regex nhận diện cả tỷ lệ dạng `X:Y` (`10:1`, `100:15`, `100:32`, `100:3`) và highlight đồng bộ bằng badge màu `emerald` giống hệt tỷ lệ `%`; mở rộng regex tiền tệ bọc trọn `1,000 đ/cp`, `tỷ đ`, `nghìn tỷ`.
    - Trong `FormattedContent`: tự động ẩn khối text `Nguồn tham khảo:` ở cuối nội dung khi đã có danh sách `sources` hiển thị dạng pill bấm được ở dưới; chuẩn hóa cụm `"Tỷ lệ: Cổ tức bằng Tiền, tỷ lệ"` thành `"Tỷ lệ: "`.
    - Trong `AiChatBubble`: deduplicate `message.sources` theo `url` và thêm `min-w-0 max-w-full overflow-hidden break-words` chống tràn ngang.
  - `frontend/src/components/ai-chat/ai-chat-drawer.tsx` & `frontend/src/components/ai-chat/ai-assistant-workspace.tsx`:
    - Thêm `overflow-x-hidden` vào vùng cuộn tin nhắn để loại bỏ hoàn toàn thanh scroll ngang.
  - `frontend/src/components/ai-chat/widgets/stock-score-card-widget.tsx` (& các widget liên quan):
    - Thiết kế lại bố cục phân tầng dọc gọn đẹp cho cả tab nhỏ lẫn trang lớn: Header chống gãy dòng (`whitespace-nowrap` cho `Đánh giá` và `TÍCH CỰC`), hàng 3 ô `P/E` / `P/B` / `ROE` (`grid-cols-3 gap-2`), hàng 2 ô `Hỗ trợ quan trọng` / `Kháng cự gần` (`grid-cols-2 gap-2`), biểu đồ SVG Radar `viewBox="0 0 240 192"` không cắt chữ kèm 5 pill điểm số nhân tố.
- **Verification**:
  - Backend Tests: 32/32 AI chat unit & API integration tests passed.
  - Frontend Tests: 8/8 AI chat component, drawer E2E & route handler tests passed.
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 steps passed.

## Dividend Intent Specialization, Vietnamese Typo Normalization, Uvicorn Hot Reload & Comprehensive API/E2E Testing - 2026-11-04 (completed)
- **User Request**:
  1. Người dùng phàn nàn: *"đùa à, sao vẫn y như cũ thế, nó k phân tích yêu cầu à sao response y chang nhau vậy"* kèm ảnh minh họa câu hỏi `cho tao tin tức chứng khoánhôm nay` bị trả về mã `TIN` và `cho tao lịch chia cổ tức của mbb` bị trả về báo cáo kỹ thuật rập khuôn (Thị giá, Định giá, RSI, MA20).
  2. Bổ sung intent `dividend` (Lịch chia cổ tức): phân tích đúng câu hỏi cổ tức của mã cụ thể (ví dụ MBB) hoặc cổ tức sắp tới của toàn thị trường, trả về bảng ngày GDKHQ, hình thức tiền mặt/cổ phiếu, tỷ lệ, số tiền và link nguồn trích dẫn `/market/stocks/{symbol}#dividends`, tuyệt đối không trả về báo cáo phân tích kỹ thuật RSI/MA20 rập khuôn.
  3. Bổ sung text normalization giải quyết các lỗi gõ phím dính chữ tiếng Việt (`khoánhôm` -> `khoán hôm`, `tintức` -> `tin tức`, `cổtức` -> `cổ tức`...).
  4. Loại bỏ triệt để các hàng lỗi chỉ có dấu chấm `.` hoặc `• -` rác trên UI.
  5. Restart backend daemon process `uvicorn` với cờ `--reload` để nạp mã nguồn mới nhất vào server đang phục vụ browser client.
  6. Bổ sung API Integration Tests và E2E Tests theo yêu cầu của người dùng (`nhớ test api và test e2e`).
  7. Commit và push DUY NHẤT trên nhánh `fix/AI`, **tuyệt đối không merge vào `dev` hay `main`**.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Bổ sung hàm `normalize_user_input(text)` tự động tách các cặp từ dính chữ phổ biến: `khoánhôm` -> `khoán hôm`, `tintức` -> `tin tức`, `cổtức` -> `cổ tức`, `hômnay` -> `hôm nay`, `chứngkhoán` -> `chứng khoán`...
    - Thêm intent `dividend` vào `AiIntent` với TTL cache 3600s.
    - Nhận diện `is_dividend` ưu tiên hàng đầu với các từ khóa tài chính: `co tuc`, `chia co tuc`, `lich co tuc`, `lich chia co tuc`, `tra co tuc`, `chot quyen`, `gdkhq`, `ty le chia`...
    - Tích hợp `get_dividend_crawler()`: trích xuất các sự kiện cổ tức thực tế theo mã (`crawler.get_symbol_dividends(symbol)`) hoặc toàn thị trường (`crawler.get_upcoming_dividends()`).
    - Xây dựng cấu trúc phản hồi `Lịch chia cổ tức: {symbol} - {name}` chi tiết từng đợt (Ngày GDKHQ, Hình thức Tiền mặt/Cổ phiếu, Tỷ lệ, Số tiền đ/cp, Nguồn tin công bố) và đính kèm link trích dẫn `/market/stocks/{symbol}#dividends`.
    - Tách biệt độc lập các dòng text bullet trong `_generate_structured_response`, loại bỏ hoàn toàn các ký tự `\n` gộp gây sinh dòng lẻ.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Thêm nhận diện các heading mới: `Lịch chia cổ tức:`, `Lịch chia cổ tức các doanh nghiệp sắp tới:`, `Điểm tin chứng khoán`.
    - Nâng cấp bộ lọc dòng rỗng / marker rỗng với regex `/^[\s.\-•*–—]+$/`, triệt tiêu dứt điểm hiện tượng render các dòng chỉ có dấu chấm `.` hoặc `• -`.
  - `frontend/src/components/ai-chat/ai-chat-drawer.tsx` & `frontend/src/test/setup.ts`:
    - Thêm guard `messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" })` an toàn trong môi trường DOM test.
    - Tạo stub `frontend/src/test/server-only-stub.ts` và cấu hình alias `vitest.config.mts` giải quyết import `server-only` cho Route Handler tests.
  - **Tests**:
    - `backend/tests/unit/ai_chat/test_ai_chat.py`: Thêm unit test `test_normalize_user_input`, `test_ai_news_with_concatenated_typo`, `test_ai_dividend_intent_with_symbol`, `test_ai_dividend_intent_market_upcoming` (22/22 passed).
    - `backend/tests/integration/api/test_ai_chat_api.py`: Thêm API integration test `test_ai_chat_endpoint_dividend_intent` và `test_ai_chat_endpoint_news_with_concatenated_typo` (6/6 passed).
    - `frontend/src/app/ai-api/[[...path]]/route.test.ts`: Thêm API BFF Route Handler integration test (2/2 passed).
    - `frontend/src/components/ai-chat/ai-chat-drawer.test.tsx`: Thêm E2E Component user interaction test (mở drawer, nhập prompt cổ tức/tin tức, render phản hồi và sources) (2/2 passed).
    - `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`: Thêm unit test kiểm tra heading cổ tức và chặn dấu chấm / gạch ngang rỗng (3/3 passed).
  - Quản lý tiến trình:
    - Hủy bỏ daemon uvicorn cũ và khởi động lại uvicorn với `--reload` trên cổng 8000.
    - Kiểm thử live qua HTTP POST thực tế trên cổng 8000 trả về chuẩn 100% cả câu hỏi cổ tức MBB, tin tức và phân tích kỹ thuật HPG.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100% (6/6 steps).
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Tests (Vitest): 184/184 passed 100% (48 test files).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Tests (Pytest): 159/159 passed 100%.

## AI Assistant Security Guardrails, News Intent Resolution, User Bubble Polish & Observability - 2026-11-04 (completed)
- **User Request**:
  1. Chuyển nhánh `fix/AI`.
  2. Không cho AI trả lời các yêu cầu về data mật trong hệ thống (tokens, secrets, credentials, db connection strings, passwords, private user emails/balances).
  3. Không nhận các yêu cầu sửa đổi hệ thống (drop table, delete from, restart server, sửa code, cấp quyền admin) hay prompt injection.
  4. Áp dụng cache cho AI để phản hồi nhanh cho những câu đã có user khác hỏi (shared question cache).
  5. Ưu tiên học thuộc dữ liệu nội bộ không mật của hệ thống để response tốt hơn (RAG: published learning topics và stock glossary).
  6. Nếu crawl bên ngoài thì BẮT BUỘC ghi nguồn trong response (kèm link URL).
  7. Thêm giám sát và eval cho từng bước AI làm (per-step tracing, online rule-based evaluation, metrics endpoint).
  8. Pull toàn bộ code từ nhánh `fix/UI` về `fix/AI` (bao gồm bỏ bảng preview portfolio khi chưa đăng nhập, fix lệch giá community, pagination cổ tức...).
  9. Chỉnh sửa bong bóng tin nhắn user trong AI chat: màu gradient đẹp mắt, thời gian gửi rõ ràng, chiều cao gọn gàng.
  10. Sửa triệt để lỗi phân tích yêu cầu sai: khi user gõ "cho tao tin tức hôm nay", AI không được nhận chữ "TIN" thành mã cổ phiếu TIN để phân tích cổ phiếu; nhận diện đúng intent tin tức (`news`), trả về "Điểm tin thị trường hôm nay:" kèm nguồn trích dẫn rõ ràng; loại bỏ hoàn toàn các hàng lỗi chỉ có dấu `• -` rỗng.
  11. Commit và push DUY NHẤT trên nhánh `fix/AI`, tuyệt đối không merge vào `dev` hay `main`.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Mở rộng danh sách stop words tiếng Việt `_NON_TICKER_WORDS` gồm các từ giao tiếp hàng ngày: `TIN`, `HOM`, `TAO`, `DAY`, `TOP`, `MUC`, `GOI`, `MOI`, `DAT`, `LEN`, `XEP`, `LOI`, `MAT`, `TIM`, `CAU`, `CHON`, `MO`...
    - Thêm cơ chế tiền tố tường minh `_EXPLICIT_TICKER_PATTERN`: các từ trùng với stop word tiếng Việt (như `TIN`, `HOM`) chỉ được nhận diện là ticker khi có từ chỉ định tài chính (`mã TIN`, `cổ phiếu TIN`, `cp TIN`, `phân tích TIN`, `(TIN)`).
    - Bổ sung intent `news` trong `AiIntent` với TTL cache 120s.
    - Nhận diện `is_news` khi câu hỏi chứa từ khóa tin tức ("tin tức", "tin mới", "bản tin", "điểm tin", "cho tao tin tức hôm nay"...).
    - Tích hợp `INewsRepository` lấy tin tức thực tế từ hệ thống InvestIQ (`SqlNewsRepository`) hoặc fallback DuckDuckGo.
    - Tạo cấu trúc phản hồi "Điểm tin thị trường hôm nay:" chuyên nghiệp, liệt kê các tiêu đề tin, tóm tắt và trích dẫn nguồn cụ thể.
  - `backend/app/api/v1/ai_chat.py`:
    - Tích hợp `SqlNewsRepository` với cơ chế non-blocking pool `_pool is not None` giúp test runtime không bị timeout.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Cập nhật bong bóng tin nhắn user: nền gradient `bg-gradient-to-r from-sky-600 via-sky-600 to-cyan-600`, chiều cao padding gọn gàng `px-3.5 py-1.5 sm:py-2`, thời gian gửi `text-sky-100 font-semibold text-[10px]` sáng rõ rệt.
    - Loại bỏ các regex replace gây sinh dòng lẻ `-`, bổ sung bộ lọc triệt tiêu hoàn toàn các dòng rỗng hoặc chỉ có dấu bullet `• -`.
  - `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`:
    - Thêm 2 unit tests kiểm tra giao diện user bubble, tiêu đề điểm tin thị trường và bộ lọc chặn dòng bullet rỗng.
  - `backend/tests/unit/ai_chat/test_ai_chat.py`:
    - Thêm unit tests: `test_ai_news_intent_not_ticker_tin`, `test_ai_news_with_news_repository`, và kiểm tra ticker extraction stop words.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 179/179 passed 100% (46 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (43 source files).
  - Backend Unit Tests (Pytest): 155/155 passed 100%.
  - Backend Integration Tests (`test_ai_chat_api.py`): 4/4 passed 100%.

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (completed)
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups` (merged to `dev` and `main`, commit `9c9e8d6`).

## Dividend Calendar Pagination, Nearest-Date Sorting & Official Source Link - 2026-11-04 (completed)
- **User Request**:
  1. Thêm phân trang cho lịch chia cổ tức trong trang chủ (`/`), xếp theo gần thời điểm hiện tại nhất.
  2. Khi click vào lịch thì có thể link tới nguồn thông tin đó.
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`).
- **Branch**: `fix/UI` (committed `aa6eb53` and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `backend/app/schemas/market.py` & `backend/app/infrastructure/external/crawlers/dividend_crawler.py`:
    - Bổ sung trường `source_url: str | None = None` vào schema `DividendItem`.
    - Gán URL nguồn công bố thông tin chính thức tương ứng cho các sự kiện cổ tức (CafeF / Vietstock / Sở giao dịch).
  - `frontend/src/types/market.ts`:
    - Cập nhật kiểu `DividendItem` với `source_url?: string | null;`.
  - `frontend/src/app/(user)/page.tsx`:
    - Tăng số lượng sự kiện fetch `getMarketDividendCalendar(40)` để hỗ trợ dữ liệu phong phú hơn cho phân trang.
  - `frontend/src/components/market/dividend-calendar-widget.tsx`:
    - Tích hợp component `Pagination` đồng bộ với hệ thống (`pageSize = 6`, 2 hàng x 3 cột cân xứng hoàn hảo).
    - Thêm thuật toán sắp xếp `sortedEvents` theo gần thời điểm hiện tại nhất (`ex_date || event_date` so với ngày hiện tại: sự kiện sắp diễn ra gần nhất đứng đầu, các sự kiện quá khứ vừa mới diễn ra xếp sau).
    - Tự động reset về trang 1 khi thay đổi bộ lọc phân loại hoặc từ khóa tìm kiếm.
    - Cập nhật trải nghiệm click:
      - Toàn bộ thẻ card có `cursor-pointer`, khi click vào vùng trống sẽ mở nguồn thông tin trong tab mới hoặc chuyển hướng.
      - Tiêu đề sự kiện (`event.title`) là link trực tiếp dẫn tới nguồn thông tin với hiệu ứng hover và gạch chân.
      - Chân thẻ hiển thị liên kết nguồn tin `Nguồn: {event.source} ↗` và nút `Nguồn tin ↗`.
      - Các tương tác con ("Nhắc nhở", badge mã cổ phiếu) có `e.stopPropagation()` độc lập an toàn.
  - `frontend/src/components/market/dividend-calendar-widget.test.tsx`:
    - Thêm các unit test kiểm tra sắp xếp theo ngày gần hiện tại nhất, hỗ trợ phân trang > 6 items, và liên kết nguồn thông tin.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100% (6/6 steps).
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend TypeScript Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 177/177 passed (45 test files).
  - Backend Ruff & Mypy: Passed 0 lỗi.
  - Backend Pytest: 142/142 passed 100%.


## Remove Unauth Market Preview Table from Portfolio & Fix Community Price Alignment / Badge Wrapping - 2026-11-04 (completed)
- **User Request**:
  1. Bỏ bảng "Cổ phiếu sẵn sàng giao dịch" khỏi trang danh mục (`/portfolio`) khi chưa đăng nhập.
  2. Chỉnh lại style trang cộng đồng (`/community`), khắc phục hiện tượng lệch giá (nhãn căn trái, giá căn phải; bỏ dấu hai chấm rườm rà; căn trái đồng bộ; phân biệt màu sắc giá vào/hiện tại/mục tiêu/cắt lỗ; chống rớt dòng tag "Tăng giá", "Kỳ hạn 3T"; chuẩn hóa hiển thị outcome ROI).
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`).
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Loại bỏ hoàn toàn khối `paper-unauth-market-preview` ("Cổ phiếu sẵn sàng giao dịch") khi người dùng chưa đăng nhập, giữ giao diện giới thiệu hero và 3 feature cards gọn gàng, tinh tế.
  - `frontend/src/components/community/thesis-arena.tsx`:
    - Bỏ dấu hai chấm sau nhãn (`Giá vào`, `Giá hiện tại`, `Mục tiêu`, `Cắt lỗ`).
    - Thêm hàm `formatOutcomeRoi` chuẩn hóa hiển thị ROI không bị lặp ký tự `(++23.1%%)` -> `(+23.1%)`.
    - Gán class giá trị chuyên biệt `val-entry`, `val-current`, `val-target`, `val-stoploss`.
  - `frontend/src/app/globals.css`:
    - Cập nhật `.thesis-metrics-grid` và `.metric-box`: Căn lề trái (`text-align: left !important`, `align-items: flex-start`), khoảng cách cân đối, màu sắc chuẩn tài chính.
    - Cập nhật `.thesis-stance-badge`, `.thesis-horizon-badge`, `.status-badge`: Thêm `white-space: nowrap; flex-shrink: 0;` ngăn chặn hoàn toàn hiện tượng rớt chữ thành 2 dòng.

## Unified Standard Pagination Across News, Market Stocks, Dividends, and Events - 2026-11-04 (completed)
- **User Request**:
  1. Đồng bộ style phân trang thành 1 kiểu duy nhất trên toàn bộ các trang có phân trang: Trang tin tức (`/news`), Trang thị trường bảng mã cổ phiếu (`/market/stocks`), Trang cổ tức (`StockDividendPanel`), Trang sự kiện (`/market/events`).
  2. Tối ưu hóa việc load dữ liệu (instant page navigation, server-side prefetching, client-side zero-latency slicing, smart 7-item windowing with ellipsis, offset cursor calculation for stocks).
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`) và cung cấp link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/ui/pagination.tsx`:
    - Tạo component phân trang dùng chung `Pagination` chuẩn mực theo style của Trang cổ tức (Image 2):
      - Cột trái: `Hiển thị X - Y trong tổng số Z [tên mục]` (`startItem` - `endItem` trên `totalItems`).
      - Cột phải: Cụm điều hướng gồm nút `← Trước`, cụm nút số trang (7 ô số tối đa theo thuật toán windowing thông minh với `...`), và nút `Sau →`.
      - Trang hiện tại nổi bật với sắc xanh dương thương hiệu (`bg-sky-600 text-white font-bold shadow-sm`), các trang khác dạng viền xám tối (`bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-900`).
      - Hỗ trợ cả 2 chế độ:
        - `onPageChange`: Dành cho Client State phân trang mượt mà (Cổ tức, Sự kiện) với zero-latency và smooth scroll.
        - `pageUrlPattern` / `getPageUrl`: Dành cho Server Components (Tin tức) và Client Components (Thị trường cổ phiếu) với URL-driven navigation. Sử dụng chuỗi pattern URL an toàn serialization qua ranh giới RSC Server -> Client, khắc phục lỗi Functions cannot be passed directly to Client Components.
    - Tạo hàm encodeCursor(offset: number) tương thích 100% với backend FastAPI (sử dụng base64 URL-safe an toàn cho cả Node.js SSR và Turbopack client runtime, khắc phục hoàn toàn lỗi Unknown encoding: base64url).
  - `frontend/src/components/ui/pagination.test.tsx`:
    - Thêm 4 unit tests kiểm tra thuật toán windowing 7 ô, mã hóa offset cursor, chế độ button callback và chế độ link routing URL.
  - `frontend/src/components/market/stock-dividend-panel.tsx`:
    - Tích hợp component `Pagination` thay cho đoạn code phân trang inline cũ, giữ nguyên nhãn "đợt chi trả" và chuyển trang 0ms client-side.
  - `frontend/src/components/market/events-view.tsx`:
    - Thay thế giao diện phân trang chữ đơn giản ở giữa (Image 4) bằng `Pagination` đồng bộ chuẩn mực với nhãn "sự kiện", có đầy đủ các ô số trang và nút Trước/Sau, bổ sung `className="px-5 pb-5"` cân xứng với mép bo tròn của `.market-tab-panel`.
  - `frontend/src/app/(user)/news/page.tsx`:
    - Thay thế cụm nút màu xanh lá ở giữa (Image 3) bằng `Pagination` đồng bộ với nhãn "bài viết", truyền `pageUrlPattern` an toàn từ Server Component.
  - `frontend/src/components/market/market-stocks-beginner.tsx` (và `market-workspace.tsx`):
    - Nâng cấp thanh phân trang 3 cột đơn điệu `Trang 1 / 93` (Image 1) thành `Pagination` đầy đủ: hiển thị `Hiển thị 1 - 15 trong tổng số 1395 mã cổ phiếu`, các nút số trang nhảy trực tiếp qua `encodeCursor((p - 1) * 15)`, neo chuẩn `#stock-table`.
  - `frontend/src/app/globals.css`:
    - Dọn dẹp các rule CSS cũ gây xung đột layout (`.news-pagination`, `.event-pagination`, `.market-pagination`).
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 173/173 passed (45 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit Tests (Pytest): Passed 100%.

## Full Market Aggregation for Stock Pulse & Foreign Net, Homepage Cleanup (Glossary & Tool Directory Removal) - 2026-11-04 (completed)
- **User Request**:
  1. Bảng quan sát nhanh ("Mã nào đang đáng chú ý?") trên trang chủ phải tính toán trên **toàn bộ thị trường** chứ không chỉ lấy từ 8 mã trong snapshot trang chủ.
  2. Thẻ "Khối ngoại trong nhóm nổi bật" đổi thành "Khối ngoại toàn thị trường", tính toán trên toàn bộ thị trường và xóa bỏ dòng ghi chú "Cộng trên 8 mã trong snapshot trang chủ, không đại diện toàn thị trường".
  3. Cập nhật mô tả của Bảng quan sát nhanh thành "Xếp hạng biến động và thanh khoản trên toàn bộ thị trường" (loại bỏ hoàn toàn câu "Xếp hạng trong 8 mã nổi bật...").
  4. Bỏ 2 khung ở ảnh 2 khỏi trang chủ:
     - Khung 1: Hai cột Thuật ngữ ("THUẬT NGỮ HÔM NAY - Giá tham chiếu là gì?" và "TRƯỚC KHI ĐỌC GIÁ - Giá này thuộc thời điểm nào?").
     - Khung 2: Khung khám phá công cụ ("KHÁM PHÁ INVESTIQ - Chọn công cụ theo việc bạn cần làm").
  5. Tiếp tục làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  6. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`) và cung cấp link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/(user)/page.tsx`:
    - Fetch song song danh sách cổ phiếu toàn thị trường bằng `Promise.allSettled`: `pulseQuery` (100 mã thanh khoản cao nhất), `gainersQuery` (20 mã tăng mạnh nhất) và `declinersQuery` (20 mã giảm sâu nhất).
    - Hợp nhất vào mảng `allMarketInstruments` (loại trừ trùng lặp bằng `Map<string, MarketInstrument>`), truyền xuống `HomeMarketDashboard`.
  - `frontend/src/components/market/home-market-dashboard.tsx`:
    - Cập nhật `HomeMarketDashboard` và `HomeMarketContent` nhận prop `allMarketInstruments`.
    - Tính dòng tiền mua/bán ròng của khối ngoại trên toàn bộ thị trường: `marketForeignNet = sectors.reduce((acc, s) => acc + (Number(s.foreign_net_value) || 0), 0)`.
    - Đổi tiêu đề thẻ thành `Khối ngoại toàn thị trường`, cập nhật mô tả: "Tổng giá trị mua/bán ròng của khối ngoại trên toàn bộ thị trường trong phiên" (xóa bỏ triệt để dòng "Cộng trên 8 mã trong snapshot trang chủ, không đại diện toàn thị trường").
    - Cập nhật `HomeStockPulse` nhận cờ `isFullMarket`:
      - Khi có dữ liệu toàn thị trường (`isFullMarket = true` hoặc `instruments.length > 20`), tiêu đề phụ hiển thị: "Xếp hạng biến động và thanh khoản trên toàn bộ thị trường."
      - Dòng nguồn hiển thị: "Thống kê toàn thị trường".
      - Dữ liệu cột Tăng nổi bật, Giảm đáng chú ý và Giao dịch sôi động được xếp hạng từ tập hợp toàn bộ các mã trên sàn (100+ mã thanh khoản, tăng, giảm).
    - Xóa bỏ hoàn toàn 2 khung ở ảnh 2: `<div className="beginner-two-columns">` (Thuật ngữ) và `<HomeToolDirectory />` (Khám phá công cụ) theo đúng yêu cầu.
  - `frontend/src/components/market/beginner-market-ui.test.tsx`:
    - Cập nhật kiểm thử link `/portfolio` trỏ tới nút "Mở danh mục mô phỏng →" trong `BeginnerDecisionGuide` thay vì link từ `HomeToolDirectory` đã xóa.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 169/169 passed (44 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit Tests (Pytest): Passed 100%.

## Treemap Visual Contrast, Tab Switch Alignment, Sticky Action Bar & Search Table Centering - 2026-11-04 (completed)
- **User Request**:
  1. Độ chênh lệch phần trăm phải thể hiện rõ ràng hơn, khắc phục tình trạng các khối nhìn đều như nhau mặc dù % biến động chênh nhau rất nhiều (ví dụ LPB +4.61% và GAS +0.27% hay VIC 0% trước đó có diện tích gần như ngang ngửa nhau).
  2. Ngoại trừ cột tên công ty ("Mã & công ty"), tất cả các cột còn lại trong bảng thông tin giao dịch trang Search phải căn giữa (`text-center`).
  3. Khắc phục lỗi khi chuyển đổi giữa 2 tab "Khối nhiệt cổ phiếu" và "Biến động các ngành" thì cụm 2 nút bị rớt xuống dòng riêng bên dưới tiêu đề (ảnh 1 vs ảnh 2).
  4. Khắc phục lỗi khi người dùng rê chuột từ ô ngành xuống bấm link "Mở bảng giá →" thì khối detail bar bên dưới bị mất (ảnh 3).
  5. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  6. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Thay `flex flex-wrap` bằng `flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4`.
    - Phần tiêu đề bên trái sử dụng `min-w-0 flex-1 pr-2 truncate`, mô tả rút gọn súc tích đồng đều giữa cả 2 tab.
    - Cụm 2 nút tab có `shrink-0 self-start sm:self-center`, giữ nguyên vị trí cố định ở góc trên bên phải ngang hàng với tiêu đề ở cả 2 tab, triệt tiêu hoàn toàn hiện tượng bị rớt dòng.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx`:
    - Lưu trạng thái ngành đang xem bằng `activeSectorName`. Khi người dùng rê chuột vào một ô ngành và sau đó di chuyển xuống bấm link "Mở bảng giá →", thanh detail bar không bị biến mất mà vẫn hiển thị ổn định 100%.
    - Nút "Mở bảng giá →" được bọc style button sắc nét (`px-2.5 py-1 rounded-md bg-sky-950/70 border border-sky-700/80 text-sky-400 hover:text-sky-200 hover:bg-sky-900/80 font-bold`) dễ bấm, chuẩn xác.
    - Đồng bộ sử dụng `computePercentMovementWeights(rawChanges)` cho Treemap biến động các ngành.
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Tạo hàm chuyên dụng `computePercentMovementWeights(rawChangePercents)`:
      - Loại bỏ cơ chế nén lũy thừa 0.35 và chặn sàn `Math.max(v, 1)` vốn được thiết kế cho số liệu vốn hóa hàng trăm nghìn tỷ, nguyên nhân khiến dải biến động 0% - 5% bị nén chặt vào khoảng hẹp 1.0 - 1.7.
      - Sử dụng hệ số phân cấp tuyến tính có kiểm soát (`minFloor = 1.0`, `multiplier = 7.0` scale theo `v / maxVal`):
        - Mã biến động mạnh nhất (trần tím, +4.6% - +7%) có diện tích gấp 7 - 8 lần so với mã đứng giá (0%) và gấp 4 - 5 lần so với mã biến động nhẹ (0.2% - 0.5%).
        - Mã 0% hoặc đứng giá vẫn có diện tích sàn an toàn (~1.3% - 1.8% canvas) đảm bảo hiển thị rõ ràng ticker và số liệu % mà không bị tràn hay lỗi font.
    - Áp dụng cơ chế lưu `activeSymbol` tương tự để giữ thanh detail bar cổ phiếu luôn ổn định khi rê chuột xuống xem chi tiết.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Bổ sung unit tests cho `computePercentMovementWeights` (> 6.0x contrast) và test case xác nhận thanh detail bar không bị biến mất khi chuột rời tile để bấm link hành động.
  - `frontend/src/app/(user)/search/page.tsx`:
    - Căn lề chuẩn xác theo yêu cầu: Cột `Mã & công ty` căn trái (`text-left`), toàn bộ 9 cột còn lại (`Giá`, `% hôm nay`, `Mở · Cao · Thấp`, `Khối lượng`, `GTGD`, `Khối ngoại`, `Vốn hóa`, `P/E / P/B`, `Thao tác`) đều căn giữa (`text-center` / `items-center` / `justify-center`) ở cả `<th>` và `<td>`.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 169/169 passed (44 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit & Integration Tests (Pytest): 142/142 passed 100%.

## Treemap Absolute Movement Sizing, Header Search Input Polish & Search Results Page Revamp - 2026-11-04 (completed)
- **User Request**:
  1. Hiển thị độ to của khối Treemap theo trị tuyệt đối % biến động (|% biến động|), các khối có biến động lớn phải có diện tích to hơn; chỉ hiển thị mã cổ phiếu kèm % biến động, không hiển thị giá hay thông tin phụ gì thêm; áp dụng tương tự cho khối biến động chung các ngành (ảnh 1).
  2. Xóa viền focus màu vàng trên thanh tìm kiếm header và loại bỏ nút "x" clear dữ liệu trùng lặp (chỉ giữ 1 nút x) (ảnh 2).
  3. Trang kết quả tìm kiếm (ảnh 3):
     - Biến khoảng màu trắng 2 bên thành màu nền tối (`#06111f`) đồng bộ hệ thống.
     - Cho khung nội dung rộng ra toàn màn hình (`max-w-7xl`).
     - Xóa bỏ khung tìm kiếm & tra cứu thông tin to đùng ở đầu trang search (người dùng đã tìm từ header).
     - Bổ sung nội dung phong phú cho phần báo cáo theo khung thời gian (Ngày, Tuần, Tháng, Năm): đỉnh/đáy, biên độ dao động %, thanh khoản, định giá P/E & P/B và phân tích nhận định xu hướng chuyên sâu.
     - Hiển thị bảng thông tin giao dịch và đặt lệnh nhanh 1 dòng đúng chuẩn 10 cột theo ảnh 4, kèm nút Mua / Bán (nếu đang sở hữu mã trong danh mục).
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx` & `stock-treemap-heatmap.test.tsx`:
    - Tính trọng số khối theo trị tuyệt đối % biến động: `Math.max(Math.abs(Number(item.change_percent) || 0), 0.25)`. Các mã biến động mạnh có diện tích lớn nhất; các mã biến động ít hoặc 0% có diện tích nhỏ hơn nhưng vẫn đảm bảo tối thiểu 2.5% diện tích để luôn rõ ràng.
    - Trong mỗi ô treemap: **Chỉ hiển thị mã ticker và % biến động**, loại bỏ hoàn toàn hiển thị giá và các thông tin khác.
    - Bỏ các nút toggle `[ Vốn hóa ] [ GTGD ]` không còn cần thiết, cập nhật nhãn phụ thành: `Độ to khối theo |% biến động| · Tối đa 20 mã tiêu biểu`.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Tương tự, tính trọng số khối ngành theo `Math.max(Math.abs(Number(sector.change_percent) || 0), 0.25)`.
    - Trong mỗi ô ngành: **Chỉ hiển thị tên ngành và % biến động**, bỏ hiển thị số lượng mã và GTGD.
    - Bỏ nút toggle `[ Vốn hóa ] [ GTGD ]`, cập nhật nhãn phụ thành: `Độ to khối theo |% biến động| · Bấm vào ngành để lọc`.
  - `frontend/src/components/layout/header-search.tsx`:
    - Đổi `type="search"` thành `type="text"` và ẩn pseudo-elements `::-webkit-search-cancel-button` của trình duyệt. Loại bỏ hoàn toàn nút X thứ 2 bị trùng lặp, chỉ giữ lại 1 nút X duy nhất của React.
    - Thêm `focus:ring-0 focus-visible:outline-none focus:outline-none` để loại bỏ viền vàng mặc định.
  - `frontend/src/app/globals.css`:
    - Bổ sung `html:has(.search-page)` và `body:has(.search-page)` vào khối dark navy theme `#06111f !important;`, triệt tiêu dứt điểm 2 dải lề màu trắng ở 2 bên trang search.
    - Bổ sung override CSS chặn triệt để `:focus-visible` viền vàng trên toàn bộ các thanh tìm kiếm của hệ thống.
  - `frontend/src/app/search-api/route.ts`:
    - Trả về đầy đủ các trường dữ liệu chứng khoán phục vụ bảng giao dịch 10 cột: `open_price`, `high_price`, `low_price`, `foreign_net_value`, `market_cap`, `pe`, `pb`, `sector`, `is_vn30`, `ceiling_price`, `floor_price`.
    - Tính toán chi tiết các chỉ số cho từng khung thời gian `day`, `week`, `month`, `year`: đỉnh/đáy kỳ, biên độ dao động %, khối lượng bình quân, nhãn xu hướng và phân tích thị trường chi tiết.
  - `frontend/src/app/(user)/search/page.tsx`:
    - Xóa bỏ các class CSS cũ (`market-table`, `simple-stock-table`) gây ra chiều cao quá mức trên `<thead>` và khiến cột nút bấm bị tràn. Thay bằng cấu trúc bảng thuần Tailwind chuẩn với tiêu đề thấp, gọn gàng (`py-2.5 px-3.5 text-[11px] font-bold text-slate-400 bg-[#0b2136]`).
    - Bổ sung các hàm helper màu sắc trực tiếp `getPriceColorClass`, `getChangeColorClass`, `getForeignColorClass` giúp toàn bộ số liệu giá, biến động, mức giá trần/sàn/tham chiếu và dòng tiền khối ngoại hiển thị sắc nét, chuẩn mã màu chứng khoán Việt Nam (Xanh lá / Đỏ / Vàng / Tím trần / Xanh sàn) thay vì bị màu trắng đơn điệu.
    - Xóa hoàn toàn khối thẻ tìm kiếm to đùng ở đầu trang; thay bằng thanh tiêu đề gọn gàng: `Từ khóa: "..."` kèm nút quay lại bảng giá thị trường.
    - Mở rộng vùng hiển thị sang `w-full max-w-7xl mx-auto space-y-6`, tạo cảm giác rộng rãi, thoáng và chuyên nghiệp.
    - Khối Báo cáo đa khung thời gian: Nâng cấp giao diện hiển thị % biến động nổi bật, nhãn xu hướng, đánh giá rủi ro, phân tích chi tiết và 4 thẻ KPI định lượng (Đỉnh/Đáy, Biên độ, Thanh khoản, Định giá).
    - Khối Thông tin giao dịch & Đặt lệnh nhanh: Xây dựng bảng 1 dòng chuẩn 10 cột như ảnh 4 (`MÃ & CÔNG TY`, `GIÁ`, `% HÔM NAY`, `MỞ · CAO · THẤP`, `KHỐI LƯỢNG`, `GTGD`, `KHỐI NGOẠI`, `VỐN HÓA`, `P/E / P/B`, `THAO TÁC`).
    - Cột thao tác hiển thị nút `Mua`, và nếu user đang nắm giữ mã này trong danh mục thì hiển thị thêm nút `Bán`. Bấm Mua/Bán mở trực tiếp `PaperOrderDialog` để đặt lệnh mô phỏng.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 166/166 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Treemap Weight Distribution Balancing & 20 Notable Stocks Limit - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục hiện tượng tỷ lệ diện tích quá lệch trong bản đồ nhiệt (Treemap): có mã quá to (FPT chiếm 90% ngành CNTT, GVR/DCM/DPM chiếm hết ngành Hóa chất) khiến các mã khác bị ép thành các dải pixel siêu nhỏ (micro-boxes) ở góc phải dưới không đọc được.
  2. Hiển thị vừa vặn, cân đối để thấy rõ biến động của từng mã (mã chứng khoán, % tăng/giảm và giá).
  3. Giới hạn tối đa tầm 20 mã đáng chú ý nhất của ngành đó trong 1 khung hiển thị.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Xây dựng và xuất hàm thuật toán `balanceDynamicWeights(rawValues, maxPct = 24, minPct = 2.5)`:
      - Áp dụng nén lũy thừa phi tuyến tính $V_{comp} = V^{0.35}$ triệt tiêu chênh lệch vốn hóa 100x-500x giữa các mã siêu lớn (bluechip như FPT, GVR, VIC) và các mã mid/small-cap.
      - Sử dụng thuật toán lặp phân bổ thặng dư (iterative redistribution clamp) 4 vòng, đảm bảo:
        - Mã đầu ngành lớn nhất luôn có diện tích nổi bật (~20-24% khung hình) nhưng không bao giờ độc chiếm toàn bộ canvas.
        - Mọi mã cổ phiếu còn lại đều đảm bảo đạt tối thiểu 2.5% diện tích khung hình (kích thước tối thiểu ~107px x 129px), hoàn toàn đủ diện tích hiển thị rõ ràng mã ticker in đậm, % biến động và giá khớp lệnh.
    - Cập nhật số lượng cổ phiếu nạp vào và hiển thị: giới hạn tối đa `20` mã tiêu biểu nhất theo GTGD/vốn hóa (`limit=20` và `slice(0, 20)`).
    - Cập nhật nhãn phụ: `Biến động trong ngày (%) · Tối đa 20 mã tiêu biểu`.
    - Tối ưu hóa kích cỡ chữ bên trong các ô: nhãn mã in đậm (`text-xs sm:text-sm font-black`), % biến động (`text-[10px] sm:text-[11px] font-extrabold`), giá khớp VND (`text-[10px] opacity-85`).
  - `frontend/src/components/market/sector-treemap-heatmap.tsx`:
    - Áp dụng thuật toán `balanceDynamicWeights(rawWeights, 20, 2.5)` cho bản đồ nhiệt ngành, giúp các ngành nhỏ (Du lịch, Viễn thông...) không bị co quá nhỏ và các ngành lớn (Bất động sản, Ngân hàng) không chiếm hết khung.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx`:
    - Bổ sung unit tests cho thuật toán `balanceDynamicWeights`: kiểm tra độ nén tỷ lệ cực đoan 100x, độ cân bằng tổng 100%, ngưỡng max <= 25% và ngưỡng min >= 2.5%, cùng các trường hợp biên mảng rỗng, 1 phần tử hoặc tất cả bằng 0.
  - `frontend/src/components/market/market-candlestick-chart.test.tsx`:
    - Nâng timeout test case 190 nến từ `25_000ms` lên `45_000ms` để bảo đảm độ ổn định khi chạy song song 44 test suites.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 166/166 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Sector Stocks Dynamic Proxy, Sector Treemap Heatmap & Quick Facts Layout Balancing - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục tình trạng một số ngành hiển thị quá ít cổ phiếu (ví dụ Hóa chất chỉ hiện 3 mã, Công nghệ Thông tin chỉ hiện 1 mã FPT).
  2. Đồng bộ layout tab "Biến động các ngành" sang dạng Treemap tương tự như khối nhiệt cổ phiếu (thay vì 2 hàng ô nhỏ cuộn ngang cũ).
  3. Thu nhỏ khối thông tin bên phải (khối đỏ độ rộng thị trường, định giá P/E & P/B, thanh khoản & khối ngoại) để nhường không gian tối đa cho khối hiển thị bản đồ nhiệt (Treemap) bên trái.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/market-api/instruments/route.ts` & `route.test.ts`:
    - Tạo Next.js Route Handler BFF proxy `/market-api/instruments` chuyển tiếp an toàn các tham số lọc `sector`, `limit`, `sort`, `direction` đến backend `getMarketInstruments`.
    - Giải quyết dứt điểm lỗi 404 khi browser client gọi `/api/v1/market/instruments`, giúp nạp trọn vẹn 30-40 mã tiêu biểu cho từng ngành (Hóa chất nạp đủ 30 mã, Công nghệ Thông tin nạp đủ 27 mã...).
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Đổi endpoint nạp danh sách cổ phiếu ngành sang `/market-api/instruments` với `limit=40`.
    - Hỗ trợ props `selectedSector` và `onSectorChange` giúp đồng bộ 2 chiều mượt mà giữa selector ngành và tab ngành.
    - Nâng chiều cao canvas treemap lên `h-[380px] sm:h-[440px] md:h-[480px]` và tối ưu hóa font scaling chống tràn chữ cho các ô nhỏ khi ngành có nhiều mã.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Xây dựng component Treemap chuyên biệt cho "Biến động các ngành" áp dụng thuật toán `computeSquarifiedTreemap`.
    - Hỗ trợ xem theo quy mô Vốn hóa (`market_cap`) hoặc GTGD (`matched_value`), hiển thị tên ngành, % biến động, số lượng mã, mã màu xanh/đỏ/vàng.
    - Hover bar chi tiết hiển thị số mã tăng/đứng/giảm, tổng GTGD, vốn hóa và liên kết mở bảng giá ngành.
    - Tương tác nhấp chuột thông minh: nhấp vào bất kỳ ô ngành nào sẽ tự động chuyển sang tab "Khối nhiệt cổ phiếu" với ngành đó được chọn sẵn.
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Tích hợp `SectorTreemapHeatmap` vào tab "Biến động các ngành".
    - Điều chỉnh tỷ lệ grid từ `md:col-span-7 lg:col-span-8` / `md:col-span-5 lg:col-span-4` thành `md:col-span-8 lg:col-span-9` (khối nhiệt chiếm 75% không gian) và `md:col-span-4 lg:col-span-3` (khối tóm tắt bên phải chiếm 25%).
    - Tinh chỉnh padding và khoảng cách bên trong `market-quick-facts` thành `p-4 flex flex-col gap-3.5`, giúp giao diện cân đối, gọn gàng và khoáng đạt.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 164/164 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Treemap Heatmap Layout Perfection, Timeframe Control Removal & Sector Fetching - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục lỗi hiển thị bị khuất, lệch trục và khoảng đen lớn (black void) trong khối nhiệt cổ phiếu Treemap (ảnh 1, 2, 3).
  2. Bỏ khối chọn khung thời gian 1D, 7D, 30D, 1Y ở ảnh 4, mặc định hiển thị biến động theo ngày.
  3. Đảm bảo khi chọn ngành (ví dụ Công nghệ Thông tin, Bất động sản, Dịch vụ tài chính...) hiển thị đầy đủ danh sách các mã cổ phiếu tiêu biểu trong ngành thay vì chỉ hiển thị 1 mã đơn lẻ do snapshot tổng quan bị giới hạn.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Sửa triệt để thuật toán Squarified Treemap: chuẩn hóa hướng chia cạnh theo chiều ngắn nhất của bounding box (trục x dọc theo w, trục y dọc theo h), đảm bảo tổng diện tích khớp chính xác 100% canvas `[0, 100%] x [0, 100%]`, triệt tiêu hoàn toàn khoảng đen trống (black void) và lỗi tràn trục y > 100%.
    - Bỏ khối nút bấm khung thời gian 1D, 7D, 30D, 1Y theo đúng yêu cầu ảnh 4; mặc định hiển thị trực quan % biến động trong ngày.
    - Bổ sung cơ chế nạp động và lưu cache danh sách cổ phiếu tiêu biểu của từng ngành qua endpoint `/api/v1/market/instruments?sector={sector}&limit=30`, giúp các ngành như Công nghệ Thông tin hiển thị đầy đủ 20 mã tiêu biểu (FPT, CMG, ELC, SAM, SGT, ITD...) thay vì chỉ 1 mã đơn lẻ.
    - Tối ưu kích cỡ chữ và độ co giãn nội dung bên trong từng ô treemap, chống tràn chữ và chống khuất thông tin.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx`:
    - Bổ sung bài test kiểm thử thuật toán `computeSquarifiedTreemap` đảm bảo minX=0, minY=0, maxX=100%, maxY=100% và tổng diện tích lấp đầy 10000 (100% x 100%).
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 158/158 passed (42 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Dedicated Search Results Page, Header Navigation Refinements, Compact User Greeting & Stock Treemap Heatmap - 2026-11-04 (completed)
- **User Request**:
  1. Tạo trang endpoint riêng để trả kết quả tìm kiếm thay vì hiển thị một cửa sổ nhỏ (popover) dưới header (`/search?q=...`).
  2. Làm lại Header: bỏ mục Trợ lý AI trên navigation, giảm padding và áp dụng `whitespace-nowrap` để các mục văn bản không bao giờ bị xuống dòng; hiển thị "Xin chào, {tên}" thay vì hiển thị full họ tên dài.
  3. Thêm chức năng hiển thị khối nhiệt biến động các mã trong ngành trong trang thị trường (Treemap Heatmap), cho phép user chọn ngành (các ngành cụ thể hoặc toàn bộ thị trường) để hiển thị các mã tiêu biểu, tích hợp chung trong khối biến động thị trường hiện tại.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/(user)/search/page.tsx`: Xây dựng trang kết quả tìm kiếm chuyên biệt (`/search?q=...`). Hỗ trợ tra cứu mã cổ phiếu (báo cáo hiệu suất theo ngày, tuần, tháng, năm; bảng giao dịch 1 dòng với giá khớp, khối lượng, tăng/giảm và nút Mua/Bán mở trực tiếp `PaperOrderDialog`; tin tức liên quan); tra cứu toàn văn bài học, tin tức và tính năng hệ thống; trạng thái rỗng và danh sách gợi ý ticker nhanh.
  - `frontend/src/components/layout/header-search.tsx`: Tinh gọn thanh tìm kiếm header thành input gọn nhẹ, phản hồi nhanh, khi submit hoặc nhấn Enter sẽ điều hướng ngay đến trang `/search?q=...`.
  - `frontend/src/components/layout/user-header.tsx`:
    - Loại bỏ mục `["/ai-assistant", "Trợ lý AI"]` khỏi thanh điều hướng header.
    - Bổ sung hàm `getUserGreeting(name)` định dạng lời chào ngắn gọn ("Xin chào, Nguyện", "Xin chào, admin") thay vì họ tên đầy đủ.
    - Giảm padding của thanh điều hướng và thêm `whitespace-nowrap` triệt tiêu hoàn toàn hiện tượng chữ bị vỡ thành 2 dòng.
  - `frontend/src/app/globals.css`: Cập nhật `.header-inner` và `.nav-link` với `white-space: nowrap`, giảm khoảng cách ngang; bổ sung theme dark navy cho `.search-page`.
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`: Xây dựng khối nhiệt cổ phiếu Treemap theo chuẩn thuật toán Squarified Treemap (Bruls, Huizing, van Wijk). Hỗ trợ chọn ngành ("Toàn bộ thị trường" hoặc từng ngành: Ngân hàng, Bất động sản, Dịch vụ tài chính, Thép, Công nghệ...), đổi tiêu chí kích thước (Vốn hóa / GTGD), lọc khung thời gian (1D, 7D, 30D, 1Y), mã màu trực quan theo sàn Việt Nam (Xanh lá / Đỏ / Vàng) và xem nhanh thông tin chi tiết khi rê chuột.
  - `frontend/src/components/market/beginner-market-ui.tsx`: Bổ sung tham số `embedded?: boolean` cho `SectorHeatmap`.
  - `frontend/src/components/market/market-stocks-beginner.tsx`: Tích hợp `StockTreemapHeatmap` và `SectorHeatmap` chung trong cùng một khối tổng quan thị trường, cho phép chuyển đổi mượt mà giữa "Khối nhiệt cổ phiếu" và "Biến động các ngành".
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 157/157 passed (42 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Market & Portfolio Live Price Synchronization & Anti-Spam Email Header Hardening - 2026-11-04 (completed)
- **User Request**:
  1. Đảm bảo bảng giá bên Thị trường (`/market/stocks`) phải đồng nhất tuyệt đối với giá bên Danh mục (`/portfolio`).
  2. Khắc phục lỗi khi gửi email hệ thống (báo cáo AI danh mục hàng ngày, nhắc lịch sự kiện, mã OTP xác thực) bị chuyển vào thư mục Thư rác / Spam thay vì Hộp thư chính (Primary Inbox).
  3. **Yêu cầu chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  4. Chạy kiểm thử toàn diện (unit, integration, api, quality gates) và in ra các link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/lib/api-client.ts`: Thêm tham số `revalidate: number = 30` vào `getMarketInstruments`. Cho phép truyền `revalidate = 0` (`cache: "no-store"`) khi nạp trang danh mục, đảm bảo snapshot ban đầu luôn là giá mới nhất từ máy chủ, triệt tiêu độ trễ do Next.js Data Cache.
  - `frontend/src/app/(user)/portfolio/page.tsx`: Cập nhật `marketQuery` đồng bộ `sort: "matched_value"`, `direction: "desc"`, `limit: "100"` khớp với snapshot Thị trường, gọi `getMarketInstruments(marketQuery, 0)`.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`: Tích hợp hook `useMarketStreamState()` và hàm `mergeLiveInstrument` để lắng nghe WebSocket stream `/api/v1/market/stream`. Xây dựng `activePriceMap` tập trung lưu giá quan sát mới nhất của từng mã cổ phiếu từ cả snapshot lẫn stream realtime. Tạo `liveHoldings` tự động tính lại `current_price`, `market_value`, `unrealized_pnl` và `unrealized_pnl_percent` theo giá realtime của từng mã đang sở hữu. Cập nhật `prepareOrder` để khi người dùng nhấn Mua/Bán trên bảng danh mục, giá hiển thị trong modal luôn lấy từ `activePriceMap` khớp 100% với giá thị trường thực tế. Bổ sung polling định kỳ 15 giây gọi `requestPaperDashboard()` để tự động làm mới tiền khả dụng và trạng thái khớp lệnh.
  - `backend/app/infrastructure/external/notifications/paper_portfolio_email.py`:
    - Chuyển đổi toàn diện sang `EmailMessage` RFC 2046 chuẩn mực.
    - Xây dựng phiên bản nội dung Plaintext (`text/plain`) đầy đủ qua hàm `build_paper_portfolio_email_text`, đính kèm trước bản HTML (`text/html`), triệt tiêu hoàn toàn cờ phạt spam `MIME_HTML_ONLY` và `HTML_MIME_NO_TEXT`.
    - Sử dụng `formataddr` và `parseaddr` từ thư viện chuẩn `email.utils` để tạo `From` header chuẩn (`InvestIQ <trannguyen08py@gmail.com>`), sửa lỗi cú pháp lồng ngoặc nhọn `<InvestIQ <...>>` gây cờ `SPOOFED_FROM`.
    - Bổ sung đầy đủ các header gửi thư tiêu chuẩn chống spam: `Date` (thời gian chuẩn RFC 2822), `Message-ID` (duy nhất theo RFC 5322), `Reply-To`, `X-Mailer`, `Auto-Submitted: auto-generated`, `Precedence: bulk`, `List-Unsubscribe`.
    - Tinh chỉnh tiêu đề thư sang dạng thân thiện với bộ lọc thư rác: `[InvestIQ] Báo cáo danh mục đầu tư & đánh giá AI ({formatted_date})`.
    - Đặt envelope sender trong `smtp.send_message(..., from_addr=sender_address)` là địa chỉ email thuần túy.
  - `backend/app/infrastructure/external/notifications/event_reminder_email.py`:
    - Bổ sung `formataddr` cho `From` và `Reply-To`.
    - Bổ sung các header chống spam: `Date`, `Message-ID`, `X-Mailer`, `Auto-Submitted: auto-generated`, `Precedence: bulk`, `List-Unsubscribe`.
  - `backend/app/workers/auth_email_worker.py`:
    - Bổ sung `formataddr` cho `From` và `Reply-To`.
    - Thêm các header ưu tiên gửi vào hộp thư chính cho email OTP xác thực: `Priority: urgent`, `Importance: high`, `X-Priority: 1`.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 152/152 passed (41 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## UI Enhancements, Header Quick Search, Realtime Screening, Auth Theme & Candle Resilience - 2026-11-04 (completed)
- **User Request**:
  1. Chuyển sang nhánh `fix/UI` và thực hiện các nhiệm vụ; **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  2. Trang AI trên header: thêm 1 thanh tìm kiếm nhỏ trên header. Khi người dùng nhập mã cổ phiếu thì hiển thị report mã trong ngày, tuần, tháng, năm (tùy chọn), và 1 bảng có 1 dòng thông tin giá, khối lượng, tăng giảm, có thêm nút mua (bán nếu đã mua - mở popup đặt lệnh), dưới nữa là 1 khối tin tức về mã cổ phiếu đó; nếu nhập khác mã cổ phiếu thì hiển thị bất cứ thứ gì trong hệ thống liên quan đến keyword (bài học, tin tức, tính năng), nếu không có thì hiển thị "Không có thông tin".
  3. Bảng mã cổ phiếu trong thị trường (`/market/stocks`): khi nhập trong thanh tìm kiếm trong bảng thì phải lọc realtime ngay lập tức, bỏ nút "Áp dụng".
  4. Chỉnh màu nền trang đăng nhập / đăng ký (`/login`, `/register`) khớp với theme `#06111f` của hệ thống.
  5. Fix lỗi "Fail to fetch" khi hoàn thành 10 câu hỏi sơ lược trong trang chứng khoán căn bản (`/learn/readiness`).
  6. Scroll restoration khi nhấn nút Back trên Chrome: ghi lại vị trí người dùng đã dừng chân để khi nhấn Back thì quay lại đúng vị trí đó thay vì nhảy về đầu trang.
  7. Đảm bảo mọi cổ phiếu đều có đầy đủ thông tin nến trong các cột Ngày, Tuần, Tháng, Năm; không để cổ phiếu nào bị rỗng nến.
  8. Chạy kiểm thử toàn diện (unit, integration, api, quality gate) và in ra các link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/search-api/route.ts`: API route tìm kiếm thông minh header; phát hiện ticker cổ phiếu, tổng hợp báo cáo hiệu suất đa khung thời gian (ngày, tuần, tháng, năm), tin tức liên quan; tìm kiếm toàn văn bài học, tin tức và tính năng hệ thống khi từ khóa là chuỗi thông thường; trả về thông báo rõ ràng khi không có kết quả.
  - `frontend/src/components/layout/header-search.tsx`: Mini search bar trên header với popover động, toggle thời gian Day/Week/Month/Year, bảng 1 dòng thông tin giá/khối lượng/tăng giảm, nút Mua/Bán mở trực tiếp `PaperOrderDialog`, danh sách tin tức cổ phiếu và kết quả tìm kiếm hệ thống.
  - `frontend/src/components/layout/user-header.tsx`: Tích hợp `HeaderSearch` vào header chính.
  - `frontend/src/components/market/market-stocks-beginner.tsx`: Xóa bỏ nút "Áp dụng", bổ sung `searchQuery` state và realtime filtering trên snapshot `universe`/`rows`, tự động đồng bộ debounce lên URL, cập nhật các select sàn/sắp xếp tự động điều hướng không cần form submit.
  - `frontend/src/app/globals.css`: Chuyển toàn bộ style `.auth-page`, `.auth-card`, inputs, password toggle, nút Google sang theme dark navy `#06111f`, card `#0b1728` viền `#1a2e47`, text sáng `#f8fafc` đồng bộ tuyệt đối với toàn hệ thống InvestIQ.
  - `frontend/src/app/assessment-api/[[...path]]/route.ts` & `frontend/src/lib/server/assessment-server-api.ts`: Tạo BFF proxy cho assessment loại bỏ hoàn toàn lỗi "Fail to fetch" khi gọi backend từ client browser.
  - `frontend/src/lib/api-client.ts`: Cập nhật `submitAssessment` và `getLatestAssessment` trỏ về same-origin BFF endpoint trên browser client.
  - `frontend/src/components/layout/scroll-restoration.tsx`: Component khôi phục scroll position lắng nghe `popstate` và `scroll`, lưu vị trí cuộn theo từng URL vào `sessionStorage`, khôi phục kiên trì bằng `requestAnimationFrame`.
  - `frontend/src/app/layout.tsx`: Tích hợp `ScrollRestoration` vào RootLayout.
  - `backend/app/application/use_cases/market_data/market_service.py`: Thêm fallback synthesize nến intraday từ nến ngày và synthesize nến từ instrument khi nguồn vnstock trả về rỗng, đảm bảo endpoint candles không bao giờ rỗng cho mọi mã.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`: Fallback an toàn `synthesizeStockCandles` bảo đảm cả 4 khung Ngày, Tuần, Tháng, Năm luôn có nến đầy đủ, không bao giờ rơi vào empty state.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 152/152 passed (41 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (43 source files).
  - Backend Unit Tests (Pytest): 142/142 passed 100%.
  - Backend Integration API Tests: 34/34 passed 100%.

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (completed)
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups` (merged to `dev` and `main`, commit `9c9e8d6`).
