"""Vietstock RSS, dated channel archive, and article adapter."""

import re
from datetime import date
from urllib.parse import urlencode, urljoin, urlsplit

from bs4 import BeautifulSoup

from app.infrastructure.external.crawlers.base import (
    BaseNewsCrawler,
    UnsafeProviderUrl,
    validate_provider_url,
)


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

    def discover_history_page(self, page: int, start: date, end: date) -> tuple[str, ...]:
        if not 1 <= page <= 150 or start > end:
            raise ValueError("invalid Vietstock history page or date range")
        query = urlencode(
            {
                "channelID": 144,
                "page": page,
                "fromdate": start.isoformat(),
                "todate": end.isoformat(),
            }
        )
        html = self._client.get_text(f"https://vietstock.vn/StartPage/ChannelContentPage?{query}")
        soup = BeautifulSoup(html, "html.parser")
        urls: list[str] = []
        for link in soup.select(".channelContent a[href]"):
            candidate = urljoin("https://vietstock.vn", str(link.get("href")))
            path = urlsplit(candidate).path
            match = re.match(r"^/(\d{4})/(\d{2})/[^/]+\.htm$", path)
            if not match:
                continue
            try:
                published_day = date(int(match[1]), int(match[2]), 1)
            except ValueError:
                continue
            if published_day < start.replace(day=1) or published_day > end.replace(day=1):
                continue
            try:
                safe_url = validate_provider_url(candidate, self.allowed_domains, resolve_dns=False)
            except UnsafeProviderUrl:
                continue
            if safe_url not in urls:
                urls.append(safe_url)
        return tuple(urls)
