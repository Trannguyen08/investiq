"""Vietstock RSS and article adapter."""

from app.infrastructure.external.crawlers.base import BaseNewsCrawler


class VietstockCrawler(BaseNewsCrawler):
    source_slug = "vietstock"
    allowed_domains = ("vietstock.vn", "fili.vn")
    discovery_urls = (
        "https://vietstock.vn/0/tin-moi.rss",
        "https://vietstock.vn/144/chung-khoan.rss",
        "https://vietstock.vn/733/doanh-nghiep.rss",
    )
    content_selectors = (
        "[itemprop='articleBody']",
        ".article-content",
        ".fili-content",
        ".content-detail",
    )
    description_selectors = (".pHead", ".article-sapo", ".lead")
