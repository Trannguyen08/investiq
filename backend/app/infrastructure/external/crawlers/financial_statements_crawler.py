"""Crawler and adapter for real company financial statements (Income, Balance Sheet, Cash Flow)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from datetime import UTC, datetime
from threading import RLock
from typing import Any

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 7200  # 2 hours cache for financial statements
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_BASE_URL = "https://cafef.vn/du-lieu/Ajax/PageNew/FinanceReport.ashx"


class FinancialStatementsCrawler:
    """Fetches real full financial statements across multiple quarters or years from CafeF."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def get_financial_statements(
        self,
        symbol: str,
        period_type: str = "quarter",
        limit: int = 8,
    ) -> dict[str, Any]:
        clean_symbol = symbol.strip().upper()
        norm_period = "year" if period_type.lower() in {"year", "nam", "y"} else "quarter"
        cache_key = f"{clean_symbol}:{norm_period}:{limit}"
        now = datetime.now(UTC).timestamp()

        with self._lock:
            cached = self._cache.get(cache_key)
            if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
                return cached[1]

        # CafeF Mapping: Type=1 is Income Statement, Type=2 is Balance Sheet, Type=3/4 is Cash Flow
        is_data = self._fetch_report(
            clean_symbol, report_type_id=1, period_type=norm_period, limit=limit
        )
        bs_data = self._fetch_report(
            clean_symbol, report_type_id=2, period_type=norm_period, limit=limit
        )
        cf_data = self._fetch_report(
            clean_symbol, report_type_id=3, period_type=norm_period, limit=limit
        )
        if not cf_data or not cf_data.get("periods"):
            cf_data = self._fetch_report(
                clean_symbol, report_type_id=4, period_type=norm_period, limit=limit
            )

        result = self._combine_statements(
            symbol=clean_symbol,
            period_type=norm_period,
            bs=bs_data,
            inc=is_data,
            cf=cf_data,
        )

        with self._lock:
            self._cache[cache_key] = (now, result)

        return result

    def _fetch_report(
        self,
        symbol: str,
        report_type_id: int,
        period_type: str,
        limit: int,
    ) -> dict[str, Any]:
        """Fetch a specific report type (1=Income Statement, 2=Balance Sheet, 3/4=Cash Flow)."""
        current_year = datetime.now(UTC).year

        # Candidate end dates ensuring populated real data
        if period_type == "quarter":
            candidate_end_dates = [
                f"4-{current_year - 1}",
                f"3-{current_year - 1}",
                f"4-{current_year - 2}",
            ]
            report_type_param = "QUY"
        else:
            candidate_end_dates = [
                str(current_year - 1),
                str(current_year - 2),
                str(current_year - 3),
            ]
            report_type_param = "NAM"

        for end_date in candidate_end_dates:
            url = (
                f"{_BASE_URL}?Type={report_type_id}&Symbol={symbol}"
                f"&TotalRow={limit}&EndDate={end_date}&ReportType={report_type_param}&Sort=DESC"
            )
            headers = {
                "User-Agent": _USER_AGENT,
                "Referer": f"https://s.cafef.vn/hose/{symbol}.chn",
            }

            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=6.0) as resp:
                    if getattr(resp, "status", 200) != 200:
                        continue
                    content = resp.read().decode("utf-8", errors="replace")
                    data = json.loads(content)

                if not isinstance(data, dict) or not data.get("Success"):
                    continue

                raw_data = data.get("Data", {})
                if not isinstance(raw_data, dict):
                    continue

                periods_raw = raw_data.get("Value", [])
                if not isinstance(periods_raw, list) or not periods_raw:
                    continue

                # Verify actual values exist
                has_values = any(
                    any(
                        item.get("Value") is not None and item.get("Value") != 0
                        for item in p.get("Value", [])
                        if isinstance(item, dict)
                    )
                    for p in periods_raw
                    if isinstance(p, dict)
                )

                if not has_values:
                    continue

                periods = [
                    p.get("Time") for p in periods_raw if isinstance(p, dict) and p.get("Time")
                ]
                metric_map: dict[str, dict[str, Any]] = {}

                for p_idx, p in enumerate(periods_raw):
                    if not isinstance(p, dict):
                        continue
                    items = p.get("Value", [])
                    if not isinstance(items, list):
                        continue
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        code = str(item.get("Code") or item.get("ID") or "").strip()
                        name = str(item.get("Name") or "").strip()
                        val = item.get("Value")
                        if not code:
                            continue

                        if code not in metric_map:
                            metric_map[code] = {
                                "code": code,
                                "name": name,
                                "values": [None] * len(periods),
                            }
                        metric_map[code]["values"][p_idx] = float(val) if val is not None else None

                return {
                    "periods": periods,
                    "metrics": list(metric_map.values()),
                }

            except Exception as exc:
                logger.debug(
                    "financial_report_attempt_failed",
                    extra={"symbol": symbol, "end_date": end_date, "error": str(exc)},
                )
                continue

        return {}

    def _combine_statements(
        self,
        symbol: str,
        period_type: str,
        bs: dict[str, Any],
        inc: dict[str, Any],
        cf: dict[str, Any],
    ) -> dict[str, Any]:
        """Combine statements into a unified structure with high-level summary charts."""
        periods = inc.get("periods") or bs.get("periods") or cf.get("periods") or []

        def _get_metric_series(
            metrics_list: list[dict[str, Any]], possible_codes: list[str]
        ) -> list[float | None]:
            for m in metrics_list:
                code_lower = m.get("code", "").lower()
                name_lower = m.get("name", "").lower()
                if any(k.lower() == code_lower or k.lower() in name_lower for k in possible_codes):
                    return m.get("values", [])
            return [None] * len(periods)

        inc_metrics = inc.get("metrics", [])
        bs_metrics = bs.get("metrics", [])

        revenue_series = _get_metric_series(
            inc_metrics, ["dttbhccdv", "doanh thu bán hàng", "doanh thu thuần"]
        )
        gross_profit_series = _get_metric_series(inc_metrics, ["lngbhccdv", "lợi nhuận gộp"])
        net_profit_series = _get_metric_series(
            inc_metrics, ["lnsttndn", "netincome", "lợi nhuận sau thuế"]
        )

        total_assets_series = _get_metric_series(bs_metrics, ["totalasset", "tts", "tổng tài sản"])
        total_debt_series = _get_metric_series(
            bs_metrics, ["totaldebt", "npt", "tổng nợ", "nợ phải trả"]
        )
        equity_series = _get_metric_series(
            bs_metrics, ["totalownercapital", "vcsh", "vốn chủ sở hữu"]
        )

        chart_data: list[dict[str, Any]] = []
        for i, period in enumerate(periods):
            rev = revenue_series[i] if i < len(revenue_series) else None
            gp = gross_profit_series[i] if i < len(gross_profit_series) else None
            np = net_profit_series[i] if i < len(net_profit_series) else None
            assets = total_assets_series[i] if i < len(total_assets_series) else None
            debt = total_debt_series[i] if i < len(total_debt_series) else None
            eq = equity_series[i] if i < len(equity_series) else None

            # Convert to billions VND (/ 1,000,000,000)
            rev_b = round(rev / 1e9, 2) if rev is not None else None
            gp_b = round(gp / 1e9, 2) if gp is not None else None
            np_b = round(np / 1e9, 2) if np is not None else None
            assets_b = round(assets / 1e9, 2) if assets is not None else None
            debt_b = round(debt / 1e9, 2) if debt is not None else None
            eq_b = round(eq / 1e9, 2) if eq is not None else None

            gross_margin = (
                round((gp / rev) * 100, 2) if gp is not None and rev and rev > 0 else None
            )
            net_margin = round((np / rev) * 100, 2) if np is not None and rev and rev > 0 else None

            chart_data.append(
                {
                    "period": period,
                    "revenue_billion": rev_b,
                    "gross_profit_billion": gp_b,
                    "net_profit_billion": np_b,
                    "gross_margin_percent": gross_margin,
                    "net_margin_percent": net_margin,
                    "total_assets_billion": assets_b,
                    "total_debt_billion": debt_b,
                    "equity_billion": eq_b,
                }
            )

        # Chronological order for chart rendering (oldest -> newest)
        chronological_charts = list(reversed(chart_data))

        return {
            "symbol": symbol,
            "period_type": period_type,
            "periods": periods,
            "charts": chronological_charts,
            "income_statement": inc_metrics,
            "balance_sheet": bs_metrics,
            "cash_flow": cf.get("metrics", []),
            "source": "CafeF Financial Reports Data",
        }


_statements_crawler_instance: FinancialStatementsCrawler | None = None
_statements_lock = RLock()


def get_financial_statements_crawler() -> FinancialStatementsCrawler:
    global _statements_crawler_instance
    with _statements_lock:
        if _statements_crawler_instance is None:
            _statements_crawler_instance = FinancialStatementsCrawler()
        return _statements_crawler_instance
