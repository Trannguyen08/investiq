"""Bounded, allowlisted HTML/XML news crawler primitives."""

from __future__ import annotations

import gzip
import io
import ipaddress
import json
import re
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta, tzinfo
from email.utils import parsedate_to_datetime
from html import unescape
from http.client import HTTPMessage
from typing import IO, Final

from bs4 import BeautifulSoup, Tag

from app.application.dto.news_dto import ParsedArticle
from app.domain.entities.news_article import (
    ArticleAsset,
    ContentBlock,
    ExtractionStatus,
)
from app.infrastructure.config.settings import settings
from app.infrastructure.external.provider_guard import (
    ProviderCircuitOpen,
    ProviderGuard,
    ProviderRateLimited,
    get_provider_guard,
)

MAX_HTML_BYTES: Final = 5 * 1024 * 1024
USER_AGENT: Final = "InvestIQ-NewsBot/1.0 (+https://investiq.local/news-crawler)"


class NewsProviderError(RuntimeError):
    """A safe provider-facing error category."""


class UnsafeProviderUrl(NewsProviderError):
    pass


class ResponseTooLarge(NewsProviderError):
    pass


def _decode_response_body(raw: bytes, charset: str) -> str:
    if raw.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as archive:
                raw = archive.read(MAX_HTML_BYTES + 1)
        except OSError as exc:
            raise NewsProviderError("provider returned invalid gzip content") from exc
        if len(raw) > MAX_HTML_BYTES:
            raise ResponseTooLarge("provider response exceeded 5 MiB after decompression")
    return raw.decode(charset, errors="replace")


def canonicalize_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url.strip())
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    safe_query = [(key, value) for key, value in query if not key.lower().startswith("utm_")]
    safe_query = [
        (key, value) for key, value in safe_query if key.lower() not in {"fbclid", "gclid"}
    ]
    path = parsed.path or "/"
    return urllib.parse.urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, urllib.parse.urlencode(safe_query), "")
    )


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_provider_url(url: str, allowed_domains: tuple[str, ...], *, resolve_dns: bool) -> str:
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise UnsafeProviderUrl("provider URL must be an HTTP(S) URL without credentials")
    host = parsed.hostname.rstrip(".").lower()
    if not any(host == domain or host.endswith(f".{domain}") for domain in allowed_domains):
        raise UnsafeProviderUrl("provider URL host is not allowlisted")
    if resolve_dns:
        try:
            default_port = 443 if parsed.scheme == "https" else 80
            addresses = {
                str(item[4][0]) for item in socket.getaddrinfo(host, parsed.port or default_port)
            }
        except socket.gaierror as exc:
            raise NewsProviderError("provider hostname could not be resolved") from exc
        if not addresses or any(not _is_public_address(address) for address in addresses):
            raise UnsafeProviderUrl("provider URL resolved to a non-public address")
    return canonicalize_url(url)


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_domains: tuple[str, ...], max_redirects: int = 3) -> None:
        self._allowed_domains = allowed_domains
        self._max_redirects = max_redirects

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> urllib.request.Request | None:
        redirect_count = int(req.headers.get("X-Investiq-Redirect-Count", "0"))
        if redirect_count >= self._max_redirects:
            raise NewsProviderError("provider exceeded redirect limit")
        safe_url = validate_provider_url(newurl, self._allowed_domains, resolve_dns=True)
        redirected = super().redirect_request(req, fp, code, msg, headers, safe_url)
        if redirected is not None:
            redirected.add_header("X-Investiq-Redirect-Count", str(redirect_count + 1))
        return redirected


class BoundedHttpClient:
    def __init__(
        self,
        allowed_domains: tuple[str, ...],
        guard: ProviderGuard | None = None,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        self._allowed_domains = allowed_domains
        self._guard = guard or get_provider_guard()
        handlers: list[urllib.request.BaseHandler] = [_SafeRedirectHandler(allowed_domains)]
        if ssl_context is not None:
            handlers.append(urllib.request.HTTPSHandler(context=ssl_context))
        self._opener = urllib.request.build_opener(*handlers)

    def get_text(self, url: str) -> str:
        safe_url = validate_provider_url(url, self._allowed_domains, resolve_dns=True)
        provider = urllib.parse.urlsplit(safe_url).hostname or self._allowed_domains[0]
        try:
            self._guard.before_request(provider)
        except (ProviderRateLimited, ProviderCircuitOpen) as exc:
            raise NewsProviderError(str(exc)) from exc
        request = urllib.request.Request(
            safe_url,
            headers={
                "Accept": "text/html,application/xml;q=0.9,*/*;q=0.2",
                "User-Agent": USER_AGENT,
            },
        )
        try:
            with self._opener.open(request, timeout=30) as response:
                raw = bytes(response.read(MAX_HTML_BYTES + 1))
                if len(raw) > MAX_HTML_BYTES:
                    raise ResponseTooLarge("provider response exceeded 5 MiB")
                charset_value = response.headers.get_content_charset()
                charset = charset_value if isinstance(charset_value, str) else "utf-8"
                text = _decode_response_body(raw, charset)
                self._guard.record_success(provider)
                return text
        except urllib.error.HTTPError as exc:
            self._guard.record_failure(provider)
            raise NewsProviderError(f"provider returned HTTP {exc.code}") from exc
        except (TimeoutError, urllib.error.URLError) as exc:
            self._guard.record_failure(provider)
            raise NewsProviderError("provider request failed") from exc
        except NewsProviderError:
            self._guard.record_failure(provider)
            raise


def _first_text(soup: BeautifulSoup, selectors: tuple[str, ...]) -> str | None:
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            value = node.get_text(" ", strip=True)
            if value:
                return value
    return None


def _meta_content(soup: BeautifulSoup, *keys: tuple[str, str]) -> str | None:
    for attribute, name in keys:
        node = soup.find("meta", attrs={attribute: name})
        if isinstance(node, Tag):
            content = node.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    return None


def _parse_datetime(
    value: str | None, *, naive_timezone: tzinfo = UTC
) -> datetime | None:
    if not value:
        return None
    normalized = unescape(value.strip()).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(normalized)
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=naive_timezone).astimezone(UTC)
    return parsed.astimezone(UTC)


def _json_ld_articles(soup: BeautifulSoup) -> Iterable[dict[str, object]]:
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.get_text())
        except (json.JSONDecodeError, TypeError):
            continue
        objects = payload if isinstance(payload, list) else [payload]
        for item in objects:
            if isinstance(item, dict):
                graph = item.get("@graph")
                candidates = graph if isinstance(graph, list) else [item]
                for candidate in candidates:
                    if isinstance(candidate, dict) and candidate.get("@type") in {
                        "Article",
                        "NewsArticle",
                        "ReportageNewsArticle",
                    }:
                        yield candidate


class BaseNewsCrawler:
    naive_datetime_timezone: tzinfo = UTC
    source_slug: str
    allowed_domains: tuple[str, ...]
    discovery_urls: tuple[str, ...]
    content_selectors: tuple[str, ...]
    description_selectors: tuple[str, ...]
    title_selectors: tuple[str, ...] = ("h1",)

    def __init__(self, client: BoundedHttpClient | None = None) -> None:
        self._client = client or BoundedHttpClient(self.allowed_domains)

    def discover(self, limit: int = 50) -> tuple[str, ...]:
        if not 1 <= limit <= 200:
            raise ValueError("discovery limit must be between 1 and 200")
        discovered: list[str] = []
        for feed_url in self.discovery_urls:
            xml = self._client.get_text(feed_url)
            parsed_urls = self.parse_discovery_document(xml)
            cutoff = datetime.now(UTC) - timedelta(hours=settings.news_ingestion_max_age_hours)
            for url in self._recent_discovery_urls(xml, parsed_urls, cutoff):
                if url not in discovered:
                    discovered.append(url)
                if len(discovered) >= limit:
                    return tuple(discovered)
        return tuple(discovered)

    def parse_discovery_document(self, document: str) -> tuple[str, ...]:
        try:
            root = ET.fromstring(document)
        except ET.ParseError as exc:
            raise NewsProviderError("provider discovery document is invalid XML") from exc
        root_name = root.tag.rsplit("}", 1)[-1].lower()
        candidates: list[str] = []
        if root_name == "urlset":
            for entry in root:
                if entry.tag.rsplit("}", 1)[-1].lower() != "url":
                    continue
                candidates.extend(
                    child.text.strip()
                    for child in entry
                    if child.tag.rsplit("}", 1)[-1].lower() == "loc" and child.text
                )
        elif root_name == "rss":
            for item in root.iter():
                if item.tag.rsplit("}", 1)[-1].lower() != "item":
                    continue
                candidates.extend(
                    child.text.strip()
                    for child in item
                    if child.tag.rsplit("}", 1)[-1].lower() == "link" and child.text
                )
        elif root_name == "feed":
            for entry in root:
                if entry.tag.rsplit("}", 1)[-1].lower() != "entry":
                    continue
                for child in entry:
                    if child.tag.rsplit("}", 1)[-1].lower() != "link":
                        continue
                    candidate = child.get("href") or child.text
                    if candidate and candidate.strip():
                        candidates.append(candidate.strip())

        urls: list[str] = []
        for candidate in candidates:
            try:
                safe_url = validate_provider_url(candidate, self.allowed_domains, resolve_dns=False)
            except UnsafeProviderUrl:
                continue
            if safe_url not in urls:
                urls.append(safe_url)
        return tuple(urls)

    def _recent_discovery_urls(
        self,
        document: str,
        urls: tuple[str, ...],
        cutoff: datetime,
    ) -> tuple[str, ...]:
        """Drop feed entries with an explicit timestamp outside the crawl window."""
        try:
            root = ET.fromstring(document)
        except ET.ParseError:
            return urls
        timestamps: dict[str, datetime] = {}
        for entry in root.iter():
            entry_name = entry.tag.rsplit("}", 1)[-1].lower()
            if entry_name not in {"item", "entry", "url"}:
                continue
            candidate_url: str | None = None
            published_at: datetime | None = None
            for child in entry.iter():
                name = child.tag.rsplit("}", 1)[-1].lower()
                if name in {"link", "loc"} and candidate_url is None:
                    raw_url = child.get("href") or child.text
                    candidate_url = raw_url.strip() if raw_url else None
                if name in {
                    "pubdate",
                    "published",
                    "publication_date",
                    "updated",
                    "lastmod",
                }:
                    published_at = _parse_datetime(
                        child.text, naive_timezone=self.naive_datetime_timezone
                    )
            if candidate_url and published_at:
                timestamps[canonicalize_url(candidate_url)] = published_at
        return tuple(url for url in urls if timestamps.get(url, cutoff) >= cutoff)

    def fetch_article(self, url: str) -> ParsedArticle:
        safe_url = validate_provider_url(url, self.allowed_domains, resolve_dns=True)
        return self.parse_article(self._client.get_text(safe_url), safe_url)

    def parse_article(
        self, html: str, url: str, *, fetched_at: datetime | None = None
    ) -> ParsedArticle:
        safe_url = validate_provider_url(url, self.allowed_domains, resolve_dns=False)
        soup = BeautifulSoup(html, "html.parser")
        json_ld = next(iter(_json_ld_articles(soup)), {})

        title = (
            self._string_value(json_ld.get("headline"))
            or _meta_content(soup, ("property", "og:title"), ("name", "twitter:title"))
            or _first_text(soup, self.title_selectors)
        )
        if not title:
            raise NewsProviderError("article title was not found")
        title = re.sub(
            r"\s+\|\s+(?:Vietstock|CafeF)$", "", self._clean_text(title), flags=re.IGNORECASE
        )

        description = (
            self._string_value(json_ld.get("description"))
            or _meta_content(soup, ("property", "og:description"), ("name", "description"))
            or _first_text(soup, self.description_selectors)
        )
        if description:
            description = self._clean_text(description)
        canonical = self._canonical_from_page(soup, safe_url)
        content_root = next(
            (
                soup.select_one(selector)
                for selector in self.content_selectors
                if soup.select_one(selector)
            ),
            None,
        )
        blocks, assets = self._extract_content(content_root, canonical)
        thumbnail_url = self._image_url(json_ld.get("image")) or _meta_content(
            soup, ("property", "og:image"), ("name", "twitter:image")
        )
        if thumbnail_url:
            absolute_thumbnail = self._safe_asset_url(canonical, thumbnail_url)
            if absolute_thumbnail and all(asset.url != absolute_thumbnail for asset in assets):
                assets = (
                    ArticleAsset(
                        id="asset-thumbnail",
                        kind="image",
                        role="thumbnail",
                        url=absolute_thumbnail,
                        position=0,
                    ),
                    *assets,
                )
        content_text = "\n\n".join(block.text for block in blocks if block.text)
        quality_flags: list[str] = []
        if not content_text:
            quality_flags.append("content_missing")
        elif len(content_text) < 500:
            quality_flags.append("content_short")
        extraction_status = (
            ExtractionStatus.METADATA_ONLY
            if not content_text
            else ExtractionStatus.PARTIAL
            if "content_short" in quality_flags
            else ExtractionStatus.COMPLETE
        )

        author_value = json_ld.get("author")
        authors = self._authors(author_value)
        published_at = _parse_datetime(
            self._string_value(json_ld.get("datePublished"))
            or _meta_content(
                soup,
                ("property", "article:published_time"),
                ("name", "article:published_time"),
            ),
            naive_timezone=self.naive_datetime_timezone,
        )
        updated_at = _parse_datetime(
            self._string_value(json_ld.get("dateModified"))
            or _meta_content(
                soup,
                ("property", "article:modified_time"),
                ("name", "article:modified_time"),
            ),
            naive_timezone=self.naive_datetime_timezone,
        )
        tags = self._tags(json_ld.get("keywords"), soup)
        category = _meta_content(soup, ("property", "article:section"))
        candidates = self._symbol_candidates(" ".join((title, description or "", content_text)))
        return ParsedArticle(
            source_slug=self.source_slug,
            canonical_url=canonical,
            title=title.strip(),
            description=description.strip() if description else None,
            content_text=content_text or None,
            content_blocks=blocks,
            authors=authors,
            published_at=published_at,
            source_updated_at=updated_at,
            fetched_at=(fetched_at or datetime.now(UTC)).astimezone(UTC),
            category=category,
            tags=tags,
            assets=assets,
            candidate_symbols=candidates,
            extraction_status=extraction_status,
            quality_flags=tuple(quality_flags),
        )

    def _canonical_from_page(self, soup: BeautifulSoup, fallback: str) -> str:
        node = soup.find("link", rel=lambda value: value and "canonical" in value)
        if isinstance(node, Tag) and isinstance(node.get("href"), str):
            candidate = urllib.parse.urljoin(fallback, str(node["href"]))
            try:
                return validate_provider_url(candidate, self.allowed_domains, resolve_dns=False)
            except UnsafeProviderUrl:
                pass
        return fallback

    def _extract_content(
        self, root: Tag | None, base_url: str
    ) -> tuple[tuple[ContentBlock, ...], tuple[ArticleAsset, ...]]:
        if root is None:
            return (), ()
        blocks: list[ContentBlock] = []
        assets: list[ArticleAsset] = []
        position = 0
        selected_tags = ["p", "h2", "h3", "blockquote", "img", "ul", "ol", "table", "a"]
        for node in root.find_all(selected_tags, recursive=True):
            if not isinstance(node, Tag):
                continue
            if node.name == "a":
                href = node.get("href")
                if not isinstance(href, str) or not re.search(
                    r"\.(?:pdf|docx?|xlsx?)(?:$|[?#])", href, flags=re.IGNORECASE
                ):
                    continue
                attachment_url = self._safe_asset_url(base_url, href)
                if attachment_url is None:
                    continue
                assets.append(
                    ArticleAsset(
                        id=f"asset-{len(assets) + 1}",
                        kind="document",
                        role="attachment",
                        url=attachment_url,
                        caption=node.get_text(" ", strip=True) or None,
                        position=len(assets) + 1,
                    )
                )
                continue
            if node.name == "img":
                raw_src = node.get("data-src") or node.get("src")
                if not isinstance(raw_src, str) or raw_src.startswith("data:"):
                    continue
                image_url = self._safe_asset_url(base_url, raw_src)
                if image_url is None:
                    continue
                asset_id = f"asset-{len(assets) + 1}"
                assets.append(
                    ArticleAsset(
                        id=asset_id,
                        kind="image",
                        role="inline",
                        url=image_url,
                        alt=str(node.get("alt") or "").strip() or None,
                        position=len(assets) + 1,
                    )
                )
                blocks.append(ContentBlock(id=f"b{position + 1}", type="image", url=image_url))
                position += 1
                continue
            if node.find_parent(["p", "h2", "h3", "blockquote", "ul", "ol", "table"]):
                continue
            if node.name in {"ul", "ol"}:
                items = tuple(
                    item.get_text(" ", strip=True)
                    for item in node.find_all("li", recursive=False)
                    if item.get_text(" ", strip=True)
                )
                if items:
                    blocks.append(
                        ContentBlock(
                            id=f"b{position + 1}",
                            type="list",
                            text="; ".join(items),
                            items=items,
                        )
                    )
                    position += 1
                continue
            if node.name == "table":
                rows = tuple(
                    tuple(
                        cell.get_text(" ", strip=True)
                        for cell in table_row.find_all(["th", "td"], recursive=False)
                        if cell.get_text(" ", strip=True)
                    )
                    for table_row in node.find_all("tr")
                )
                rows = tuple(row for row in rows if row)
                if rows:
                    blocks.append(
                        ContentBlock(
                            id=f"b{position + 1}",
                            type="table",
                            text="; ".join(" | ".join(row) for row in rows),
                            rows=rows,
                        )
                    )
                    position += 1
                continue
            text = node.get_text(" ", strip=True)
            if not text:
                continue
            block_type = (
                "heading"
                if node.name in {"h2", "h3"}
                else "quote"
                if node.name == "blockquote"
                else "paragraph"
            )
            level = int(node.name[1]) if node.name in {"h2", "h3"} else None
            blocks.append(
                ContentBlock(id=f"b{position + 1}", type=block_type, text=text, level=level)
            )
            position += 1
        return tuple(blocks), tuple(assets)

    @staticmethod
    def _string_value(value: object) -> str | None:
        return value.strip() if isinstance(value, str) and value.strip() else None

    @staticmethod
    def _clean_text(value: str) -> str:
        # Some publishers encode metadata entities twice (for example &amp;quot;).
        return unescape(unescape(value)).strip()

    @classmethod
    def _image_url(cls, value: object) -> str | None:
        if isinstance(value, str):
            return cls._string_value(value)
        if isinstance(value, dict):
            return cls._string_value(value.get("url"))
        if isinstance(value, list):
            return next((url for item in value if (url := cls._image_url(item))), None)
        return None

    @staticmethod
    def _safe_asset_url(base_url: str, value: str) -> str | None:
        absolute_url = urllib.parse.urljoin(base_url, value.strip())
        parsed = urllib.parse.urlsplit(absolute_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            return None
        return canonicalize_url(absolute_url)

    @staticmethod
    def _authors(value: object) -> tuple[str, ...]:
        entries = value if isinstance(value, list) else [value]
        names: list[str] = []
        for entry in entries:
            if isinstance(entry, str) and entry.strip():
                names.append(entry.strip())
            elif isinstance(entry, dict) and isinstance(entry.get("name"), str):
                names.append(str(entry["name"]).strip())
        return tuple(dict.fromkeys(name for name in names if name))

    @staticmethod
    def _tags(value: object, soup: BeautifulSoup) -> tuple[str, ...]:
        if isinstance(value, str):
            values = re.split(r"[,;]", value)
        elif isinstance(value, list):
            values = [str(item) for item in value]
        else:
            meta = _meta_content(soup, ("name", "keywords")) or ""
            values = re.split(r"[,;]", meta)
        return tuple(dict.fromkeys(item.strip() for item in values if item.strip()))[:20]

    @staticmethod
    def _symbol_candidates(text: str) -> tuple[str, ...]:
        qualified_matches = re.findall(
            r"\b(HOSE|HNX|UPCOM)\s*:\s*([A-Z][A-Z0-9]{2,7})\b", text.upper()
        )
        candidates = [f"{exchange}:{symbol}" for exchange, symbol in qualified_matches]
        contextual_matches = re.findall(
            r"\b(?:[Cc]ổ phiếu|[Mm]ã(?: chứng khoán)?)\s+(?:của\s+)?"
            r"([A-Z][A-Z0-9]{2,7})\b",
            text,
        )
        candidates.extend(contextual_matches)
        return tuple(dict.fromkeys(candidates))
