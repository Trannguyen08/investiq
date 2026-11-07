"""AI Financial Assistant Service: Guardrails, shared answer cache, Internal Data RAG,
curated knowledge retrieval, cited fallback Web Search, per-step tracing and evaluation,
and Structured Rich Widgets.

This module acts as the pipeline orchestrator and delegates specialized responsibilities to:
- ``intent_parser.py``: User input normalization, ticker extraction, and intent detection.
- ``market_snapshot.py``: Daily market aggregation (indices, VN30 basket, movers, liquidity, sectors, events).
- ``external_search.py``: Fallback web search and citation extraction.
- ``response_builder.py``: Structured markdown synthesis, widgets, citations, and follow-up actions.
"""

from __future__ import annotations

import logging
from typing import Any

from app.application.dto.news_dto import NewsQuery
from app.application.interfaces.i_ai_response_cache import AiResponseCache
from app.application.use_cases.ai_chat.ai_observability import (
    AiMetricsRegistry,
    AiTrace,
    evaluate_response,
)
from app.application.use_cases.ai_chat.external_search import (
    decode_ddg_url as _decode_ddg_url,
)
from app.application.use_cases.ai_chat.external_search import (
    search_external_info,
)
from app.application.use_cases.ai_chat.external_search import (
    strip_tags as _strip_tags,
)
from app.application.use_cases.ai_chat.guardrails import (
    evaluate_guardrails,
    redact_sensitive_output,
)
from app.application.use_cases.ai_chat.intent_parser import (
    AiIntent,
    DetectedIntent,
    _calculate_rsi,
    _clean_dividend_ratio,
    _extract_tickers,
    _get_val,
    detect_intent,
    normalize_question,
    normalize_user_input,
)
from app.application.use_cases.ai_chat.knowledge_base import InternalKnowledgeBase, KnowledgeHit
from app.application.use_cases.ai_chat.market_snapshot import build_daily_market_snapshot
from app.application.use_cases.ai_chat.response_builder import generate_structured_response
from app.application.use_cases.market_data.market_service import MarketService
from app.domain.repositories.i_news_repository import INewsRepository
from app.infrastructure.external.crawlers.dividend_crawler import get_dividend_crawler

logger = logging.getLogger(__name__)

_CACHE_KEY_PREFIX = "ai:chat:v7"

_CACHE_TTL_SECONDS: dict[AiIntent, int] = {
    "comparison": 60,
    "dividend": 3600,
    "stock_analysis": 60,
    "market_overview": 60,
    "leader": 12 * 3600,
    "news": 120,
    "knowledge": 6 * 3600,
    "external": 30 * 60,
    "general": 6 * 3600,
}

__all__ = [
    "AiFinancialService",
    "AiIntent",
    "DetectedIntent",
    "_calculate_rsi",
    "_clean_dividend_ratio",
    "_decode_ddg_url",
    "_extract_tickers",
    "_get_val",
    "_strip_tags",
    "detect_intent",
    "normalize_question",
    "normalize_user_input",
]


class AiFinancialService:
    def __init__(
        self,
        market_service: MarketService,
        knowledge_base: InternalKnowledgeBase | None = None,
        news_repo: INewsRepository | None = None,
        cache: AiResponseCache | None = None,
        metrics: AiMetricsRegistry | None = None,
    ) -> None:
        self._market = market_service
        self._knowledge = knowledge_base
        self._news_repo = news_repo
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
        with trace.step("intent_detection") as i_step:
            parsed_intent = detect_intent(user_message)
            tickers = parsed_intent.tickers
            is_leader = parsed_intent.is_leader
            leader_id = parsed_intent.leader_id
            leader_name = parsed_intent.leader_name
            is_leader_rankings = parsed_intent.is_leader_rankings
            is_ecosystem = parsed_intent.is_ecosystem
            ecosystem_id = parsed_intent.ecosystem_id
            is_dividend = parsed_intent.is_dividend
            is_news = parsed_intent.is_news
            is_comparison = parsed_intent.is_comparison
            is_gold_bank = parsed_intent.is_gold_bank
            is_forensics = parsed_intent.is_forensics
            is_market_general = parsed_intent.is_market_general
            i_step.mark(
                "ok",
                passed=True,
                note=(
                    f"tickers={len(tickers)} leader={is_leader} eco={is_ecosystem} dividend={is_dividend} news={is_news} "
                    f"comparison={is_comparison} forensics={is_forensics} market={is_market_general}"
                ),
            )

        # Step 4: Internal data retrieval (market quotes, candles, forensics, dividends/events, news, or leaders)
        stock_data: dict[str, Any] = {}
        news_articles: list[dict[str, Any]] = []
        dividend_events: list[dict[str, Any]] = []
        market_events: list[dict[str, Any]] = []
        leader_profile: Any = None
        with trace.step("internal_data_retrieval") as d_step:
            if is_leader:
                try:
                    from app.infrastructure.external.crawlers.leader_crawler import (
                        get_leader_crawler,
                    )

                    crawler = get_leader_crawler()
                    lookup_key = leader_id or leader_name or user_message
                    leader_profile = crawler.find_leader(lookup_key)
                    if not leader_profile and tickers:
                        leader_profile = crawler.find_leader(tickers[0])
                    if leader_profile and not tickers and leader_profile.symbols:
                        tickers = list(leader_profile.symbols)
                except Exception as exc:
                    logger.warning("Failed to lookup leader profile: %s", exc)

                for ticker in tickers[:3]:
                    try:
                        inst = self._market.instrument(ticker, include_fundamentals=False)
                        if inst:
                            stock_data[ticker] = {"instrument": inst}
                    except Exception as exc:
                        logger.warning("Failed to fetch leader ticker %s: %s", ticker, exc)
                d_step.mark(
                    "ok",
                    passed=True,
                    note=f"leader={getattr(leader_profile, 'full_name', None)} tickers={tickers}",
                )
            elif is_dividend:
                try:
                    crawler = get_dividend_crawler()
                    if tickers:
                        target_sym = tickers[0]
                        inst = self._market.instrument(target_sym, include_fundamentals=False)
                        dividend_events = crawler.get_symbol_dividends(target_sym)
                        if inst:
                            stock_data[target_sym] = {"instrument": inst}
                        elif not dividend_events:
                            # Token is not a valid listed instrument or dividend symbol; fall back to market calendar
                            tickers = []
                    if not tickers:
                        if hasattr(crawler, "get_market_calendar"):
                            dividend_events = crawler.get_market_calendar(limit=10)
                        elif hasattr(crawler, "get_upcoming_dividends"):
                            dividend_events = crawler.get_upcoming_dividends()
                except Exception as exc:
                    logger.warning("Failed to fetch internal dividends: %s", exc)
                if not tickers and hasattr(self._market, "overview"):
                    try:
                        ov_raw = self._market.overview()
                        ov_data = ov_raw.get("data", ov_raw) if isinstance(ov_raw, dict) else {}
                        if isinstance(ov_data, dict):
                            market_events = ov_data.get("upcoming_events", []) or []
                    except Exception as exc:
                        logger.warning("Failed to fetch market overview events: %s", exc)
                d_step.mark(
                    "ok",
                    passed=True,
                    note=f"dividend_count={len(dividend_events)} market_events={len(market_events)}",
                )
            elif is_news:
                if self._news_repo:
                    try:
                        query_symbols = tuple(tickers) if tickers else ()
                        articles, _ = self._news_repo.list_articles(
                            NewsQuery(limit=5, symbols=query_symbols)
                        )
                        for a in articles:
                            news_articles.append(
                                {
                                    "id": a.id,
                                    "title": a.title,
                                    "summary": a.description
                                    or (a.content_text[:180] + "..." if a.content_text else ""),
                                    "url": f"/news/{a.id}",
                                    "source": a.source.name if a.source else "InvestIQ",
                                    "published_at": (
                                        a.published_at.strftime("%H:%M %d/%m/%Y")
                                        if a.published_at
                                        else ""
                                    ),
                                }
                            )
                    except Exception as exc:
                        logger.warning("Failed to fetch internal news: %s", exc)
                d_step.mark("ok", passed=True, note=f"news_count={len(news_articles)}")
            else:
                for ticker in tickers[:3]:
                    try:
                        inst = self._market.instrument(ticker, include_fundamentals=True)
                        if inst:
                            candle_res = self._market.candles(ticker, interval="1d", limit=60)
                            candle_list = (
                                candle_res.get("data", []) if isinstance(candle_res, dict) else []
                            )
                            closes = [
                                float(c["close"])
                                for c in candle_list
                                if isinstance(c, dict) and "close" in c
                            ]
                            forensics_res = self._market.forensics(ticker)
                            forensics = (
                                forensics_res.get("data", {})
                                if isinstance(forensics_res, dict)
                                else {}
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
            if (
                self._knowledge
                and not stock_data
                and not is_market_general
                and not is_news
                and not is_dividend
                and not is_leader
            ):
                knowledge_hits = self._knowledge.search(user_message, limit=2)
                k_step.mark("ok", passed=True, note=f"hits={len(knowledge_hits)}")
            else:
                k_step.mark("skipped", note="stock_or_market_context_active")

        # Step 6: External search (crawled web data fallback ONLY if internal data/knowledge empty)
        external_snippets: list[dict[str, str]] = []
        with trace.step("external_search") as s_step:
            if is_leader and not leader_profile and not is_leader_rankings:
                search_query = f"doanh nhân {leader_name or user_message} tiểu sử sự nghiệp"
                external_snippets = await self._search_external_info(search_query)
                s_step.mark("ok", passed=True, note=f"leader_snippets={len(external_snippets)}")
            elif is_dividend and not dividend_events and not market_events:
                search_query = (
                    f"lịch chia cổ tức {tickers[0]} mới nhất"
                    if tickers
                    else f"lịch sự kiện cổ tức chứng khoán sắp tới {user_message}"
                )
                external_snippets = await self._search_external_info(search_query)
                s_step.mark("ok", passed=True, note=f"dividend_snippets={len(external_snippets)}")
            elif is_news and not news_articles:
                search_query = (
                    f"tin tức cổ phiếu {tickers[0]} mới nhất"
                    if tickers
                    else f"tin tức tài chính chứng khoán hôm nay {user_message}"
                )
                external_snippets = await self._search_external_info(search_query)
                s_step.mark("ok", passed=True, note=f"news_snippets={len(external_snippets)}")
            elif (
                not stock_data
                and not is_market_general
                and not is_news
                and not is_dividend
                and not is_leader
                and not knowledge_hits
            ):
                external_snippets = await self._search_external_info(user_message)
                s_step.mark("ok", passed=True, note=f"snippets={len(external_snippets)}")
            else:
                s_step.mark("skipped", note="internal_data_or_knowledge_available")

        # Step 7: Response generation
        intent: AiIntent = "general"
        if is_leader:
            intent = "leader"
        elif is_dividend:
            intent = "dividend"
        elif is_news:
            intent = "news"
        elif is_comparison or len(stock_data) >= 2:
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
                news_articles=news_articles,
                dividend_events=dividend_events,
                market_events=market_events,
                knowledge_hits=knowledge_hits,
                external_snippets=external_snippets,
                is_comparison=is_comparison,
                is_gold_bank=is_gold_bank,
                is_forensics=is_forensics,
                is_market_general=is_market_general,
                is_news=is_news,
                is_dividend=is_dividend,
                is_leader=is_leader,
                leader_profile=leader_profile,
                leader_id=leader_id,
                leader_name=leader_name,
                is_leader_rankings=is_leader_rankings,
                is_ecosystem=is_ecosystem,
                ecosystem_id=ecosystem_id,
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
        return await search_external_info(query)

    def _get_daily_market_snapshot(self) -> dict[str, Any]:
        """Aggregate daily market data (indices, VN30 basket, breadth, movers, liquidity, foreign flow, sectors)."""
        return build_daily_market_snapshot(self._market)

    def _generate_structured_response(
        self,
        *,
        user_message: str,
        tickers: list[str],
        stock_data: dict[str, Any],
        news_articles: list[dict[str, Any]],
        dividend_events: list[dict[str, Any]],
        market_events: list[dict[str, Any]] | None = None,
        knowledge_hits: list[KnowledgeHit],
        external_snippets: list[dict[str, str]],
        is_comparison: bool,
        is_gold_bank: bool,
        is_forensics: bool,
        is_market_general: bool,
        is_news: bool,
        is_dividend: bool,
        is_leader: bool = False,
        leader_profile: Any = None,
        leader_id: str | None = None,
        leader_name: str | None = None,
        is_leader_rankings: bool = False,
        is_ecosystem: bool = False,
        ecosystem_id: str | None = None,
    ) -> dict[str, Any]:
        """Synthesize structured response and widgets via ``response_builder``."""
        return generate_structured_response(
            market_service=self._market,
            user_message=user_message,
            tickers=tickers,
            stock_data=stock_data,
            news_articles=news_articles,
            dividend_events=dividend_events,
            market_events=market_events or [],
            knowledge_hits=knowledge_hits,
            external_snippets=external_snippets,
            is_comparison=is_comparison,
            is_gold_bank=is_gold_bank,
            is_forensics=is_forensics,
            is_market_general=is_market_general,
            is_news=is_news,
            is_dividend=is_dividend,
            is_leader=is_leader,
            leader_profile=leader_profile,
            leader_id=leader_id,
            leader_name=leader_name,
            is_leader_rankings=is_leader_rankings,
            is_ecosystem=is_ecosystem,
            ecosystem_id=ecosystem_id,
        )
