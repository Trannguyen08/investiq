# Current Task

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
