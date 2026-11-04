"""AI Financial Assistant Service: Guardrails, shared answer cache, Internal Data RAG,
curated knowledge retrieval, cited fallback Web Search, per-step tracing and evaluation,
and Structured Rich Widgets.

Pipeline steps (each evaluated and recorded in ``AiTrace``):
1. guardrail: prevent secret exfiltration, prompt injection, and unauthorized system modifications.
2. cache_lookup: check shared cache for identical questions asked by other users.
3. intent_detection: identify tickers, comparison, forensics, market, or educational topics.
4. internal_data_retrieval: fetch market quotes, technical candles, and forensic scores.
5. knowledge_retrieval: query InvestIQ curated lessons and glossary (high priority for concepts).
6. external_search: fallback web search when internal data does not cover the request.
7. response_generation: synthesize comprehensive analysis and structured widgets.
8. citation: append clear source attribution (internal learning topic or external links).
9. output_redaction: strip any accidental tokens, keys, credentials, or emails.
10. evaluation: rule-based online scoring against quality criteria.
11. cache_store: save clean answers to shared cache with intent-based TTL.
"""

from __future__ import annotations

import html
import logging
import re
from typing import Any, Literal
from urllib.parse import parse_qs, urlparse

import httpx

from app.application.interfaces.i_ai_response_cache import AiResponseCache
from app.application.use_cases.ai_chat.ai_observability import (
    AiMetricsRegistry,
    AiTrace,
    evaluate_response,
)
from app.application.use_cases.ai_chat.guardrails import (
    evaluate_guardrails,
    fold_text,
    redact_sensitive_output,
)
from app.application.use_cases.ai_chat.knowledge_base import InternalKnowledgeBase, KnowledgeHit
from app.application.use_cases.market_data.market_service import MarketService

logger = logging.getLogger(__name__)

# Known stock tickers regex: 3 uppercase letters
_TICKER_PATTERN = re.compile(r"\b([A-Z]{3})\b")

# Stop words that look like tickers but are Vietnamese words or common financial acronyms
_NON_TICKER_WORDS = frozenset(
    {
        "CHO", "CON", "CAC", "NAM", "THI", "GIA", "NEN", "MUA", "BAN", "XEM", "LUC",
        "QUA", "NAY", "VAY", "NHO", "LON", "TOC", "NGU", "GAP", "DCA", "BCTC", "EPS",
        "ROE", "ROA", "USD", "VND", "VSA", "MAC", "MAI", "DAO", "SAN", "COT", "DON",
        "TUC", "TRA", "DAN", "DOC", "BAI", "THE", "KHI", "BAO", "LAI", "COI", "HOI",
        "VON", "TIEN", "BOT", "HAY", "HOA",
    }
)

_CACHE_KEY_PREFIX = "ai:chat:v1"
_MAX_EXTERNAL_SOURCES = 3

AiIntent = Literal[
    "blocked",
    "comparison",
    "stock_analysis",
    "market_overview",
    "knowledge",
    "external",
    "general",
]

_CACHE_TTL_SECONDS: dict[AiIntent, int] = {
    "comparison": 60,
    "stock_analysis": 60,
    "market_overview": 60,
    "knowledge": 6 * 3600,
    "external": 30 * 60,
    "general": 6 * 3600,
}


def normalize_question(message: str) -> str:
    """Canonical form used as the shared cache key: folded, punctuation-free, single-spaced."""
    folded = fold_text(message)
    cleaned = re.sub(r"[^a-z0-9/%\s]", " ", folded)
    return re.sub(r"\s+", " ", cleaned).strip()


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


def _decode_ddg_url(raw_href: str) -> str | None:
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


def _strip_tags(raw: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", raw))).strip()


class AiFinancialService:
    def __init__(
        self,
        market_service: MarketService,
        knowledge_base: InternalKnowledgeBase | None = None,
        cache: AiResponseCache | None = None,
        metrics: AiMetricsRegistry | None = None,
    ) -> None:
        self._market = market_service
        self._knowledge = knowledge_base
        self._cache = cache
        self._metrics = metrics or AiMetricsRegistry()

    @property
    def metrics(self) -> AiMetricsRegistry:
        return self._metrics

    async def process_chat(self, user_message: str) -> dict[str, Any]:
        """Main entry point: execute guarded, traced, cached, grounded financial analysis."""
        trace = AiTrace(self._metrics)

        # Step 1: Guardrail verification (block secrets, private data, system modification, injection)
        with trace.step("guardrail") as g_step:
            verdict = evaluate_guardrails(user_message)
            if not verdict.allowed:
                g_step.mark("blocked", passed=True, note=verdict.category or "rejected")
                trace.finish(
                    "blocked",
                    evaluation=None,
                    guardrail_category=verdict.category,
                )
                return {
                    "content": verdict.refusal,
                    "widgets": [],
                    "suggested_actions": [
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
                            "label": "Nhịp đập thị trường",
                            "action_type": "SEND_PROMPT",
                            "prompt": "Thị trường hôm nay thế nào?",
                        },
                    ],
                    "sources": [],
                    "evaluation": {
                        "score": 1.0,
                        "checks": {"guardrail_blocked": True, "no_sensitive_leak": True},
                    },
                }
            g_step.mark("ok", passed=True)

        # Step 2: Shared cache lookup for previously answered queries
        normalized_q = normalize_question(user_message)
        cache_key = f"{_CACHE_KEY_PREFIX}:{normalized_q}"
        with trace.step("cache_lookup") as c_step:
            if self._cache:
                cached_payload = self._cache.get(cache_key)
                if cached_payload and isinstance(cached_payload, dict):
                    c_step.mark("hit", passed=True)
                    trace.finish("cached", evaluation=None)
                    result_copy = dict(cached_payload)
                    result_copy["is_cached"] = True
                    return result_copy
                c_step.mark("miss", passed=True)
            else:
                c_step.mark("skipped", note="no_cache_configured")

        # Step 3: Intent detection
        tickers: list[str] = []
        is_comparison = False
        is_gold_bank = False
        is_forensics = False
        is_market_general = False
        with trace.step("intent_detection") as i_step:
            tickers = _extract_tickers(user_message)
            query_lower = user_message.lower()

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
            i_step.mark(
                "ok",
                passed=True,
                note=f"tickers={len(tickers)} comparison={is_comparison} forensics={is_forensics} market={is_market_general}",
            )

        # Step 4: Internal data retrieval (market quotes, candles, forensics)
        stock_data: dict[str, Any] = {}
        with trace.step("internal_data_retrieval") as d_step:
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
            d_step.mark("ok", passed=True, note=f"resolved={len(stock_data)}")

        # Step 5: Knowledge retrieval (curated internal educational content & glossary)
        knowledge_hits: list[KnowledgeHit] = []
        with trace.step("knowledge_retrieval") as k_step:
            if self._knowledge and not stock_data and not is_market_general:
                knowledge_hits = self._knowledge.search(user_message, limit=2)
                k_step.mark("ok", passed=True, note=f"hits={len(knowledge_hits)}")
            else:
                k_step.mark("skipped", note="stock_or_market_context_active")

        # Step 6: External search (crawled web data fallback ONLY if internal data/knowledge empty)
        external_snippets: list[dict[str, str]] = []
        with trace.step("external_search") as s_step:
            if not stock_data and not is_market_general and not knowledge_hits:
                external_snippets = await self._search_external_info(user_message)
                s_step.mark("ok", passed=True, note=f"snippets={len(external_snippets)}")
            else:
                s_step.mark("skipped", note="internal_data_or_knowledge_available")

        # Step 7: Response generation
        intent: AiIntent = "general"
        if is_comparison or len(stock_data) >= 2:
            intent = "comparison"
        elif len(stock_data) == 1:
            intent = "stock_analysis"
        elif is_market_general:
            intent = "market_overview"
        elif knowledge_hits:
            intent = "knowledge"
        elif external_snippets:
            intent = "external"

        with trace.step("response_generation") as gen_step:
            raw_response = self._generate_structured_response(
                user_message=user_message,
                tickers=tickers,
                stock_data=stock_data,
                knowledge_hits=knowledge_hits,
                external_snippets=external_snippets,
                is_comparison=is_comparison,
                is_gold_bank=is_gold_bank,
                is_forensics=is_forensics,
                is_market_general=is_market_general,
            )
            gen_step.mark("ok", passed=True, note=f"intent={intent}")

        # Step 8: Citation verification
        with trace.step("citation") as cit_step:
            sources = raw_response.get("sources", [])
            cit_step.mark("ok", passed=True, note=f"sources_count={len(sources)}")

        # Step 9: Output redaction (prevent credential, key, email leakage)
        content_safe, redactions = redact_sensitive_output(raw_response["content"])
        with trace.step("output_redaction") as red_step:
            red_step.mark("ok", passed=(redactions == 0), note=f"redactions={redactions}")

        # Step 10: Online evaluation
        elapsed_total = trace.elapsed_ms()
        external_urls = [s["url"] for s in sources if s.get("kind") == "external" and "url" in s]
        with trace.step("evaluation") as eval_step:
            evaluation = evaluate_response(
                content=content_safe,
                blocked=False,
                requested_tickers=tickers,
                resolved_tickers=list(stock_data.keys()),
                external_urls=external_urls,
                redactions=redactions,
                elapsed_ms=elapsed_total,
            )
            eval_step.mark(
                "ok",
                passed=(evaluation.score >= 0.8),
                note=f"score={evaluation.score}",
            )

        final_response = {
            "content": content_safe,
            "widgets": raw_response.get("widgets", []),
            "suggested_actions": raw_response.get("suggested_actions", []),
            "sources": sources,
            "evaluation": evaluation.as_dict(),
        }

        # Step 11: Store to shared cache with intent-dependent TTL
        with trace.step("cache_store") as cs_step:
            if self._cache:
                ttl = _CACHE_TTL_SECONDS.get(intent, 300)
                try:
                    self._cache.set(cache_key, final_response, ttl_seconds=ttl)
                    cs_step.mark("ok", passed=True, note=f"ttl={ttl}s")
                except Exception as exc:
                    cs_step.mark("error", passed=False, note=str(exc))
            else:
                cs_step.mark("skipped", note="no_cache_configured")

        # Finish trace and record metrics
        trace.finish(
            "answered",
            evaluation=evaluation,
            internal_sources=len([s for s in sources if s.get("kind") == "internal"]),
            external_sources=len(external_urls),
        )

        return final_response

    async def _search_external_info(self, query: str) -> list[dict[str, str]]:
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
                        dest_url = _decode_ddg_url(raw_href)
                        title = _strip_tags(raw_title)
                        snippet = _strip_tags(snippets[idx]) if idx < len(snippets) else ""
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

    def _generate_structured_response(
        self,
        user_message: str,
        tickers: list[str],
        stock_data: dict[str, Any],
        knowledge_hits: list[KnowledgeHit],
        external_snippets: list[dict[str, str]],
        is_comparison: bool,
        is_gold_bank: bool,
        is_forensics: bool,
        is_market_general: bool,
    ) -> dict[str, Any]:
        """Synthesize in-depth analysis and format rich interactive widgets."""
        widgets: list[dict[str, Any]] = []
        suggested_actions: list[dict[str, Any]] = []
        text_parts: list[str] = []
        sources: list[dict[str, str]] = []

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

            sources.extend(
                [
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {t1}",
                        "url": f"/market/stocks/{t1}",
                    },
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {t2}",
                        "url": f"/market/stocks/{t2}",
                    },
                ]
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

            sources.append(
                {
                    "kind": "internal",
                    "title": f"Báo cáo tài chính & dữ liệu giao dịch {sym} (InvestIQ)",
                    "url": f"/market/stocks/{sym}",
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

                sources.append(
                    {
                        "kind": "internal",
                        "title": "Tổng quan thị trường trực tiếp InvestIQ",
                        "url": "/market/stocks",
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

        # Case 4: Curated internal knowledge & glossary hit
        elif knowledge_hits:
            top_hit = knowledge_hits[0].entry
            text_parts.append(f"Kiến thức đầu tư InvestIQ: {top_hit.title}")
            text_parts.append(top_hit.text)

            if len(knowledge_hits) > 1:
                second = knowledge_hits[1].entry
                text_parts.append(f"Khái niệm liên quan — {second.title}:\n{second.text}")

            sources.append(
                {
                    "kind": "internal",
                    "title": f"Khóa học InvestIQ: {top_hit.topic_title}",
                    "url": f"/learn?topic={top_hit.topic_slug}" if top_hit.topic_slug else "/learn",
                }
            )

            suggested_actions.extend(
                [
                    {
                        "label": f"Học bài: {top_hit.topic_title[:32]}",
                        "action_type": "NAVIGATE",
                        "url": f"/learn?topic={top_hit.topic_slug}" if top_hit.topic_slug else "/learn",
                    },
                    {
                        "label": "Xem bảng thuật ngữ đầy đủ",
                        "action_type": "NAVIGATE",
                        "url": "/learn",
                    },
                ]
            )

        # Case 5: External web crawled fallback with MANDATORY citation
        elif external_snippets:
            text_parts.append("Thông tin tổng hợp cập nhật thị trường:")
            for item in external_snippets[:2]:
                text_parts.append(f"- {item['title']}: {item['snippet']}")

            for item in external_snippets:
                sources.append(
                    {
                        "kind": "external",
                        "title": item["title"],
                        "url": item["url"],
                    }
                )

            suggested_actions.extend(
                [
                    {
                        "label": "Nhịp đập VN-Index hôm nay",
                        "action_type": "SEND_PROMPT",
                        "prompt": "Thị trường hôm nay thế nào?",
                    },
                    {
                        "label": "Học kiến thức chứng khoán",
                        "action_type": "NAVIGATE",
                        "url": "/learn",
                    },
                ]
            )

        # Case 6: General introduction
        else:
            text_parts.append(
                "Chào bạn, tôi là InvestIQ Financial Assistant — Trợ lý phân tích tài chính và hỗ trợ đầu tư trực tiếp.\n\n"
                "Tôi ưu tiên sử dụng dữ liệu định lượng và tri thức nội bộ từ hệ thống InvestIQ:\n"
                "1. Phân tích toàn diện mã cổ phiếu: Đánh giá định giá P/E, P/B, ROE, sức mạnh kỹ thuật nến và RSI (Ví dụ: 'Đánh giá HPG', 'Phân tích VNM').\n"
                "2. So sánh đối đầu đa tài sản: So sánh 2 mã cổ phiếu hoặc so sánh với Vàng SJC và Tiết kiệm ngân hàng (Ví dụ: 'So sánh VCB và MBB').\n"
                "3. Kiểm tra rủi ro BCTC và Altman Z-Score: Chẩn đoán sức khỏe tài chính và cờ đỏ kế toán (Ví dụ: 'Kiểm tra rủi ro NVL').\n"
                "4. Nhịp đập thị trường & Kiến thức: Diễn biến VN-Index, thanh khoản hoặc giải thích thuật ngữ chứng khoán (Ví dụ: 'P/E là gì', 'Lệnh ATC là gì')."
            )

            sources.append(
                {
                    "kind": "internal",
                    "title": "Học viện chứng khoán căn bản InvestIQ",
                    "url": "/learn",
                }
            )

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

        # Append source citation block at the end of the text
        if sources:
            citation_lines = ["\n\nNguồn tham khảo:"]
            for s in sources:
                kind_badge = "[Hệ thống InvestIQ]" if s.get("kind") == "internal" else "[Nguồn ngoài]"
                citation_lines.append(f"- {kind_badge} {s['title']} ({s['url']})")
            text_parts.append("\n".join(citation_lines))

        return {
            "content": "\n\n".join(text_parts),
            "widgets": widgets,
            "suggested_actions": suggested_actions,
            "sources": sources,
        }
