"""External web search fallback and URL/HTML sanitization for AI Financial Assistant."""

from __future__ import annotations

import html
import logging
import re
from urllib.parse import parse_qs, urlparse

import httpx

logger = logging.getLogger(__name__)

_MAX_EXTERNAL_SOURCES = 3


def decode_ddg_url(raw_href: str) -> str | None:
    """Extract destination URL from DuckDuckGo wrapper href."""
    href = html.unescape(raw_href)
    if href.startswith("//"):
        href = f"https:{href}"
    parsed = urlparse(href)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        href = target
    final = urlparse(href)
    if final.scheme in ("http", "https") and final.netloc:
        return href
    return None


def strip_tags(raw: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", raw))).strip()


async def search_external_info(query: str) -> list[dict[str, str]]:
    """Crawl external information and parse links/sources for mandatory citation."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": f"{query} thị trường chứng khoán việt nam tài chính"},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            if resp.status_code == 200:
                text = resp.text
                links = re.findall(
                    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                    text,
                    re.DOTALL,
                )
                snippets = re.findall(
                    r'<a[^>]*class="result__snippet[^"]*"[^>]*>(.*?)</a>',
                    text,
                    re.DOTALL,
                )
                results: list[dict[str, str]] = []
                for idx, (raw_href, raw_title) in enumerate(links[:_MAX_EXTERNAL_SOURCES]):
                    dest_url = decode_ddg_url(raw_href)
                    title = strip_tags(raw_title)
                    snippet = strip_tags(snippets[idx]) if idx < len(snippets) else ""
                    if dest_url and title:
                        results.append(
                            {
                                "title": title[:140],
                                "url": dest_url,
                                "snippet": snippet[:350],
                            }
                        )
                return results
    except Exception as exc:
        logger.debug("External search unavailable: %s", exc)
    return []
