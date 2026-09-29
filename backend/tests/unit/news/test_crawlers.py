from datetime import UTC, datetime

import pytest

from app.infrastructure.external.crawlers.base import (
    NewsProviderError,
    UnsafeProviderUrl,
    canonicalize_url,
    validate_provider_url,
)
from app.infrastructure.external.crawlers.cafef_crawler import CafeFCrawler
from app.infrastructure.external.crawlers.vietstock_crawler import VietstockCrawler

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


def test_discovery_accepts_rss_and_sitemap_but_rejects_foreign_hosts() -> None:
    rss = """<rss><channel>
      <link>https://vietstock.vn/0/tin-moi.rss</link>
      <item><link>https://vietstock.vn/a.htm?utm_source=feed</link></item>
      <item><link>https://malicious.example/private</link></item>
    </channel></rss>"""

    assert VietstockCrawler().parse_discovery_document(rss) == ("https://vietstock.vn/a.htm",)


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
