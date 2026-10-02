"""VnExpress business RSS adapter restricted to securities-market topics."""

import unicodedata
import xml.etree.ElementTree as ET

from app.infrastructure.external.crawlers.base import (
    BaseNewsCrawler,
    NewsProviderError,
    UnsafeProviderUrl,
    validate_provider_url,
)

STOCK_MARKET_TERMS = (
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
    "cong ty chung khoan",
    "trai phieu",
    "co tuc",
    "chung chi quy",
    "quy etf",
)


def _normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


class VnExpressCrawler(BaseNewsCrawler):
    source_slug = "vnexpress"
    allowed_domains = ("vnexpress.net",)
    discovery_urls = ("https://vnexpress.net/rss/kinh-doanh.rss",)
    content_selectors = ()
    description_selectors = (".description",)

    def parse_discovery_document(self, document: str) -> tuple[str, ...]:
        """Keep only securities-market entries from the broader business feed."""
        try:
            root = ET.fromstring(document)
        except ET.ParseError as exc:
            raise NewsProviderError("provider discovery document is invalid XML") from exc

        urls: list[str] = []
        for item in root.iter():
            if item.tag.rsplit("}", 1)[-1].lower() != "item":
                continue
            fields = {
                child.tag.rsplit("}", 1)[-1].lower(): child.text.strip()
                for child in item
                if child.text and child.text.strip()
            }
            title = fields.get("title")
            article_url = fields.get("link")
            if not title or not article_url:
                continue
            if not any(term in _normalized(title) for term in STOCK_MARKET_TERMS):
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
