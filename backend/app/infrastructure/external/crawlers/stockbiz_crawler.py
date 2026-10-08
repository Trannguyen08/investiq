"""StockBiz public RSS and publisher-dated article metadata."""

import re
from dataclasses import replace
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from app.application.dto.news_dto import ParsedArticle
from app.infrastructure.external.crawlers.base import BaseNewsCrawler, NewsProviderError


class StockBizCrawler(BaseNewsCrawler):
    source_slug = "stockbiz"
    allowed_domains = ("stockbiz.vn",)
    discovery_urls = (
        "https://web.stockbiz.vn/RSS/News/Market.ashx",
        "https://web.stockbiz.vn/RSS/News/Company.ashx",
    )
    content_selectors = ()
    description_selectors = (".news_summary",)
    naive_datetime_timezone = ZoneInfo("Asia/Ho_Chi_Minh")

    def parse_article(
        self, html: str, url: str, *, fetched_at: datetime | None = None
    ) -> ParsedArticle:
        article = super().parse_article(html, url, fetched_at=fetched_at)
        date_node = BeautifulSoup(html, "html.parser").select_one(".news_date")
        date_text = date_node.get_text(" ", strip=True) if date_node else ""
        match = re.search(r"(\d{2}/\d{2}/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s+(SA|CH)", date_text)
        if not match:
            raise NewsProviderError("StockBiz publisher time was not found")
        local = datetime.strptime(f"{match[1]} {match[2]}", "%d/%m/%Y %I:%M:%S")
        if match[3] == "CH" and local.hour < 12:
            local = local.replace(hour=local.hour + 12)
        elif match[3] == "SA" and local.hour == 12:
            local = local.replace(hour=0)
        published_at = local.replace(tzinfo=self.naive_datetime_timezone).astimezone(UTC)
        return replace(article, published_at=published_at)
