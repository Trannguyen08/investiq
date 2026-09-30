"""VnEconomy stock RSS adapter with metadata-only article extraction."""

from app.infrastructure.external.crawlers.base import BaseNewsCrawler


class VnEconomyCrawler(BaseNewsCrawler):
    source_slug = "vneconomy"
    allowed_domains = ("vneconomy.vn",)
    discovery_urls = ("https://vneconomy.vn/chung-khoan.rss",)
    # RSS use is explicitly offered by the publisher, while full-text republication is not.
    content_selectors = ()
    description_selectors = (".article-header__summary", ".article-header__lead")
