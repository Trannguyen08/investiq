# Báo cáo thực thi tính năng tin tức chứng khoán Việt Nam

- Ngày thực hiện: 29/09/2026.
- Phạm vi: research, triển khai MVP hai nguồn, kiểm thử và kiểm chứng backup/restore.
- Trạng thái deploy: chưa deploy theo đúng yêu cầu; ingestion mặc định tắt bằng
  `NEWS_INGESTION_ENABLED=false`.
- Cơ chế bảo vệ dữ liệu: backup định kỳ, không có database replica.

## 1. Kết quả research nguồn tin

Việc khảo sát và backfill preview chỉ đọc các trang công khai, chạy tuần tự có khoảng nghỉ và không vượt đăng nhập,
CAPTCHA hoặc paywall. `robots.txt` mô tả quyền truy cập của crawler, không tự tạo quyền lưu hoặc
tái xuất bản toàn văn.

| Nguồn | Kết quả ngày kiểm tra | Trạng thái trong hệ thống |
| --- | --- | --- |
| [Vietstock](https://vietstock.vn/rss) | Có trang RSS chính thức và feed theo chuyên mục, gồm tin mới, chứng khoán và doanh nghiệp | Adapter RSS + parser đã triển khai; `active` về mặt kỹ thuật |
| [CafeF](https://cafef.vn/robots.txt) | `robots.txt` hiện cho phép truy cập và công bố sitemap cùng [Google News sitemap](https://cafef.vn/google-news-sitemap.xml) | Adapter news sitemap + parser đã triển khai; `active` về mặt kỹ thuật |
| [HNX](https://www.hnx.vn/) | Lần khảo sát nhận lỗi 502 từ công cụ truy cập; chưa xác nhận feed/API công khai ổn định | `pending_review` |
| [HOSE](https://www.hsx.vn/) | Trang phụ thuộc JavaScript; chưa xác nhận luồng công bố công khai phù hợp cho adapter | `pending_review` |
| [StockBiz](https://stockbiz.vn/) | Đọc được trang công khai nhưng chưa xác nhận nguồn bài gốc, chống trùng và điều kiện sử dụng | `pending_review` |
| [FireAnt](https://fireant.vn/) | Có nội dung thị trường và cộng đồng; chưa có ranh giới ingestion đủ chắc chắn | `pending_review` |
| [Simplize](https://simplize.vn/) | Đọc được trang công khai; chưa xác nhận kênh bài viết và chính sách sử dụng | `pending_review` |
| [SSI iBoard](https://iboard.ssi.com.vn/) | Bảng điện phụ thuộc JavaScript và nằm ngoài phạm vi tin tức của MVP | `blocked` |
| [TradingView](https://vn.tradingview.com/) | Tin và ý tưởng cộng đồng cần xác nhận quyền tích hợp riêng | `pending_review` |

Hai adapter đầu dùng URL allowlist, kiểm tra DNS/IP để chống SSRF, giới hạn redirect, timeout và
response HTML 5 MiB. CafeF và Vietstock vẫn cần quyết định sản phẩm/pháp lý về chế độ
`full_text`, `metadata_only` hoặc `link_only` trước khi bật ingestion ở môi trường thật.

## 2. Phần đã triển khai

### Crawl và xử lý dữ liệu

- Discovery từ RSS Vietstock và Google News sitemap CafeF; chỉ đọc link bài trong item/URL entry,
  bỏ link feed, URL ảnh, tin CafeF ngoài phạm vi thị trường và tham số tracking.
- Parser ưu tiên JSON-LD/OpenGraph rồi selector riêng từng nguồn. Kết quả giữ tiêu đề, mô tả, tác
  giả, ngày đăng/cập nhật, chuyên mục, tag, đoạn văn, heading, quote, danh sách, bảng, thumbnail,
  ảnh trong bài và tài liệu đính kèm.
- Nhận mã có sàn rõ ràng như `HOSE:FPT` và mẫu ngữ cảnh chặt như `cổ phiếu HDC`; mã chưa có trong
  security master được lưu riêng là “mã nguồn nhắc đến”, không tự nâng thành mã đã xác minh và không
  coi mọi chữ viết hoa là mã chứng khoán.
- Baseline sentiment tiếng Việt phiên bản 4 dùng trọng số sự kiện tài chính và phủ định, chọn chiều
  chi phối thay vì mặc định trả trung tính/trái chiều. Kết quả có quan điểm, câu bằng chứng, phạm vi,
  ảnh hưởng dự kiến đến thị trường và kỳ hạn ngắn hạn; confidence vẫn `null` vì chưa có tập hiệu chuẩn.
- Công cụ nhập security master CSV được kiểm tra chặt và chạy idempotent:

  ```sh
  python -m app.infrastructure.db.import_securities \
    --file /data/securities.csv --source reviewed-master --dry-run
  ```

### PostgreSQL và hàng đợi

- Migration tạo nguồn, bài, revision bất biến, asset, security/identifier, mention, sentiment,
  crawl run và ingestion job cùng các unique constraint/index cần thiết.
- Migration `0002_news_analysis` lưu mã nguồn nhắc đến cùng phạm vi, kỳ hạn và diễn giải tác động;
  thay đổi phiên bản analyzer cập nhật analysis hiện hành mà không tạo revision nội dung giả.
- Repository ghi theo transaction; URL trùng và nội dung không đổi không sinh revision mới. Bài
  thay đổi tạo revision mới và chỉ cập nhật `current_revision_id` sau khi dữ liệu liên quan hoàn tất.
- PostgreSQL giữ trạng thái job bền vững. Dispatcher mỗi 60 giây claim bằng
  `FOR UPDATE SKIP LOCKED`, phát job sau commit và thu hồi job `dispatched/running` hết lease khi
  Redis hoặc worker gián đoạn.
- Pool kết nối mở lười, migration là lệnh release riêng và không chạy trong startup API.

### API và giao diện

- API versioned gồm `GET /api/v1/news`, `/news/{id}`, `/news-sources` và
  `/securities/search`; cursor có chữ ký HMAC và gắn với bộ lọc.
- Response dùng schema allowlist, error envelope có request ID, và endpoint news trả
  `Cache-Control: no-store`.
- Header nền trắng/chữ đen, wordmark SVG InvestIQ cục bộ, điều hướng desktop/mobile, ô tìm kiếm,
  trang danh sách và chi tiết responsive.
- Danh sách mặc định tải 30 bài, có search/filter nguồn, mã, sentiment và phân trang. Mỗi thẻ đặt tối
  đa ba mã ngay sau nhãn sentiment rồi hiển thị `+n`; mã nguồn nhắc đến được phân biệt với mã đã xác minh.
  Chi tiết có tiêu đề gọn hơn, khối
  đọc nhanh từ ba đoạn thực tế, thống kê số đoạn/mục/ảnh rồi hiển thị toàn bộ nội dung có cấu trúc,
  bảng cuộn ngang, attachment, nguồn, thời gian, mã liên quan và bảng phân tích gồm quan điểm, điểm
  sắc thái, ảnh hưởng thị trường, phạm vi, kỳ hạn và các câu bằng chứng; luôn kèm cảnh báo đây
  không phải dự báo giá hoặc khuyến nghị đầu tư.
- API nội bộ giữa Next.js và FastAPI dùng biến môi trường và network Compose, phù hợp với việc đóng
  gói/deploy sau này nhưng chưa thực hiện deploy.

### Backup định kỳ

- `backup_db.sh` tạo `pg_dump` custom format vào file tạm, dùng lock chống chạy chồng, kiểm tra
  archive, tạo SHA-256 manifest rồi mới chuyển file hoàn chỉnh sang đích.
- Manifest ghi PostgreSQL version, migration versions, extension, database role và kích thước.
- `backup_scheduler.sh` chạy độc lập Redis/Celery, mặc định mỗi 6 giờ và hỗ trợ `--once --dry-run`.
- `restore_db.sh` kiểm checksum/archive, yêu cầu `ALLOW_DATABASE_RESTORE=yes`, restore trong
  transaction rồi chạy `ANALYZE`.
- Cách dùng và nguyên tắc đích lưu độc lập tuân theo
  [PostgreSQL 17 SQL dump](https://www.postgresql.org/docs/17/backup-dump.html).

## 3. Bằng chứng kiểm thử

| Hạng mục | Kết quả |
| --- | --- |
| Backend Ruff | đạt |
| Backend mypy strict | đạt, 138 source files |
| Toàn bộ backend pytest | 39 passed trên PostgreSQL test cách ly |
| Feature `news` unit | 20 passed; có regression test cho ticker ngữ cảnh, trọng số sentiment, phủ định, phạm vi và tác động thị trường |
| Feature `news` integration | 6 passed; branch coverage 86,94% trên module sở hữu |
| PostgreSQL integration | migration DB rỗng, idempotency, revision history và phục hồi job hết lease đều đạt |
| Frontend Vitest | 4 passed |
| Frontend ESLint | đạt, không warning |
| Frontend TypeScript | đạt với `tsc --noEmit --incremental false` |
| Live preview backfill | 60 bài thật: 50 Vietstock, 10 CafeF; 60/60 request thành công, không còn dữ liệu demo |
| Phân tích preview | 25/60 bài có mã nguồn nhắc đến, tổng 63 tham chiếu; 25 tích cực, 13 tiêu cực, 13 trái chiều, 9 trung tính |
| Chất lượng nội dung preview | CafeF 2.121–8.258 ký tự/bài; Vietstock 290–11.427 ký tự/bài; bài 290 ký tự dùng bảng động được đánh dấu `partial` |
| Smoke test UI/API | list API trả 30 bài và `has_more=true`; detail thật có 27 content block/3.273 ký tự; `/news` và detail đều HTTP 200 |
| Compose | `docker compose config --quiet` đạt với biến môi trường kiểm thử |
| Shell | `sh -n` đạt cho backup, restore và scheduler |
| Restore drill | backup PostgreSQL 17, restore vào DB cách ly và đọc `app_schema_migrations` thành công |

Các báo cáo JUnit/coverage được sinh cục bộ dưới `test-results/news/` và bị gitignore theo quy ước
repository.

## 4. Giới hạn còn lại

- Đã chạy một backfill có kiểm soát trên database preview để kiểm chứng parser và giao diện; lịch crawl
  thật vẫn tắt mặc định. Cần chốt quyền lưu/hiển thị cho Vietstock và CafeF, nhập security
  master đã được duyệt, cấu hình Redis/PostgreSQL thật rồi mới đặt `NEWS_INGESTION_ENABLED=true`.
- Bảy nguồn còn lại chưa có adapter vì kênh công khai hoặc điều kiện sử dụng chưa đủ chắc chắn;
  database và API báo đúng trạng thái thay vì giả lập hỗ trợ.
- Wordmark SVG là bản dựng từ ảnh tham chiếu rất nhỏ; nên thay bằng asset thương hiệu gốc khi có.
- Baseline sentiment chưa được đánh giá trên tập tối thiểu 500 bài nên không phát confidence và
  không được dùng như tín hiệu giao dịch.
- Chưa đủ bộ 20 fixture cho mỗi nguồn ưu tiên, chưa có E2E trình duyệt, contract code generation,
  benchmark 100.000 bài, circuit breaker/rate limiter phân tán, near-duplicate grouping hoặc kiểm
  thử outage/429 toàn luồng. Đây là các cổng chất lượng trước khi vận hành crawl liên tục.
- Scheduler backup đã có nhưng chưa được gắn vào một môi trường deploy. Retention nhiều tầng,
  object storage mã hóa, cảnh báo backup age và weekly restore automation cần được cấu hình theo
  hạ tầng đích; lần này chỉ kiểm chứng backup/restore cục bộ theo yêu cầu không deploy.

## 5. Cách chạy kiểm tra lại

```sh
# Backend
python -m ruff check app tests
python -m mypy app tests
python -m pytest -q
python tests/run_feature_tests.py news all

# Frontend
npm run lint
npm test
npm run typecheck

# Backup dry run
sh infra/scripts/backup_scheduler.sh --once --dry-run
```

Test integration PostgreSQL cần `TEST_DATABASE_URL` trỏ tới PostgreSQL 17 cách ly đã được tạo riêng
cho test. Không chạy migration hoặc restore test vào database đang phục vụ người dùng.
