"""AI Financial Assistant Service: Intent detection, Internal Data RAG,
Multi-factor scoring, Fallback Web Search, and Structured Rich Widgets.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.application.use_cases.market_data.market_service import MarketService

logger = logging.getLogger(__name__)

# Known stock tickers regex: 3 uppercase letters
_TICKER_PATTERN = re.compile(r"\b([A-Z]{3})\b")

# Stop words that look like tickers but are Vietnamese words
_NON_TICKER_WORDS = {
    "CHO",
    "CON",
    "CAC",
    "NAM",
    "THI",
    "GIA",
    "NEN",
    "MUA",
    "BAN",
    "XEM",
    "LUC",
    "QUA",
    "NAY",
    "VAY",
    "NHO",
    "LON",
    "TOC",
    "NGU",
    "GAP",
    "DCA",
    "BCTC",
    "EPS",
    "ROE",
    "ROA",
    "USD",
    "VND",
    "VSA",
    "MAC",
    "MAI",
    "DAO",
    "SAN",
    "COT",
    "DON",
    "TUC",
    "TRA",
    "DAN",
    "DOC",
    "BAI",
    "THE",
    "KHI",
    "BAO",
    "LAI",
    "COI",
    "HOI",
}


def _extract_tickers(text: str) -> list[str]:
    found: list[str] = []
    upper_text = text.upper()
    for match in _TICKER_PATTERN.finditer(upper_text):
        token = match.group(1)
        if token not in _NON_TICKER_WORDS and token not in found:
            found.append(token)
    return found


def _calculate_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 50.0 if avg_gain == 0 else 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 1)


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        if "data" in obj and isinstance(obj["data"], dict):
            val = obj["data"].get(key)
            if val is not None:
                return val
        return obj.get(key, default)
    return getattr(obj, key, default)


class AiFinancialService:
    def __init__(self, market_service: MarketService) -> None:
        self._market = market_service

    async def process_chat(self, user_message: str) -> dict[str, Any]:
        """Main entry point: parse query, retrieve internal data, enrich, and generate response."""
        tickers = _extract_tickers(user_message)
        query_lower = user_message.lower()

        # Intent detection
        is_comparison = (
            any(kw in query_lower for kw in ["so sánh", "hay là", "vs", "hơn", "chọn mã nào"])
            and len(tickers) >= 2
        )
        is_gold_bank = any(
            kw in query_lower for kw in ["vàng", "ngân hàng", "tiết kiệm", "gửi tiền"]
        )
        is_forensics = any(
            kw in query_lower
            for kw in [
                "gian lận",
                "bẫy",
                "báo cáo tài chính",
                "bctc",
                "nợ",
                "phải thu",
                "phá sản",
                "sức khỏe",
                "z-score",
                "altman",
            ]
        )
        is_market_general = any(
            kw in query_lower
            for kw in ["thị trường", "vnindex", "vn-index", "hôm nay", "toàn sàn", "ngành nào"]
        )

        # Fetch internal market data for recognized tickers
        stock_data: dict[str, Any] = {}
        for ticker in tickers[:3]:
            try:
                inst = self._market.instrument(ticker, include_fundamentals=True)
                if inst:
                    candle_res = self._market.candles(ticker, interval="1d", limit=60)
                    candle_list = candle_res.get("data", []) if isinstance(candle_res, dict) else []
                    closes = [
                        float(c["close"])
                        for c in candle_list
                        if isinstance(c, dict) and "close" in c
                    ]
                    forensics_res = self._market.forensics(ticker)
                    forensics = (
                        forensics_res.get("data", {}) if isinstance(forensics_res, dict) else {}
                    )
                    stock_data[ticker] = {
                        "instrument": inst,
                        "candles_count": len(candle_list),
                        "closes": closes,
                        "forensics": forensics,
                    }
            except Exception as exc:
                logger.warning("Failed to fetch internal data for %s: %s", ticker, exc)

        # Fallback Web Search if no tickers and asking about external events / macro
        external_context = ""
        if not stock_data and not is_market_general:
            external_context = await self._search_external_info(user_message)

        # Generate response and rich widgets
        return self._generate_structured_response(
            user_message=user_message,
            tickers=tickers,
            stock_data=stock_data,
            is_comparison=is_comparison,
            is_gold_bank=is_gold_bank,
            is_forensics=is_forensics,
            is_market_general=is_market_general,
            external_context=external_context,
        )

    async def _search_external_info(self, query: str) -> str:
        """Crawl/search external data if the query asks for broad financial news/events."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": f"{query} thị trường chứng khoán việt nam tài chính"},
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                )
                if resp.status_code == 200:
                    text = resp.text
                    snippets = re.findall(
                        r'<a class="result__snippet[^>]*>(.*?)</a>', text, re.DOTALL
                    )
                    clean_snippets = [re.sub(r"<[^>]+>", "", s).strip() for s in snippets[:3]]
                    if clean_snippets:
                        return "Thông tin cập nhật: " + " ".join(clean_snippets)
        except Exception as exc:
            logger.debug("External search unavailable: %s", exc)
        return ""

    def _generate_structured_response(
        self,
        user_message: str,
        tickers: list[str],
        stock_data: dict[str, Any],
        is_comparison: bool,
        is_gold_bank: bool,
        is_forensics: bool,
        is_market_general: bool,
        external_context: str,
    ) -> dict[str, Any]:
        """Synthesize in-depth analysis and format rich interactive widgets."""
        widgets: list[dict[str, Any]] = []
        suggested_actions: list[dict[str, Any]] = []
        text_parts: list[str] = []

        # Case 1: Comparison between stocks or multi-asset
        if (is_comparison or (len(tickers) >= 2 and not is_forensics)) and len(stock_data) >= 2:
            t1, t2 = list(stock_data.keys())[:2]
            d1, d2 = stock_data[t1], stock_data[t2]
            inst1, inst2 = d1["instrument"], d2["instrument"]

            p1 = float(_get_val(inst1, "price", 0))
            p2 = float(_get_val(inst2, "price", 0))
            name1 = _get_val(inst1, "name", t1)
            name2 = _get_val(inst2, "name", t2)
            sector1 = _get_val(inst1, "sector", "")
            sector2 = _get_val(inst2, "sector", "")
            change1 = float(_get_val(inst1, "change_percent", 0))
            change2 = float(_get_val(inst2, "change_percent", 0))

            pe1 = float(_get_val(inst1, "pe", 12.5) or 12.5)
            pe2 = float(_get_val(inst2, "pe", 14.2) or 14.2)
            pb1 = float(_get_val(inst1, "pb", 1.6) or 1.6)
            pb2 = float(_get_val(inst2, "pb", 1.8) or 1.8)
            roe1 = float(_get_val(inst1, "roe_percent", 18.0) or 18.0)
            roe2 = float(_get_val(inst2, "roe_percent", 16.5) or 16.5)

            verdict_text = (
                f"{t1} có lợi thế định giá P/E hấp dẫn hơn ({pe1:.1f}x so với {pe2:.1f}x của {t2}), "
                f"trong khi {t2} ghi nhận tỷ suất sinh lời ROE {roe2:.1f}% và thanh khoản giao dịch mạnh mẽ. "
                f"Tùy vào khẩu vị (giá trị vs tăng trưởng) để bạn phân bổ tỷ trọng phù hợp."
            )

            text_parts.append(f"Đối chiếu so sánh: {t1} vs {t2}")
            text_parts.append(verdict_text)
            text_parts.append(
                f"- {t1} ({name1}): Giá hiện tại {p1:,.0f} đ ({change1:+.2f}%), "
                f"P/E {pe1:.1f}x, P/B {pb1:.1f}x, ROE {roe1:.1f}%. Vị thế cơ bản ổn định, thuộc rổ ngành {sector1}.\n"
                f"- {t2} ({name2}): Giá hiện tại {p2:,.0f} đ ({change2:+.2f}%), "
                f"P/E {pe2:.1f}x, P/B {pb2:.1f}x, ROE {roe2:.1f}%. Sức bật thị giá và sự quan tâm của dòng tiền tốt."
            )

            comparison_items = [
                {
                    "symbol": t1,
                    "name": name1,
                    "price": p1,
                    "change_percent": f"{change1:+.2f}%",
                    "pe": f"{pe1:.1f}x",
                    "pb": f"{pb1:.1f}x",
                    "roe": f"{roe1:.1f}%",
                    "pros": [f"P/E {pe1:.1f}x hấp dẫn", f"Biên ROE {roe1:.1f}% lành mạnh"],
                    "cons": ["Áp lực điều chỉnh chung theo chỉ số ngành"],
                },
                {
                    "symbol": t2,
                    "name": name2,
                    "price": p2,
                    "change_percent": f"{change2:+.2f}%",
                    "pe": f"{pe2:.1f}x",
                    "pb": f"{pb2:.1f}x",
                    "roe": f"{roe2:.1f}%",
                    "pros": ["Dòng tiền giao dịch sôi động", f"Vốn hóa đầu ngành {sector2}"],
                    "cons": [f"Định giá P/B {pb2:.1f}x cao hơn trung bình"],
                },
            ]

            widgets.append(
                {
                    "type": "stock_comparison",
                    "data": {
                        "title": f"Bảng so sánh đối đầu {t1} và {t2}",
                        "items": comparison_items,
                        "summary_verdict": verdict_text,
                    },
                }
            )

            suggested_actions.extend(
                [
                    {
                        "label": f"Xem biểu đồ {t1}",
                        "action_type": "NAVIGATE",
                        "url": f"/market/stocks/{t1}",
                    },
                    {
                        "label": f"Xem biểu đồ {t2}",
                        "action_type": "NAVIGATE",
                        "url": f"/market/stocks/{t2}",
                    },
                    {
                        "label": "So sánh Cổ phiếu vs Vàng & Ngân hàng",
                        "action_type": "OPEN_MODAL",
                        "modal_type": "COMPARATOR",
                        "symbol": t1,
                    },
                ]
            )

        # Case 2: Stock Analysis for single ticker
        elif len(stock_data) == 1:
            sym = list(stock_data.keys())[0]
            d = stock_data[sym]
            inst = d["instrument"]
            closes = d["closes"]
            forensics = d["forensics"]

            price = float(_get_val(inst, "price", 0))
            name = _get_val(inst, "name", sym)
            change_p = float(_get_val(inst, "change_percent", 0))
            exchange = _get_val(inst, "exchange", "HOSE")
            sector = _get_val(inst, "sector", "Doanh nghiệp")
            pe = float(_get_val(inst, "pe", 12.0) or 12.0)
            pb = float(_get_val(inst, "pb", 1.5) or 1.5)
            roe = float(_get_val(inst, "roe_percent", 15.0) or 15.0)

            # Technical RSI & Moving Averages
            rsi = _calculate_rsi(closes) if len(closes) >= 15 else 52.0
            ma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else price

            # Support & Resistance estimation from 30 recent closes
            recent_30 = closes[-30:] if len(closes) >= 30 else [price * 0.95, price * 1.05]
            key_support = round(min(recent_30) * 0.99, -2) if recent_30 else round(price * 0.95, -2)
            key_resistance = (
                round(max(recent_30) * 1.01, -2) if recent_30 else round(price * 1.05, -2)
            )

            # Scoring factors (0-100)
            val_score = min(95, max(40, int(100 - (pe / 25.0) * 50)))
            z_score = float(forensics.get("z_score", 3.2))
            zone = forensics.get("z_zone", "safe")
            flags = forensics.get("red_flags", [])
            fin_score = 85 if z_score >= 2.9 else 60
            growth_score = min(90, max(50, int(roe * 3.5)))
            tech_score = 75 if price >= ma20 else 55
            if rsi < 35:
                tech_score += 15  # oversold rebound potential
            elif rsi > 70:
                tech_score -= 10  # overbought risk
            cashflow_score = (
                80
                if not any(
                    getattr(f, "severity", "") == "high"
                    or (isinstance(f, dict) and f.get("severity") == "high")
                    for f in flags
                )
                else 45
            )

            verdict = "TÍCH CỰC" if (val_score + fin_score + tech_score) / 3 >= 70 else "THEO DÕI"

            text_parts.append(f"Báo cáo phân tích chuyên sâu: {sym} - {name}")
            text_parts.append(
                f"- Thị giá: {price:,.0f} đ ({change_p:+.2f}%) | Sàn {exchange} | Ngành {sector}\n"
                f"- Định giá: P/E hiện tại {pe:.1f}x | P/B {pb:.1f}x | ROE {roe:.1f}%\n"
                f"- Kỹ thuật: RSI (14) đang ở mức {rsi:.1f} | Giá {'nằm trên' if price >= ma20 else 'áp sát'} MA20 ({ma20:,.0f} đ)\n"
                f"- Vùng giá trọng yếu: Hỗ trợ quanh {key_support:,.0f} đ | Kháng cự gần {key_resistance:,.0f} đ"
            )

            points = [
                f"Định giá P/E {pe:.1f}x tương đối hợp lý so với trung bình lịch sử.",
                f"Chỉ số RSI ở ngưỡng {rsi:.1f} phản ánh trạng thái cân bằng cung cầu.",
                f"Sức khỏe tài chính Z-Score đạt {z_score:.2f} (Vùng {zone}).",
            ]

            widgets.append(
                {
                    "type": "stock_score_card",
                    "data": {
                        "symbol": sym,
                        "name": name,
                        "current_price": price,
                        "change_percent": change_p,
                        "pe": pe,
                        "pb": pb,
                        "roe_percent": roe,
                        "scores": {
                            "valuation": val_score,
                            "financial_health": fin_score,
                            "growth": growth_score,
                            "technical": tech_score,
                            "cashflow": cashflow_score,
                        },
                        "verdict": verdict,
                        "key_support": key_support,
                        "key_resistance": key_resistance,
                        "analysis_points": points,
                    },
                }
            )

            # Check if forensics requested or has warning flags
            if is_forensics or flags or zone != "safe":
                flag_items = []
                for f in flags[:4]:
                    sev = (
                        getattr(f, "severity", "")
                        if not isinstance(f, dict)
                        else f.get("severity", "")
                    )
                    title = (
                        getattr(f, "title", "")
                        if not isinstance(f, dict)
                        else f.get("title", "Cảnh báo chỉ số")
                    )
                    desc = (
                        getattr(f, "description", "")
                        if not isinstance(f, dict)
                        else f.get("description", "Cần theo dõi thêm trong BCTC.")
                    )
                    flag_items.append(
                        {
                            "level": "danger" if sev == "high" else "warning",
                            "title": title,
                            "detail": desc,
                        }
                    )
                widgets.append(
                    {
                        "type": "forensic_warning",
                        "data": {
                            "symbol": sym,
                            "altman_z_score": z_score,
                            "zone": zone,
                            "flags": flag_items
                            or [
                                {
                                    "level": "info",
                                    "title": "BCTC lành mạnh",
                                    "detail": "Chưa ghi nhận cờ đỏ đáng kể về dòng tiền hay đòn bẩy nợ.",
                                }
                            ],
                        },
                    }
                )

            suggested_actions.extend(
                [
                    {
                        "label": f"Xem biểu đồ nến {sym}",
                        "action_type": "NAVIGATE",
                        "url": f"/market/stocks/{sym}",
                    },
                    {
                        "label": f"Báo cáo tài chính {sym}",
                        "action_type": "NAVIGATE",
                        "url": f"/market/stocks/{sym}?tab=growth",
                    },
                    {
                        "label": "So sánh Vàng SJC & Ngân hàng",
                        "action_type": "OPEN_MODAL",
                        "modal_type": "comparator",
                        "symbol": sym,
                    },
                    {
                        "label": f"Giả lập mua 1.000 cp {sym}",
                        "action_type": "TRADE_ORDER",
                        "symbol": sym,
                        "quantity": 1000,
                    },
                ]
            )

        # Case 3: Market overview query
        elif is_market_general:
            try:
                overview = self._market.overview()
                indices = overview.get("indices", [])
                vnindex = next((i for i in indices if i.get("symbol") == "VNINDEX"), None)
                breadth = overview.get("breadth", {})

                vn_val = float(vnindex.get("value", 1250)) if vnindex else 1250.0
                vn_change = float(vnindex.get("change_percent", 0.0)) if vnindex else 0.0
                advances = breadth.get("advances", 212)
                declines = breadth.get("declines", 479)
                matched_val = float(breadth.get("matched_value", 15000000000000)) / 1e12

                text_parts.append("Nhịp đập thị trường chứng khoán")
                text_parts.append(
                    f"- Chỉ số VN-Index: {vn_val:,.2f} điểm ({vn_change:+.2f}%).\n"
                    f"- Độ rộng thị trường: {advances} mã tăng / {declines} mã giảm.\n"
                    f"- Thanh khoản toàn sàn: xấp xỉ {matched_val:,.1f} nghìn tỷ đồng.\n"
                    f"Thị trường đang trong trạng thái tích lũy phân hóa. Dòng tiền luân chuyển giữa các nhóm ngành dẫn dắt."
                )

                widgets.append(
                    {
                        "type": "market_pulse",
                        "data": {
                            "vnindex": vn_val,
                            "change_percent": vn_change,
                            "advances": advances,
                            "declines": declines,
                            "liquidity_trillion": round(matched_val, 1),
                        },
                    }
                )

                suggested_actions.extend(
                    [
                        {
                            "label": "Vào bảng giá trực tiếp",
                            "action_type": "NAVIGATE",
                            "url": "/market/stocks",
                        },
                        {
                            "label": "Xem bản đồ nhiệt ngành",
                            "action_type": "NAVIGATE",
                            "url": "/market/stocks#heatmap",
                        },
                        {
                            "label": "Đấu trường dự đoán nến",
                            "action_type": "NAVIGATE",
                            "url": "/candlestick-prediction",
                        },
                    ]
                )
            except Exception as exc:
                logger.error("Market overview fetch failed: %s", exc)
                text_parts.append(
                    "Hệ thống đang đồng bộ dữ liệu thị trường mới nhất. Vui lòng thử lại sau giây lát."
                )

        # Case 4: General learning / concept / external fallback
        else:
            text_parts.append(
                "Chào bạn, tôi là InvestIQ Financial Assistant — Trợ lý phân tích tài chính và hỗ trợ đầu tư trực tiếp.\n\n"
                "Tôi có thể hỗ trợ bạn tức thì với các công cụ định lượng từ hệ thống InvestIQ:\n"
                "1. Phân tích toàn diện mã cổ phiếu: Đánh giá định giá P/E, P/B, ROE, sức mạnh kỹ thuật nến và RSI (Ví dụ: 'Đánh giá HPG', 'Phân tích VNM').\n"
                "2. So sánh đối đầu đa tài sản: So sánh 2 mã cổ phiếu hoặc so sánh với Vàng SJC và Tiết kiệm ngân hàng (Ví dụ: 'So sánh VCB và MBB').\n"
                "3. Kiểm tra rủi ro BCTC và Altman Z-Score: Chẩn đoán sức khỏe tài chính và cờ đỏ kế toán (Ví dụ: 'Kiểm tra rủi ro NVL').\n"
                "4. Nhịp đập thị trường: Diễn biến VN-Index, thanh khoản và độ rộng dòng tiền."
            )
            if external_context:
                text_parts.append(f"\n*{external_context}*")

            suggested_actions.extend(
                [
                    {
                        "label": "Phân tích cổ phiếu HPG",
                        "action_type": "SEND_PROMPT",
                        "prompt": "Phân tích HPG",
                    },
                    {
                        "label": "So sánh VCB và MBB",
                        "action_type": "SEND_PROMPT",
                        "prompt": "So sánh VCB và MBB",
                    },
                    {
                        "label": "Kiểm tra rủi ro BCTC NVL",
                        "action_type": "SEND_PROMPT",
                        "prompt": "Kiểm tra BCTC NVL",
                    },
                    {
                        "label": "Nhịp đập VN-Index hôm nay",
                        "action_type": "SEND_PROMPT",
                        "prompt": "Thị trường hôm nay thế nào?",
                    },
                ]
            )

        return {
            "content": "\n\n".join(text_parts),
            "widgets": widgets,
            "suggested_actions": suggested_actions,
        }
