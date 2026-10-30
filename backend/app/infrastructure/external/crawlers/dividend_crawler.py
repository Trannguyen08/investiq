"""Crawler and adapter for real Vietnamese stock dividend events and corporate calendars."""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from datetime import UTC, datetime
from decimal import Decimal
from threading import RLock
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_CACHE_TTL_SECONDS = 3600  # 1 hour cache
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# High-liquidity VN30 + core bluechip tickers for market calendar aggregation
_CORE_SYMBOLS = (
    "HPG",
    "FPT",
    "VNM",
    "VCB",
    "VIC",
    "VHM",
    "SSI",
    "TCB",
    "MBB",
    "MWG",
    "MSN",
    "ACB",
    "STB",
    "GAS",
    "BID",
    "CTG",
    "VPB",
    "VRE",
    "PLX",
    "POW",
    "GVR",
    "SAB",
    "KDH",
    "DGC",
    "PVD",
    "PVS",
    "VND",
    "VCI",
    "HCM",
    "SHB",
)


def _parse_epoch_date(date_str: str | None) -> str:
    """Parse CafeF's '/Date(1779642000000)/' or ISO date to 'YYYY-MM-DD'."""
    if not date_str:
        return ""
    # Check if /Date(1234567890000)/ format
    match = re.search(r"/Date\((\d+)\)/", str(date_str))
    if match:
        timestamp_ms = int(match.group(1))
        dt = datetime.fromtimestamp(timestamp_ms / 1000.0, tz=UTC).astimezone(_MARKET_TZ)
        return dt.strftime("%Y-%m-%d")

    # Check if DD/MM/YYYY
    dmy = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", str(date_str).strip())
    if dmy:
        d, m, y = dmy.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"

    # Check if YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}", str(date_str)):
        return str(date_str)[:10]

    return str(date_str).strip()


def _classify_dividend(text: str) -> tuple[str, str, Decimal | None]:
    """Parse dividend description into (type, ratio_str, cash_value).

    Types: 'cash', 'stock', 'bonus', 'issuance', 'esop', 'rights'.
    """
    clean_text = text.lower()

    # Cash dividend
    if "tiền" in clean_text or "vnd" in clean_text or "đ/cp" in clean_text:
        div_type = "cash"
        # Extract percentage or cash amount
        pct_match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", text)
        if pct_match:
            pct_val = pct_match.group(1).replace(",", ".")
            ratio_str = f"{pct_val}%"
            # In VN stock market: 10% par value (10,000 VND) = 1,000 VND
            try:
                cash_val = Decimal(pct_val) * Decimal("100")
            except Exception:
                cash_val = None
        else:
            val_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:đ|vnd|đồng)", text, re.IGNORECASE)
            if val_match:
                ratio_str = f"{val_match.group(1)} đ/cp"
                try:
                    cash_val = Decimal(val_match.group(1).replace(".", "").replace(",", "."))
                except Exception:
                    cash_val = None
            else:
                ratio_str = text
                cash_val = None
        return div_type, ratio_str, cash_val

    # Stock dividend
    if "cổ phiếu" in clean_text and "thưởng" not in clean_text:
        div_type = "stock"
        ratio_match = re.search(r"(\d+\s*:\s*\d+)", text)
        pct_match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", text)
        if ratio_match:
            ratio_str = ratio_match.group(1).replace(" ", "")
        elif pct_match:
            ratio_str = f"{pct_match.group(1)}%"
        else:
            ratio_str = text
        return div_type, ratio_str, None

    # Bonus shares
    if "thưởng" in clean_text:
        div_type = "bonus"
        ratio_match = re.search(r"(\d+\s*:\s*\d+)", text)
        ratio_str = ratio_match.group(1).replace(" ", "") if ratio_match else text
        return div_type, ratio_str, None

    # Rights / Issuance
    if "phát hành" in clean_text or "bán ưu đãi" in clean_text:
        div_type = "issuance"
        ratio_match = re.search(r"(\d+\s*:\s*\d+)", text)
        ratio_str = ratio_match.group(1).replace(" ", "") if ratio_match else text
        return div_type, ratio_str, None

    return "other", text, None


class DividendCrawler:
    """Crawls and caches real stock dividend data for symbols and market calendar."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._symbol_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
        self._calendar_cache: tuple[float, list[dict[str, Any]]] | None = None

    def get_symbol_dividends(self, symbol: str) -> list[dict[str, Any]]:
        """Fetch all historical and upcoming dividend events for a given stock symbol."""
        clean_symbol = symbol.strip().upper()
        now = datetime.now(UTC).timestamp()

        with self._lock:
            cached = self._symbol_cache.get(clean_symbol)
            if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
                return cached[1]

        # Crawl live from CafeF
        events = self._crawl_symbol_cafef(clean_symbol)

        # Fallback to Vnstock Company events if CafeF returned empty
        if not events:
            events = self._crawl_symbol_vnstock(clean_symbol)

        with self._lock:
            self._symbol_cache[clean_symbol] = (now, events)

        return events

    def get_market_calendar(self, limit: int = 40) -> list[dict[str, Any]]:
        """Fetch upcoming and recent dividend events across the Vietnamese stock market."""
        now = datetime.now(UTC).timestamp()

        with self._lock:
            if self._calendar_cache and (now - self._calendar_cache[0]) < _CACHE_TTL_SECONDS:
                return self._calendar_cache[1][:limit]

        all_events: list[dict[str, Any]] = []

        # Aggregate from core symbols
        for sym in _CORE_SYMBOLS[:18]:
            try:
                sym_divs = self.get_symbol_dividends(sym)
                for div in sym_divs[:3]:  # Take latest 3 events per ticker
                    item = dict(div)
                    item["symbol"] = sym
                    all_events.append(item)
            except Exception as exc:
                logger.debug(
                    "dividend_calendar_sym_failed", extra={"symbol": sym, "error": str(exc)}
                )

        # Sort descending by date (most recent / upcoming first)
        all_events.sort(
            key=lambda x: str(x.get("ex_date") or x.get("event_date") or ""), reverse=True
        )

        # Deduplicate
        seen: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for e in all_events:
            key = f"{e.get('symbol')}-{e.get('ex_date')}-{e.get('title')}"
            if key not in seen:
                seen.add(key)
                deduped.append(e)

        with self._lock:
            self._calendar_cache = (now, deduped)

        return deduped[:limit]

    def _crawl_symbol_cafef(self, symbol: str) -> list[dict[str, Any]]:
        """Crawl CafeF Ajax corporate event & dividend endpoint."""
        url = f"https://cafef.vn/du-lieu/Ajax/PageNew/LichSuKien.ashx?Symbol={symbol}"
        headers = {
            "User-Agent": _USER_AGENT,
            "Referer": f"https://s.cafef.vn/hose/{symbol}.chn",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if getattr(resp, "status", 200) != 200:
                    return []
                content = resp.read().decode("utf-8", errors="replace")
                data = json.loads(content)

            if not isinstance(data, dict) or not data.get("Success"):
                return []

            raw_events = data.get("Data", [])
            if not isinstance(raw_events, list):
                return []

            results: list[dict[str, Any]] = []
            for item in raw_events:
                if not isinstance(item, dict):
                    continue
                time_str = item.get("Time")
                event_date = _parse_epoch_date(time_str)
                text_list = item.get("Text") or []
                if isinstance(text_list, str):
                    text_list = [text_list]

                for text_line in text_list:
                    if not text_line or not str(text_line).strip():
                        continue
                    title = str(text_line).strip()
                    div_type, ratio_str, cash_val = _classify_dividend(title)

                    results.append(
                        {
                            "id": f"{symbol}-{event_date}-{hash(title)}",
                            "symbol": symbol,
                            "event_date": event_date,
                            "ex_date": event_date,
                            "type": div_type,
                            "ratio": ratio_str,
                            "cash_value": float(cash_val) if cash_val is not None else None,
                            "title": title,
                            "source": "CafeF Data",
                        }
                    )

            # Sort by date descending
            results.sort(key=lambda x: str(x.get("event_date") or ""), reverse=True)
            return results

        except Exception as exc:
            logger.warning(
                "cafef_dividend_crawl_failed", extra={"symbol": symbol, "error": str(exc)}
            )
            return []

    def _crawl_symbol_vnstock(self, symbol: str) -> list[dict[str, Any]]:
        """Fallback using Vnstock Company events."""
        try:
            from vnstock import Company

            company = Company(symbol=symbol, source="vci")
            df = company.events()
            if df is None or getattr(df, "empty", True):
                return []

            results: list[dict[str, Any]] = []
            for _, row in df.iterrows():
                code = str(row.get("event_code") or "").upper()
                if code not in {"DIV", "ISS"}:
                    continue

                ex_date = _parse_epoch_date(str(row.get("exright_date") or ""))
                payout_date = _parse_epoch_date(str(row.get("payout_date") or ""))
                record_date = _parse_epoch_date(str(row.get("record_date") or ""))
                title = str(row.get("event_name_vi") or row.get("event_title_vi") or "")
                ratio_raw = str(row.get("exercise_ratio") or "")
                val_raw = row.get("value_per_share")

                div_type, ratio_str, cash_val = _classify_dividend(f"{title} {ratio_raw}")
                if val_raw and not cash_val:
                    import contextlib

                    with contextlib.suppress(Exception):
                        cash_val = Decimal(str(val_raw))

                results.append(
                    {
                        "id": str(row.get("id") or f"{symbol}-{ex_date}"),
                        "symbol": symbol,
                        "event_date": ex_date or record_date,
                        "ex_date": ex_date,
                        "record_date": record_date,
                        "payout_date": payout_date,
                        "type": div_type,
                        "ratio": ratio_raw or ratio_str,
                        "cash_value": float(cash_val) if cash_val is not None else None,
                        "title": title,
                        "source": "Vietcap / Vnstock",
                    }
                )

            results.sort(key=lambda x: str(x.get("event_date") or ""), reverse=True)
            return results
        except Exception as exc:
            logger.debug(
                "vnstock_dividend_crawl_failed", extra={"symbol": symbol, "error": str(exc)}
            )
            return []


_crawler_instance: DividendCrawler | None = None
_crawler_lock = RLock()


def get_dividend_crawler() -> DividendCrawler:
    global _crawler_instance
    with _crawler_lock:
        if _crawler_instance is None:
            _crawler_instance = DividendCrawler()
        return _crawler_instance
