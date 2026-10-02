"""CafeF news-sitemap and article adapter."""

import unicodedata
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

from app.infrastructure.external.crawlers.base import (
    BaseNewsCrawler,
    NewsProviderError,
    UnsafeProviderUrl,
    validate_provider_url,
)

NEWS_NAMESPACE = "http://www.google.com/schemas/sitemap-news/0.9"
MARKET_TERMS = (
    "chung khoan",
    "co phieu",
    "vn-index",
    "vnindex",
    "hose",
    "hnx",
    "upcom",
    "niem yet",
    "khoi ngoai",
    "tu doanh",
    "ctck",
    "doanh nghiep",
    "ngan hang",
    "tai chinh",
    "thi truong",
    "kinh te",
    "lai suat",
    "ty gia",
    "trai phieu",
    "co tuc",
    "loi nhuan",
    "von hoa",
    "dhdcd",
    "ipo",
    "gdp",
    "fdi",
)
HIGH_SIGNAL_TERMS = (
    "chung khoan",
    "co phieu",
    "vn-index",
    "vnindex",
    "hose",
    "hnx",
    "upcom",
    "niem yet",
    "khoi ngoai",
    "tu doanh",
    "ctck",
    "lai suat",
    "trai phieu",
    "co tuc",
    "loi nhuan",
    "von hoa",
    "dhdcd",
    "ipo",
)
EXCLUDED_TERMS = (
    "khoi to",
    "cong an",
    "lua dao",
    "ma tuy",
    "hoc sinh",
    "sinh vien",
)


def _normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


class CafeFCrawler(BaseNewsCrawler):
    source_slug = "cafef"
    allowed_domains = ("cafef.vn",)
    discovery_urls = ("https://cafef.vn/google-news-sitemap.xml",)
    naive_datetime_timezone = ZoneInfo("Asia/Ho_Chi_Minh")
    content_selectors = (
        "[data-role='content']",
        ".detail-content",
        ".contentdetail",
        ".content-news-detail",
    )
    description_selectors = (".sapo", ".detail-sapo", ".knc-sapo")

    def parse_discovery_document(self, document: str) -> tuple[str, ...]:
        """Return only finance/market article URLs from CafeF's mixed-topic sitemap."""
        try:
            root = ET.fromstring(document)
        except ET.ParseError as exc:
            raise NewsProviderError("provider discovery document is invalid XML") from exc

        urls: list[str] = []
        for entry in root:
            if entry.tag.rsplit("}", 1)[-1].lower() != "url":
                continue
            article_url = next(
                (
                    child.text.strip()
                    for child in entry
                    if child.tag.rsplit("}", 1)[-1].lower() == "loc" and child.text
                ),
                None,
            )
            news_title = next(
                (
                    node.text.strip()
                    for node in entry.iter(f"{{{NEWS_NAMESPACE}}}title")
                    if node.text
                ),
                None,
            )
            if not article_url or not news_title:
                continue
            normalized_title = _normalized(news_title)
            if not any(term in normalized_title for term in MARKET_TERMS):
                continue
            if any(term in normalized_title for term in EXCLUDED_TERMS) and not any(
                term in normalized_title for term in HIGH_SIGNAL_TERMS
            ):
                continue
            try:
                safe_url = validate_provider_url(
                    article_url, self.allowed_domains, resolve_dns=False
                )
            except UnsafeProviderUrl:
                continue
            if safe_url not in urls:
                urls.append(safe_url)
        return tuple(urls)
