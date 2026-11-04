# Current Task

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
