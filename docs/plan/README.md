# Kế hoạch tính năng InvestIQ

Thư mục lưu đặc tả và kế hoạch triển khai. Trạng thái thực tế của tính năng tin tức được ghi trong
báo cáo thực thi; có mã đã hoàn thành không đồng nghĩa hệ thống đã được deploy hoặc bật crawl thật.

| Tài liệu | Nội dung |
| --- | --- |
| [Tin tức chứng khoán Việt Nam](vietnam-stock-news.md) | Phạm vi, nguồn crawl, pipeline, nhận diện mã, sentiment, lộ trình và nghiệm thu |
| [Database và backup](news-database.md) | Schema, quan hệ, chỉ mục, phiên bản nội dung, giao dịch và backup định kỳ |
| [API và giao diện](news-api-ui.md) | Hợp đồng API, header trắng, trang danh sách/chi tiết và thiết kế thuận tiện deploy |

Yêu cầu được chốt ngày 29/09/2026: **chỉ backup định kỳ, không triển khai database replica**.

## Kết quả thực thi

MVP hai nguồn đã được lập trình và kiểm thử. Xem [báo cáo research, triển khai và kiểm
thử](news-implementation-report.md) để biết bằng chứng cùng các cổng còn lại trước khi bật crawl thật.
