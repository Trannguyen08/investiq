# Current Task

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (in-progress)
- **User Request**:
  1. Fix màu nền không khớp toàn hệ thống ở `/learn/readiness`: chuyển từ màu trắng sáng sang dark mode `#06111f` đồng bộ.
  2. Xác nhận và đảm bảo xóa 2 khối ở trang danh mục: Khối "Cảnh báo học tập / Đang khởi sắc" và Khối "Tin tức thị trường tích cực".
  3. Xóa dòng text "Lệnh luyện tập vẫn tự động khớp theo giá quan sát mới nhất khi thị trường thật đóng cửa, kể cả cuối tuần." ở trang chi tiết cổ phiếu để khỏi bị lỗi giá xuống dòng.
  4. Fix layout header trang chi tiết cổ phiếu với `sm:flex-nowrap` và `flex-1` để khung giá không bao giờ bị rớt dòng khi xuất hiện thêm nút Bán.
  5. Đảm bảo lỗi "Giá quan sát đang cũ" ở modal đặt lệnh trang danh mục được giải quyết triệt để và đồng bộ với trang chi tiết.
  6. Tuân thủ nghiêm ngặt quy trình Git: làm việc trên nhánh fix riêng, chạy Quality Gate pass 100%, merge vào `dev` rồi merge vào `main`.
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups`
- **Changes**:
  - `frontend/src/app/(user)/learn/readiness/page.tsx`: Gán `<main id="main-content" className="learn-page readiness-page">`.
  - `frontend/src/app/globals.css`: Bổ sung `html:has(.readiness-page)`, `body:has(.readiness-page)` và style `.readiness-page` dark mode `#06111f`.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`: Thêm `sm:flex-nowrap` vào `.stock-detail-hero` và `flex-1` cho container bên trái.
  - `frontend/src/components/portfolio/paper-order-dialog.tsx`: Hỗ trợ đọc cả `detail` và `error.message` từ API response.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed (ESLint, TSC Typecheck, Vitest 152/152 passed, Ruff, Mypy, Pytest 142/142 passed).

## Auth Cold Start Resilience, UI Error Display & Keep-Alive Ping - 2026-11-03 (completed)
- **Branch**: `fix/auth-cold-start-retry-and-keepalive` (merged to `dev` and `main`).

## Portfolio UX Discipline, Automatic Order Fill, Header Layout & Stock Detail Speed - 2026-11-03 (completed)
- **Branch**: `fix/portfolio-ux-discipline-and-stock-detail-speed` (merged to `dev` and `main`, commit `9e131b1`).

## Stock Detail Performance Optimization, Sector Taxonomy & Fundamentals Fallback - 2026-11-03 (completed)
- **Branch**: `fix/stock-detail-performance-sectors-and-pe-pb` (merged to `dev` and `main`).

## Live Production Deployment & E2E System Verification - 2026-11-03 (completed)
- Status: 15/15 E2E endpoints passed 100%, Backend and Frontend Live.
