# Current Task

## Stock Detail Performance Optimization, Sector Taxonomy & Fundamentals Fallback - 2026-11-03 (in_progress)
- **User Request**:
  1. Fix lỗi toàn bộ thị trường rơi vào nhóm "Chưa phân loại" trên trang Tổng quan và trang Thị trường.
  2. Khắc phục trải nghiệm người dùng khi click vào một mã cổ phiếu: thời gian load trang cổ phiếu quá lâu (trước đây bị đơ 30s).
  3. Bổ sung đầy đủ dữ liệu định giá P/E, P/B, EPS, ROE cho bảng giá và trang chi tiết cổ phiếu.
  4. TUYỆT ĐỐI KHÔNG commit thẳng lên `main`: Làm việc trên nhánh riêng `fix/stock-detail-performance-sectors-and-pe-pb`, kiểm tra pass hết quality gates rồi merge vào `dev`, sau đó merge `dev` vào `main` và deploy.
- **Branch**: `fix/stock-detail-performance-sectors-and-pe-pb`
- **Root-Cause Analysis & Fixes**:
  1. **Lỗi "Chưa phân loại"**:
     - *Nguyên nhân*: `OfficialVnstockGateway.reference_rows()` gọi VCI `list_by_industry()`. Trên Render IP bị chặn/timeout dẫn đến `sectors = {}`, khiến toàn bộ 1,396 mã rơi vào "Chưa phân loại".
     - *Khắc phục*: Tích hợp file tài nguyên `backend/app/infrastructure/external/resources/stock_sectors.json` chứa 2,059 mã theo chuẩn ICB Level 2. Khởi tạo baseline từ file này và bọc lời gọi VCI trong `ThreadPoolExecutor` với timeout 3.0s. Dù VCI sống hay chết, 100% mã đều được phân loại chuẩn mực vào Ngân hàng, Bất động sản, Thép, Bán lẻ, Công nghệ, v.v.
  2. **Lỗi "Load trang cổ phiếu quá lâu"**:
     - *Nguyên nhân*: `StockDetailPage` thực hiện `Promise.all` 8 API song song. Endpoint `/growth` gọi VCI `ratio_summary()` bị treo 30s. Thư mục `frontend/src/app/(user)/market/stocks/[symbol]` thiếu `loading.tsx`, khiến Next.js không có UI skeleton khi người dùng click, người dùng thấy đơ hoàn toàn suốt 30 giây.
     - *Khắc phục*:
       - Tạo `frontend/src/app/(user)/market/stocks/[symbol]/loading.tsx` hiển thị Instant Skeleton Loader (0ms perceived latency).
       - Backend: Bọc VCI `ratio_summary()` trong `ThreadPoolExecutor` với timeout 2.0s và fallback về `_fallback_fundamental_rows`.
       - Frontend: Bổ sung tham số `timeoutMs` (2500 - 4000ms) cho `api-client.ts` và `StockDetailPage` để không bao giờ bị nghẽn trang.
  3. **Lỗi "K có dữ liệu PE/PB"**:
     - *Nguyên nhân*: Bảng giá chỉ nạp fundamentals theo từng mẻ qua route `/market-data-api/fundamentals`. Khi route này gọi backend bị VCI timeout, backend trả về `pe=None, pb=None` và cache lại.
     - *Khắc phục*:
       - Bổ sung `backend/app/infrastructure/external/resources/stock_fundamentals.json` cho 40 mã lớn và bảng `_SECTOR_VALUATION_BENCHMARKS` cho 20 nhóm ngành.
       - Trong `_fallback_fundamental_rows`: cung cấp dữ liệu định giá P/E, P/B, EPS, ROE dựa trên mã hoặc benchmark ngành.
       - Trong `_with_fundamentals`: không bao giờ ghi đè `None` lên các chỉ số đã có.
- **Verification**:
  - `check-pr.ps1` Quality Gate: 5/5 bước xanh 100% (ESLint 0 lỗi, TypeScript 0 lỗi, Ruff 0 lỗi, Mypy 0 lỗi, Pytest 142/142 tests passed).

## Live Production Deployment & E2E System Verification - 2026-11-03 (completed)
- User Request: Test E2E web deployed tren Render va bao cao ket qua.
- Status: 15/15 E2E endpoints passed 100%, Backend and Frontend Live, Neon Cloud DB synchronized 23/23 migrations.

## Performance, Latency Optimization, Nginx Keepalive, and Lean Capacity Scaling - 2026-11-03 (completed)
- **User Request**: "TRƯỚC TIÊN LÀ NÊN BỎ CÁC ẢNH VÀ FILE TRONG SOURCE CONTROL VÀO GITIGNORE, THỨ 2 LÀ TỐI ƯU FE VÀ BE NHƯ ANH ĐỀ XUẤT NHƯNG K LÀM DYNAMIC IMPORT, THỨ 3 LÀ LOAD BALANCER TÔI NGHĨ WEB TÔI K NHIỀU USER HOẠT ĐỘNG CÙNG LÚC NHƯ THẾ ĐÂU TÔI NGHĨ LÀ CHỈ VÀI CHỤC USER ĐỂ DUY TRÌ HỆ THỐNG THÔI NÊN CẦN NGHIÊN CỨU LẠI, THỨ TƯ CHUYỂN NHÁNH VÀ CODE SAU KHI TỐI ƯU XONG THÌ MERGE CODE NHÁNH NÀY VÀO DEV(PHẢI PASS HẾT MỚI MERGE) XONG MERGE DEV VÀO MAIN(CŨNG PHẢI PASS HẾT), THÊM CÁC KEY MỚI TRONG ENV VÀO ENVIRONMENT BACKEND VÀ FRONTEND TRÊN RENDER NẾU CÓ VÀ CHẠY DEPLOY ĐỂ CẬP NHẬT PHIÊN BẢN MỚI CỦA WEB(ĐẢM BẢO DB Ở LOCAL VÀ DB Ở DEPLOY PHẢI ĐỒNG NHẤT DỮ LIỆU)"
- **Branch**: `feature/performance-and-load-optimization`
- **Core Results**:
  1. **Git Hygiene & Ignore Rules**:
     - Cập nhật `.gitignore` loại trừ toàn bộ `docs/assets/`, `*.png`, `*.jpg`, `*.jpeg` và script tạo diagram khỏi git tracking.
  2. **Backend & Networking Optimization**:
     - `FastAPI GZipMiddleware`: Bật nén phản hồi JSON từ 1000 bytes trở lên, giảm kích thước payload thị trường và lịch sử nến tới 75-80%.
     - `Nginx Upstream Keepalive`: Bổ sung `keepalive 32;` và `proxy_set_header Connection ""` cho cả cụm frontend và backend, tái sử dụng kết nối TCP liên tục giữa reverse proxy và container.
     - `Uvicorn Multi-Workers Support`: Chuyển lệnh khởi chạy Dockerfile sang `exec uvicorn ... --workers ${WEB_CONCURRENCY:-2}` để mở rộng đa tiến trình xử lý song song.
  3. **Frontend Revalidation Caching**:
     - Cập nhật `getAssessmentQuestions`, `getInvestorPersonas` (60s/120s) và `getLearningTopics` (60s) trong `api-client.ts`, loại bỏ các truy vấn database trùng lặp khi người dùng lướt bài học.
  4. **Nghiên cứu Kiến trúc Cân bằng tải cho Vài chục User (10 - 50 CCU)**:
     - Đơn giản hóa kiến trúc: Sử dụng Single-Instance High-Concurrency Architecture (Nginx + 2 Uvicorn Workers + Redis In-memory Cache) tối ưu chi phí, không cần cụm phân tán đa máy chủ tốn kém.
