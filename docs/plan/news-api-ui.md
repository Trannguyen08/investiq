# Thiết kế API và giao diện tin tức

Thuộc [kế hoạch chính](vietnam-stock-news.md), dùng [schema tin tức](news-database.md).
Nội dung là hợp đồng thiết kế. MVP endpoint/component đã được triển khai; trạng thái nghiệm thu và
các khoảng trống còn lại nằm trong [báo cáo thực thi](news-implementation-report.md).

## 1. API công khai

Base path `/api/v1`. FastAPI/Pydantic và OpenAPI là nguồn chuẩn; khi triển khai sinh TypeScript
client/types từ OpenAPI, gọi tập trung qua `frontend/src/lib/api-client.ts`.

| Method và path | Mục đích | Response |
| --- | --- | --- |
| `GET /news` | Danh sách, tìm kiếm và lọc | 200 collection có cursor |
| `GET /news/{id}` | Chi tiết bài theo UUID ổn định | 200 detail; 404 không tồn tại/không public; 410 withdrawn công khai |
| `GET /news/{id}/related` | Tin cùng mã/chủ đề, loại chính bài đang xem | 200 tối đa 6 summary |
| `GET /news-sources` | Nguồn có thể chọn trong bộ lọc | 200 danh sách tên/slug/status công khai; không trả adapter/config nội bộ |
| `GET /news-taxonomy` | Category/tag đang hỗ trợ | 200 categories + tối đa 50 tag thông dụng, không quét trả mọi tag |
| `GET /securities/search?q=...&limit=10` | Autocomplete mã/tên doanh nghiệp | 200; limit tối đa 20, q 2–100 ký tự |

MVP không thêm WebSocket cho news; tải lại theo thao tác người dùng và kiểm tra tin mới mỗi
60 giây khi tab đang hiển thị. Không làm mới tự động khiến người dùng mất vị trí đọc.
`news-sources` trả thêm `last_success_at` và freshness đã tính theo lịch; nguồn chưa được hỗ trợ
hiện trạng thái thông tin riêng, không cho chọn bộ lọc như thể đã có dữ liệu.

### 1.1 Query danh sách

| Query | Quy tắc |
| --- | --- |
| `q` | 2–200 ký tự sau trim; token search có/không dấu, không fuzzy/semantic trong MVP |
| `source` | Slug nguồn, lặp tối đa 9; OR trong cùng nhóm |
| `symbol` | `HOSE:FPT`, `HNX:...`, `UPCOM:...`, lặp tối đa 10; resolve qua security master |
| `category`, `tag` | Category một giá trị; tag lặp tối đa 10, OR giữa tag |
| `sentiment` | positive/negative/neutral/mixed/unknown; chỉ xét kết quả ready khớp revision |
| `sentiment_scope` | article (mặc định) hoặc symbol; scope symbol yêu cầu ít nhất một symbol |
| `analysis_status` | pending/ready/failed/stale; unknown là nhãn, không phải trạng thái |
| `from`, `to` | ISO 8601 có timezone; khoảng `[from,to)` lọc ngày nguồn đăng; from < to; bài ngày đăng null chỉ xuất hiện khi không lọc ngày |
| `sort` | newest mặc định hoặc oldest; search vẫn sắp theo thời gian, chưa có relevance sort |
| `limit` | 1–50, mặc định 20 |
| `cursor` | Opaque, tối đa 2 KiB, có version/filter hash/snapshot/order/last key; sai hoặc đổi filter trả 422 |

AND giữa các nhóm filter. Với scope symbol và nhiều mã, cần tồn tại **cùng một mention** khớp
mã được chọn và nhãn sentiment; không lấy nhãn mã B để trả bài khi người dùng đang lọc mã A.
Scope article xét đánh giá toàn bài dù có lọc symbol. UI luôn chỉ rõ scope hiện tại.

Ngày trong date-picker hiểu theo giờ Việt Nam, chuyển đầu ngày UTC; ngày kết thúc inclusive
trên UI chuyển đầu ngày kế tiếp làm `to` exclusive. Feed không filter ngày dùng `feed_at`
đã đóng băng; metadata ngày nguồn thay đổi không làm cursor chạy lùi/lặp cùng identity.
Cursor là trạng thái phân trang, không phải credential; validate mọi trường và parameterize SQL.

### 1.2 Collection response

```json
{
  "data": [],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  },
  "meta": {
    "request_id": "req-example",
    "as_of": "2026-09-29T03:45:00Z",
    "last_ingested_at": "2026-09-29T03:43:00Z",
    "freshness": "fresh"
  }
}
```

`data` là NewsSummary[]; không tính `total` chính xác bằng COUNT toàn bộ ở mọi request.
`freshness` fresh/delayed/unavailable theo lịch và last_success nguồn được lọc; ban đêm không
tự kết luận stale vì không có bài mới. `last_ingested_at` null khi chưa có dữ liệu.
`as_of` là snapshot phân trang, không phải cam kết toàn bộ nguồn cập nhật tại thời điểm đó.

NewsSummary gồm: `id`, `title`, `description`, `url`, `source`, `published_at`, `updated_at`
(giờ nguồn sửa, nullable), `first_seen_at`, `feed_at`, `category`, `tags`, `thumbnail`,
`symbols`, `sentiment`, `extraction_status`, `content_access`. Không trả full body/raw snapshot.

### 1.3 Detail response mẫu

Ví dụ bên dưới là dữ liệu giả để mô tả hợp đồng, không phải bài thực tế hoặc kết quả model.
Envelope detail có `data` và `meta.request_id`; NewsDetail trong `data` như sau:

```json
{
  "id": "8d2ea402-8ed8-4e53-9dbe-0c957ec8f323",
  "revision_id": "6fdb38a8-89e9-4ab0-b85d-7d3b1c0b7be9",
  "url": "https://example.com/news/doanh-nghiep-a",
  "title": "Doanh nghiệp A công bố kết quả kinh doanh",
  "description": "Doanh thu cải thiện so với cùng kỳ.",
  "content": "Doanh nghiệp A ghi nhận doanh thu tăng so với cùng kỳ.",
  "content_blocks": [
    {
      "id": "p1",
      "type": "paragraph",
      "text": "Doanh nghiệp A ghi nhận doanh thu tăng so với cùng kỳ."
    }
  ],
  "authors": [{"name": "Tác giả minh họa", "profile_url": null}],
  "published_at": "2026-09-29T03:30:00Z",
  "updated_at": "2026-09-29T04:20:00Z",
  "first_seen_at": "2026-09-29T03:33:00Z",
  "feed_at": "2026-09-29T03:30:00Z",
  "fetched_at": "2026-09-29T04:22:00Z",
  "category": {"key": "business", "label": "Doanh nghiệp"},
  "tags": [{"slug": "ket-qua-kinh-doanh", "label": "Kết quả kinh doanh"}],
  "thumbnail": null,
  "images": [],
  "attachments": [],
  "media": [],
  "source": {"slug": "example", "name": "Nguồn minh họa", "url": "https://example.com"},
  "symbols": [],
  "unresolved_symbols": [],
  "sentiment": {
    "status": "ready",
    "label": "positive",
    "score": 0.6,
    "confidence": null,
    "method": "rules",
    "analyzer_version": "rules-vi-demo-1",
    "analyzed_at": "2026-09-29T04:23:00Z",
    "horizon": null,
    "rationale": "Bài nêu kết quả kinh doanh cải thiện.",
    "evidence": [{"block_id": "p1", "quote": "doanh thu tăng so với cùng kỳ"}]
  },
  "content_access": "full_text",
  "extraction_status": "complete",
  "quality_flags": [],
  "reading_time_minutes": 1
}
```

Các trường chi tiết bổ sung:

- `symbols[]`: `security_id`, `symbol`, `exchange`, `company_name`, `is_primary`,
  `match_method`, `match_confidence`, `evidence[]`, `sentiment` có cùng shape toàn bài.
- `thumbnail`/`images[]`: `{id,url,alt,caption,credit,width,height,position}`; trường không có
  nullable. `attachments[]`: `{id,url,title,mime_type,byte_size,extraction_status}`.
  `media[]` chỉ trả metadata/link an toàn, không trả embed HTML từ nguồn.
- `unresolved_symbols` chỉ có candidate text và lý do chưa xác minh, không security ID bịa.
- `content` map từ `content_text`; `authors` hỗ trợ nhiều người thay trường author đơn trong ảnh.
  `source` là object thay chuỗi để có cả tên, slug và liên kết. Giữ đủ ý nghĩa các trường ảnh 2.
- Metadata-only/link-only: `content=null`, `content_blocks=[]`, chỉ trả nội dung được phép;
  evidence có thể giới hạn ở title/description public. UI không lấy raw DB để vượt policy.
- Pending/failed/stale: label/score/confidence/rationale/evidence hiện tại không dùng lại
  từ revision cũ. API trả label/score/confidence null và evidence rỗng; UI giữ trạng thái rõ ràng.
- Không public raw HTML, storage key, parser config, job payload, stack trace hoặc hồ sơ policy nội bộ.

### 1.4 HTTP, cache và lỗi

- Lỗi thống nhất: `{"error":{"code":"INVALID_CURSOR","message":"Bộ lọc hoặc con trỏ không hợp lệ.","request_id":"...","details":[]}}`.
  422 input sai, 401 chưa đăng nhập admin, 403 thiếu quyền, 404/410 theo bảng trên,
  409 idempotency/version conflict, 429 kèm Retry-After, 503 dependency unavailable.
- Đọc bài không crawl hay chạy model ngay trong request. DB lỗi trả 503 an toàn; nguồn đang
  lỗi vẫn đọc được dữ liệu đã lưu với freshness phù hợp.
- MVP dùng DB trực tiếp, HTTP `Cache-Control: no-store` để tránh giấu cập nhật/takedown và
  giảm độ phức tạp. Chỉ bổ sung Redis cache sau đo hiệu năng; phải có key version, TTL,
  invalidation sau commit, policy takedown và fallback. Personalized/admin luôn no-store.
- Rate limit khởi điểm public 120 request/phút/client; chỉ tin forwarded IP qua proxy được
  cấu hình. Admin 10 mutations/phút/account; giới hạn điều chỉnh bằng cấu hình và đo tải.

## 2. API vận hành nội bộ

Không làm giao diện admin đầy đủ trong MVP. Các endpoint dưới đây chỉ enable khi auth/role
backend thật đã sẵn sàng; trước đó chạy tác vụ qua entrypoint nội bộ được kiểm soát.

| Endpoint | Quyền | Hành vi |
| --- | --- | --- |
| `GET /admin/news/sources` | news:read | Tình trạng nguồn/last-success/lỗi đã làm sạch |
| `PATCH /admin/news/sources/{id}` | news:manage | Pause/resume, lịch và policy allowlist; If-Match/row_version; audit |
| `POST /admin/news/crawl-runs` | news:ingest | source_ids + mode incremental/backfill + date range có giới hạn; 202 operation ID |
| `GET /admin/news/crawl-runs/{id}` | news:read | queued/running/succeeded/partial/failed, counters và lỗi an toàn |
| `POST /admin/news/{id}/reprocess` | news:manage | stage parse/resolve/analyze, version được allowlist; 202 job ID |
| `GET /admin/news/jobs/{id}` | news:read | Trạng thái operation reprocess, attempt/progress, terminal error code |

POST yêu cầu `Idempotency-Key`, lưu cùng normalized request hash/job trong DB 24 giờ; cùng key
cùng body trả cùng operation, khác body trả 409. Crawl-run creation và insert discovery jobs
trong cùng transaction; status resource có ngay sau commit. 202 có `Location` tới resource trạng
thái. Không nhận URL tùy ý từ user công khai; không cho chọn đường file hoặc tên class adapter.
PATCH reject unknown fields/empty body; policy domain mới phải qua validation SSRF và audit.

## 3. Header trắng theo ảnh tham chiếu

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo InvestIQ]  Tổng quan  Danh mục  Dự báo AI  Kiểm thử chiến lược  [Tin tức]             │
│                                                  [⌕ Tìm mã, tên DN, tin tức] [🔔] [User] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Sơ đồ tách dòng để đọc trong tài liệu; desktop >=1280px xếp **cùng một hàng** như ảnh.

- Cao 72px, nền `#FFFFFF`, chữ chính `#111827`, viền dưới `#E5E7EB`, sticky top,
  nội dung max-width 1440px và padding ngang 24px.
- Logo bên trái, giữ đúng tỷ lệ, khung tối đa 120×32px; ưu tiên SVG/PNG gốc trong
  `frontend/public/`. Không kéo dãn/cắt ảnh header để giả asset logo.
- Nav giữ thứ tự ảnh: Tổng quan `/`, Danh mục `/portfolio`, Dự báo AI `/predictions`,
  Kiểm thử chiến lược `/backtesting`, Tin tức `/news`.
- Active Tin tức dùng nền `#F3F4F6`, chữ đen đậm, gạch chân accent xanh `#2563EB`;
  còn lại chữ đen/xám đậm, hover nền xám nhạt. `aria-current="page"` theo route.
- Search label rõ, `Ctrl/Cmd+K` focus; gợi ý chia “Mã chứng khoán” và “Tin tức”.
  Chọn mã mở danh sách có filter; enter text mở `/news?q=...`. Debounce 300ms, hủy request cũ.
- Chuông và avatar theo bố cục ảnh nhưng lấy dữ liệu thật. Nếu notification chưa có thì ẩn
  chuông; khách thấy “Đăng nhập”, không hiển thị tên Alex Mercer hoặc số thông báo giả.
- 768–1279px dùng menu thu gọn để tránh ép chật; <768px cao 64px, logo + search icon +
  menu + account; menu drawer có đủ nav và label. Escape đóng, trả focus về nút mở.

## 4. Trang danh sách `/news`

### Bố cục và phong cách

```text
HEADER TRẮNG
Tin tức thị trường                           Cập nhật lúc …  [Làm mới]
Đọc tin và theo dõi diễn biến liên quan đến doanh nghiệp
[Tìm kiếm tin hoặc mã…                                                 ]
[Nguồn ▾] [Mã cổ phiếu ▾] [Chuyên mục ▾] [Sắc thái ▾] [Thời gian ▾] [Xóa lọc]
[Chip bộ lọc đang chọn ×]                            [Mới nhất ▾]
┌───────────────────────────────────────────────┬───────────────────────┐
│ Bài mới đáng chú ý: thumbnail + title + sapo    │ Mã xuất hiện trong tin│
│ nguồn • giờ đăng • chip mã • nhãn sắc thái      │ FPT … / HPG … / …     │
├───────────────────────────────────────────────┤                       │
│ [Ảnh] Tiêu đề tin tiếp theo                    │ Tình trạng cập nhật   │
│       Mô tả 2 dòng / nguồn / mã / sắc thái      │ các nguồn đang chọn   │
│ [Ảnh] …                                       │                       │
│                    [Xem thêm]                 │                       │
└───────────────────────────────────────────────┴───────────────────────┘
```

- Nền trang `#F8FAFC`, card trắng viền `#E5E7EB`, radius 12px, bóng nhẹ; font có đầy đủ
  tiếng Việt theo stack sẵn có, không thêm font service ngoài nếu chưa cần.
- Container 1280px, desktop main/sidebar tỷ lệ khoảng 3:1, gap 24px; main dùng hàng tin
  thumbnail 160×100px, title 18–20px, sapo 14–16px. Bài dẫn đầu chỉ là bài mới nhất đủ
  dữ liệu, không tự gọi “quan trọng nhất” nếu chưa có tiêu chí biên tập.
- Sidebar “Mã xuất hiện trong tin” tính từ **các bài đã tải**, có nhãn phạm vi đó; không gọi
  là cổ phiếu tăng mạnh hoặc xu hướng toàn thị trường. Nguồn/status dùng `news-sources`.
- Không dựng bảng VN-Index/giá/% thay đổi giả khi chưa có API market data thật.
- Mỗi card: nguồn, ngày/giờ, nhãn “Ngày ghi nhận” nếu thiếu ngày đăng, thumbnail fallback,
  title tối đa 3 dòng, description 2 dòng, tối đa 3 chip mã + “+N”, nhãn sắc thái bằng chữ.
- Sắc thái: xanh `#166534` trên `#DCFCE7` cho tích cực; đỏ `#991B1B` trên `#FEE2E2` cho
  tiêu cực; xám cho trung tính; vàng/nâu cho trái chiều. Luôn có label/icon, không chỉ màu.
- Filter state trong URL, hỗ trợ copy link/back/forward; đổi filter reset cursor. “Xem thêm”
  giữ vị trí scroll, dedupe theo article ID; refresh thủ công reset snapshot và báo tin mới.
- <1024px bỏ sidebar hoặc đưa xuống cuối; <768px một cột, filter trong bottom sheet có
  nút Áp dụng/Xóa, chip active vẫn thấy bên ngoài. Không tạo horizontal scroll toàn trang.
- Không thêm bookmark/watchlist cá nhân trong MVP khi chưa có auth + API lưu tương ứng.

## 5. Trang chi tiết `/news/{id}`

```text
HEADER TRẮNG
Tin tức / Doanh nghiệp
TIÊU ĐỀ BÀI VIẾT
Nguồn ↗ • Tác giả • Đăng lúc … • Cập nhật … • Khoảng N phút đọc
[FPT · HOSE] [Mã khác]                        [Sao chép liên kết] [Đọc nguồn ↗]
┌─────────────────────────────────────────────────┬───────────────────────────┐
│ Sapo nổi bật                                    │ Đánh giá nội dung tự động │
│ Ảnh chính + chú thích + credit                   │ Tích cực / …              │
│                                                 │ Lý do và bằng chứng       │
│ Nội dung theo thứ tự gốc                         │ Theo từng mã              │
│ Heading / đoạn / quote / bảng / ảnh              │ FPT: … ; HPG: …           │
│ Tài liệu đính kèm                                │ Thời điểm / phương pháp   │
│                                                 │                           │
│ Tags • nguồn bài • ghi nhận nội dung thiếu       │ Mục lục nếu >=3 headings  │
└─────────────────────────────────────────────────┴───────────────────────────┘
Tin liên quan: cùng mã/chuyên mục, tối đa 6 bài, không lặp bài hiện tại
```

- Vùng đọc rộng 700–760px, font body 18px, line-height 1.75, khoảng đoạn 16–20px;
  headline desktop 32–36px/mobile 26–28px. Không để câu kéo dài hết màn hình.
- Phân biệt giờ nguồn đăng/cập nhật với giờ hệ thống thu thập. Tác giả vắng thì bỏ nhãn;
  không in “null”. `reading_time` tính từ word count, là ước tính.
- Ảnh có kích thước/aspect ratio để tránh layout shift, alt/caption/credit khi có; lazy load
  phía dưới màn hình. Ảnh lỗi dùng placeholder nhẹ, không phá khối bài.
- Bảng có caption/header, vùng cuộn ngang riêng có thể focus bằng bàn phím. File có tên,
  loại, dung lượng nếu biết; file unsupported vẫn có link nguồn và trạng thái rõ.
- Panel sentiment tách thị giác khỏi lời tác giả. Nhấn evidence cuộn/highlight đúng đoạn
  của revision đang xem; không highlight một đoạn từ revision khác. Confidence null thì
  ẩn phần trăm; có thì ghi “Độ tin cậy phân loại”, không “xác suất tăng giá”.
- Mobile panel sentiment nằm sau sapo, thu gọn được; nội dung bài và button đọc nguồn luôn
  dễ tiếp cận. Mục lục chỉ tạo từ heading có thật, không tự thêm phân tích vào bài nguồn.
- Metadata-only/link-only có thông báo “Nguồn này chỉ cung cấp thông tin tóm tắt tại InvestIQ”
  và nút đọc nguồn; không để vùng nội dung trắng như lỗi.
- Link ngoài dùng giao thức allowlist và `rel="noopener noreferrer"` khi mở tab mới.
  HTML/JSON-LD/URL từ crawler đều không tin cậy; sanitizer + React escaping + CSP phù hợp.

## 6. Trạng thái và khả năng truy cập

| Trạng thái | Cách hiển thị và thao tác |
| --- | --- |
| Loading | Skeleton giữ kích thước; busy state có nhãn, không nhấp nháy |
| Chưa có tin | Giải thích chưa thu thập được bài; có làm mới và trạng thái nguồn |
| Không khớp filter | Hiển thị filter hiện tại, nút xóa lọc; không nói hệ thống chưa có tin |
| API lỗi | Thông báo ngắn + thử lại; giữ filter, không biến lỗi thành danh sách rỗng |
| Nguồn chậm | Banner dữ liệu cập nhật chậm + mốc last-success; bài cũ vẫn đọc được |
| Nội dung thiếu | Badge thu thập một phần + trường/ảnh thiếu; đọc nguồn để xem thêm |
| Sentiment pending/failed/unknown | “Đang phân tích” / “Chưa phân tích được” / “Chưa đủ cơ sở đánh giá” |
| Bài bị gỡ | Trang 410, giải thích ngắn và link quay về tin; không lộ body đã gỡ |
| ID không tồn tại | Trang 404; không nhầm với nguồn crawl tạm lỗi |

Đạt WCAG contrast 4.5:1 cho body, 3:1 cho thành phần lớn/UI; kiểm tra token thật khi làm UI.
Touch target >=44px, focus-visible, skip link, semantic nav/main/article/time, input có label,
drawer quản lý focus và Escape. Test 360/768/1024/1440px, zoom 200%, tiếng Việt dài,
reduced-motion và toàn bộ flow bằng bàn phím.

## 7. Thiết kế thuận tiện deploy, không thực hiện deploy

- Browser gọi relative `/api/v1/...` cùng origin Nginx hiện tại; không hard-code localhost,
  host Docker hoặc domain production trong component.
- Server Components dùng biến server-only `API_INTERNAL_BASE_URL` với đường mạng nội bộ;
  browser không nhận secret hoặc địa chỉ DB. Nếu UI/API khác origin sau này, cấu hình
  CORS allowlist chính xác ở backend; ưu tiên cùng origin cho phiên bản đầu.
- API stateless, đọc/ghi PostgreSQL chính; worker chạy riêng và dùng cùng backend image.
  Redis DB 0/1/2 giữ đúng quy ước repo; một Beat. Không thêm replica hoặc broker mới.
- Cấu hình đề xuất: source enable/rate limits, HTTP timeouts, `NEWS_INGESTION_ENABLED`,
  `NEWS_SENTIMENT_ENABLED`, analyzer version, storage bucket/prefix và backup schedule/retention.
  Secret cấp runtime, validate startup, tài liệu hóa trong `.env.example` khi triển khai.
- Dùng pool có giới hạn; tổng pool API/worker/migration/backup thấp hơn max_connections.
  Crawl/model không chạy trong HTTP handler, không tự khởi động Beat theo mỗi API replica.
- Migration chạy bước riêng, không trong startup API; expand/contract, job payload versioned,
  parser/analyzer version có thể rollback độc lập. Không xóa column ngay khi rollout bản mới.
- Liveness hiện có chỉ kiểm process, readiness cần DB; giữ hợp đồng readiness Redis hiện tại
  cho tới khi có thay đổi riêng được kiểm thử. Endpoint news đọc DB không tự phụ thuộc Redis.
- Log stdout có request/job/source ID và error code đã làm sạch, không raw bài/secret.
  Crawler và backup có metric/status riêng; không đưa lỗi hạ tầng chi tiết lên trang người dùng.
- Runtime không phụ thuộc ổ đĩa tạm cho dữ liệu bền vững; file dùng storage adapter cấu hình,
  backup ra nơi độc lập. Chưa chọn nhà cung cấp cloud, chưa thêm cấu hình deploy mới.

## 8. Nghiệm thu hợp đồng và UI

1. List → filter mã → detail → đọc nguồn → back giữ được bộ lọc; deep link mở đúng trạng thái.
2. Title/body/source/author/date/image/table/attachment khớp fixture nguồn được phép sử dụng;
   thiếu trường hiện đúng fallback và không có placeholder trông như dữ liệu thật.
3. Một bài hai mã có sentiment trái nhau vẫn hiển thị/lọc đúng từng mã; pending khác neutral.
4. Bài update đổi revision; kết quả cũ không hiện như phân tích revision mới. Withdrawn không
   còn xuất hiện ở list/search/related; policy giới hạn nội dung áp dụng cả SSR và API.
5. Bộ test API kiểm enum/null/pagination/filter scope/422/401/403/409/429/503; export OpenAPI
   và sinh client trong cùng thay đổi, không giữ bản DTO viết tay cạnh tranh.
6. Header đúng nền trắng/chữ đen, nav đúng route, logo dùng asset được xác định; menu/search
   hoạt động ở các breakpoint, không cần đăng nhập để đọc tin công khai.
7. Frontend lint/typecheck, component tests và E2E trọng tâm chạy được; kiểm bằng dev server,
   không chạy production build trong phiên tương tác.
