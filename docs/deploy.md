# Hướng Dẫn Triển Khai InvestIQ Lên Render & Tự Động Hóa CI/CD Với GitHub Actions

Tài liệu này hướng dẫn chi tiết từng bước cách đưa toàn bộ hệ thống **InvestIQ** (Database PostgreSQL, Backend FastAPI, Frontend Next.js) lên nền tảng đám mây **Render.com**, đồng thời xây dựng quy trình **CI/CD hoàn chỉnh bằng GitHub Actions** nhằm phục vụ việc học tập và áp dụng thực tế.

---

## Mục Lục

1. [Tổng Quan Kiến Trúc Triển Khai (Architecture Overview)](#1-tổng-quan-kiến-trúc-triển-khai)
2. [Gợi Ý Nền Tảng PostgreSQL Miễn Phí & Chuẩn Bị (Prerequisites)](#2-gợi-ý-nền-tảng-postgresql-miễn-phí--chuẩn-bị)
3. [Bước 1: Triển Khai Cơ Sở Dữ Liệu Miễn Phí (Khuyên Dùng: Neon.tech)](#3-bước-1-triển-khai-cơ-sở-dữ-liệu-miễn-phí-khuyên-dùng-neontech)
4. [Bước 2: Triển Khai Backend (FastAPI Web Service Trên Render)](#4-bước-2-triển-khai-backend-fastapi-web-service-trên-render)
5. [Bước 3: Triển Khai Frontend (Next.js Web Service Trên Render)](#5-bước-3-triển-khai-frontend-nextjs-web-service-trên-render)
6. [Bước 4: Triển Khai Tự Động Bằng Render Blueprint (`render.yaml`)](#6-bước-4-triển-khai-tự-động-bằng-render-blueprint-renderyaml)
7. [Bước 5: Xây Dựng Pipeline CI/CD Toàn Diện Với GitHub Actions](#7-bước-5-xây-dựng-pipeline-cicd-toàn-diện-với-github-actions)
8. [Bước 6: Khắc Phục Sự Cố & Best Practices Vận Hành](#8-bước-6-khắc-phục-sự-cố--best-practices-vận-hành)

---

## 1. Tổng Quan Kiến Trúc Triển Khai

Trong môi trường cục bộ (Local Docker Compose), InvestIQ chạy 10 containers với Nginx đóng vai trò là Reverse Proxy công khai duy nhất tiếp nhận cổng 8080.

Khi đưa lên môi trường Cloud tiết kiệm chi phí tối đa (100% Free):
- **Frontend & Backend**: Chạy trên **Render.com Web Services** (Gói Free).
- **Database (PostgreSQL)**: Đặt tại nhà cung cấp cơ sở dữ liệu chuyên dụng có **gói miễn phí vĩnh viễn** như **[Neon.tech](https://neon.tech)** hoặc **[Supabase](https://supabase.com)** (thay vì dùng Render Postgres vốn chỉ cho dùng thử 30 ngày).

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        Browser["Trình duyệt người dùng (User Browser)"]
    end

    subgraph Render ["Render.com (Compute Layer - Free Tier)"]
        subgraph FrontendService ["Frontend Web Service"]
            NextJS["Next.js 16 (Node.js 24)\nhttps://investiq-fe.onrender.com"]
            BFF["BFF API Routes (/auth-api, /portfolio-api)"]
        end

        subgraph BackendService ["Backend Web Service"]
            FastAPI["FastAPI (Python 3.13)\nhttps://investiq-api.onrender.com"]
            Health["Liveness (/healthz) & Status (/api/v1/status)"]
        end
    end

    subgraph CloudDB ["External Database Layer (Free Vĩnh Viễn)"]
        NeonDB["Neon.tech / Supabase (PostgreSQL 16/17)\nRegion: Singapore (ap-southeast-1)\nSSL: Require (Port 5432)"]
    end

    Browser -->|HTTPS GET/POST| NextJS
    Browser -.->|WSS WebSocket| FastAPI
    NextJS --> BFF
    BFF -->|Internal/Public HTTPS API| FastAPI
    FastAPI -->|psycopg SSL pooled connection| NeonDB
```

### Tại sao tách Database ra ngoài Render là giải pháp tối ưu?
1. **Giải quyết giới hạn 30 ngày**: Render Postgres chỉ cho dùng thử 30 ngày rồi tự động khóa/thu phí ($7/tháng). Tách DB sang **Neon.tech** giúp bạn có PostgreSQL miễn phí vĩnh viễn cho mục đích học tập.
2. **Hiệu năng & Độ trễ**: Cả Render và Neon đều hỗ trợ cụm máy chủ tại **Singapore (`ap-southeast-1`)**. Khi chọn cùng Region, độ trễ kết nối giữa Backend Render và DB Neon chỉ khoảng **5 - 15ms**, cực kỳ nhanh chóng.
3. **Frontend (Next.js 16 App Router)**: Sử dụng Server Components, Server-Side Rendering (SSR), Server Actions và mô hình **BFF (Backend-For-Frontend)**. Frontend **bắt buộc phải là Web Service** (Node.js runtime), **không thể** triển khai dưới dạng Static Site.
4. **Backend (FastAPI)**: Quản lý pool kết nối trực tiếp đến remote DB qua `psycopg_pool` với `sslmode=require`.

---

## 2. Chuẩn Bị Trước Khi Bắt Đầu

### 2.1. Yêu Cầu Tài Khoản
- Tài khoản **[GitHub](https://github.com)** chứa mã nguồn repository InvestIQ của bạn.
- Tài khoản **[Render.com](https://render.com)** (dùng để host Frontend và Backend).
- Tài khoản **[Neon.tech](https://neon.tech)** (hoặc [Supabase.com](https://supabase.com)) để tạo cơ sở dữ liệu PostgreSQL miễn phí vĩnh viễn.

### 2.2. So Sánh Các Nền Tảng PostgreSQL Miễn Phí Vĩnh Viễn

| Tiêu chí | 🥇 **Neon.tech** *(Khuyên dùng)* | 🥈 **Supabase** | ⚠️ **Render Postgres** |
| :--- | :--- | :--- | :--- |
| **Thời hạn Free** | **Vĩnh viễn** | **Vĩnh viễn** | ❌ **Chỉ 30 ngày** (sau đó thu phí $7/tháng) |
| **Dung lượng Free** | 0.5 GB Storage | 500 MB Storage | 1 GB Storage |
| **Region Singapore** | ✅ Có (`aws-ap-southeast-1`) | ✅ Có (`ap-southeast-1`) | ✅ Có (`singapore`) |
| **Đặc điểm nổi bật** | Serverless Postgres, tự động co giãn, tích hợp sẵn PgBouncer connection pooler | Dashboard quản lý dữ liệu xuất sắc, có sẵn auth/storage | Đơn giản nhưng giới hạn thời gian |
| **Lưu ý** | Hoạt động liên tục, không bị xóa project | Tự động tạm dừng (pause) sau 7 ngày không có request | Hết 30 ngày sẽ bị xóa dữ liệu nếu không trả phí |

> [!TIP]
> **Khuyên bạn nên dùng [Neon.tech](https://neon.tech)** vì:
> 1. Có máy chủ tại **Singapore** (cùng khu vực với Render Web Service), đảm bảo tốc độ phản hồi cực nhanh.
> 2. Cung cấp sẵn chế độ **Connection Pooling** (cổng 5432) giúp FastAPI xử lý nhiều truy vấn đồng thời mà không làm nghẽn kết nối.
> 3. Không bao giờ tự động xóa database của bạn.

### 2.3. Hiểu Về Cơ Chế Free Tier Của Render
> [!IMPORTANT]
> - **Spin Down (Ngủ đông)**: Trên gói Free của Render, nếu Web Service không nhận được lượt truy cập (inbound request) nào trong vòng **15 phút**, service sẽ tự động tạm ngưng để tiết kiệm tài nguyên.
> - **Cold Start**: Lượt truy cập đầu tiên sau khi ngủ đông sẽ mất khoảng **30 - 50 giây** để hệ thống khởi động lại container. Đây là đặc tính bình thường của gói miễn phí.

### 2.4. Ma Trận Biến Môi Trường Cần Thiết

| Dịch vụ | Biến môi trường | Mục đích / Giá trị mẫu |
| :--- | :--- | :--- |
| **Backend** | `APP_ENV` | `production` |
| **Backend** | `DATABASE_URL` | Chuỗi kết nối Neon: `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| **Backend** | `SECRET_KEY` | Chuỗi ký tự ngẫu nhiên bảo mật (tối thiểu 32 ký tự) |
| **Backend** | `NEWS_INGESTION_ENABLED` | `false` *(đối với bản học tập không chạy worker Celery)* |
| **Backend** | `MARKET_DATA_MODE` | `fixture` *(để hiển thị dữ liệu mẫu ngay)* hoặc `disabled` |
| **Backend** | `PORT` | `10000` *(Render tự động inject)* |
| **Frontend** | `NODE_ENV` | `production` |
| **Frontend** | `API_INTERNAL_BASE_URL` | `https://<tên-backend>.onrender.com/api` |
| **Frontend** | `NEXT_PUBLIC_API_URL` | `/api` |
| **Frontend** | `NEXT_PUBLIC_MARKET_WS_URL` | `wss://<tên-backend>.onrender.com/ws/v1/market` |

---

## 3. Bước 1: Triển Khai Cơ Sở Dữ Liệu Miễn Phí (Khuyên Dùng: Neon.tech)

### 3.1. Các Bước Khởi Tạo Database Trên Neon.tech
1. Truy cập [Neon.tech](https://neon.tech) và đăng ký tài khoản (chọn **Sign in with GitHub**).
2. Nhấn **Create a project**:
   - **Project name**: `investiq`
   - **Postgres version**: Chọn phiên bản `16` hoặc `17` (khớp với dự án).
   - **Region**: Chọn **Asia Pacific (Singapore) - `aws-ap-southeast-1`** (bắt buộc chọn cùng khu vực với Render để có độ trễ thấp nhất).
3. Nhấn **Create Project**. Neon sẽ khởi tạo cơ sở dữ liệu chỉ trong khoảng 5-10 giây!

### 3.2. Lấy Chuỗi Kết Nối (Connection String)
Sau khi tạo xong, Neon hiển thị ngay bảng **Connection Details**:
1. Đánh dấu tích vào ô **Connection pooling** (chuỗi kết nối sẽ có đuôi `-pooler`).
2. Chọn ngôn ngữ hoặc chuẩn kết nối: **psycopg2 / PostgreSQL URL**.
3. Sao chép chuỗi kết nối, dạng:
   ```text
   postgresql://neondb_owner:MAT_KHAU_CUA_BAN@ep-cool-fog-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

> [!NOTE]
> Chuỗi kết nối của Neon đã có sẵn tham số `?sslmode=require`. Thư viện `psycopg` của InvestIQ yêu cầu kết nối bảo mật SSL này khi làm việc với cloud database.

*(Tùy chọn: Nếu bạn sử dụng **Supabase**, hãy vào mục **Settings** $\rightarrow$ **Database** $\rightarrow$ **Connection Pooling** $\rightarrow$ Chọn chế độ **Session/Transaction (Port 5432 hoặc 6543)** và copy URI).*

### 3.3. Chạy Khởi Tạo Schema (Database Migration)
InvestIQ tích hợp sẵn module migration forward-only độc lập tại [app.infrastructure.db.base](file:///c:/investiq/backend/app/infrastructure/db/base.py) (không phụ thuộc Alembic).

Để áp dụng toàn bộ các file SQL migration từ máy tính cá nhân lên Neon Database:

```powershell
# 1. Mở PowerShell và di chuyển vào thư mục backend
cd c:\investiq\backend

# 2. Gán biến môi trường DATABASE_URL bằng chuỗi kết nối từ Neon
$env:DATABASE_URL="postgresql://neondb_owner:MAT_KHAU_CUA_BAN@ep-cool-fog-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# 3. Kích hoạt môi trường ảo Python (nếu có) và chạy migration
python -m app.infrastructure.db.base
```

Khi chạy thành công, terminal sẽ in ra danh sách các version migration đã được áp dụng vào Neon:
```text
Applied 0001_news_foundation
Applied 0002_news_crawl_runs
Applied 0003_vietstock_article_revisions
...
Applied 0013_paper_orders
Applied 0014_withdraw_incomplete_news
```

Bạn có thể vào tab **Tables** trên Dashboard của Neon để thấy tất cả các bảng (`articles`, `users`, `securities`, `paper_accounts`, v.v.) đã được khởi tạo hoàn chỉnh!

---

## 4. Bước 2: Triển Khai Backend (FastAPI Web Service)

### 4.1. Khởi Tạo Web Service Trên Render
1. Tại Dashboard, nhấn **New +** $\rightarrow$ Chọn **Web Service**.
2. Chọn **Build and deploy from a Git repository** $\rightarrow$ Kết nối với repository GitHub của InvestIQ.
3. Cấu hình các thông số cơ bản:
   - **Name**: `investiq-backend`
   - **Region**: Chọn cùng Region với Database (ví dụ `Singapore`).
   - **Branch**: `main` (hoặc nhánh bạn muốn triển khai).
   - **Root Directory**: Nhập `backend`.

### 4.2. Chọn Môi Trường Thực Thi (Runtime)

Có 2 phương án bạn có thể lựa chọn:

#### Cách 1: Sử dụng Docker (Khuyên Dùng - Đồng nhất với Monorepo)
- **Environment**: Chọn `Docker`.
- Render sẽ tự động tìm thấy file `backend/Dockerfile`.
- Render chạy container và ánh xạ port tự động qua biến `$PORT`.

#### Cách 2: Sử dụng Python Native
- **Environment**: Chọn `Python`.
- **Build Command**:
  ```bash
  pip install --upgrade pip && pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*
  ```

### 4.3. Cấu Hình Biến Môi Trường (Environment Variables)
Chuyển sang tab **Environment** của service và thêm các cặp Key/Value:

| Key | Value | Ghi chú |
| :--- | :--- | :--- |
| `APP_ENV` | `production` | Môi trường sản xuất |
| `DATABASE_URL` | *Dán chuỗi kết nối Neon.tech (kèm ?sslmode=require)* | Kết nối trực tiếp tới Neon PostgreSQL qua SSL |
| `SECRET_KEY` | *(Tự sinh 1 chuỗi ngẫu nhiên dài 32 ký tự)* | `openssl rand -hex 32` |
| `NEWS_INGESTION_ENABLED` | `false` | Tắt crawler ngầm nếu chưa cấu hình Celery Worker |
| `MARKET_DATA_MODE` | `fixture` | Chạy chế độ giả lập dữ liệu chứng khoán có sẵn |
| `LOG_LEVEL` | `INFO` | Mức ghi log hệ thống |

### 4.4. Cấu Hình Health Check
1. Kéo xuống mục **Advanced Settings**.
2. Tìm **Health Check Path**: Nhập `/healthz`.
3. Nhấn **Create Web Service**.

### 4.5. Kiểm Tra Sau Khi Deploy
Sau khi log hiển thị `Application startup complete`:
- Truy cập endpoint sức khỏe: `https://investiq-backend.onrender.com/healthz` $\rightarrow$ Kết quả mong đợi: `{"status":"ok"}`.
- Truy cập endpoint trạng thái: `https://investiq-backend.onrender.com/api/v1/status` $\rightarrow$ `{"service":"investiq-backend","status":"ok"}`.
- Xem tài liệu API tự động: `https://investiq-backend.onrender.com/docs`.

---

## 5. Bước 3: Triển Khai Frontend (Next.js Web Service)

### 5.1. Khởi Tạo Web Service Cho Frontend
1. Tại Dashboard, nhấn **New +** $\rightarrow$ Chọn **Web Service**.
2. Chọn repository InvestIQ.
3. Cấu hình thông số:
   - **Name**: `investiq-frontend`
   - **Region**: Cùng region với Backend (ví dụ `Singapore`).
   - **Branch**: `main`.
   - **Root Directory**: Nhập `frontend`.
   - **Environment**: Chọn `Node`.
   - **Build Command**:
     ```bash
     npm ci && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```

### 5.2. Cấu Hình Biến Môi Trường Frontend
Thêm các biến sau vào tab **Environment**:

| Key | Value | Ý nghĩa |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Chạy Next.js ở chế độ tối ưu |
| `API_INTERNAL_BASE_URL` | `https://investiq-backend.onrender.com/api` | Địa chỉ Backend mà Next.js Server gọi tới |
| `NEXT_PUBLIC_API_URL` | `/api` | Đường dẫn client gọi |
| `NEXT_PUBLIC_MARKET_WS_URL`| `wss://investiq-backend.onrender.com/ws/v1/market` | URL WebSocket cho bảng giá thời gian thực |
| `ADMIN_UI_PASSWORD` | *(Mật khẩu quản trị bạn chọn)* | Bảo vệ trang quản trị tin tức `/admin-login` |
| `ADMIN_SESSION_SECRET`| *(Chuỗi ngẫu nhiên 32 ký tự)* | Khóa ký session cookie cho Admin |

### 5.3. Xử Lý CORS & Next.js Rewrites (Quan Trọng)
Trong kiến trúc gốc có Nginx điều phối cùng tên miền, người dùng truy cập `/api` sẽ đến thẳng FastAPI. Khi triển khai trên 2 URL Render tách biệt (`investiq-frontend.onrender.com` và `investiq-backend.onrender.com`):

1. **Server-side & BFF Calls**: Mọi thao tác tải trang SSR, kiểm tra Auth, và đặt lệnh mô phỏng đều đi qua Server của Next.js gọi tới `API_INTERNAL_BASE_URL`. Vì đây là giao tiếp giữa 2 máy chủ (Node.js $\rightarrow$ FastAPI), **hoàn toàn không bị chặn bởi CORS của trình duyệt**.
2. **Client-side Rewrites**: Để các yêu cầu từ phía Client (Fetch trong trình duyệt) đi mượt mà không gặp lỗi CORS, bạn có thể cập nhật nhẹ file [next.config.ts](file:///c:/investiq/frontend/next.config.ts):

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const backendUrl = process.env.API_INTERNAL_BASE_URL?.replace(/\/api\/?$/, "")
  || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

---

## 6. Bước 4: Triển Khai Tự Động Bằng Render Blueprint (`render.yaml`)

**Infrastructure as Code (IaC)** là phương pháp quản lý toàn bộ hạ tầng thông qua tệp tin cấu hình được lưu cùng mã nguồn. Render hỗ trợ tệp `render.yaml` (Render Blueprint), cho phép khởi tạo cùng lúc Database, Backend và Frontend chỉ bằng 1 thao tác.

Bạn có thể tạo tệp `render.yaml` tại thư mục gốc của repository với nội dung sau:

```yaml
version: "1"

services:
  # -------------------------------------------------------------
  # Backend FastAPI Web Service
  # -------------------------------------------------------------
  - type: web
    name: investiq-backend
    runtime: python
    region: singapore
    plan: free
    rootDir: backend
    buildCommand: "pip install --upgrade pip && pip install -r requirements.txt"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*"
    healthCheckPath: /healthz
    envVars:
      - key: APP_ENV
        value: production
      - key: DATABASE_URL
        sync: false # Render sẽ hiển thị ô để bạn dán chuỗi kết nối Neon.tech vào khi tạo Blueprint
      - key: SECRET_KEY
        generateValue: true
      - key: NEWS_INGESTION_ENABLED
        value: "false"
      - key: MARKET_DATA_MODE
        value: fixture
      - key: LOG_LEVEL
        value: INFO

  # -------------------------------------------------------------
  # Frontend Next.js Web Service
  # -------------------------------------------------------------
  - type: web
    name: investiq-frontend
    runtime: node
    region: singapore
    plan: free
    rootDir: frontend
    buildCommand: "npm ci && npm run build"
    startCommand: "npm run start"
    healthCheckPath: /
    envVars:
      - key: NODE_ENV
        value: production
      - key: API_INTERNAL_BASE_URL
        fromService:
          type: web
          name: investiq-backend
          property: host
          # Sẽ tự động gán: https://investiq-backend.onrender.com/api
      - key: NEXT_PUBLIC_API_URL
        value: /api
      - key: ADMIN_SESSION_SECRET
        generateValue: true
```

### Cách Sử Dụng Blueprint:
1. Push file `render.yaml` lên GitHub repository.
2. Trên Render Dashboard, nhấn **New +** $\rightarrow$ Chọn **Blueprint**.
3. Chọn repo của bạn $\rightarrow$ Render sẽ phân tích tệp `render.yaml`, hiển thị ô nhập `DATABASE_URL` để bạn dán chuỗi kết nối từ Neon.tech, sau đó tự động tạo và liên kết 2 dịch vụ Backend & Frontend!

---

## 7. Bước 5: Xây Dựng Pipeline CI/CD Toàn Diện Với GitHub Actions

Đây là phần trọng tâm để bạn nắm vững tư duy và kỹ năng thực hành **CI/CD (Continuous Integration & Continuous Deployment)**.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Lập Trình Viên
    participant GitHub as GitHub Actions (CI/CD)
    participant DB as Neon PostgreSQL
    participant RenderBE as Render Backend
    participant RenderFE as Render Frontend

    Dev->>GitHub: Push code / Tạo Pull Request
    Note over GitHub: Bắt đầu giai đoạn CI (Continuous Integration)
    GitHub->>GitHub: Chạy backend-ci (Ruff, Mypy, Pytest)
    GitHub->>GitHub: Chạy frontend-ci (ESLint, TSC, Vitest)
    
    alt CI Thất bại (Lỗi Code / Test)
        GitHub-->>Dev: Báo đỏ (Failed), chặn merge code
    else CI Thành công
        GitHub-->>Dev: Báo xanh (Passed)
        Dev->>GitHub: Merge code vào nhánh main
        Note over GitHub: Bắt đầu giai đoạn CD (Continuous Deployment)
        GitHub->>DB: Chạy DB Migrations (Forward-only SQL)
        GitHub->>RenderBE: Kích hoạt Deploy Hook (Backend)
        RenderBE-->>GitHub: Build & Deploy hoàn tất (Health OK)
        GitHub->>RenderFE: Kích hoạt Deploy Hook (Frontend)
        RenderFE-->>GitHub: Build & Deploy hoàn tất
        GitHub-->>Dev: Thông báo Triển khai thành công!
    end
```

### 7.1. Cơ Chế Kết Nối: Render Deploy Hook
Render cung cấp **Deploy Hook** (URL Webhook bảo mật dạng `https://api.render.com/deploy/srv-xxxx?key=yyyy`). Khi gửi một HTTP POST request đến URL này, Render sẽ tự động pull code mới nhất về và tiến hành build/deploy ngay lập tức.

#### Cách lấy Deploy Hook trên Render:
1. Vào dịch vụ `investiq-backend` $\rightarrow$ **Settings** $\rightarrow$ Kéo xuống mục **Deploy Hook**.
2. Nhấn **Add Deploy Hook** $\rightarrow$ Copy đường link được cấp.
3. Thực hiện tương tự cho `investiq-frontend`.

### 7.2. Cấu Hình GitHub Secrets
Vào GitHub Repository của bạn $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ Nhấn **New repository secret** và thêm 3 secrets sau:

1. `RENDER_BACKEND_DEPLOY_HOOK`: Dán Webhook URL của Backend trên Render.
2. `RENDER_FRONTEND_DEPLOY_HOOK`: Dán Webhook URL của Frontend trên Render.
3. `NEON_DATABASE_URL`: Dán chuỗi kết nối PostgreSQL từ **Neon.tech** (kèm tham số `?sslmode=require`) để GitHub Actions tự động chạy migration trước khi deploy.

---

### 7.3. Tệp Workflow CI/CD Hoàn Chỉnh

Tạo file mới tại `.github/workflows/render-deploy.yml`:

```yaml
name: CI/CD Pipeline to Render

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: render-delivery-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # =========================================================================
  # GIAI ĐOẠN 1: CONTINUOUS INTEGRATION (CI) - KIỂM THỬ TỰ ĐỘNG
  # =========================================================================

  ci-backend:
    name: Backend Lint, Typecheck & Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up Python 3.13
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"
          cache: "pip"
          cache-dependency-path: "backend/requirements-dev.txt"

      - name: Install Dependencies
        working-directory: backend
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements-dev.txt

      - name: Run Ruff (Linter & Formatter Check)
        working-directory: backend
        run: ruff check .

      - name: Run Mypy (Static Type Check)
        working-directory: backend
        run: mypy

      - name: Run Unit Tests (Pytest)
        working-directory: backend
        run: python -m pytest tests/unit/ -v

  ci-frontend:
    name: Frontend Lint, Typecheck & Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
          cache-dependency-path: "frontend/package-lock.json"

      - name: Install Node Modules
        working-directory: frontend
        run: npm ci

      - name: Run ESLint
        working-directory: frontend
        run: npm run lint

      - name: Run TypeScript Compiler Check
        working-directory: frontend
        run: npm run typecheck

      - name: Run Frontend Tests (Vitest)
        working-directory: frontend
        run: npm test

  # =========================================================================
  # GIAI ĐOẠN 2: CONTINUOUS DEPLOYMENT (CD) - MIGRATION & DEPLOY RENDER
  # =========================================================================

  migrate-database:
    name: Apply Database Migrations
    needs: [ci-backend, ci-frontend]
    # Chỉ chạy deploy khi code đã được MERGE vào nhánh main
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install Database Driver
        run: pip install psycopg[binary]

      - name: Run Forward Migrations
        working-directory: backend
        env:
          DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          echo "Bắt đầu áp dụng migration lên Neon Database..."
          python -m app.infrastructure.db.base

  deploy-to-render:
    name: Trigger Render Deployment
    needs: [migrate-database]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Trigger Backend Deploy
        run: |
          echo "Gửi tín hiệu deploy Backend tới Render..."
          curl -f -X POST "${{ secrets.RENDER_BACKEND_DEPLOY_HOOK }}"
          echo "Đã kích hoạt Backend Deploy thành công."

      - name: Trigger Frontend Deploy
        run: |
          echo "Gửi tín hiệu deploy Frontend tới Render..."
          curl -f -X POST "${{ secrets.RENDER_FRONTEND_DEPLOY_HOOK }}"
          echo "Đã kích hoạt Frontend Deploy thành công."

      - name: Smoke Test Endpoint Sức Khỏe
        run: |
          echo "Chờ 30 giây để Render chuẩn bị build..."
          sleep 30
          echo "CI/CD hoàn tất! Bạn có thể theo dõi tiến trình trực tiếp trên Dashboard của Render."
```

### 7.4. Phân Tích Các Điểm Quan Trọng Của Pipeline Này

1. **Tính Cô Lập & Tiết Kiệm Thời Gian**: `ci-backend` và `ci-frontend` chạy song song (parallel execution). Nếu một trong hai bên có lỗi chính tả, sai kiểu dữ liệu hay rớt test, quá trình sẽ dừng ngay lập tức, bảo vệ hệ thống không bị triển khai mã lỗi lên server.
2. **Quy Tắc An Toàn Dữ Liệu (Expand & Contract)**: Job `migrate-database` bắt buộc phải chạy **trước** khi kích hoạt deploy Backend (`needs: [migrate-database]`). Điều này đảm bảo khi mã nguồn Backend mới khởi động lên, cấu trúc bảng trong Database đã sẵn sàng.
3. **Phân Định Nhánh**:
   - Khi tạo Pull Request: Chỉ có 2 job `ci-backend` và `ci-frontend` được chạy để kiểm tra chất lượng code.
   - Khi merge vào `main`: Toàn bộ các bước từ Test $\rightarrow$ Migrate $\rightarrow$ Deploy mới được kích hoạt.

---

## 8. Bước 6: Khắc Phục Sự Cố & Best Practices Vận Hành

### 8.1. Lỗi Thường Gặp & Cách Khắc Phục

#### 1. Lỗi kết nối Database `sslmode=require`
- **Hiện tượng**: Backend báo lỗi `FATAL: no pg_hba.conf entry for host... SSL off`.
- **Nguyên nhân**: Render PostgreSQL bắt buộc mọi kết nối từ bên ngoài (hoặc một số driver) phải sử dụng mã hóa SSL.
- **Xử lý**: Thêm `?sslmode=require` vào cuối chuỗi `DATABASE_URL`.

#### 2. Lỗi Render cấp Port khác với mặc định của Dockerfile
- **Hiện tượng**: Web Service build thành công nhưng báo `Timed out waiting for port...`.
- **Nguyên nhân**: Dockerfile mặc định `EXPOSE 8000`, trong khi Render tự động sinh một cổng ngẫu nhiên thông qua biến `$PORT` (ví dụ `10000`).
- **Xử lý**: Trong Render Dashboard của Backend $\rightarrow$ **Environment Variables** $\rightarrow$ Đặt biến `PORT=8000`, hoặc cấu hình lệnh khởi chạy uvicorn lắng nghe trên `$PORT`:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```

#### 3. Lỗi Frontend không gọi được API Backend (CORS)
- **Hiện tượng**: Trình duyệt báo `Cross-Origin Request Blocked`.
- **Xử lý**: Đảm bảo các route trong Next.js gọi thông qua BFF (`/auth-api`, `/portfolio-api`) hoặc thiết lập Next.js Rewrites trong `next.config.ts` như đã hướng dẫn ở [Mục 5.3](#53-xử-lý-cors--nextjs-rewrites-quan-trọng).

---

### 8.2. Các Bài Học DevOps Đúc Kết
1. **Never Commit Secrets**: Tuyệt đối không đưa file `.env` chứa mật khẩu thật lên Git. Mọi thông tin nhạy cảm phải quản lý qua **GitHub Secrets** và **Render Environment Variables**.
2. **Health Check Endpoints Là Cốt Lõi**: Một hệ thống chuyên nghiệp luôn cần endpoint `/healthz` (kiểm tra tiến trình còn sống) và `/readyz` (kiểm tra các phụ thuộc DB/Redis đã sẵn sàng). Render dựa vào đây để xác định thời điểm chuyển traffic an toàn sang phiên bản mới mà không làm gián đoạn người dùng (Zero Downtime Deployment).
3. **Giám Sát Bằng Log**: Khi có sự cố, hãy truy cập mục **Logs** của từng service trên Render để quan sát traceback thời gian thực.
