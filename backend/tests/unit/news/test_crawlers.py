import gzip
from datetime import UTC, date, datetime

import pytest

from app.infrastructure.external.crawlers.base import (
    BoundedHttpClient,
    NewsProviderError,
    UnsafeProviderUrl,
    _decode_response_body,
    canonicalize_url,
    validate_provider_url,
)
from app.infrastructure.external.crawlers.cafef_crawler import CafeFCrawler
from app.infrastructure.external.crawlers.hnx_crawler import HnxCrawler
from app.infrastructure.external.crawlers.stockbiz_crawler import StockBizCrawler
from app.infrastructure.external.crawlers.vietstock_crawler import VietstockCrawler
from app.infrastructure.external.crawlers.vneconomy_crawler import VnEconomyCrawler
from app.infrastructure.external.crawlers.vnexpress_crawler import VnExpressCrawler

VIETSTOCK_HTML = """
<html><head>
  <link rel="canonical" href="https://vietstock.vn/chung-khoan/fpt-khoi-sac-123.htm?utm_source=x">
  <meta property="og:title" content="FPT ghi nhận lợi nhuận tăng mạnh">
  <meta property="og:description" content="Kết quả kinh doanh tích cực.">
  <meta property="article:section" content="Chứng khoán">
  <script type="application/ld+json">{
    "@type":"NewsArticle", "datePublished":"2026-09-29T08:30:00+07:00",
    "dateModified":"2026-09-29T09:00:00+07:00", "author":{"name":"Minh An"},
    "keywords":"FPT; công nghệ"
  }</script>
</head><body><article itemprop="articleBody">
  <p>Doanh nghiệp (HOSE: FPT) ghi nhận lợi nhuận tăng mạnh trong quý.</p>
  <h2>Kết quả kinh doanh</h2>
  <p>Doanh thu vượt kế hoạch đề ra.</p>
  <img data-src="/images/fpt.jpg" alt="Trụ sở FPT">
</article></body></html>
"""

CAFEF_HTML = """
<html><head>
  <link rel="canonical" href="https://cafef.vn/hpg-cap-nhat.chn">
  <meta property="og:title" content="HPG cập nhật hoạt động kinh doanh">
  <meta name="description" content="Thông tin mới từ doanh nghiệp.">
</head><body>
  <div class="detail-content"><p>HOSE: HPG có sản lượng tăng trưởng trong tháng.</p></div>
</body></html>
"""


def test_vietstock_parser_extracts_article_fields_and_symbols() -> None:
    article = VietstockCrawler().parse_article(
        VIETSTOCK_HTML,
        "https://vietstock.vn/chung-khoan/fpt-khoi-sac-123.htm",
        fetched_at=datetime(2026, 9, 29, 3, 0, tzinfo=UTC),
    )

    assert article.title == "FPT ghi nhận lợi nhuận tăng mạnh"
    assert article.canonical_url == "https://vietstock.vn/chung-khoan/fpt-khoi-sac-123.htm"
    assert article.authors == ("Minh An",)
    assert article.candidate_symbols == ("HOSE:FPT",)
    assert article.content_text and "vượt kế hoạch" in article.content_text
    assert article.assets[0].url == "https://vietstock.vn/images/fpt.jpg"
    assert article.published_at == datetime(2026, 9, 29, 1, 30, tzinfo=UTC)


def test_cafef_parser_uses_source_specific_content_selector() -> None:
    article = CafeFCrawler().parse_article(
        CAFEF_HTML,
        "https://cafef.vn/hpg-cap-nhat.chn",
        fetched_at=datetime(2026, 9, 29, tzinfo=UTC),
    )

    assert article.source_slug == "cafef"
    assert article.candidate_symbols == ("HOSE:HPG",)
    assert article.content_text == "HOSE: HPG có sản lượng tăng trưởng trong tháng."


def test_cafef_parser_interprets_naive_publisher_time_as_vietnam_time() -> None:
    html = """
    <html><head>
      <link rel="canonical" href="https://cafef.vn/hpg-cap-nhat.chn">
      <meta property="og:title" content="HPG cap nhat">
      <meta property="article:published_time" content="2026-09-30T20:30:00">
    </head><body>
      <div class="detail-content"><p>HOSE: HPG cap nhat hoat dong kinh doanh.</p></div>
    </body></html>
    """

    article = CafeFCrawler().parse_article(
        html,
        "https://cafef.vn/hpg-cap-nhat.chn",
        fetched_at=datetime(2026, 9, 30, 14, 0, tzinfo=UTC),
    )

    assert article.published_at == datetime(2026, 9, 30, 13, 30, tzinfo=UTC)


def test_discovery_accepts_rss_and_sitemap_but_rejects_foreign_hosts() -> None:
    rss = """<rss><channel>
      <link>https://vietstock.vn/0/tin-moi.rss</link>
      <item><link>https://vietstock.vn/a.htm?utm_source=feed</link></item>
      <item><link>https://malicious.example/private</link></item>
    </channel></rss>"""

    assert VietstockCrawler().parse_discovery_document(rss) == ("https://vietstock.vn/a.htm",)


def test_discovery_drops_explicitly_stale_feed_entries_before_fetching_articles() -> None:
    rss = """<rss><channel>
      <item><link>https://vietstock.vn/current.htm</link>
        <pubDate>Wed, 30 Sep 2026 10:00:00 GMT</pubDate></item>
      <item><link>https://vietstock.vn/old.htm</link>
        <pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
    </channel></rss>"""
    crawler = VietstockCrawler()
    urls = crawler.parse_discovery_document(rss)

    recent = crawler._recent_discovery_urls(rss, urls, datetime(2026, 9, 27, 12, tzinfo=UTC))

    assert recent == ("https://vietstock.vn/current.htm",)


def test_cafef_discovery_filters_topics_and_ignores_image_urls() -> None:
    sitemap = """<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
      xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <url>
        <loc>https://cafef.vn/co-phieu-ngan-hang-tang.chn</loc>
        <news:news><news:title>Cổ phiếu ngân hàng tăng mạnh</news:title></news:news>
        <image:image>
          <image:loc>https://cafefcdn.com/chart.jpg</image:loc>
          <image:title>Ảnh minh họa</image:title>
        </image:image>
      </url>
      <url>
        <loc>https://cafef.vn/mon-an-cuoi-tuan.chn</loc>
        <news:news><news:title>Món ăn ngon cuối tuần</news:title></news:news>
      </url>
      <url>
        <loc>https://cafef.vn/khoi-to-mo-tai-khoan.chn</loc>
        <news:news>
          <news:title>Khởi tố sinh viên mở tài khoản ngân hàng để bán</news:title>
        </news:news>
      </url>
      <url>
        <loc>https://malicious.example/co-phieu.chn</loc>
        <news:news><news:title>Chứng khoán hôm nay</news:title></news:news>
      </url>
    </urlset>"""

    assert CafeFCrawler().parse_discovery_document(sitemap) == (
        "https://cafef.vn/co-phieu-ngan-hang-tang.chn",
    )


def test_url_validation_rejects_credentials_and_non_allowlisted_hosts() -> None:
    assert canonicalize_url("HTTPS://CafeF.vn/a.chn?utm_source=x&id=1#part") == (
        "https://cafef.vn/a.chn?id=1"
    )
    with pytest.raises(UnsafeProviderUrl):
        validate_provider_url("https://user:pass@cafef.vn/a", ("cafef.vn",), resolve_dns=False)
    with pytest.raises(UnsafeProviderUrl):
        validate_provider_url("https://cafef.vn.evil.example/a", ("cafef.vn",), resolve_dns=False)
    with pytest.raises(UnsafeProviderUrl):
        validate_provider_url("https://:secret@cafef.vn/a", ("cafef.vn",), resolve_dns=False)


def test_invalid_discovery_xml_has_stable_provider_error() -> None:
    with pytest.raises(NewsProviderError, match="invalid XML"):
        CafeFCrawler().parse_discovery_document("<not-closed>")


def test_http_body_decoder_handles_provider_gzip_without_response_header() -> None:
    html = "<html><title>Compressed provider</title></html>"

    assert _decode_response_body(gzip.compress(html.encode()), "utf-8") == html


def test_parser_preserves_thumbnail_lists_tables_and_attachments() -> None:
    html = """
    <html><head>
      <meta property="og:title" content="FPT quarterly update">
      <meta property="og:image" content="/images/fpt-cover.jpg">
    </head><body><article itemprop="articleBody">
      <p>HOSE:FPT reports growth.</p>
      <ul><li>Revenue increased</li><li>Margin improved</li></ul>
      <table><tr><th>Metric</th><th>Value</th></tr><tr><td>Profit</td><td>100</td></tr></table>
      <img src="/images/fpt-inline.jpg" alt="FPT office">
      <a href="/documents/fpt.pdf">FPT report</a>
    </article></body></html>
    """

    article = VietstockCrawler().parse_article(html, "https://vietstock.vn/fpt.htm")

    assert article.assets[0].role == "thumbnail"
    assert article.assets[0].url == "https://vietstock.vn/images/fpt-cover.jpg"
    assert any(asset.role == "inline" for asset in article.assets)
    assert any(asset.kind == "document" for asset in article.assets)
    assert any(block.type == "list" and len(block.items) == 2 for block in article.content_blocks)
    assert any(block.type == "table" and len(block.rows) == 2 for block in article.content_blocks)
    inline_asset = next(asset for asset in article.assets if asset.role == "inline")
    image_block = next(block for block in article.content_blocks if block.type == "image")
    assert image_block.url == inline_asset.url


def test_parser_rejects_unsafe_asset_schemes() -> None:
    html = """
    <html><head><meta property="og:title" content="Unsafe media"></head>
    <body><article itemprop="articleBody">
      <p>Article body long enough for parsing.</p>
      <img src="javascript:alert(1)">
      <a href="javascript:report.pdf">Open report</a>
    </article></body></html>
    """

    article = VietstockCrawler().parse_article(html, "https://vietstock.vn/a.htm")

    assert article.assets == ()
    assert article.extraction_status.value == "partial"
    assert article.quality_flags == ("content_short",)


def test_parser_cleans_publisher_suffix_and_ignores_empty_tables() -> None:
    html = """
    <html><head><meta property="og:title" content="Market update | Vietstock"></head>
    <body><article itemprop="articleBody">
      <p>This is a short market update.</p>
      <table><tr><td></td></tr></table>
    </article></body></html>
    """

    article = VietstockCrawler().parse_article(html, "https://vietstock.vn/update.htm")

    assert article.title == "Market update"
    assert all(block.type != "table" for block in article.content_blocks)


def test_parser_extracts_qualified_and_contextual_symbols_without_uppercase_noise() -> None:
    html = """
    <html><head><meta property="og:title" content="Cổ phiếu HDC được chú ý"></head>
    <body><article itemprop="articleBody">
      <p>HOSE: HDC tăng giá. Công ty công bố KẾ HOẠCH nhưng không gọi KẾ là mã cổ phiếu.</p>
    </article></body></html>
    """

    article = VietstockCrawler().parse_article(html, "https://vietstock.vn/hdc.htm")

    assert article.candidate_symbols == ("HOSE:HDC", "HDC")


def test_vneconomy_parser_keeps_only_publisher_metadata() -> None:
    html = """
    <html><head>
      <link rel="canonical" href="https://vneconomy.vn/co-phieu-fpt-tang.htm">
      <meta property="og:title" content="Cổ phiếu FPT tăng sau báo cáo lợi nhuận">
      <meta property="og:description" content="Nhà đầu tư quan tâm kết quả quý mới.">
      <meta name="article:published_time" content="2026-09-30T16:56:05+07:00">
      <meta property="og:image" content="https://media.vneconomy.vn/fpt.jpg">
      <script type="application/ld+json">{
        "@type":"NewsArticle", "datePublished":"2026-09-30T16:56:05&#x2B;07:00"
      }</script>
    </head><body><article><p>Nội dung toàn văn không được lưu.</p></article></body></html>
    """

    article = VnEconomyCrawler().parse_article(
        html,
        "https://vneconomy.vn/co-phieu-fpt-tang.htm",
        fetched_at=datetime(2026, 9, 30, 10, 0, tzinfo=UTC),
    )

    assert article.source_slug == "vneconomy"
    assert article.description == "Nhà đầu tư quan tâm kết quả quý mới."
    assert article.content_text is None
    assert article.content_blocks == ()
    assert article.extraction_status.value == "metadata_only"
    assert article.published_at == datetime(2026, 9, 30, 9, 56, 5, tzinfo=UTC)
    assert article.candidate_symbols == ("FPT",)


def test_vnexpress_discovery_filters_business_feed_to_stock_market_topics() -> None:
    rss = """<rss><channel>
      <item>
        <title>VN-Index giảm mạnh trong tháng</title>
        <link>https://vnexpress.net/vn-index-giam-123.html?utm_source=rss</link>
      </item>
      <item>
        <title>Giá cá tăng tại miền Tây</title>
        <link>https://vnexpress.net/gia-ca-tang-456.html</link>
      </item>
      <item>
        <title>Cổ phiếu ngân hàng hút dòng tiền</title>
        <link>https://malicious.example/co-phieu-789.html</link>
      </item>
    </channel></rss>"""

    assert VnExpressCrawler().parse_discovery_document(rss) == (
        "https://vnexpress.net/vn-index-giam-123.html",
    )


def test_hnx_discovery_normalizes_legacy_port_and_parser_reads_disclosure_time() -> None:
    rss = """<rss><channel>
    <item>
      <title>Thông báo tình trạng cổ phiếu ECI</title>
      <link>http://www.hnx.vn:7978/tin-cung-cap-rss-vi_vn-636013-1.html</link>
    </item>
    <item>
      <title>Kết quả giao dịch trái phiếu doanh nghiệp</title>
      <link>http://www.hnx.vn:7978/tin-cung-cap-rss-vi_vn-636014-1.html</link>
    </item>
    </channel></rss>"""
    html = """
    <html><head><title>Thông báo tình trạng cổ phiếu ECI</title></head><body>
      <div class="divContentArticlesDetail">
        <div class="Box-TieuDe"><label>Thông báo tình trạng cổ phiếu ECI</label></div>
        <div class="Box-Thoigian"><label>19:05 28/09/2026</label></div>
        <div class="Box-Tomtat"><label>Thông tin công bố chính thức từ HNX.</label></div>
        <div class="divLstFileAttach">
          <a href="https://owa.hnx.vn/ftp/cims/ECI.pdf">Thông báo ECI</a>
        </div>
      </div>
    </body></html>
    """
    crawler = HnxCrawler()

    assert crawler.parse_discovery_document(rss) == (
        "https://www.hnx.vn/tin-cung-cap-rss-vi_vn-636013-1.html",
    )
    article = crawler.parse_article(
        html,
        "https://www.hnx.vn/tin-cung-cap-rss-vi_vn-636013-1.html",
        fetched_at=datetime(2026, 9, 30, 10, 0, tzinfo=UTC),
    )

    assert article.title == "Thông báo tình trạng cổ phiếu ECI"
    assert article.published_at == datetime(2026, 9, 28, 12, 5, tzinfo=UTC)
    assert article.content_text is None
    assert article.extraction_status.value == "metadata_only"
    assert article.candidate_symbols == ("ECI",)
    assert article.assets[0].kind == "document"


def test_worker_crawler_registry_supports_all_active_sources() -> None:
    from app.workers.news_ingestion_worker import _crawler

    assert {
        _crawler(source).source_slug
        for source in ("vietstock", "cafef", "hnx", "stockbiz", "vneconomy", "vnexpress")
    } == {"vietstock", "cafef", "hnx", "stockbiz", "vneconomy", "vnexpress"}


def test_stockbiz_parser_uses_publisher_time_and_metadata_only_content() -> None:
    html = """<html><head><meta property="og:title" content="Cổ phiếu FPT tăng giá">
      <meta name="description" content="Tin thị trường chứng khoán"></head>
      <body><span class="news_date">02/10/2026 9:00:46 SA</span></body></html>"""
    article = StockBizCrawler().parse_article(
        html, "https://web.stockbiz.vn/News/2026/10/2/1910663/fpt.aspx"
    )
    assert article.published_at == datetime(2026, 10, 2, 2, 0, 46, tzinfo=UTC)
    assert article.content_text is None


def test_vietstock_archive_discovers_only_in_range_articles() -> None:
    class Client(BoundedHttpClient):
        def get_text(self, url: str) -> str:
            assert "page=2" in url
            return """<div class="channelContent">
              <a href="/2026/09/market-123.htm">Market</a>
              <a href="/2026/06/old-123.htm">Old</a>
              <a href="https://outside.example/2026/09/bad.htm">Bad</a>
            </div>"""

    crawler = VietstockCrawler(client=Client(("vietstock.vn",)))
    assert crawler.discover_history_page(2, date(2026, 7, 4), date(2026, 10, 4)) == (
        "https://vietstock.vn/2026/09/market-123.htm",
    )
