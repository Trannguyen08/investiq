# Hướng Dẫn Triển Khai InvestIQ Theo Phương Án 1: Vercel + Koyeb + Neon.tech (100% Free & Always-On 24/7)

Tài liệu này hướng dẫn chi tiết từng bước cách đưa toàn bộ hệ thống **InvestIQ** lên Cloud theo **Phương án 1**:
- **Frontend**: **Vercel** (Hobby Free - Next.js 16 App Router, Edge CDN Singapore, tốc độ mở trang tức thì < 50ms, 0 giây Cold Start, không bao giờ ngủ đông).
- **Backend**: **Koyeb** (Free Eco - FastAPI Python 3.13, Dockerfile container hóa, **hoạt động liên tục 24/7 không có cơ chế spin-down/ngủ đông**, không cần ping giữ ấm).
- **Database**: **Neon.tech** (PostgreSQL Serverless 16/17, Region Singapore `aws-ap-southeast-1`, 0.5GB dung lượng, **miễn phí vĩnh viễn**, tích hợp Connection Pooling).
- **Cache/Session** *(Tùy chọn)*: **Upstash Redis** (Serverless Redis Free 10,000 commands/ngày).

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
        Rewrites["Next.js Proxy Rewrites\n/api/:path* -> Koyeb Backend"]
    end

    subgraph KoyebCloud ["Koyeb Cloud (Free Tier - Always-On 24/7 Không Ngủ)"]
        FastAPI["FastAPI Backend (Port 8000)\nhttps://investiq-backend-xxx.koyeb.app"]
        Health["Liveness Check (/healthz)"]
        AutoMigrate["Auto Migration Runner\n(AUTO_MIGRATE=true)"]
    end

    subgraph NeonCloud ["Neon.tech Database (Free Vĩnh Viễn)"]
        PostgresDB["PostgreSQL 16/17 (Singapore ap-southeast-1)\nConnection Pooling (Port 5432)"]
    end

    User -->|HTTPS GET/POST| NextFront
    NextFront --> BFF
    NextFront --> Rewrites
    BFF -->|Secure HTTPS / Auth BFF Token| FastAPI
    Rewrites -->|Reverse Proxy API| FastAPI
    User -.->|WSS Realtime Ticker| FastAPI
    AutoMigrate -->|Apply Forward SQL| PostgresDB
    FastAPI -->|psycopg SSL Pool Connection| PostgresDB
```

### Tại sao giải pháp này tối ưu hơn Render Free thông thường?
1. **Triệt tiêu 100% tình trạng chờ 30-50s (Cold Start)**:
   - Render Free sẽ tự động tắt máy chủ (spin down) sau 15 phút không có request. Khi người dùng vào lại web phải đợi 30-50s để Render khởi động lại.
   - Vercel là nền tảng máy chủ Serverless Edge CDN sinh ra bởi chính đội ngũ phát triển Next.js: **0ms độ trễ khởi động**.
   - Koyeb Free Tier duy trì tiến trình **chạy liên tục 24/7 không bao giờ ngủ**, phản hồi tức thì mọi request từ Vercel.
2. **Chi phí $0.00 trọn đời**:
   - Vercel: Miễn phí gói Hobby.
   - Koyeb: Miễn phí 1 Web Service Free Tier.
   - Neon.tech: Miễn phí vĩnh viễn 1 Project Postgres (không bị giới hạn 30 ngày như Render Postgres).

---

## 2. Chuẩn Bị & Bộ Biến Môi Trường (Environment Variables)

### 2.1. Sinh bộ Key bảo mật ngẫu nhiên cho Production
Dự án đã tích hợp sẵn script PowerShell để kiểm tra công cụ CLI và tự động sinh toàn bộ các khóa mã hóa bảo mật chuẩn mật mã học:

```powershell
./scripts/deploy-setup.ps1
```

Script sẽ in ra bộ Key hoàn chỉnh để bạn copy trực tiếp vào Koyeb và Vercel.

---

### 2.2. Ma Trận Biến Môi Trường

#### A. Dành cho Backend (Koyeb)
| Biến môi trường | Giá trị mẫu / Hướng dẫn | Bắt buộc |
| :--- | :--- | :---: |
| `APP_ENV` | `production` | Có |
| `PORT` | `8000` | Có |
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
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000` *(Backend đã tự động cho phép mọi domain `*.vercel.app` và `*.koyeb.app`)* | Tùy chọn |

#### B. Dành cho Frontend (Vercel)
| Biến môi trường | Giá trị mẫu / Hướng dẫn | Bắt buộc |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | Có |
| `API_INTERNAL_BASE_URL` | `https://<ten-backend>.koyeb.app/api` | Có |
| `INTERNAL_API_URL` | `https://<ten-backend>.koyeb.app/api` | Có |
| `NEXT_PUBLIC_API_URL` | `/api` | Có |
| `NEXT_PUBLIC_MARKET_WS_URL` | `wss://<ten-backend>.koyeb.app/ws/v1/market` | Có |
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
> Nhờ tính năng `AUTO_MIGRATE=true` đã được bổ sung trong `backend/Dockerfile`, bạn **không cần chạy migration thủ công** từ máy. Khi Backend khởi động trên Koyeb lần đầu tiên, nó sẽ tự động chạy tất cả 14 file SQL migration vào database Neon!
> Nếu vẫn muốn chạy thử migration từ local để kiểm tra trước, bạn chỉ cần gõ trong PowerShell:
> ```powershell
> cd backend
> $env:DATABASE_URL="<chuỗi-kết-nối-neon>"
> .\.venv313\Scripts\python.exe -m app.infrastructure.db.base
> ```

---

## 4. Bước 2: Triển Khai Backend Lên Koyeb (Always-On 24/7)

### 4.1. Đăng ký tài khoản Koyeb
1. Truy cập **[Koyeb.com](https://app.koyeb.com)** và đăng ký tài khoản miễn phí (chọn **Sign in with GitHub**).
2. Xác thực email và hoàn tất thiết lập tài khoản.

### 4.2. Khởi tạo Web Service cho Backend
1. Tại màn hình chính của Koyeb, nhấn **Create Service**.
2. Chọn nguồn triển khai: **GitHub**.
3. Chọn repository của bạn: `investiq` (cấp quyền truy cập cho Koyeb nếu được hỏi).
4. Thiết lập cấu hình triển khai:
   - **Branch**: Chọn nhánh bạn muốn deploy (ví dụ: `deploy/vercel-koyeb` hoặc nhánh chính của bạn).
   - **Build and deployment method**: Chọn **Dockerfile**.
   - **Dockerfile location**: Điền `./backend/Dockerfile`.
5. Thiết lập Instance & Khu vực (Regions):
   - **Instance type**: Chọn **Free** (`eco-nano`, 0.1 vCPU, 512 MB RAM, $0.00/tháng vĩnh viễn).
   - **Regions**: Chọn **Frankfurt (`fra`)** hoặc **Washington, D.C. (`was`)** (đây là 2 khu vực hỗ trợ 100% Free Tier không giới hạn thời gian của Koyeb).
6. Thiết lập Mạng & Cổng (Networking & Ports):
   - **Port**: Điền `8000`.
   - **Protocol**: `HTTP`.
   - **Path**: `/`.
7. Thiết lập Kiểm tra sức khỏe (Health checks):
   - Nhấn **Add health check**.
   - **Type**: `HTTP`.
   - **Path**: `/healthz`.
   - **Port**: `8000`.
8. Điền các Biến môi trường (Environment Variables):
   - Nhấn **Add variable** và thêm toàn bộ các cặp biến môi trường ở [Mục 2.2.A](#a-dành-cho-backend-koyeb).
   - Đảm bảo dán đúng `DATABASE_URL` từ Neon.tech và đặt `AUTO_MIGRATE=true`.
9. Đặt tên Service:
   - **App name**: `investiq`
   - **Service name**: `investiq-backend`
10. Nhấn **Deploy**.

Koyeb sẽ tiến hành build Dockerfile và khởi chạy. Khi hoàn tất (khoảng 2-3 phút), trạng thái chuyển sang **Healthy**.
Bạn sẽ nhận được một đường link công khai, ví dụ:
```text
https://investiq-backend-<tên-ngẫu-nhiên>.koyeb.app
```

### 4.3. Kiểm tra Backend hoạt động
Mở trình duyệt truy cập:
- `https://<tên-backend>.koyeb.app/healthz` $\rightarrow$ Trả về `{"status":"ok"}`.
- `https://<tên-backend>.koyeb.app/api/v1/status` $\rightarrow$ Trả về `{"service":"investiq-backend","status":"ok"}`.
- `https://<tên-backend>.koyeb.app/docs` $\rightarrow$ Mở Swagger UI của FastAPI.

---

## 5. Bước 3: Triển Khai Frontend Lên Vercel (Edge CDN Tức Thì)

Vercel là nền tảng tối ưu nhất thế giới cho Next.js, tự động tối ưu hình ảnh, Server Components và định tuyến.

### 5.1. Triển khai qua Vercel Dashboard (Giao diện Web khuyên dùng)
1. Truy cập **[Vercel.com](https://vercel.com)** và đăng nhập bằng tài khoản GitHub.
2. Nhấn **Add New...** $\rightarrow$ Chọn **Project**.
3. Tìm và chọn repository `investiq` $\rightarrow$ Nhấn **Import**.
4. Cấu hình dự án (Project Configuration):
   - **Framework Preset**: Tự động nhận diện là `Next.js`.
   - **Root Directory**: Nhấn nút **Edit** và chọn thư mục `frontend` (BẮT BUỘC).
   - **Build Command**: Giữ mặc định `npm run build`.
   - **Output Directory**: Giữ mặc định `.next`.
   - **Install Command**: Giữ mặc định `npm install` (hoặc `npm ci`).
5. Thêm Biến môi trường (Environment Variables):
   - Kéo xuống mục **Environment Variables**.
   - Thêm tất cả các biến đã liệt kê ở [Mục 2.2.B](#b-dành-cho-frontend-vercel):
     - `API_INTERNAL_BASE_URL`: `https://<tên-backend>.koyeb.app/api`
     - `INTERNAL_API_URL`: `https://<tên-backend>.koyeb.app/api`
     - `NEXT_PUBLIC_API_URL`: `/api`
     - `NEXT_PUBLIC_MARKET_WS_URL`: `wss://<tên-backend>.koyeb.app/ws/v1/market`
     - `AUTH_BFF_SECRET`: *(Dán mã trùng với Backend)*
     - `AUTH_SESSION_ENCRYPTION_KEY`: *(Dán mã trùng với Backend)*
     - `ADMIN_UI_PASSWORD`: `Admin@InvestIQ2026!`
     - `ADMIN_SESSION_SECRET`: *(Dán mã từ deploy-setup.ps1)*
6. Nhấn **Deploy**!

Vercel sẽ build ứng dụng trong ~60 giây. Khi xong, bạn sẽ thấy màn hình pháo hoa chúc mừng kèm đường link trang web chính thức:
```text
https://investiq-<tên-user>.vercel.app
```

---

### 5.2. Tùy chọn: Triển khai qua Vercel CLI (Dành cho dòng lệnh)
Nếu bạn thích làm việc trên terminal, máy bạn đã cài sẵn Vercel CLI:

```powershell
# 1. Đăng nhập Vercel từ terminal
vercel login

# 2. Di chuyển vào thư mục frontend
cd frontend

# 3. Liên kết và deploy lên Vercel Production
vercel --prod
```

CLI sẽ hỏi bạn:
- `Set up and deploy?`: Nhấn `y`
- `Which scope?`: Chọn tài khoản của bạn
- `Link to existing project?`: Nhấn `n` (hoặc `y` nếu đã tạo)
- `What's your project's name?`: `investiq`
- `In which directory is your code located?`: `./`

---

## 6. Bước 4: Cấu Hình Google OAuth (Nếu Sử Dụng Đăng Nhập Bằng Google)

Nếu bạn muốn người dùng có thể bấm nút "Đăng nhập bằng Google" trên trang Vercel:

1. Truy cập **[Google Cloud Console](https://console.cloud.google.com)**.
2. Vào **APIs & Services** $\rightarrow$ **Credentials**.
3. Nhấp vào OAuth 2.0 Client ID loại Web Application của dự án.
4. Tại mục **Authorized JavaScript origins**:
   - Thêm: `https://<tên-trang-web>.vercel.app` *(KHÔNG có dấu gạch chéo `/` ở cuối)*.
5. Tại mục **Authorized redirect URIs**:
   - Thêm: `https://<tên-trang-web>.vercel.app/auth-api/google/callback` *(BẮT BUỘC có `/auth-api/google/callback`)*.
6. Nhấn **Save**.
7. Cập nhật biến môi trường:
   - Trên **Vercel**: Thêm `AUTH_GOOGLE_CLIENT_ID` và `AUTH_GOOGLE_REDIRECT_URI=https://<tên-trang-web>.vercel.app/auth-api/google/callback`.
   - Trên **Koyeb**: Thêm `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`, và `AUTH_GOOGLE_REDIRECT_URI=https://<tên-trang-web>.vercel.app/auth-api/google/callback`.

---

## 7. Bước 5: Kiểm Tra Toàn Diện Hệ Thống (Smoke Test Checklist)

Sau khi deploy xong, hãy thực hiện kiểm tra nhanh theo danh sách dưới đây:

| Hạng mục kiểm tra | Thao tác thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- |
| **Backend Liveness** | Mở `https://<backend>.koyeb.app/healthz` | Trả về `{"status":"ok"}` ngay lập tức (< 100ms) |
| **Trang chủ InvestIQ** | Mở `https://<frontend>.vercel.app/` | Tải trang tức thì, giao diện Dark theme hiển thị mượt mà |
| **Bảng giá thị trường** | Vào tab **Thị trường** (`/market`) | Nạp danh sách mã chứng khoán VN30, nến OHLCV hiển thị đầy đủ |
| **Chi tiết cổ phiếu** | Bấm vào 1 mã (ví dụ `HPG`, `SSI`) | Biểu đồ nến và các tab Báo cáo tăng trưởng, BCTC hiển thị chính xác |
| **Paper Trading** | Vào tab **Danh mục** (`/portfolio`) | Số dư 100M VND hiển thị chuẩn, đặt lệnh mô phỏng khớp mượt mà |
| **Khớp lệnh tức thì** | Bấm toggle "Khớp tức thì 24/7" | Switch chuyển trạng thái tức thì 0ms, không báo lỗi 503 |
| **Trợ lý AI InvestIQ** | Mở drawer Chat AI, hỏi: *"so sánh hpg và vcb"* | AI phản hồi phân tích so sánh đầy đủ kèm widget |

---

## 8. Tóm Tắt Khắc Phục Sự Cố (Troubleshooting)

1. **Lỗi `503 Service Unavailable` tại `/portfolio-api` hoặc `/auth-api`**:
   - Kiểm tra `API_INTERNAL_BASE_URL` trên Vercel: Đảm bảo có đuôi `/api` (ví dụ: `https://investiq-backend-xxx.koyeb.app/api`).
   - Kiểm tra `AUTH_BFF_SECRET` trên cả Vercel và Koyeb: Hai bên phải có giá trị hoàn toàn giống nhau.
2. **Lỗi kết nối database `no pg_hba.conf entry ... SSL off`**:
   - Chuỗi kết nối `DATABASE_URL` trên Koyeb bắt buộc phải có đuôi `?sslmode=require`.
3. **Database bị thiếu bảng dữ liệu**:
   - Đảm bảo đã đặt biến `AUTO_MIGRATE=true` trong tab Environment của Koyeb Service. Khi restart service, Koyeb sẽ tự chạy các file SQL migration từ `0001` đến `0014`.
4. **Thay đổi mã nguồn**:
   - Khi bạn push code mới lên nhánh đã liên kết trên GitHub, cả Koyeb và Vercel sẽ tự động build và deploy phiên bản mới nhất hoàn toàn tự động!
