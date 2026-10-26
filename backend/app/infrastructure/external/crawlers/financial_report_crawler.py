"""Crawler and adapter for corporate financial reports, growth analysis, and forecasts."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from threading import RLock
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 1800  # 30 minutes
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class FinancialReportCrawler:
    """Crawls recent financial reports, earnings summaries, and forecasts for any stock ticker."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

    def get_financial_reports(
        self,
        symbol: str,
        limit: int = 6,
    ) -> list[dict[str, Any]]:
        clean_symbol = symbol.strip().upper()
        now = datetime.now(UTC).timestamp()

        # 1. Check in-memory cache
        with self._lock:
            cached = self._cache.get(clean_symbol)
            if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
                return cached[1][:limit]

        # 2. Crawl from authoritative sources (CafeF financial search)
        reports = self._crawl_cafef(clean_symbol, limit=limit)

        # 3. Cache valid results
        with self._lock:
            self._cache[clean_symbol] = (now, reports)

        return reports[:limit]

    def _crawl_cafef(self, symbol: str, limit: int = 6) -> list[dict[str, Any]]:
        url = f"https://cafef.vn/tim-kiem.chn?keywords={symbol}"
        headers = {"User-Agent": _USER_AGENT}
        results: list[dict[str, Any]] = []

        try:
            with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
                response = client.get(url)
                if response.status_code != 200:
                    logger.warning(
                        "cafef_financial_search_status_not_200",
                        extra={"symbol": symbol, "status": response.status_code},
                    )
                    return []

                soup = BeautifulSoup(response.text, "html.parser")
                container = soup.find(class_="search-content-wrap") or soup.find(class_="timeline")
                if not container:
                    return []

                blocks = container.find_all(["li", "div"], recursive=True)
                seen_links: set[str] = set()

                for block in blocks:
                    h_tag = block.find(["h3", "h2"])
                    if not h_tag:
                        continue

                    a_tag = h_tag.find("a")
                    if not a_tag or not a_tag.get("href"):
                        continue

                    href = str(a_tag["href"]).strip()
                    if not href.endswith(".chn") or href in seen_links:
                        continue

                    title = a_tag.get_text(strip=True)
                    if len(title) < 15:
                        continue

                    # Sapo / Summary extraction
                    sapo_el = block.find(
                        class_=lambda c: bool(
                            c and any(k in str(c).lower() for k in ["sapo", "summary", "desc"])
                        )
                    )
                    summary = sapo_el.get_text(strip=True) if sapo_el else ""

                    # Image extraction
                    img_el = block.find("img")
                    image_url: str | None = None
                    if img_el:
                        img_src = img_el.get("src") or img_el.get("data-src")
                        if img_src and str(img_src).startswith("http"):
                            image_url = str(img_src)

                    # Extract publication date and filter out outdated records (< 2025)
                    pub_date: str | None = None
                    m = re.search(r"-188(\d{2})(\d{2})(\d{2})", href)
                    if m:
                        yy, mm, dd = m.groups()
                        year = int(f"20{yy}")
                        if year < 2025:
                            # Skip outdated articles to ensure freshness & forward utility
                            continue
                        pub_date = f"{dd}/{mm}/{year}"

                    # Classify tag based on content
                    title_lower = title.lower()
                    tag = "Hoạt động & Tăng trưởng"
                    if any(
                        w in title_lower
                        for w in [
                            "bctc",
                            "lợi nhuận",
                            "lãi",
                            "kỷ lục",
                            "doanh thu",
                            "quý",
                            "báo cáo",
                        ]
                    ):
                        tag = "Kết quả kinh doanh & BCTC"
                    elif any(
                        w in title_lower
                        for w in [
                            "dự báo",
                            "dự phóng",
                            "mục tiêu",
                            "triển vọng",
                            "định giá",
                            "khuyến nghị",
                        ]
                    ):
                        tag = "Dự phóng & Triển vọng"
                    elif any(
                        w in title_lower
                        for w in [
                            "hợp tác",
                            "đầu tư",
                            "khởi công",
                            "dự án",
                            "mở rộng",
                            "nhà máy",
                        ]
                    ):
                        tag = "Đầu tư & Mở rộng"

                    full_url = href if href.startswith("http") else f"https://cafef.vn{href}"
                    seen_links.add(href)

                    results.append(
                        {
                            "title": title,
                            "summary": summary,
                            "image_url": image_url,
                            "source": "CafeF / BCTC Doanh Nghiệp",
                            "published_at": pub_date,
                            "article_url": full_url,
                            "category": "Báo cáo tài chính & Tăng trưởng",
                            "tag": tag,
                        }
                    )
                    if len(results) >= limit:
                        break

        except Exception as exc:
            logger.warning(
                "financial_reports_crawl_failed",
                extra={"symbol": symbol, "error": str(exc)},
            )

        return results


financial_report_crawler = FinancialReportCrawler()
