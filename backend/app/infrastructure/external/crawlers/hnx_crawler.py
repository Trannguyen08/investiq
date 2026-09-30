"""Official HNX disclosure RSS adapter."""

import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import replace
from datetime import UTC, datetime
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from app.application.dto.news_dto import ParsedArticle
from app.domain.entities.news_article import ArticleAsset
from app.infrastructure.external.crawlers.base import (
    BaseNewsCrawler,
    NewsProviderError,
    UnsafeProviderUrl,
    canonicalize_url,
    validate_provider_url,
)

NON_EQUITY_TERMS = (
    "trai phieu",
    "tpcp",
    "han ngach phat thai",
    "khi nha kinh",
    "cac-bon",
    "carbon",
)


def _normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


class HnxCrawler(BaseNewsCrawler):
    source_slug = "hnx"
    allowed_domains = ("hnx.vn",)
    discovery_urls = (
        "https://www.hnx.vn/1/vi_vn/thong-tin-cong-bo-tu-so.rss",
        "https://www.hnx.vn/3/vi_vn/thong-tin-cong-bo-tu-to-chuc-phat-hanh.rss",
    )
    title_selectors = (".Box-TieuDe label", "title")
    content_selectors = ()
    description_selectors = (".Box-Tomtat label",)

    def discover(self, limit: int = 50) -> tuple[str, ...]:
        """Round-robin official and issuer disclosures so neither feed starves."""
        if not 1 <= limit <= 200:
            raise ValueError("discovery limit must be between 1 and 200")
        feed_urls = [
            self.parse_discovery_document(self._client.get_text(feed_url))
            for feed_url in self.discovery_urls
        ]
        discovered: list[str] = []
        position = 0
        while len(discovered) < limit and any(position < len(urls) for urls in feed_urls):
            for urls in feed_urls:
                if position < len(urls) and urls[position] not in discovered:
                    discovered.append(urls[position])
                    if len(discovered) >= limit:
                        break
            position += 1
        return tuple(discovered)

    def parse_discovery_document(self, document: str) -> tuple[str, ...]:
        """Keep equity disclosures and normalize legacy links onto public HTTPS."""
        try:
            root = ET.fromstring(document)
        except ET.ParseError as exc:
            raise NewsProviderError("provider discovery document is invalid XML") from exc

        normalized: list[str] = []
        for item in root.iter():
            if item.tag.rsplit("}", 1)[-1].lower() != "item":
                continue
            fields = {
                child.tag.rsplit("}", 1)[-1].lower(): child.text.strip()
                for child in item
                if child.text and child.text.strip()
            }
            title = fields.get("title", "")
            url = fields.get("link")
            if not url or any(term in _normalized(title) for term in NON_EQUITY_TERMS):
                continue
            try:
                safe_url = validate_provider_url(url, self.allowed_domains, resolve_dns=False)
            except UnsafeProviderUrl:
                continue
            parsed = urlsplit(safe_url)
            public_url = urlunsplit(("https", "www.hnx.vn", parsed.path, parsed.query, ""))
            canonical = canonicalize_url(public_url)
            if canonical not in normalized:
                normalized.append(canonical)
        return tuple(normalized)

    def parse_article(
        self, html: str, url: str, *, fetched_at: datetime | None = None
    ) -> ParsedArticle:
        parsed = super().parse_article(html, url, fetched_at=fetched_at)
        soup = BeautifulSoup(html, "html.parser")
        attachments = tuple(
            ArticleAsset(
                id=f"asset-{position}",
                kind="document",
                role="attachment",
                url=asset_url,
                caption=node.get_text(" ", strip=True) or None,
                position=position,
            )
            for position, node in enumerate(soup.select(".divLstFileAttach a[href]"), start=1)
            if isinstance(node.get("href"), str)
            and (asset_url := self._safe_asset_url(parsed.canonical_url, str(node["href"])))
        )
        parsed = replace(parsed, assets=attachments)
        timestamp_node = soup.select_one(".Box-Thoigian label")
        if timestamp_node is None:
            return parsed
        try:
            local_time = datetime.strptime(
                timestamp_node.get_text(" ", strip=True), "%H:%M %d/%m/%Y"
            ).replace(tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
        except ValueError:
            return parsed
        return replace(parsed, published_at=local_time.astimezone(UTC))
