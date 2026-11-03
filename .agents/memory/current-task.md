# Current Task

## Portfolio UX Discipline, Automatic Order Fill, Header Layout & Stock Detail Speed - 2026-11-03 (completed)
- **User Request**:
  1. Fix lỗi mới vào hệ thống chưa paper trading mà đã có điểm kỷ luật giả định (83/100).
  2. Fix lỗi mua cổ ở trang danh mục báo giá cũ không thể khớp lệnh, trong khi trang chi tiết lại mua được.
  3. Fix lỗi khi mua cổ phiếu thì có thêm nút bán đẩy khung giá xuống dòng; bỏ dòng text "Lệnh luyện tập vẫn tự động khớp theo giá quan sát mới nhất khi thị trường thật đóng cửa, kể cả cuối tuần." để giao diện gọn gàng.
  4. Bỏ 2 khối: Khối 2 cột (Cảnh báo học tập / Đang khởi sắc) và Khối tin tức tích cực khỏi trang danh mục mô phỏng (`/portfolio`).
  5. Fix lỗi load trang chi tiết mã cổ phiếu quá lâu.
  6. Tuân thủ quy trình Git: Làm việc trên nhánh riêng `fix/portfolio-ux-discipline-and-stock-detail-speed`, pass 100% Quality Gates (Frontend Lint, Typecheck, Vitest 151/151 tests, Backend Ruff, Mypy, Pytest 142/142 tests), merge vào `dev`, merge `dev` vào `main` và push lên GitHub.
- **Branch**: `fix/portfolio-ux-discipline-and-stock-detail-speed` (merged to `dev` and `main`, commit `9e131b1`).
- **Root-Cause Analysis & Fixes**:
  1. **Lỗi Điểm Kỷ Luật Trống (Discipline Onboarding/Empty State)**:
     - `TradingDisciplineCard` trước đây tự động tính điểm mặc định `overallScore=83` ngay cả khi user chưa có lệnh nào. Đã cập nhật kiểm tra `hasActivity`: khi chưa có giao dịch hoặc vị thế nắm giữ, hiển thị badge "Chưa có dữ liệu giao dịch", các chỉ số `-- / 100` và thông báo hướng dẫn đặt lệnh đầu tiên.
  2. **Lỗi "Giá cũ không thể khớp lệnh" (`STALE_MARKET_PRICE`)**:
     - `simulate_trade.py` kiểm tra độ tươi `_can_simulate_fill()`. Khi snapshot ngoài giờ thị trường chuyển sang `stale`, lệnh mua bị chặn bởi ngoại lệ `STALE_MARKET_PRICE`. Đã cập nhật `_can_simulate_fill() -> True` và gỡ bỏ ngoại lệ này để lệnh mô phỏng luôn khớp theo giá quan sát mới nhất (`instrument.price > 0`).
  3. **Lỗi Nút Bán Đẩy Khung Giá Xuống Dòng & Bỏ Dòng Text**:
     - Gỡ bỏ thẻ `<p className="stock-trade-session-note">` dài 35rem khỏi `stock-trade-actions.tsx`.
     - Thêm `shrink-0` cho khối `<StockLivePrice item={item} />` và `max-w-2xl` cho khối thông tin bên trái trong `market/stocks/[symbol]/page.tsx`, đảm bảo khung giá luôn nằm ngang hàng bên phải của Hero header.
  4. **Dọn dẹp Trang Danh mục (`/portfolio`)**:
     - Xóa bỏ khối `paper-insights-grid` (Cảnh báo học tập / Đang khởi sắc).
     - Xóa bỏ khối `paper-news-grid` (Tin tức tích cực).
     - Loại bỏ lời gọi API `getNews` thừa trên Server Component `portfolio/page.tsx`, giúp trang `/portfolio` tải nhanh hơn đáng kể.
  5. **Tối ưu Tốc độ Tải Trang Chi tiết Cổ phiếu**:
     - Thêm in-memory/Redis read cache `_cached` cho 3 endpoints backend: `/instruments/{symbol}/dividends`, `/instruments/{symbol}/financial-statements`, và `/instruments/{symbol}/forensics`.
     - Giảm timeout cho các tab phụ xuống 1500ms và `instrumentPromise` xuống 2500ms, giúp SSR fallback nhanh chóng nếu dịch vụ ngoài chậm.
- **Verification**:
  - `check-pr.ps1` Quality Gate: 6/6 bước xanh 100% (ESLint, TSC, Vitest 151/151 tests, Ruff, Mypy, Pytest 142/142 tests).
  - Pre-push hook xác nhận 100% tests passed khi push nhánh fix, nhánh `dev` và nhánh `main`.

## Stock Detail Performance Optimization, Sector Taxonomy & Fundamentals Fallback - 2026-11-03 (completed)
- **User Request**: Fix lỗi "Chưa phân loại", tối ưu tốc độ click mã cổ phiếu và bổ sung dữ liệu P/E, P/B.
- **Branch**: `fix/stock-detail-performance-sectors-and-pe-pb` (merged to `dev` and `main`).

## Live Production Deployment & E2E System Verification - 2026-11-03 (completed)
- User Request: Test E2E web deployed tren Render va bao cao ket qua.
- Status: 15/15 E2E endpoints passed 100%, Backend and Frontend Live.
