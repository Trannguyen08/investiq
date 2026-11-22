# Hướng Dẫn Triển Khai InvestIQ Backend Lên Oracle Cloud Always Free (2 OCPU / 12 GB RAM)

Tài liệu này hướng dẫn từng bước triển khai **InvestIQ Backend (FastAPI + Redis + Celery Worker/Beat)** lên **Oracle Cloud Infrastructure (OCI) Always Free** tại Region **Singapore** (kết hợp **Vercel** cho Frontend và **Neon.tech Singapore** cho PostgreSQL) để đạt tốc độ phản hồi nhanh gần như chạy Local, **không Cold Start**, **không OOM** và **chi phí 0đ**.

---

## 1. Cấu Hình 2 OCPU / 12 GB RAM Có Đủ Cho InvestIQ Không?

**Trả lời ngắn gọn: RẤT DƯ DẢ.**

So với Render Free (`0.1 vCPU / 512 MB RAM`, tự ngủ đông sau 15 phút), một máy ảo Oracle Cloud ARM (`VM.Standard.A1.Flex`) cấu hình **2 OCPU / 12 GB RAM** mạnh hơn **20 lần về CPU** và **24 lần về RAM**, chạy **24/7 không bao giờ ngủ đông**.

### Bảng Ước Tính Tài Nguyên Thực Tế Của InvestIQ Trên 2 OCPU / 12 GB RAM

| Dịch vụ chạy trên OCI VM | RAM tiêu thụ ước tính | Vai trò |
| :--- | :---: | :--- |
| **FastAPI Backend (`uvicorn --workers 2`)** + `vnstock` / `pandas` | ~350 – 600 MB | Phục vụ API thị trường (DNSE-first), AI Assistant, Paper Trading |
| **Redis 8** (local container) | ~100 – 250 MB | Cache bảng giá/nến siêu tốc (<1ms), Broker cho Celery & Session BFF |
| **Celery Worker + Celery Beat** | ~300 – 500 MB | Crawl tin tức 6 nguồn, nhắc lịch cổ tức, cố vấn danh mục AI |
| **Caddy Reverse Proxy** *(hoặc Cloudflare Tunnel)* | ~30 – 50 MB | Tự động cấp chứng chỉ HTTPS (Let's Encrypt) & nén GZip |
| **Hệ điều hành Ubuntu 24.04 + Docker** | ~300 – 400 MB | Nền tảng vận hành |
| **Tổng cộng sử dụng** | **~1.1 – 1.8 GB / 12 GB** | **Còn dư > 10 GB RAM** (thoải mái chạy thêm PostgreSQL local nếu muốn) |

> [!TIP]
> **Gợi ý kiến trúc tối ưu nhất**:
> - **Frontend**: Giữ trên **Vercel** (`https://investiq-chi-eosin.vercel.app`) — CDN toàn cầu, tải trang tức thì.
> - **Backend + Redis + Celery**: Đặt trên **Oracle Cloud Singapore (2 OCPU / 12 GB RAM)** — giữ nguyên in-memory cache + Redis cache tại chỗ, không ngủ đông, gọi DNSE/FHSC nhanh và ổn định.
> - **PostgreSQL**: Dùng **Neon.tech Singapore** (đã có sẵn) hoặc chạy trực tiếp container PostgreSQL 17 ngay trên VM 12 GB RAM này.

---

## 2. Bước 1: Tạo Máy Ảo (Compute Instance) Trên Oracle Cloud

1. Đăng nhập **[Oracle Cloud Console](https://cloud.oracle.com)** (chọn Home Region **Singapore** nếu có).
2. Vào **Compute → Instances → Create Instance**:
   - **Name**: `investiq-backend`
   - **Image**: `Canonical Ubuntu 24.04` (hoặc `22.04 Minimal aarch64`)
   - **Shape**: Chọn **Ampere** → `VM.Standard.A1.Flex`:
     - **OCPUs**: `2`
     - **Memory (GB)**: `12`
   - **Networking**: Đảm bảo bật **Assign a public IPv4 address**.
   - **Add SSH keys**: Tải xuống **Private Key (`.key`)** để SSH vào máy chủ.
   - **Boot volume**: Để mặc định `50 GB` (hoặc tăng lên `100 GB` — vẫn nằm trong hạn mức 200 GB Always Free).
3. Nhấn **Create** và ghi lại **Public IPv4 Address** (ví dụ: `152.x.x.x`).

> [!NOTE]
> Nếu Region Singapore báo *"Out of capacity for shape VM.Standard.A1.Flex"*, bạn có thể nâng cấp tài khoản lên **Pay-As-You-Go** (vẫn miễn phí 100% chừng nào chỉ tạo tài nguyên trong hạn mức Always Free: tối đa 4 OCPU / 24 GB RAM / 200 GB SSD) để được ưu tiên cấp máy ngay lập tức.

---

## 3. Bước 2: Mở Cổng Firewall (Port 80 & 443)

Oracle Cloud chặn mặc định port 80/443 ở **cả 2 lớp** (Cloud VCN và Ubuntu iptables). Bạn cần mở cả hai:

### 3.1. Trên Oracle Cloud Console (VCN Security List)
1. Trong trang chi tiết Instance → bấm vào **Subnet** → bấm vào **Default Security List**.
2. Chọn **Add Ingress Rules** và thêm 2 rule:
   - Rule 1: Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port Range `80`
   - Rule 2: Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port Range `443`

### 3.2. SSH vào VM và mở firewall Ubuntu
```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>

# Mở port 80, 443 trên iptables mặc định của Oracle Ubuntu
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 4. Bước 3: Cài Đặt Docker & Clone Mã Nguồn InvestIQ

```bash
# Cài Docker chính thức cho Ubuntu ARM64
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra Docker & Docker Compose
docker --version
docker compose version

# Clone dự án (nhánh mới nhất đã tối ưu DNSE-first)
git clone https://github.com/Trannguyen08/investiq.git
cd investiq
```

---

## 5. Bước 4: Cấu Hình Biến Môi Trường (`.env.oracle`)

Tạo file `.env.oracle` ngay trong thư mục `/home/ubuntu/investiq/`:

```bash
cat <<'EOF' > .env.oracle
APP_ENV=production
LOG_LEVEL=INFO
AUTO_MIGRATE=true
WEB_CONCURRENCY=2

# Database Neon Singapore (hoặc Postgres local)
DATABASE_URL=postgresql://<user>:<pass>@<neon-host>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Redis chạy trực tiếp trên cùng VM (độ trễ < 1ms, không giới hạn request như Upstash Free!)
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Thị trường (DNSE-first + tối thiểu hóa FHSC)
MARKET_DATA_MODE=vnstock
VNSTOCK_API_KEY=<VNSTOCK_API_KEY>
FHSC_API_KEY=<FHSC_API_KEY>
DNSE_API_KEY=<DNSE_API_KEY>
DNSE_API_SECRET=<DNSE_API_SECRET>
VNSTOCK_REFRESH_SECONDS=300
VNSTOCK_CANDLE_CACHE_SECONDS=300
VNSTOCK_FUNDAMENTAL_CACHE_SECONDS=3600

# Bật crawl tin tức nền bằng Celery Worker
NEWS_INGESTION_ENABLED=true

# Bảo mật Auth & SMTP (copy giống bản đang dùng trên Render/Vercel)
AUTH_ENABLED=true
SECRET_KEY=<SECRET_KEY>
AUTH_BFF_SECRET=<AUTH_BFF_SECRET>
AUTH_JWT_SECRET=<AUTH_JWT_SECRET>
AUTH_OTP_HMAC_KEY=<AUTH_OTP_HMAC_KEY>
AUTH_PAYLOAD_ENCRYPTION_KEY=<AUTH_PAYLOAD_ENCRYPTION_KEY>
AUTH_SESSION_ENCRYPTION_KEY=<AUTH_SESSION_ENCRYPTION_KEY>
AUTH_GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
AUTH_GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
AUTH_GOOGLE_REDIRECT_URI=https://investiq-chi-eosin.vercel.app/auth-api/google/callback
AUTH_MAIL_FROM=<MAIL_FROM>
AUTH_SMTP_HOST=smtp.gmail.com
AUTH_SMTP_PORT=587
AUTH_SMTP_USERNAME=<SMTP_USER>
AUTH_SMTP_PASSWORD=<SMTP_APP_PASSWORD>
AUTH_SMTP_STARTTLS=true
EOF
chmod 600 .env.oracle
```

---

## 6. Bước 5: Chạy Backend + Redis + Celery + HTTPS Tự Động Với Caddy

### 6.1. Tạo `Caddyfile` để tự động cấp SSL HTTPS miễn phí
- Nếu bạn đã có tên miền (ví dụ `api.investiq.vn`), trỏ bản ghi `A` về `<PUBLIC_IP>`.
- **Nếu chưa mua tên miền**, dùng ngay tên miền miễn phí **`<PUBLIC_IP>.nip.io`** (ví dụ `152-67-10-20.nip.io`) — Caddy sẽ tự động xin chứng chỉ Let's Encrypt HTTPS hợp lệ cho bạn!

```bash
cat <<'EOF' > Caddyfile
<TEN_MIEN_HOAC_IP_NIP_IO> {
    encode gzip zstd
    reverse_proxy backend:8000
}
EOF
```

### 6.2. Tạo `docker-compose.oracle.yml` và khởi chạy
```bash
cat <<'EOF' > docker-compose.oracle.yml
services:
  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: ["redis-server", "--maxmemory", "512mb", "--maxmemory-policy", "allkeys-lru"]

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.oracle
    depends_on:
      - redis
    expose:
      - "8000"

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.oracle
    command: ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
    depends_on:
      - redis

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.oracle
    command: ["celery", "-A", "app.workers.celery_app", "beat", "--loglevel=info"]
    depends_on:
      - redis

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend

volumes:
  caddy_data:
  caddy_config:
EOF

# Build & chạy nền 24/7
docker compose -f docker-compose.oracle.yml up --build -d
```

---

## 7. Bước 6: Kiểm Tra Tốc Độ & Kết Nối Vercel Frontend

1. Kiểm tra container đang chạy ổn định và lượng RAM thực tế:
   ```bash
   docker compose -f docker-compose.oracle.yml ps
   docker stats --no-stream
   curl -w "\nTime: %{time_total}s\n" https://<TEN_MIEN_HOAC_IP_NIP_IO>/healthz
   curl -w "\nTime: %{time_total}s\n" "https://<TEN_MIEN_HOAC_IP_NIP_IO>/api/v1/market/candles?symbol=FPT&interval=1d&limit=60"
   ```
2. Vào **Vercel Dashboard → Project InvestIQ → Settings → Environment Variables**:
   - Đổi `API_INTERNAL_BASE_URL` từ `https://investiq-backend-xe6x.onrender.com/api` thành:
     ```
     https://<TEN_MIEN_HOAC_IP_NIP_IO>/api
     ```
   - Nhấn **Redeploy** Frontend trên Vercel.
3. Khi có code mới trên GitHub, chỉ cần SSH vào VM và chạy 2 lệnh để cập nhật:
   ```bash
   cd ~/investiq && git pull origin main
   docker compose -f docker-compose.oracle.yml up --build -d
   ```

> [!IMPORTANT]
> **Lưu ý kiến trúc ARM64**: `Dockerfile` của Backend dùng `python:3.13-slim` đã hỗ trợ đa kiến trúc (`linux/amd64` và `linux/arm64`) sẵn nên build trực tiếp trên Oracle Cloud ARM64 mượt mà, không cần cấu hình giả lập.
