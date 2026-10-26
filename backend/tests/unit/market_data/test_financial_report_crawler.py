from unittest.mock import MagicMock, patch

from app.infrastructure.external.crawlers.financial_report_crawler import (
    FinancialReportCrawler,
)

SAMPLE_CAFEF_HTML = """
<html>
<body>
  <div class="search-content-wrap">
    <div>
      <h3><a href="/fpt-lai-hon-2700-ty-trong-quy-3-tiep-tuc-lap-ky-luc-moi-188261021093213162.chn">
        FPT lãi hơn 2.700 tỷ trong quý 3, tiếp tục lập kỷ lục mới
      </a></h3>
      <p class="sapo">Lợi nhuận sau thuế của FPT tiếp tục lập kỷ lục mới trong quý 3/2026.</p>
      <img src="https://cafefcdn.com/zoom/260_163/avatar.jpg" />
    </div>
    <div>
      <h3><a href="/vietcap-dieu-chinh-loat-du-bao-ve-fpt-188261020145848592.chn">
        Vietcap điều chỉnh loạt dự báo tăng trưởng về FPT
      </a></h3>
      <p class="sapo">Vietcap dự báo lợi nhuận sau thuế FPT tăng 14%/năm giai đoạn 2026-2029.</p>

      <img src="https://cafefcdn.com/zoom/260_163/chart.jpg" />
    </div>
    <div>
      <h3><a href="/fpt-ky-ket-hop-tac-mo-rong-du-an-nha-may-188260815123456789.chn">
        FPT hợp tác mở rộng dự án nhà máy AI toàn cầu
      </a></h3>
      <p class="sapo">FPT ký kết hợp tác đầu tư quy mô lớn mở rộng hạ tầng AI.</p>
    </div>
    <div>
      <!-- Outdated article from 2022 -->
      <h3><a href="/fpt-tong-ket-nam-cu-188220101123456789.chn">
        FPT tổng kết kết quả kinh doanh năm cũ 2021
      </a></h3>
      <p class="sapo">Nội dung cũ từ 2022.</p>
    </div>
  </div>
</body>
</html>
"""


def test_financial_report_crawler_parsing_and_filtering() -> None:
    crawler = FinancialReportCrawler()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = SAMPLE_CAFEF_HTML

    with patch("httpx.Client.get", return_value=mock_resp):
        reports = crawler.get_financial_reports("FPT", limit=5)

    # 3 recent articles should pass, 1 outdated (< 2025) should be skipped
    assert len(reports) == 3

    r1 = reports[0]
    assert "FPT lãi hơn 2.700 tỷ" in r1["title"]
    assert "Lợi nhuận sau thuế" in r1["summary"]
    assert r1["image_url"] == "https://cafefcdn.com/zoom/260_163/avatar.jpg"
    assert r1["published_at"] == "21/10/2026"
    assert r1["tag"] == "Kết quả kinh doanh & BCTC"
    assert "https://cafef.vn/fpt-lai-hon-2700-ty" in r1["article_url"]

    r2 = reports[1]
    assert "Vietcap điều chỉnh loạt dự báo" in r2["title"]
    assert r2["image_url"] == "https://cafefcdn.com/zoom/260_163/chart.jpg"
    assert r2["published_at"] == "20/10/2026"
    assert r2["tag"] == "Dự phóng & Triển vọng"

    r3 = reports[2]
    assert "FPT hợp tác mở rộng" in r3["title"]
    assert r3["tag"] == "Đầu tư & Mở rộng"
    assert r3["image_url"] is None


def test_financial_report_crawler_cache_reuse() -> None:
    crawler = FinancialReportCrawler()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = SAMPLE_CAFEF_HTML

    with patch("httpx.Client.get", return_value=mock_resp) as mock_get:
        res1 = crawler.get_financial_reports("FPT", limit=2)
        res2 = crawler.get_financial_reports("FPT", limit=2)
        assert len(res1) == 2
        assert len(res2) == 2
        # HTTP client should only be called once due to cache
        assert mock_get.call_count == 1


def test_financial_report_crawler_handles_http_failure() -> None:
    crawler = FinancialReportCrawler()

    with patch("httpx.Client.get", side_effect=Exception("Network connection timeout")):
        reports = crawler.get_financial_reports("UNKNOWN_SYM", limit=5)
        # Should gracefully return empty list without crashing
        assert reports == []
