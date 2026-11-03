# Current Task

## Auth Cold Start Resilience, UI Error Display & Keep-Alive Ping - 2026-11-03 (completed)
- **User Request**: Thực hiện 3 giải pháp tối ưu dài hạn để xử lý lỗi AUTH_FAILED / Render Free-tier cold start:
  1. Hiển thị thông báo thân thiện trên giao diện Đăng nhập (`/login`) khi có query parameter `error`.
  2. Bổ sung cơ chế tự động thử lại (Retry) với backoff khi Backend gặp Cold Start / 502 / 503 / 504 trong `backendJson`.
  3. Cấu hình GitHub Actions Keep-Alive Ping định kỳ (`keepalive.yml`) và hướng dẫn UptimeRobot để giữ Backend và Frontend luôn thức 24/7.
- **Branch**: `fix/auth-cold-start-retry-and-keepalive` (merged to `dev` and `main`).
- **Implementation**:
  1. **Hiển thị thông báo trên giao diện Đăng nhập**:
     - Cập nhật `frontend/src/app/(auth)/login/page.tsx`: đọc `searchParams.error`, ánh xạ các mã lỗi (`AUTH_FAILED`, `BACKEND_UNAVAILABLE`, `GOOGLE_AUTH_FAILED`, `GOOGLE_CANCELLED`, `GOOGLE_STATE_INVALID`, v.v.) sang thông báo tiếng Việt rõ ràng, thân thiện.
     - Cập nhật `frontend/src/components/auth/auth-ui.tsx`: `LoginForm` nhận `initialError?: string`, hiển thị trực quan qua component `Notice` với style `.auth-notice.error`.
     - Bổ sung unit test trong `frontend/src/components/auth/auth-ui.test.tsx` xác nhận render thông báo lỗi khi có `initialError`.
  2. **Cơ chế tự động thử lại (Retry) khi Backend Cold Start**:
     - Cập nhật `frontend/src/lib/server/user-auth.ts`:
       - Thêm `AbortSignal.timeout(15000)` trong `backend()` ngăn request bị treo vô hạn.
       - Trong `backendJson`, bổ sung vòng lặp retry tối đa 2 lần với độ trễ 2000ms nếu gặp các mã lỗi tạm thời của hạ tầng Render (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout).
       - Phân loại lỗi chính xác sang `BACKEND_UNAVAILABLE` hoặc `RATE_LIMIT_EXCEEDED` thay vì fallback mù mờ vào `AUTH_FAILED`.
  3. **Cấu hình Keep-Alive Ping (Miễn phí 24/7)**:
     - Tạo `.github/workflows/keepalive.yml`: chạy định kỳ mỗi 14 phút qua cron `*/14 * * * *` ping vào `${BACKEND_URL}/healthz` và `${FRONTEND_URL}` ngăn Render đưa web services vào chế độ ngủ đông (spin down sau 15 phút).
     - Cập nhật tài liệu `docs/deploy.md` hướng dẫn cấu hình keep-alive và monitor UptimeRobot dự phòng.
- **Verification**:
  - `check-pr.ps1` Quality Gate: 6/6 bước xanh 100% (ESLint, TSC Typecheck, Vitest 152/152 tests, Ruff, Mypy, Pytest 142/142 tests).
  - Pre-push hooks passed 100% khi push nhánh fix, nhánh `dev` và nhánh `main`.

## Portfolio UX Discipline, Automatic Order Fill, Header Layout & Stock Detail Speed - 2026-11-03 (completed)
- **Branch**: `fix/portfolio-ux-discipline-and-stock-detail-speed` (merged to `dev` and `main`, commit `9e131b1`).

## Stock Detail Performance Optimization, Sector Taxonomy & Fundamentals Fallback - 2026-11-03 (completed)
- **Branch**: `fix/stock-detail-performance-sectors-and-pe-pb` (merged to `dev` and `main`).

## Live Production Deployment & E2E System Verification - 2026-11-03 (completed)
- User Request: Test E2E web deployed tren Render va bao cao ket qua.
- Status: 15/15 E2E endpoints passed 100%, Backend and Frontend Live.
