"""VnEconomy stock RSS adapter with metadata-only article extraction."""

from app.infrastructure.external.crawlers.base import BaseNewsCrawler


class VnEconomyCrawler(BaseNewsCrawler):
    source_slug = "vneconomy"
    allowed_domains = ("vneconomy.vn",)
    discovery_urls = (
        "https://vneconomy.vn/chung-khoan.rss",
        "https://vneconomy.vn/tai-chinh.rss",
    )
    title_selectors = (".article-header__title", "h1")
    content_selectors = (
        ".article-detail-section__main",
        ".main-detail-page",
        ".detail__content",
        ".post-content",
    )
    description_selectors = (".article-header__summary", ".article-header__lead")
