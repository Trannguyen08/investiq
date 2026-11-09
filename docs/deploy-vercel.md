# Hướng Dẫn Triển Khai InvestIQ: Frontend Vercel + Backend Render + Neon.tech DB (100% Free & Always-On 24/7)

Tài liệu này hướng dẫn chi tiết từng bước cách đưa toàn bộ hệ thống **InvestIQ** lên Cloud theo kiến trúc tối ưu:
- **Frontend**: **Vercel** (Hobby Free — Next.js 16 App Router, Edge CDN Singapore, tốc độ mở trang tức thì < 50ms, 0 giây Cold Start, không bao giờ ngủ đông).
- **Backend**: **Render** (Web Service Free Tier — FastAPI Python 3.13, máy chủ Singapore `ap-southeast-1`, kết hợp cơ chế Keep-Alive tự động để **hoạt động liên tục 24/7 không bao giờ ngủ đông**).
- **Database**: **Neon.tech** (PostgreSQL Serverless 16/17 — Region Singapore `aws-ap-southeast-1`, 0.5GB dung lượng, **miễn phí vĩnh viễn**, tích hợp Connection Pooling).
- **Anti-Sleep Monitor**: **UptimeRobot** / **GitHub Actions Keep-Alive** (Ping `GET /healthz` định kỳ mỗi 5–10 phút để giữ Render luôn thức).

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

```mermaid
flowchart TD
    subgraph Client ["Khách Hàng / Trình Duyệt"]
        User["Người dùng cuối (Desktop / Mobile Browser)"]
    end

    subgraph VercelCDN ["Vercel Global Edge Network (Free Tier - 0s Cold Start)"]
        NextFront["Next.js 16 Frontend\nhttps://investiq-xxx.vercel.app"]
        BFF["BFF Server Routes\n/auth-api, /portfolio-api, /ai-api"]
        Rewrites["Next.js Proxy Rewrites\n/api/:path* -> Render Backend"]
    end

    subgraph AntiSleepLayer ["Cơ Chế Giữ Backend Luôn Thức 24/7 (Free)"]
        Bot["UptimeRobot / GitHub Actions Keep-Alive\n(Ping /healthz mỗi 5-10 phút)"]
    end

    subgraph RenderCloud ["Render.com (Free Tier - Always-On 24/7)"]
        FastAPI["FastAPI Backend (Singapore)\nhttps://investiq-backend-xxx.onrender.com"]
        Health["Liveness Check (/healthz)"]
        AutoMigrate["Auto Migration Runner\n(AUTO_MIGRATE=true)"]
    end

    subgraph NeonCloud ["Neon.tech Database (Free Vĩnh Viễn)"]
        PostgresDB["PostgreSQL 16/17 (Singapore ap-southeast-1)\nConnection Pooling (Port 5432)"]
    end

    User -->|HTTPS GET/POST < 50ms| NextFront
    NextFront --> BFF
    NextFront --> Rewrites
    BFF -->|Secure HTTPS / Auth BFF Token| FastAPI
    Rewrites -->|Reverse Proxy API| FastAPI
    User -.->|WSS Realtime Ticker| FastAPI
    Bot -.->|Ping định kỳ 5 phút| Health
    AutoMigrate -->|Apply Forward SQL| PostgresDB
    FastAPI -->|psycopg SSL Pool Connection < 15ms| PostgresDB
```

### Tại sao giải pháp này tối ưu hơn Render Free thông thường?
1. **Triệt tiêu 100% tình trạng chờ 30-50s (Cold Start)**:
   - Render Free thông thường sẽ tắt máy chủ (spin down) sau 15 phút không có request. Khi người dùng vào lại web phải đợi 30-50s để khởi động lại container.
   - Khi thiết lập UptimeRobot (hoặc GitHub Actions Keep-Alive) ping endpoint `/healthz` mỗi 5 phút một lần, Render sẽ nhận traffic liên tục $\rightarrow$ **Backend Render sẽ THỨC 24/7, không bao giờ ngủ đông**.
   - Vercel là mạng lưới máy chủ Edge CDN sinh ra bởi chính đội ngũ Next.js: **0ms độ trễ khởi động**.
2. **Chi phí $0.00 trọn đời**:
   - Vercel: Miễn phí gói Hobby.
   - Render: Miễn phí 1 Web Service Free Tier.
   - Neon.tech: Miễn phí vĩnh viễn 1 Project Postgres (không bị giới hạn 30 ngày như Render Postgres).
   - UptimeRobot: Miễn phí theo dõi 50 monitors (chu kỳ 5 phút).

---

## 2. Chuẩn Bị & Bộ Biến Môi Trường (Environment Variables)

### 2.1. Sinh bộ Key bảo mật ngẫu nhiên cho Production
Dự án đã tích hợp sẵn script PowerShell để kiểm tra công cụ CLI và tự động sinh toàn bộ các khóa mã hóa bảo mật chuẩn mật mã học:

```powershell
./scripts/deploy-setup.ps1
```

Script sẽ in ra bộ Key hoàn chỉnh để bạn copy trực tiếp vào Render và Vercel.

---

### 2.2. Ma Trận Biến Môi Trường

#### A. Dành cho Backend (Render)
| Biến môi trường | Giá trị mẫu / Hướng dẫn | Bắt buộc |
| :--- | :--- | :---: |
| `APP_ENV` | `production` | Có |
| `PORT` | `8000` (hoặc `10000`) | Có |
| `DATABASE_URL` | Chuỗi kết nối từ Neon.tech (kèm `?sslmode=require`) | Có |
| `AUTO_MIGRATE` | `true` *(tự động cập nhật bảng DB khi container khởi động)* | Có |
| `SECRET_KEY` | Chuỗi 32 ký tự ngẫu nhiên từ script `deploy-setup.ps1` | Có |
| `AUTH_ENABLED` | `true` *(hoặc `false` nếu chưa bật đăng nhập)* | Có |
| `AUTH_BFF_SECRET` | Chuỗi 36 ký tự ngẫu nhiên (phải khớp tuyệt đối với Frontend) | Có |
| `AUTH_JWT_SECRET` | Chuỗi 36 ký tự ngẫu nhiên | Có |
| `AUTH_OTP_HMAC_KEY` | Chuỗi 36 ký tự ngẫu nhiên | Có |
| `AUTH_SESSION_ENCRYPTION_KEY` | Chuỗi 32 ký tự ngẫu nhiên (phải khớp tuyệt đối với Frontend) | Có |
| `AUTH_PAYLOAD_ENCRYPTION_KEY` | Khóa Fernet base64 32 bytes | Có |
| `MARKET_DATA_MODE` | `vnstock` *(dữ liệu thật sàn VN)* hoặc `fixture` | Có |
| `NEWS_INGESTION_ENABLED` | `false` | Có |
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000` *(Backend đã tự động cho phép mọi domain `*.vercel.app` và `*.onrender.com`)* | Tùy chọn |

#### B. Dành cho Frontend (Vercel)
| Biến môi trường | Giá trị mẫu / Hướng dẫn | Bắt buộc |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | Có |
| `API_INTERNAL_BASE_URL` | `https://<ten-backend>.onrender.com/api` | Có |
| `INTERNAL_API_URL` | `https://<ten-backend>.onrender.com/api` | Có |
| `NEXT_PUBLIC_API_URL` | `/api` | Có |
| `NEXT_PUBLIC_MARKET_WS_URL` | `wss://<ten-backend>.onrender.com/ws/v1/market` | Có |
| `AUTH_BFF_SECRET` | Chuỗi 36 ký tự (phải trùng khớp với Backend) | Có |
| `AUTH_SESSION_ENCRYPTION_KEY` | Chuỗi 32 ký tự (phải trùng khớp với Backend) | Có |
| `ADMIN_UI_PASSWORD` | Mật khẩu quản trị bạn chọn (VD: `Admin@InvestIQ2026!`) | Có |
| `ADMIN_SESSION_SECRET` | Chuỗi ngẫu nhiên 32 ký tự | Có |

---

## 3. Bước 1: Khởi Tạo Cơ Sở Dữ Liệu Miễn Phí Trên Neon.tech

1. Truy cập **[Neon.tech](https://neon.tech)** và nhấn **Sign up** (chọn **Continue with GitHub**).
2. Nhấn **Create project**:
   - **Name**: `investiq`
   - **Postgres version**: `16` hoặc `17`
   - **Region**: Chọn **Asia Pacific (Singapore) - `aws-ap-southeast-1`** (tối ưu tốc độ phản hồi < 15ms tại Việt Nam).
3. Sau khi tạo xong, tại màn hình **Dashboard**:
   - Bật tích chọn ô **Connection pooling** (chuỗi kết nối sẽ có đuôi `-pooler`).
   - Sao chép chuỗi kết nối:
     ```text
     postgresql://neondb_owner:MAT_KHAU_CUA_BAN@ep-cool-fog-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```

> [!NOTE]
> Nhờ tính năng `AUTO_MIGRATE=true` đã được bổ sung trong `backend/Dockerfile`, bạn **không cần chạy migration thủ công** từ máy. Khi Backend khởi động trên Render lần đầu tiên, nó sẽ tự động chạy tất cả 14 file SQL migration vào database Neon!

---

## 4. Bước 2: Triển Khai Backend Lên Render (Web Service Singapore)

1. Đăng nhập [dashboard.render.com](https://dashboard.render.com).
2. Nhấn **New +** $\rightarrow$ **Web Service** $\rightarrow$ Kết nối repository `investiq`.
3. Cấu hình dịch vụ:
   - **Name**: `investiq-backend`
   - **Region**: Chọn **Singapore** (cùng khu vực với Neon Database).
   - **Root Directory**: `backend`
   - **Runtime**: `Docker` (hoặc `Python`)
   - **Instance Type**: `Free`
4. Trong mục **Environment Variables**, thêm toàn bộ các biến ở [Mục 2.2.A](#a-dành-cho-backend-render).
   - Đảm bảo dán đúng `DATABASE_URL` từ Neon.tech (kèm `?sslmode=require`) và đặt `AUTO_MIGRATE=true`.
5. Trong mục **Advanced Settings**:
   - **Health Check Path**: `/healthz`
6. Nhấn **Create Web Service**.

Sau khi build xong (khoảng 2–3 phút), trạng thái chuyển sang **Live**. Bạn sẽ nhận được đường link:
```text
https://<ten-backend>.onrender.com
```

### Kiểm tra Backend hoạt động
Mở trình duyệt truy cập:
- `https://<ten-backend>.onrender.com/healthz` $\rightarrow$ Trả về `{"status":"ok"}`.
- `https://<ten-backend>.onrender.com/api/v1/status` $\rightarrow$ Trả về `{"service":"investiq-backend","status":"ok"}`.
- `https://<ten-backend>.onrender.com/docs` $\rightarrow$ Mở Swagger UI của FastAPI.

---

## 5. Bước 3: Thiết Lập Anti-Sleep Giữ Backend Thức 24/7 (1 Phút Cài Đặt)

Để Render **không bao giờ ngủ đông sau 15 phút**, ta thiết lập ping tự động:

1. Đăng ký tài khoản miễn phí tại **[UptimeRobot.com](https://uptimerobot.com)**.
2. Nhấn **Add New Monitor**:
   - **Monitor Type**: Chọn `HTTP(s)`
   - **Friendly Name**: `InvestIQ Backend Ping`
   - **URL (or IP)**: `https://<ten-backend>.onrender.com/healthz`
   - **Monitoring Interval**: `5 minutes`
3. Nhấn **Create Monitor**.

*(Dự phòng: Repository cũng đã tích hợp sẵn GitHub Actions Keep-Alive tại `.github/workflows/keepalive.yml` chạy tự động mỗi 14 phút một lần).*

$\rightarrow$ Kể từ lúc này, Backend Render sẽ nhận tín hiệu liên tục mỗi 5 phút, **hoạt động 24/7 không có độ trễ khởi động**.

---

## 6. Bước 4: Triển Khai Frontend Lên Vercel (Edge CDN Tức Thì)

1. Đăng nhập **[Vercel.com](https://vercel.com)** bằng tài khoản GitHub.
2. Nhấn **Add New...** $\rightarrow$ Chọn **Project** $\rightarrow$ Import repository `investiq`.
3. Cấu hình dự án:
   - **Framework Preset**: Tự động nhận diện `Next.js`.
   - **Root Directory**: Nhấn nút **Edit** và chọn thư mục `frontend` (BẮT BUỘC).
   - **Build Command**: Giữ mặc định `npm run build`.
   - **Output Directory**: Giữ mặc định `.next`.
4. Thêm Biến môi trường (Environment Variables):
   - Thêm toàn bộ các biến ở [Mục 2.2.B](#b-dành-cho-frontend-vercel):
     - `API_INTERNAL_BASE_URL`: `https://<ten-backend>.onrender.com/api`
     - `INTERNAL_API_URL`: `https://<ten-backend>.onrender.com/api`
     - `NEXT_PUBLIC_API_URL`: `/api`
     - `NEXT_PUBLIC_MARKET_WS_URL`: `wss://<ten-backend>.onrender.com/ws/v1/market`
     - `AUTH_BFF_SECRET`: *(Dán mã trùng với Backend)*
     - `AUTH_SESSION_ENCRYPTION_KEY`: *(Dán mã trùng với Backend)*
     - `ADMIN_UI_PASSWORD`: `Admin@InvestIQ2026!`
     - `ADMIN_SESSION_SECRET`: *(Dán mã từ deploy-setup.ps1)*
5. Nhấn **Deploy**!

Ứng dụng sẽ build hoàn tất trong ~60 giây với URL chính thức:
```text
https://investiq-<tên-user>.vercel.app
```

---

## 7. Bước 5: Cấu Hình Google OAuth (Nếu Dùng Đăng Nhập Bằng Google)

1. Truy cập **[Google Cloud Console](https://console.cloud.google.com)** $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials**.
2. Chọn OAuth 2.0 Client ID loại Web Application.
3. **Authorized JavaScript origins**:
   - Thêm: `https://<tên-trang-web>.vercel.app` *(KHÔNG có dấu gạch chéo `/` ở cuối)*.
4. **Authorized redirect URIs**:
   - Thêm: `https://<tên-trang-web>.vercel.app/auth-api/google/callback`.
5. Nhấn **Save**.
6. Cập nhật biến môi trường:
   - Trên **Vercel**: Thêm `AUTH_GOOGLE_CLIENT_ID` và `AUTH_GOOGLE_REDIRECT_URI=https://<tên-trang-web>.vercel.app/auth-api/google/callback`.
   - Trên **Render**: Thêm `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`, và `AUTH_GOOGLE_REDIRECT_URI=https://<tên-trang-web>.vercel.app/auth-api/google/callback`.

---

## 8. Bước 6: Kiểm Tra Toàn Diện Hệ Thống (Smoke Test Checklist)

| Hạng mục kiểm tra | Thao tác thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- |
| **Backend Liveness** | Mở `https://<backend>.onrender.com/healthz` | Trả về `{"status":"ok"}` ngay lập tức (< 100ms) |
| **Trang chủ InvestIQ** | Mở `https://<frontend>.vercel.app/` | Tải trang tức thì, giao diện Dark theme hiển thị mượt mà |
| **Bảng giá thị trường** | Vào tab **Thị trường** (`/market`) | Nạp danh sách mã chứng khoán VN30, nến OHLCV hiển thị đầy đủ |
| **Chi tiết cổ phiếu** | Bấm vào 1 mã (ví dụ `HPG`, `SSI`) | Biểu đồ nến và các tab Báo cáo tăng trưởng, BCTC hiển thị chính xác |
| **Paper Trading** | Vào tab **Danh mục** (`/portfolio`) | Số dư 100M VND hiển thị chuẩn, đặt lệnh mô phỏng khớp mượt mà |
| **Khớp lệnh tức thì** | Bấm toggle "Khớp tức thì 24/7" | Switch chuyển trạng thái tức thì 0ms, không báo lỗi 503 |
| **Trợ lý AI InvestIQ** | Mở drawer Chat AI, hỏi: *"so sánh hpg và vcb"* | AI phản hồi phân tích so sánh đầy đủ kèm widget |
