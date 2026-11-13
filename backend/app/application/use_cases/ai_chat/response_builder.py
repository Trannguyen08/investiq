"""Structured response and widget builders for AI Financial Assistant."""

from __future__ import annotations

import logging
from typing import Any

from app.application.use_cases.ai_chat.guardrails import fold_text
from app.application.use_cases.ai_chat.intent_parser import (
    _calculate_rsi,
    _clean_dividend_ratio,
    _get_val,
    normalize_user_input,
)
from app.application.use_cases.ai_chat.knowledge_base import KnowledgeHit
from app.application.use_cases.ai_chat.market_snapshot import build_daily_market_snapshot
from app.application.use_cases.ai_chat.ticker_resolver import (
    find_closest_tickers,
    is_valid_ticker,
)

logger = logging.getLogger(__name__)


def _build_dividend_and_events_section(
    user_message: str,
    tickers: list[str],
    stock_data: dict[str, Any],
    dividend_events: list[dict[str, Any]] | None,
    market_events: list[dict[str, Any]] | None,
    text_parts: list[str],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    target_stock = tickers[0] if tickers else ""
    inst = stock_data.get(target_stock, {}).get("instrument") if target_stock else None
    name = _get_val(inst, "name", target_stock) if inst else (target_stock or "Thị trường")
    q_folded = fold_text(normalize_user_input(user_message))
    is_general_event_query = "su kien" in q_folded and "co tuc" not in q_folded

    if target_stock:
        heading = (
            f"Lịch sự kiện & cổ tức: {target_stock} - {name}"
            if is_general_event_query
            else f"Lịch chia cổ tức: {target_stock} - {name}"
        )
        text_parts.append(heading)

        if dividend_events:
            text_parts.append(
                f"Thông tin các đợt chi trả cổ tức và quyền liên quan của {target_stock}:"
            )
            for ev in dividend_events[:5]:
                ex_date = ev.get("ex_date") or ev.get("event_date") or "Chưa rõ"
                div_type = ev.get("type", "cash")
                ratio, cash_val = _clean_dividend_ratio(
                    str(ev.get("ratio") or ""),
                    div_type,
                    ev.get("cash_value"),
                )
                val_str = f" ({cash_val:,.0f} đ/cp)" if cash_val is not None else ""
                type_desc = (
                    "Tiền mặt"
                    if div_type == "cash"
                    else (
                        "Cổ phiếu"
                        if div_type == "stock"
                        else ("Cổ phiếu thưởng" if div_type == "bonus" else "Quyền mua")
                    )
                )
                source_str = f" (Nguồn: {ev['source']})" if ev.get("source") else ""

                text_parts.append(
                    f"- Ngày GDKHQ: {ex_date} | Hình thức: {type_desc} | Tỷ lệ: {ratio}{val_str}{source_str}"
                )
                if ev.get("source_url"):
                    sources.append(
                        {
                            "kind": "internal"
                            if str(ev["source_url"]).startswith("/")
                            else "external",
                            "title": f"Nguồn công bố: {ev.get('source', target_stock)}",
                            "url": str(ev["source_url"]),
                        }
                    )

            sources.append(
                {
                    "kind": "internal",
                    "title": f"Lịch chia cổ tức {target_stock} (InvestIQ)",
                    "url": f"/market/stocks/{target_stock}#dividends",
                }
            )
        else:
            text_parts.append(
                f"Hiện tại chưa ghi nhận kế hoạch chốt quyền chia cổ tức mới của {target_stock} trong thời gian tới. "
                f"Bạn có thể theo dõi thêm tại báo cáo tài chính và nghị quyết ĐHCĐ."
            )
            sources.append(
                {
                    "kind": "internal",
                    "title": f"Bảng giá thị trường: {target_stock}",
                    "url": f"/market/stocks/{target_stock}",
                }
            )

        suggested_actions.extend(
            [
                {
                    "label": f"Xem bảng giá {target_stock}",
                    "action_type": "NAVIGATE",
                    "url": f"/market/stocks/{target_stock}",
                },
                {
                    "label": "Lịch sự kiện thị trường",
                    "action_type": "NAVIGATE",
                    "url": "/market/events",
                },
                {
                    "label": f"Giả lập mua 1.000 cp {target_stock}",
                    "action_type": "TRADE_ORDER",
                    "symbol": target_stock,
                    "quantity": 1000,
                },
            ]
        )
    else:
        heading = (
            "Lịch sự kiện thị trường & doanh nghiệp nổi bật sắp tới:"
            if is_general_event_query
            else "Lịch chia cổ tức các doanh nghiệp sắp tới:"
        )
        text_parts.append(heading)
        text_parts.append(
            "Tổng hợp các sự kiện doanh nghiệp, lịch chốt quyền cổ tức và công bố thông tin đáng chú ý trên thị trường chứng khoán Việt Nam:"
            if is_general_event_query
            else "Tổng hợp các sự kiện chốt quyền trả cổ tức gần nhất trên thị trường chứng khoán Việt Nam:"
        )

        rendered_count = 0
        if is_general_event_query and market_events:
            for m_ev in market_events[:4]:
                sym = m_ev.get("symbol", "Thị trường")
                ev_at = str(m_ev.get("event_at", ""))[:10] or "Sắp tới"
                ev_title = m_ev.get("title", "Sự kiện doanh nghiệp")
                ev_summary = m_ev.get("summary", "")
                src_name = m_ev.get("source_name")
                source_info = f" (Nguồn: {src_name})" if src_name else ""
                summary_part = f" — {ev_summary}" if ev_summary else ""
                text_parts.append(
                    f"- **{sym}** (Ngày sự kiện: {ev_at}): {ev_title}{summary_part}{source_info}"
                )
                if m_ev.get("source_url"):
                    sources.append(
                        {
                            "kind": "internal"
                            if str(m_ev["source_url"]).startswith("/")
                            else "external",
                            "title": f"Sự kiện {sym}: {src_name or 'Công bố'}",
                            "url": str(m_ev["source_url"]),
                        }
                    )
                rendered_count += 1

        for ev in (dividend_events or [])[:6]:
            sym = ev.get("symbol", "")
            ex_date = ev.get("ex_date") or ev.get("event_date") or "Sắp tới"
            div_type = ev.get("type", "cash")
            ratio, cash_val = _clean_dividend_ratio(
                str(ev.get("ratio") or ""),
                div_type,
                ev.get("cash_value"),
            )
            val_str = f" ({cash_val:,.0f} đ/cp)" if cash_val is not None else ""
            type_desc = (
                "Cổ tức tiền mặt"
                if div_type == "cash"
                else (
                    "Cổ tức cổ phiếu"
                    if div_type == "stock"
                    else ("Cổ phiếu thưởng" if div_type == "bonus" else "Quyền mua")
                )
            )
            title = ev.get("title") or f"{type_desc} | Tỷ lệ: {ratio}{val_str}"
            source_info = f" (Nguồn: {ev['source']})" if ev.get("source") else ""
            text_parts.append(f"- **{sym}** (Ngày GDKHQ: {ex_date}): {title}{source_info}")
            if ev.get("source_url"):
                sources.append(
                    {
                        "kind": "internal" if str(ev["source_url"]).startswith("/") else "external",
                        "title": f"Nguồn tin {sym}: {ev.get('source', 'Công bố')}",
                        "url": str(ev["source_url"]),
                    }
                )
            rendered_count += 1

        if rendered_count == 0:
            text_parts.append(
                "- Hiện tại lịch sự kiện doanh nghiệp và chốt quyền cổ tức đang được cập nhật cho chu kỳ công bố tiếp theo."
            )

        sources.append(
            {
                "kind": "internal",
                "title": "Lịch sự kiện & cổ tức toàn thị trường (InvestIQ)",
                "url": "/market/events",
            }
        )
        suggested_actions.extend(
            [
                {
                    "label": "Xem lịch sự kiện thị trường",
                    "action_type": "NAVIGATE",
                    "url": "/market/events",
                },
                {
                    "label": "Điểm tin thị trường hôm nay",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Điểm tin thị trường hôm nay",
                },
                {
                    "label": "Bảng giá trực tiếp",
                    "action_type": "NAVIGATE",
                    "url": "/market/stocks",
                },
            ]
        )


def _build_news_section(
    tickers: list[str],
    news_articles: list[dict[str, Any]] | None,
    external_snippets: list[dict[str, str]],
    text_parts: list[str],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    target_stock = tickers[0] if tickers else ""
    heading = (
        f"Điểm tin chứng khoán {target_stock}:" if target_stock else "Điểm tin thị trường hôm nay:"
    )
    text_parts.append(heading)

    if news_articles:
        text_parts.append(
            "Tổng hợp các thông tin tài chính và sự kiện thị trường mới nhất cập nhật trên hệ thống InvestIQ:"
        )
        for item in news_articles[:5]:
            time_info = f" | {item['published_at']}" if item.get("published_at") else ""
            summary = f" {item['summary']}" if item.get("summary") else ""
            text_parts.append(
                f"- **{item['title']}**:{summary} (Nguồn: {item.get('source', 'InvestIQ')}{time_info})"
            )
            sources.append(
                {
                    "kind": "internal",
                    "title": item["title"],
                    "url": item.get("url") or "/news",
                }
            )
    elif external_snippets:
        text_parts.append(
            "Điểm tin thị trường và doanh nghiệp tổng hợp từ các cơ quan báo chí tài chính uy tín:"
        )
        for item in external_snippets[:4]:
            text_parts.append(f"- **{item['title']}**: {item['snippet']}")
            sources.append(
                {
                    "kind": "external",
                    "title": item["title"],
                    "url": item["url"],
                }
            )
    else:
        text_parts.append(
            "Hiện tại chưa ghi nhận sự kiện tin tức tài chính đột biến mới trong phiên giao dịch hôm nay. "
            "Bạn có thể xem bảng giá trực tiếp hoặc khám phá các bài viết phân tích chuyên sâu tại trang Tin tức."
        )

    suggested_actions.extend(
        [
            {
                "label": "Xem toàn bộ tin tức",
                "action_type": "NAVIGATE",
                "url": "/news",
            },
            {
                "label": "Nhịp đập thị trường hôm nay",
                "action_type": "SEND_PROMPT",
                "prompt": "Thị trường hôm nay thế nào?",
            },
            {
                "label": "Bảng giá trực tiếp",
                "action_type": "NAVIGATE",
                "url": "/market/stocks",
            },
        ]
    )


def _build_leader_section(
    *,
    user_message: str,
    tickers: list[str],
    stock_data: dict[str, Any],
    leader_profile: Any | None,
    leader_id: str | None,
    leader_name: str | None,
    is_leader_rankings: bool,
    is_ecosystem: bool = False,
    ecosystem_id: str | None = None,
    market_service: Any,
    external_snippets: list[dict[str, str]],
    text_parts: list[str],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    del leader_id  # Handled in caller or not needed in text

    # Case A: Explicit corporate ecosystem query
    if is_ecosystem and ecosystem_id:
        from app.infrastructure.external.ecosystem.ecosystem_service import get_ecosystem_service

        eco_svc = get_ecosystem_service()
        eco_detail = eco_svc.get_ecosystem_detail(ecosystem_id)
        if eco_detail:
            heading = f"Hệ sinh thái doanh nghiệp: {eco_detail['name']}"
            text_parts.append(heading)
            text_parts.append(
                f"- **Người sáng lập / Lãnh đạo chủ chốt**: {eco_detail['founder_name']}\n"
                f"- **Lĩnh vực hoạt động**: {eco_detail['sector']}\n"
                f"- **Tổng quan hệ sinh thái**: {eco_detail['overview']}"
            )

            # Core tickers with live prices
            sym_items = []
            for node in eco_detail.get("nodes", []):
                t = node.get("ticker")
                if t:
                    inst = stock_data.get(t, {}).get("instrument")
                    if inst and hasattr(inst, "price") and inst.price > 0:
                        chg = getattr(inst, "change_percent", 0)
                        sym_items.append(f"{t} ({inst.price:,.0f} đ, {chg:+.2f}%)")
                    else:
                        sym_items.append(t)
            if sym_items:
                text_parts.append(f"- **Mã cổ phiếu hạt nhân trên sàn**: {', '.join(sym_items)}")

            # Key member companies / Pillars
            node_lines = ["- **Các công ty thành viên & Trụ cột chính**:"]
            for node in eco_detail.get("nodes", []):
                n_name = node.get("name", "")
                n_ticker = f" (Mã: {node['ticker']})" if node.get("ticker") else " (Ngoài sàn)"
                n_own = (
                    f" | Sở hữu: {float(node.get('ownership_percent', 0)):.1f}%"
                    if float(node.get("ownership_percent", 0)) > 0
                    else ""
                )
                n_role = node.get("role", "")
                node_lines.append(f"  - **{n_name}**{n_ticker}{n_own}: {n_role}")
            text_parts.append("\n".join(node_lines))

            # Value chains & relations
            links = eco_detail.get("links", [])
            if links:
                link_lines = ["- **Chuỗi giá trị & Liên kết chiến lược**:"]
                for link in links[:4]:
                    link_lines.append(f"  - {link.get('label', '')}")
                text_parts.append("\n".join(link_lines))

            # Sources & actions
            sources.append(
                {
                    "kind": "internal",
                    "title": f"Bản đồ hệ sinh thái doanh nghiệp {eco_detail['name']} (InvestIQ)",
                    "url": "/market/people",
                }
            )
            for node in eco_detail.get("nodes", []):
                t = node.get("ticker")
                if t:
                    sources.append(
                        {
                            "kind": "internal",
                            "title": f"Bảng giá thị trường: {t}",
                            "url": f"/market/stocks/{t}",
                        }
                    )
            sources.append(
                {
                    "kind": "external",
                    "title": "Dữ liệu sở hữu và hệ sinh thái tập đoàn (CafeF / Vietstock)",
                    "url": "https://cafef.vn",
                }
            )

            for node in eco_detail.get("nodes", [])[:2]:
                t = node.get("ticker")
                if t:
                    suggested_actions.append(
                        {
                            "label": f"Phân tích cổ phiếu {t}",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Phân tích {t}",
                        }
                    )
            primary_founder = eco_detail["founder_name"].split("&")[0].strip()
            suggested_actions.extend(
                [
                    {
                        "label": f"Lãnh đạo: {primary_founder}",
                        "action_type": "SEND_PROMPT",
                        "prompt": f"{primary_founder} là ai",
                    },
                    {
                        "label": "Xem danh sách lãnh đạo",
                        "action_type": "NAVIGATE",
                        "url": "/market/people",
                    },
                ]
            )
            return

    # Case B: General corporate ecosystems query
    if is_ecosystem and not ecosystem_id:
        heading = "Hệ sinh thái các tập đoàn lớn trên sàn chứng khoán:"
        text_parts.append(heading)
        text_parts.append(
            "Tổng hợp các hệ sinh thái và tập đoàn đa ngành có tầm ảnh hưởng lớn nhất trên thị trường chứng khoán Việt Nam:"
        )
        from app.infrastructure.external.ecosystem.ecosystem_service import get_ecosystem_service

        eco_svc = get_ecosystem_service()
        for eco in eco_svc.list_ecosystems()[:6]:
            e_name = eco["name"]
            e_founder = eco["founder_name"]
            e_sector = eco["sector"]
            e_tickers = ", ".join(t["symbol"] for t in eco.get("core_tickers", []))
            text_parts.append(
                f"- **{e_name}** ({e_founder})\n"
                f"  - Lĩnh vực: {e_sector} | Mã niêm yết: {e_tickers}\n"
                f"  - Tổng quan: {eco['overview']}"
            )
        sources.append(
            {
                "kind": "internal",
                "title": "Bản đồ hệ sinh thái doanh nghiệp (InvestIQ)",
                "url": "/market/people",
            }
        )
        suggested_actions.extend(
            [
                {
                    "label": "Hệ sinh thái Vingroup",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Hệ sinh thái Vingroup",
                },
                {
                    "label": "Hệ sinh thái Hòa Phát",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Hệ sinh thái Hòa Phát",
                },
                {
                    "label": "Hệ sinh thái FPT",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Hệ sinh thái FPT",
                },
                {
                    "label": "Xem danh sách lãnh đạo",
                    "action_type": "NAVIGATE",
                    "url": "/market/people",
                },
            ]
        )
        return

    # Case C: Rankings of top entrepreneurs / billionaires on the stock market
    if is_leader_rankings:
        heading = "Top doanh nhân & tỷ phú nổi bật trên sàn chứng khoán:"
        text_parts.append(heading)
        text_parts.append(
            "Danh sách các doanh nhân, lãnh đạo và tỷ phú hàng đầu có giá trị tài sản cổ phiếu lớn nhất trên sàn chứng khoán Việt Nam:"
        )

        people_list: list[dict[str, Any]] = []
        if hasattr(market_service, "people"):
            try:
                res = market_service.people()
                if isinstance(res, dict) and "data" in res and isinstance(res["data"], list):
                    people_list = res["data"]
            except Exception as exc:
                logger.warning("Failed to fetch people list from market_service: %s", exc)

        if not people_list:
            try:
                from app.infrastructure.external.crawlers.leader_crawler import get_leader_crawler

                inst_list = (
                    market_service.instruments() if hasattr(market_service, "instruments") else None
                )
                raw_people = get_leader_crawler().get_prominent_leaders(inst_list)
                for rank, p in enumerate(raw_people[:7], start=1):
                    people_list.append(
                        {
                            "rank": rank,
                            "full_name": p.full_name,
                            "role": p.role,
                            "company": p.company,
                            "symbols": list(p.symbols),
                            "ownership_percent": float(p.ownership_percent),
                            "estimated_listed_equity_value": float(p.estimated_listed_equity_value),
                            "net_worth_total": p.net_worth_total,
                        }
                    )
            except Exception as exc:
                logger.warning("Failed to fetch prominent leaders from crawler: %s", exc)

        for p in people_list[:6]:
            rank = p.get("rank", 1)
            p_name = p.get("full_name", "")
            p_role = p.get("role", "")
            p_comp = p.get("company", "")
            p_syms = p.get("symbols", [])
            sym_str = ", ".join(p_syms) if p_syms else "Chưa niêm yết"
            own_pct = float(p.get("ownership_percent") or 0)
            listed_val = float(p.get("estimated_listed_equity_value") or 0)
            net_total = p.get("net_worth_total", "")

            val_str = f"~{listed_val / 1e9:,.0f} tỷ ₫" if listed_val > 0 else "N/A"
            own_str = f" | Sở hữu: {own_pct:.2f}%" if own_pct > 0 else ""
            net_str = f" | Tổng tài sản: {net_total}" if net_total else ""

            text_parts.append(
                f"- **{rank}. {p_name}** — {p_role} ({p_comp})\n"
                f"  - Cổ phiếu liên quan: {sym_str}{own_str}\n"
                f"  - Tài sản cổ phiếu: {val_str}{net_str}"
            )

        sources.append(
            {
                "kind": "internal",
                "title": "Bảng xếp hạng người giàu sàn chứng khoán (InvestIQ)",
                "url": "/market/people",
            }
        )
        sources.append(
            {
                "kind": "external",
                "title": "Dữ liệu ban lãnh đạo và sở hữu (CafeF & Forbes)",
                "url": "https://cafef.vn",
            }
        )

        suggested_actions.extend(
            [
                {
                    "label": "Phân tích VIC (Phạm Nhật Vượng)",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Phân tích VIC",
                },
                {
                    "label": "Phân tích HPG (Trần Đình Long)",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Phân tích HPG",
                },
                {
                    "label": "Phân tích FPT (Trương Gia Bình)",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Phân tích FPT",
                },
                {
                    "label": "Xem danh sách người giàu",
                    "action_type": "NAVIGATE",
                    "url": "/market/people",
                },
            ]
        )
        return

    # Case D: Specific leader profile matched
    if leader_profile is not None:
        name = getattr(leader_profile, "full_name", leader_name or "Doanh nhân")
        role = getattr(leader_profile, "role", "")
        company = getattr(leader_profile, "company", "")
        sector = getattr(leader_profile, "sector", "")

        q_fold = normalize_user_input(user_message).lower()
        is_company_query = any(w in q_fold for w in ["tap doan", "cong ty", "doanh nghiep"]) or (
            not any(
                w in q_fold
                for w in ["ong", "ba", "chu tich", "tong giam doc", "ceo", "nguoi", "tieu su"]
            )
            and any(
                w in q_fold for w in ["vingroup", "hoa phat", "fpt", "masan", "vietjet", "novaland"]
            )
        )
        heading = (
            f"Thông tin doanh nghiệp & Lãnh đạo: {company} ({name})"
            if is_company_query and company
            else f"Thông tin doanh nhân: {name}"
        )
        text_parts.append(heading)

        if role or company:
            sector_info = f" (Lĩnh vực: {sector})" if sector else ""
            text_parts.append(f"- **Chức vụ & Đơn vị**: {role} — {company}{sector_info}")

        symbols = getattr(leader_profile, "symbols", ())
        if symbols:
            sym_items = []
            for s in symbols:
                inst_info = stock_data.get(s, {}).get("instrument")
                if inst_info and hasattr(inst_info, "price") and inst_info.price > 0:
                    p = inst_info.price
                    chg = getattr(inst_info, "change_percent", 0)
                    sym_items.append(f"{s} ({p:,.0f} đ, {chg:+.2f}%)")
                else:
                    sym_items.append(s)
            text_parts.append(f"- **Mã cổ phiếu liên quan**: {', '.join(sym_items)}")

        disclosed_shares = float(getattr(leader_profile, "disclosed_shares", 0))
        own_pct = float(getattr(leader_profile, "ownership_percent", 0))
        if disclosed_shares > 0 or own_pct > 0:
            share_parts = []
            if disclosed_shares > 0:
                share_parts.append(f"~{disclosed_shares / 1e6:,.1f} triệu cp")
            if own_pct > 0:
                share_parts.append(f"~{own_pct:.2f}% vốn điều lệ")
            text_parts.append(
                f"- **Cổ phần nắm giữ**: {' ('.join(share_parts) + ')' if len(share_parts) == 2 else share_parts[0]}"
            )

        # Estimated listed equity
        if disclosed_shares > 0:
            primary_sym = symbols[0] if symbols else ""
            inst_info = stock_data.get(primary_sym, {}).get("instrument") if primary_sym else None
            price = (
                float(inst_info.price)
                if inst_info and hasattr(inst_info, "price") and inst_info.price > 0
                else float(getattr(leader_profile, "base_price", 0))
            )
            if price > 0:
                listed_equity = disclosed_shares * price
                text_parts.append(
                    f"- **Tài sản cổ phiếu niêm yết ước tính**: ~{listed_equity / 1e9:,.0f} tỷ ₫"
                )

        net_total = getattr(leader_profile, "net_worth_total", "")
        if net_total:
            text_parts.append(f"- **Tổng tài sản ước tính**: {net_total}")

        net_ext = getattr(leader_profile, "net_worth_external", "")
        if net_ext:
            label = "Hệ sinh thái & Ngoài sàn" if symbols else "Dấu ấn & Triết lý"
            text_parts.append(f"- **{label}**: {net_ext}")

        bio = getattr(leader_profile, "bio", "")
        if bio:
            text_parts.append(f"- **Tiểu sử & Dấu ấn sự nghiệp**: {bio}")

        # Associated corporate ecosystem breakdown
        try:
            from app.infrastructure.external.ecosystem.ecosystem_service import (
                get_ecosystem_service,
            )

            eco_svc = get_ecosystem_service()
            associated_eco = None
            l_id = getattr(leader_profile, "id", "")
            for eco in eco_svc._ecosystems.values():
                if eco.founder_id == l_id or (
                    l_id in {"person-5", "person-6"} and eco.id == "masan-techcombank"
                ):
                    associated_eco = eco
                    break
            if associated_eco:
                eco_nodes = ", ".join(
                    f"{n.name} ({n.ticker})" if n.ticker else n.name
                    for n in associated_eco.nodes[:4]
                )
                text_parts.append(
                    f"- **Hệ sinh thái doanh nghiệp ({associated_eco.name})**: {associated_eco.overview}\n"
                    f"  - Các trụ cột cốt lõi: {eco_nodes}"
                )
        except Exception as exc:
            logger.debug("Failed to append associated ecosystem: %s", exc)

        # Sources
        for s in symbols:
            sources.append(
                {
                    "kind": "internal",
                    "title": f"Bảng giá thị trường: {s}",
                    "url": f"/market/stocks/{s}",
                }
            )
        sources.append(
            {
                "kind": "internal",
                "title": f"Hồ sơ lãnh đạo: {name} (InvestIQ)",
                "url": "/market/people",
            }
        )
        sources.append(
            {
                "kind": "external",
                "title": "Dữ liệu ban lãnh đạo và sở hữu (CafeF & Forbes)",
                "url": "https://cafef.vn",
            }
        )

        # Suggested actions
        for s in symbols[:2]:
            suggested_actions.append(
                {
                    "label": f"Phân tích cổ phiếu {s}",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"Phân tích {s}",
                }
            )
        suggested_actions.extend(
            [
                {
                    "label": "Top tỷ phú chứng khoán",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Top người giàu trên sàn chứng khoán",
                },
                {
                    "label": "Xem danh sách lãnh đạo",
                    "action_type": "NAVIGATE",
                    "url": "/market/people",
                },
            ]
        )
        return

    # Case C: Leader not in predefined database, but external snippets found
    if external_snippets:
        display_name = leader_name or (tickers[0] if tickers else "Doanh nhân & Lãnh đạo")
        text_parts.append(f"Thông tin doanh nhân & lãnh đạo: {display_name}")
        text_parts.append("Thông tin tổng hợp cập nhật từ báo chí và cơ sở dữ liệu thị trường:")
        for item in external_snippets[:3]:
            text_parts.append(f"- **{item['title']}**: {item['snippet']}")
            sources.append(
                {
                    "kind": "external",
                    "title": item["title"],
                    "url": item["url"],
                }
            )
        sources.append(
            {
                "kind": "internal",
                "title": "Hồ sơ lãnh đạo & Top người giàu sàn chứng khoán (InvestIQ)",
                "url": "/market/people",
            }
        )
        suggested_actions.extend(
            [
                {
                    "label": "Top tỷ phú chứng khoán",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Top người giàu trên sàn chứng khoán",
                },
                {
                    "label": "Xem danh sách lãnh đạo",
                    "action_type": "NAVIGATE",
                    "url": "/market/people",
                },
                {
                    "label": "Nhịp đập thị trường",
                    "action_type": "SEND_PROMPT",
                    "prompt": "Thị trường hôm nay thế nào?",
                },
            ]
        )
        return

    # Fallback when no profile and no snippets
    display_name = leader_name or "Doanh nhân"
    text_parts.append(f"Thông tin doanh nhân: {display_name}")
    text_parts.append(
        "Hệ thống InvestIQ hiện có hồ sơ chi tiết của 22 doanh nhân, lãnh đạo và tỷ phú tiêu biểu trên sàn chứng khoán "
        "(như Phạm Nhật Vượng, Trần Đình Long, Nguyễn Thị Phương Thảo, Trương Gia Bình, Hồ Hùng Anh...) cùng các huyền thoại đầu tư quốc tế."
    )
    text_parts.append(
        "Bạn có thể đặt câu hỏi theo tên doanh nhân hoặc mã cổ phiếu trực tiếp (ví dụ: 'Phạm Nhật Vượng là ai', 'Chủ tịch Hòa Phát', 'Trương Gia Bình FPT')."
    )
    sources.append(
        {
            "kind": "internal",
            "title": "Hồ sơ lãnh đạo & Top người giàu sàn chứng khoán (InvestIQ)",
            "url": "/market/people",
        }
    )
    suggested_actions.extend(
        [
            {
                "label": "Phân tích HPG (Trần Đình Long)",
                "action_type": "SEND_PROMPT",
                "prompt": "Phân tích HPG",
            },
            {
                "label": "Phân tích VIC (Phạm Nhật Vượng)",
                "action_type": "SEND_PROMPT",
                "prompt": "Phân tích VIC",
            },
            {
                "label": "Top tỷ phú chứng khoán",
                "action_type": "SEND_PROMPT",
                "prompt": "Top người giàu trên sàn chứng khoán",
            },
            {
                "label": "Xem danh sách lãnh đạo",
                "action_type": "NAVIGATE",
                "url": "/market/people",
            },
        ]
    )


def _build_typo_suggestion_section(
    *,
    invalid_tickers: list[str],
    is_dividend: bool,
    is_forensics: bool,
    is_trade_order: bool = False,
    trade_side: str = "buy",
    trade_quantity: int = 100,
    is_community_post: bool = False,
    market_service: Any = None,
    text_parts: list[str],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    """Synthesize helpful closest-match suggestions when user enters an unrecognized stock ticker."""
    bad_list_str = ", ".join(f"**{t}**" for t in invalid_tickers[:3])
    text_parts.append(
        f"Không tìm thấy mã cổ phiếu {bad_list_str} trên các sàn chứng khoán Việt Nam (HOSE, HNX, UPCoM)."
    )

    all_suggestions: list[Any] = []
    seen_syms: set[str] = set()
    suggestion_lines: list[str] = []

    for bad_sym in invalid_tickers[:3]:
        matches = find_closest_tickers(bad_sym, max_results=3, allow_valid=True)
        for m in matches:
            if m.symbol not in seen_syms:
                seen_syms.add(m.symbol)
                all_suggestions.append(m)
                suggestion_lines.append(f"- **{m.symbol}** — {m.name} (Ngành: {m.sector})")

    if suggestion_lines:
        if is_trade_order:
            side_clean = "buy" if trade_side.lower() == "buy" else "sell"
            side_vi = "Mua" if side_clean == "buy" else "Bán"
            text_parts.append(
                f"Có phải bạn muốn đặt lệnh **{side_vi.upper()} {trade_quantity:,} cổ phiếu** cho một trong các mã cổ phiếu gần đúng sau:\n"
                + "\n".join(suggestion_lines[:4])
            )
            text_parts.append(
                "Vui lòng chọn mã gợi ý bên dưới để hoàn tất đặt lệnh mô phỏng nhanh:"
            )

            for m in all_suggestions[:3]:
                price_val = 20000
                if market_service and hasattr(market_service, "instrument"):
                    try:
                        inst = market_service.instrument(m.symbol, include_fundamentals=False)
                        if inst and getattr(inst, "price", None):
                            price_val = float(inst.price)
                    except Exception:
                        pass

                sources.append(
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {m.symbol} ({m.name})",
                        "url": f"/market/stocks/{m.symbol}",
                    }
                )
                suggested_actions.append(
                    {
                        "label": f"Đặt lệnh {side_vi} {trade_quantity} {m.symbol} ngay",
                        "action_type": "TRADE_ORDER",
                        "symbol": m.symbol,
                        "side": side_clean,
                        "quantity": trade_quantity,
                        "price": str(int(price_val)),
                    }
                )
                suggested_actions.append(
                    {
                        "label": f"Mở phiếu lệnh {m.symbol}",
                        "action_type": "NAVIGATE",
                        "url": f"/portfolio?action=trade&symbol={m.symbol}&side={side_clean}&qty={trade_quantity}",
                    }
                )

            suggested_actions.append(
                {
                    "label": "Vào Sổ lệnh & Danh mục",
                    "action_type": "NAVIGATE",
                    "url": "/portfolio",
                }
            )
            if all_suggestions:
                top_m = all_suggestions[0]
                suggested_actions.append(
                    {
                        "label": f"Phân tích chuyên sâu {top_m.symbol}",
                        "action_type": "SEND_PROMPT",
                        "prompt": f"Phân tích {top_m.symbol}",
                    }
                )
        elif is_community_post:
            text_parts.append(
                "Có phải bạn đang muốn viết bài / đăng luận điểm đầu tư cho một trong các mã gần đúng sau:\n"
                + "\n".join(suggestion_lines[:4])
            )
            text_parts.append(
                "Vui lòng chọn mã bên dưới để InvestIQ soạn thảo luận điểm đầu tư hoàn chỉnh:"
            )
            for m in all_suggestions[:3]:
                sources.append(
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {m.symbol} ({m.name})",
                        "url": f"/market/stocks/{m.symbol}",
                    }
                )
                suggested_actions.append(
                    {
                        "label": f"Soạn luận điểm {m.symbol}",
                        "action_type": "SEND_PROMPT",
                        "prompt": f"Đăng bài về {m.symbol}",
                    }
                )
        else:
            text_parts.append(
                "Có phải bạn đang tìm kiếm một trong các mã cổ phiếu gần đúng sau:\n"
                + "\n".join(suggestion_lines[:4])
            )
            text_parts.append(
                "Vui lòng chọn mã gợi ý bên dưới hoặc nhập lại mã cổ phiếu chính xác để InvestIQ phân tích."
            )

            for m in all_suggestions[:3]:
                sources.append(
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {m.symbol} ({m.name})",
                        "url": f"/market/stocks/{m.symbol}",
                    }
                )
                if is_dividend:
                    suggested_actions.append(
                        {
                            "label": f"Lịch chia cổ tức {m.symbol}",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Lịch chia cổ tức {m.symbol}",
                        }
                    )
                elif is_forensics:
                    suggested_actions.append(
                        {
                            "label": f"Kiểm tra rủi ro BCTC {m.symbol}",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Kiểm tra BCTC {m.symbol}",
                        }
                    )
                else:
                    suggested_actions.append(
                        {
                            "label": f"Phân tích {m.symbol} ({m.name})",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Phân tích {m.symbol}",
                        }
                    )
    else:
        if is_trade_order:
            side_clean = "buy" if trade_side.lower() == "buy" else "sell"
            side_vi = "Mua" if side_clean == "buy" else "Bán"
            text_parts.append(
                "Vui lòng kiểm tra lại mã chứng khoán (gồm 3 ký tự niêm yết trên HOSE, HNX hoặc UPCoM, ví dụ: HPG, VCB, FPT, MBB) để đặt lệnh."
            )
            suggested_actions.extend(
                [
                    {
                        "label": f"Đặt lệnh {side_vi} 100 HPG",
                        "action_type": "TRADE_ORDER",
                        "symbol": "HPG",
                        "side": side_clean,
                        "quantity": 100,
                        "price": "21200",
                    },
                    {
                        "label": f"Đặt lệnh {side_vi} 100 FPT",
                        "action_type": "TRADE_ORDER",
                        "symbol": "FPT",
                        "side": side_clean,
                        "quantity": 100,
                        "price": "50900",
                    },
                    {
                        "label": "Vào Sổ lệnh & Danh mục",
                        "action_type": "NAVIGATE",
                        "url": "/portfolio",
                    },
                ]
            )
        else:
            text_parts.append(
                "Vui lòng kiểm tra lại mã chứng khoán (gồm 3 ký tự niêm yết trên HOSE, HNX hoặc UPCoM, ví dụ: HPG, VCB, FPT)."
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
                ]
            )


def _build_comparison_section(
    *,
    user_message: str,
    tickers: list[str],
    stock_data: dict[str, Any],
    text_parts: list[str],
    widgets: list[dict[str, Any]],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
    comparison_mode: str = "ask",
    exceeded_limit: bool = False,
    invalid_tickers: list[str] | None = None,
) -> None:
    del user_message  # Unused directly in synthesis
    active_tickers = [t for t in (tickers or list(stock_data.keys()))[:3] if t in stock_data]
    if not active_tickers:
        active_tickers = list(stock_data.keys())[:3]

    unresolved: list[str] = []
    for t in tickers:
        if t not in stock_data and t not in unresolved:
            unresolved.append(t)
    for t in invalid_tickers or []:
        if t not in stock_data and t not in unresolved:
            unresolved.append(t)

    if len(active_tickers) < 2:
        if unresolved:
            bad_str = ", ".join(f"**{t}**" for t in unresolved[:3])
            text_parts.append(
                f"Mã cổ phiếu {bad_str} không tồn tại hoặc chưa có dữ liệu giao dịch trên các sàn chứng khoán Việt Nam (HOSE, HNX, UPCoM)."
            )

            suggestion_blocks: list[str] = []
            top_per_bad: list[str] = []
            all_suggested_objs: list[Any] = []

            for bad_sym in unresolved[:3]:
                matches = find_closest_tickers(bad_sym, max_results=3, allow_valid=True)
                filtered = [m for m in matches if m.symbol not in active_tickers]
                if filtered:
                    for cand in filtered:
                        if cand.symbol not in top_per_bad:
                            top_per_bad.append(cand.symbol)
                            break
                    for m in filtered:
                        if all(x.symbol != m.symbol for x in all_suggested_objs):
                            all_suggested_objs.append(m)
                    items_desc = ", ".join(f"**{m.symbol}** ({m.name})" for m in filtered[:3])
                    suggestion_blocks.append(f"- Gần đúng với **{bad_sym}**: {items_desc}")

            if len(active_tickers) == 1:
                valid_sym = active_tickers[0]
                valid_alts = [
                    m
                    for m in find_closest_tickers(valid_sym, max_results=3, allow_valid=True)
                    if m.symbol != valid_sym
                ]
                if valid_alts and valid_sym not in (
                    "HPG",
                    "VCB",
                    "FPT",
                    "VIC",
                    "VHM",
                    "MBB",
                    "TCB",
                    "SSI",
                    "VNM",
                    "MWG",
                    "ACB",
                    "STB",
                ):
                    alt_desc = ", ".join(f"**{m.symbol}** ({m.name})" for m in valid_alts[:3])
                    suggestion_blocks.append(
                        f"- Nếu **{valid_sym}** cũng là mã nhập nhầm, gợi ý gần đúng: {alt_desc}"
                    )

            if suggestion_blocks:
                text_parts.append(
                    "Gợi ý các mã cổ phiếu gần đúng:\n" + "\n".join(suggestion_blocks)
                )

            if len(active_tickers) == 1:
                valid_sym = active_tickers[0]
                if all_suggested_objs:
                    best_sym = all_suggested_objs[0].symbol
                    text_parts.append(
                        f"Bạn đã chọn mã hợp lệ **{valid_sym}**. Có phải bạn muốn so sánh giữa **{best_sym}** và **{valid_sym}** không?"
                    )
                    for m in all_suggested_objs[:2]:
                        suggested_actions.append(
                            {
                                "label": f"So sánh {m.symbol} và {valid_sym}",
                                "action_type": "SEND_PROMPT",
                                "prompt": f"So sánh {m.symbol} và {valid_sym}",
                            }
                        )
                    suggested_actions.append(
                        {
                            "label": f"Phân tích {best_sym}",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Phân tích {best_sym}",
                        }
                    )
                else:
                    text_parts.append(
                        f"Bạn đã chọn mã **{valid_sym}**. Vui lòng cung cấp thêm ít nhất 1 mã cổ phiếu hợp lệ nữa để đối chiếu."
                    )
                sources.append(
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {valid_sym}",
                        "url": f"/market/stocks/{valid_sym}",
                    }
                )
            else:
                # 0 valid tickers, 1+ unresolved typos
                pair_candidates: list[str] = list(top_per_bad)
                for m in all_suggested_objs:
                    if m.symbol not in pair_candidates:
                        pair_candidates.append(m.symbol)
                if len(pair_candidates) >= 2:
                    s1, s2 = pair_candidates[0], pair_candidates[1]
                    text_parts.append(f"Có phải bạn muốn so sánh giữa **{s1}** và **{s2}** không?")
                    suggested_actions.append(
                        {
                            "label": f"So sánh {s1} và {s2}",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"So sánh {s1} và {s2}",
                        }
                    )
                for m in all_suggested_objs[:2]:
                    suggested_actions.append(
                        {
                            "label": f"Phân tích {m.symbol} ({m.name})",
                            "action_type": "SEND_PROMPT",
                            "prompt": f"Phân tích {m.symbol}",
                        }
                    )

            for m in all_suggested_objs[:2]:
                sources.append(
                    {
                        "kind": "internal",
                        "title": f"Bảng giá thị trường InvestIQ: {m.symbol}",
                        "url": f"/market/stocks/{m.symbol}",
                    }
                )
            return

        if len(active_tickers) == 1:
            sym = active_tickers[0]
            text_parts.append(
                f"Bạn đã chọn mã **{sym}**. Vui lòng cung cấp thêm ít nhất 1 mã cổ phiếu nữa để InvestIQ tiến hành đối chiếu "
                f"(Ví dụ: 'So sánh {sym} và HPG' hoặc 'So sánh {sym}, MBB và TCB')."
            )
        else:
            text_parts.append(
                "Bạn muốn so sánh những mã cổ phiếu nào? Vui lòng cung cấp từ 2 đến 3 mã cổ phiếu "
                "(Ví dụ: 'So sánh VCB và HPG', 'So sánh FPT, MWG và VNM')."
            )
        return

    if unresolved:
        bad_notes: list[str] = []
        for bad_sym in unresolved[:2]:
            matches = find_closest_tickers(bad_sym, max_results=2, allow_valid=True)
            hint = f" (gợi ý gần đúng: {', '.join(m.symbol for m in matches)})" if matches else ""
            bad_notes.append(f"**{bad_sym}**{hint}")
        text_parts.append(
            f"> [!NOTE] Mã {', '.join(bad_notes)} không tồn tại trên sàn niêm yết. "
            f"Hệ thống tiến hành đối chiếu các mã hợp lệ: {', '.join(active_tickers)}.\n"
        )

    # Add limit notice if user asked for > 2 stocks
    if exceeded_limit:
        text_parts.append(
            f"> [!NOTE] InvestIQ hỗ trợ so sánh tối đa 2 mã cổ phiếu trong cùng một lượt. "
            f"Hệ thống sẽ tiến hành so sánh 2 mã: {', '.join(active_tickers)}.\n"
        )

    tickers_title = " vs ".join(active_tickers)
    tickers_and = " và ".join(active_tickers)

    # Internal sources for each ticker
    for sym in active_tickers:
        sources.append(
            {
                "kind": "internal",
                "title": f"Bảng giá thị trường InvestIQ: {sym}",
                "url": f"/market/stocks/{sym}",
            }
        )

    # Extract metrics and growth for each active ticker
    parsed_items: list[dict[str, Any]] = []
    for sym in active_tickers:
        d = stock_data[sym]
        inst = d["instrument"]
        growth = d.get("growth", {}) or {}

        p = float(_get_val(inst, "price", 0))
        name = _get_val(inst, "name", sym)
        sector = _get_val(inst, "sector", "")
        chg = float(_get_val(inst, "change_percent", 0))
        pe = float(_get_val(inst, "pe", 12.5) or 12.5)
        pb = float(_get_val(inst, "pb", 1.6) or 1.6)
        roe = float(_get_val(inst, "roe_percent", 18.0) or 18.0)
        market_cap_str = (
            f"{float(_get_val(inst, 'market_cap', 0)):,.0f} ₫"
            if _get_val(inst, "market_cap")
            else "Chưa có"
        )

        # Growth fields
        health_status = growth.get("health_status") or "stable"
        health_title = growth.get("health_title") or "Hoạt động & tài chính ổn định"
        health_summary = (
            growth.get("health_summary") or f"{name} duy trì cơ cấu tài chính lành mạnh."
        )
        cap_1m = growth.get("market_cap_growth_1m")
        cap_3m = growth.get("market_cap_growth_3m")
        cap_6m = growth.get("market_cap_growth_6m")
        cap_1y = growth.get("market_cap_growth_1y")

        quarters = growth.get("quarters", []) or []
        latest_q = quarters[-1] if quarters else {}
        rev_growth = latest_q.get("revenue_growth_yoy")
        profit_growth = latest_q.get("profit_growth_yoy")
        revenue_ttm = growth.get("revenue_ttm")
        profit_ttm = growth.get("profit_ttm")
        vol_growth = growth.get("volume_growth_20d") or "Khối lượng ổn định"
        insights = growth.get("insights", []) or []

        # Determine Pros & Cons based on quantitative metrics
        pros: list[str] = []
        cons: list[str] = []
        if pe <= 13.0:
            pros.append(f"P/E {pe:.1f}x định giá hấp dẫn")
        else:
            cons.append(f"P/E {pe:.1f}x ở mức cao so với trung vị ngành")
        if roe >= 15.0:
            pros.append(f"Biên ROE {roe:.1f}% hiệu quả sinh lời tốt")
        else:
            cons.append(f"ROE {roe:.1f}% cần cải thiện hiệu quả sử dụng vốn")
        if chg > 0:
            pros.append(f"Động lượng giá tích cực (+{chg:.2f}%)")
        if rev_growth and rev_growth.startswith("+"):
            pros.append(f"Doanh thu quý tăng trưởng {rev_growth}")
        if profit_growth and profit_growth.startswith("-"):
            cons.append(f"Lợi nhuận quý suy giảm {profit_growth}")

        if not pros:
            pros.append(f"Vốn hóa đầu ngành {sector or 'niêm yết'}")
        if not cons:
            cons.append("Biến động theo xu hướng chung của thị trường")

        parsed_items.append(
            {
                "symbol": sym,
                "name": name,
                "price": p,
                "change_percent": f"{chg:+.2f}%",
                "pe": f"{pe:.1f}x",
                "pb": f"{pb:.1f}x",
                "roe": f"{roe:.1f}%",
                "sector": sector,
                "market_cap": market_cap_str,
                "pros": pros[:2],
                "cons": cons[:2],
                "health_status": health_status,
                "health_title": health_title,
                "health_summary": health_summary,
                "market_cap_growth_1m": cap_1m,
                "market_cap_growth_3m": cap_3m,
                "market_cap_growth_6m": cap_6m,
                "market_cap_growth_1y": cap_1y,
                "revenue_growth_yoy": rev_growth,
                "profit_growth_yoy": profit_growth,
                "revenue_ttm": revenue_ttm,
                "profit_ttm": profit_ttm,
                "volume_growth_20d": vol_growth,
                "growth_insights": insights[:2],
            }
        )

    # 1. Mode ASK: Ask the user to choose criteria
    if comparison_mode == "ask":
        text_parts.append(f"Lựa chọn tiêu chí so sánh: {tickers_title}")
        text_parts.append(
            f"Bạn muốn so sánh các mã **{', '.join(active_tickers)}** theo tiêu chí nào dưới đây?\n\n"
            f"- **Thông số tài chính & Định giá**: Đối chiếu thị giá, định giá P/E, P/B, tỷ suất sinh lời ROE, vốn hóa và ưu/nhược điểm kỹ thuật.\n"
            f"- **Báo cáo tăng trưởng**: Tốc độ tăng trưởng doanh thu, lợi nhuận sau thuế, EPS, tăng trưởng vốn hóa qua các mốc (1T, 3T, 6T, 1N) và sức khỏe tài chính.\n"
            f"- **Cả hai (Toàn diện)**: Bảng đối chiếu song song thông số định giá kết hợp phân tích báo cáo tăng trưởng chuyên sâu.\n\n"
            f"*Vui lòng bấm chọn một trong các tùy chọn gợi ý bên dưới để InvestIQ phản hồi ngay:*"
        )
        suggested_actions.extend(
            [
                {
                    "label": "So sánh theo Thông số",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} theo thông số",
                },
                {
                    "label": "So sánh Báo cáo tăng trưởng",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} theo báo cáo tăng trưởng",
                },
                {
                    "label": "So sánh Cả hai (Toàn diện)",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} cả hai",
                },
            ]
        )
        for sym in active_tickers:
            suggested_actions.append(
                {
                    "label": f"Xem biểu đồ {sym}",
                    "action_type": "NAVIGATE",
                    "url": f"/market/stocks/{sym}",
                }
            )
        return

    # 2. Mode METRICS: Valuation and technical parameters
    if comparison_mode == "metrics":
        text_parts.append(f"Đối chiếu so sánh thông số: {tickers_title}")
        metric_lines = []
        for it in parsed_items:
            metric_lines.append(
                f"- **{it['symbol']}** ({it['name']}): Giá hiện tại {it['price']:,.0f} đ ({it['change_percent']}), "
                f"P/E {it['pe']}, P/B {it['pb']}, ROE {it['roe']}. Vốn hóa: {it['market_cap']}. Ngành: {it['sector'] or 'Chưa phân ngành'}."
            )
        text_parts.append("\n".join(metric_lines))

        # Build comparison verdict
        best_pe = min(
            parsed_items, key=lambda x: float(x["pe"].replace("x", "")) if "x" in x["pe"] else 999.0
        )
        best_roe = max(
            parsed_items,
            key=lambda x: float(x["roe"].replace("%", "")) if "%" in x["roe"] else -999.0,
        )
        verdict = (
            f"Về mặt định giá, **{best_pe['symbol']}** sở hữu chỉ số P/E hấp dẫn nhất ({best_pe['pe']}), "
            f"trong khi **{best_roe['symbol']}** dẫn đầu về hiệu quả sinh lời trên vốn chủ sở hữu (ROE {best_roe['roe']}). "
            f"Nhà đầu tư theo trường phái giá trị có thể ưu tiên mã có P/E thấp, trong khi nhà đầu tư tăng trưởng nên cân nhắc hiệu quả sử dụng vốn ROE cao."
        )
        text_parts.append(verdict)

        widgets.append(
            {
                "type": "stock_comparison",
                "data": {
                    "title": f"Bảng so sánh thông số định giá {tickers_and}",
                    "mode": "metrics",
                    "items": parsed_items,
                    "summary_verdict": verdict,
                },
            }
        )

        suggested_actions.extend(
            [
                {
                    "label": "So sánh Báo cáo tăng trưởng",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} theo báo cáo tăng trưởng",
                },
                {
                    "label": "So sánh Cả hai (Toàn diện)",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} cả hai",
                },
            ]
        )
        for sym in active_tickers:
            suggested_actions.append(
                {
                    "label": f"Xem biểu đồ {sym}",
                    "action_type": "NAVIGATE",
                    "url": f"/market/stocks/{sym}",
                }
            )
        return

    # 3. Mode GROWTH: Revenue, profit, market cap horizons, financial health
    if comparison_mode == "growth":
        text_parts.append(f"Đối chiếu so sánh báo cáo tăng trưởng: {tickers_title}")
        growth_lines = []
        for it in parsed_items:
            rev_txt = (
                f"Doanh thu quý: {it['revenue_growth_yoy']}"
                if it["revenue_growth_yoy"]
                else "Doanh thu: Đang cập nhật"
            )
            prof_txt = (
                f"LNST quý: {it['profit_growth_yoy']}"
                if it["profit_growth_yoy"]
                else "LNST: Đang cập nhật"
            )
            cap_txt = f"Vốn hóa 1T: {it['market_cap_growth_1m'] or 'N/A'}, 1N: {it['market_cap_growth_1y'] or 'N/A'}"
            growth_lines.append(
                f"- **{it['symbol']}** ({it['name']}): Trạng thái **{it['health_title']}**. "
                f"{rev_txt}, {prof_txt}. LNST TTM đạt {it['profit_ttm'] or 'N/A'}. {cap_txt}."
            )
            if it["growth_insights"]:
                for ins in it["growth_insights"][:1]:
                    growth_lines.append(f"  * Điểm nổi bật: {ins}")

        text_parts.append("\n".join(growth_lines))

        growth_verdict = (
            "Về tốc độ bứt phá kết quả kinh doanh và mở rộng quy mô, các mã đều thể hiện những động lực tăng trưởng riêng biệt. "
            "Mã có trạng thái tăng trưởng bứt phá hoặc doanh thu/LNST tăng trưởng dương bền vững qua các quý sẽ có sức chống chịu tốt hơn trong các nhịp thị trường điều chỉnh."
        )
        text_parts.append(growth_verdict)

        widgets.append(
            {
                "type": "stock_comparison",
                "data": {
                    "title": f"Bảng so sánh báo cáo tăng trưởng {tickers_and}",
                    "mode": "growth",
                    "items": parsed_items,
                    "summary_verdict": growth_verdict,
                },
            }
        )

        suggested_actions.extend(
            [
                {
                    "label": "So sánh theo Thông số",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} theo thông số",
                },
                {
                    "label": "So sánh Cả hai (Toàn diện)",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"So sánh {tickers_and} cả hai",
                },
            ]
        )
        for sym in active_tickers:
            suggested_actions.append(
                {
                    "label": f"Xem biểu đồ {sym}",
                    "action_type": "NAVIGATE",
                    "url": f"/market/stocks/{sym}",
                }
            )
        return

    # 4. Mode BOTH: Comprehensive evaluation (Metrics + Growth)
    text_parts.append(f"Đối chiếu so sánh toàn diện: {tickers_title}")

    # Section 1: Thông số định giá
    text_parts.append("### 1. Thông số tài chính & Định giá:")
    metric_lines = []
    for it in parsed_items:
        metric_lines.append(
            f"- **{it['symbol']}**: Giá {it['price']:,.0f} đ ({it['change_percent']}), "
            f"P/E {it['pe']}, P/B {it['pb']}, ROE {it['roe']}. Vốn hóa: {it['market_cap']}."
        )
    text_parts.append("\n".join(metric_lines))

    # Section 2: Báo cáo tăng trưởng
    text_parts.append("### 2. Báo cáo Tăng trưởng & Sức khỏe Tài chính:")
    growth_lines = []
    for it in parsed_items:
        rev_txt = (
            f"Doanh thu quý {it['revenue_growth_yoy']}"
            if it["revenue_growth_yoy"]
            else "Doanh thu ổn định"
        )
        prof_txt = (
            f"LNST quý {it['profit_growth_yoy']}" if it["profit_growth_yoy"] else "LNST ổn định"
        )
        growth_lines.append(
            f"- **{it['symbol']}**: Trạng thái **{it['health_title']}**. "
            f"{rev_txt}, {prof_txt}. LNST TTM: {it['profit_ttm'] or 'N/A'}. Tăng trưởng vốn hóa 1T: {it['market_cap_growth_1m'] or 'N/A'}."
        )
    text_parts.append("\n".join(growth_lines))

    # Section 3: Nhận định tổng hợp
    text_parts.append("### 3. Nhận định Tổng hợp Đa chiều:")
    overall_verdict = (
        "Đối chiếu giữa góc nhìn định giá và động lực tăng trưởng cho thấy: "
        "Mỗi mã đều có ưu thế cạnh tranh trong rổ ngành tương ứng. "
        "Nếu ưu tiên sự an toàn và định giá thấp, hãy xem xét mã có P/E chiết khấu sâu. "
        "Nếu theo đuổi đà tăng giá từ kết quả kinh doanh đột phá, các mã có tăng trưởng doanh thu/lợi nhuận hai chữ số sẽ là điểm tựa vững chắc."
    )
    text_parts.append(overall_verdict)

    widgets.append(
        {
            "type": "stock_comparison",
            "data": {
                "title": f"Bảng đối chiếu toàn diện {tickers_and}",
                "mode": "both",
                "items": parsed_items,
                "summary_verdict": overall_verdict,
            },
        }
    )

    suggested_actions.extend(
        [
            {
                "label": "So sánh Cổ phiếu vs Vàng & Ngân hàng",
                "action_type": "OPEN_MODAL",
                "modal_type": "COMPARATOR",
                "symbol": active_tickers[0],
            },
        ]
    )
    for sym in active_tickers:
        suggested_actions.append(
            {
                "label": f"Xem biểu đồ {sym}",
                "action_type": "NAVIGATE",
                "url": f"/market/stocks/{sym}",
            }
        )


def _build_single_stock_section(
    stock_data: dict[str, Any],
    is_forensics: bool,
    text_parts: list[str],
    widgets: list[dict[str, Any]],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
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

    rsi = _calculate_rsi(closes) if len(closes) >= 15 else 52.0
    ma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else price

    recent_30 = closes[-30:] if len(closes) >= 30 else [price * 0.95, price * 1.05]
    key_support = round(min(recent_30) * 0.99, -2) if recent_30 else round(price * 0.95, -2)
    key_resistance = round(max(recent_30) * 1.01, -2) if recent_30 else round(price * 1.05, -2)

    val_score = min(95, max(40, int(100 - (pe / 25.0) * 50)))
    z_score = float(forensics.get("z_score", 3.2))
    zone = forensics.get("z_zone", "safe")
    flags = forensics.get("red_flags", [])
    fin_score = 85 if z_score >= 2.9 else 60
    growth_score = min(90, max(50, int(roe * 3.5)))
    tech_score = 75 if price >= ma20 else 55
    if rsi < 35:
        tech_score += 15
    elif rsi > 70:
        tech_score -= 10
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
        f"- Thị giá: {price:,.0f} đ ({change_p:+.2f}%) | Sàn {exchange} | Ngành {sector}"
    )
    text_parts.append(f"- Định giá: P/E hiện tại {pe:.1f}x | P/B {pb:.1f}x | ROE {roe:.1f}%")
    text_parts.append(
        f"- Kỹ thuật: RSI (14) đang ở mức {rsi:.1f} | Giá {'nằm trên' if price >= ma20 else 'áp sát'} MA20 ({ma20:,.0f} đ)"
    )
    text_parts.append(
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

    if is_forensics or flags or zone != "safe":
        flag_items = []
        for f in flags[:4]:
            sev = getattr(f, "severity", "") if not isinstance(f, dict) else f.get("severity", "")
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


def _build_market_overview_section(
    user_message: str,
    market_service: Any,
    text_parts: list[str],
    widgets: list[dict[str, Any]],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    try:
        snapshot = build_daily_market_snapshot(market_service)
        vnindex = snapshot["vnindex"]
        vn30 = snapshot["vn30"]
        breadth = snapshot["breadth"]
        top_movers = snapshot["top_movers"]
        top_gainers = snapshot["top_gainers"]
        top_losers = snapshot["top_losers"]
        top_liquidity = snapshot["top_liquidity"]
        top_foreign_buy = snapshot["top_foreign_buy"]
        top_foreign_sell = snapshot["top_foreign_sell"]
        vn30_active = snapshot["vn30_active"]
        vn30_movers = snapshot["vn30_movers"]
        vn30_gainers = snapshot["vn30_gainers"]
        vn30_losers = snapshot["vn30_losers"]
        top_sectors = snapshot["top_sectors"]

        vn_val = float(vnindex.get("value", 1250)) if vnindex else 1250.0
        vn_change = float(vnindex.get("change_percent", 0.0)) if vnindex else 0.0
        vn30_val = float(vn30.get("value", 1300)) if vn30 else 1300.0
        vn30_change = float(vn30.get("change_percent", 0.0)) if vn30 else 0.0
        advances = int(breadth.get("advances", 212) or 212)
        declines = int(breadth.get("declines", 150) or 150)
        unchanged = int(breadth.get("unchanged", 60) or 60)
        matched_val = float(breadth.get("matched_value", 15000000000000) or 15000000000000) / 1e12

        q_folded = fold_text(normalize_user_input(user_message))
        ask_vn30 = "vn30" in q_folded or "vn 30" in q_folded
        ask_movers = any(
            k in q_folded for k in ["bien dong", "manh nhat", "nhieu nhat", "lon nhat"]
        ) and not any(
            k in q_folded
            for k in [
                "tang manh",
                "giam manh",
                "thanh khoan",
                "giao dich nhieu",
                "soi noi",
                "soi dong",
            ]
        )
        ask_gainers = any(
            k in q_folded
            for k in [
                "tang manh",
                "tang nhieu",
                "tang tran",
                "tim tran",
                "co phieu nao tang",
                "ma nao tang",
            ]
        )
        ask_losers = any(
            k in q_folded
            for k in [
                "giam manh",
                "giam nhieu",
                "giam sau",
                "nam san",
                "giam san",
                "co phieu nao giam",
                "ma nao giam",
            ]
        )
        ask_liquidity = any(
            k in q_folded
            for k in [
                "thanh khoan",
                "giao dich nhieu",
                "soi dong",
                "soi noi",
                "hoat dong",
                "nhon nhip",
            ]
        )
        ask_foreign = any(
            k in q_folded for k in ["khoi ngoai", "mua rong", "ban rong", "nuoc ngoai"]
        )
        ask_sector = any(k in q_folded for k in ["nganh nao", "nhom nganh"])

        lead_sym = top_movers[0]["symbol"] if top_movers else "HPG"

        if ask_vn30 and vn30_active:
            if ask_losers and vn30_losers:
                text_parts.append("Top cổ phiếu rổ VN30 giảm điểm hôm nay:")
                text_parts.append(
                    f"Chỉ số VN30 hiện ở mức {vn30_val:,.2f} điểm ({vn30_change:+.2f}%). Các mã trụ trong rổ VN30 chịu áp lực điều chỉnh gồm:"
                )
                for item in vn30_losers[:5]:
                    gtgd_ty = item["matched_value"] / 1e9
                    text_parts.append(
                        f"- **{item['symbol']}** ({item['name']}): Thị giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}%) | GTGD: {gtgd_ty:,.1f} tỷ đ"
                    )
                lead_sym = vn30_losers[0]["symbol"]
            elif ask_gainers and vn30_gainers:
                text_parts.append("Top cổ phiếu rổ VN30 tăng giá mạnh nhất hôm nay:")
                text_parts.append(
                    f"Chỉ số VN30 đạt {vn30_val:,.2f} điểm ({vn30_change:+.2f}%). Các cổ phiếu vốn hóa lớn dẫn dắt đà tăng của rổ VN30 hôm nay gồm:"
                )
                for item in vn30_gainers[:5]:
                    gtgd_ty = item["matched_value"] / 1e9
                    text_parts.append(
                        f"- **{item['symbol']}** ({item['name']}): Thị giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}%) | GTGD: {gtgd_ty:,.1f} tỷ đ"
                    )
                lead_sym = vn30_gainers[0]["symbol"]
            else:
                target_list = vn30_movers[:5] if "bien dong" in q_folded else vn30_active[:5]
                text_parts.append("Các cổ phiếu rổ VN30 hoạt động sôi nổi nhất hôm nay:")
                text_parts.append(
                    f"Chỉ số VN30 hôm nay đạt {vn30_val:,.2f} điểm ({vn30_change:+.2f}%). Dưới đây là các cổ phiếu trụ cột trong rổ VN30 có giao dịch sôi nổi, thanh khoản cao và biến động đáng chú ý nhất phiên:"
                )
                for item in target_list:
                    gtgd_ty = item["matched_value"] / 1e9
                    vol_m = item["volume"] / 1e6
                    text_parts.append(
                        f"- **{item['symbol']}** ({item['name']}): Thị giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}%) | GTGD: {gtgd_ty:,.1f} tỷ đ ({vol_m:,.2f} triệu cp)"
                    )
                if vn30_gainers:
                    top_g = vn30_gainers[0]
                    top_l = vn30_active[0]
                    text_parts.append(
                        f"- **Tâm điểm rổ VN30**: Dẫn đầu thanh khoản là **{top_l['symbol']}** ({top_l['matched_value'] / 1e9:,.1f} tỷ đ), trong khi mã tăng tốt nhất rổ là **{top_g['symbol']}** ({top_g['change_percent']:+.2f}%)."
                    )
                lead_sym = target_list[0]["symbol"]
        elif ask_gainers and top_gainers:
            text_parts.append("Top cổ phiếu tăng giá mạnh nhất hôm nay:")
            text_parts.append(
                f"Trên nền VN-Index đạt {vn_val:,.2f} điểm ({vn_change:+.2f}%) với {advances} mã xanh, dưới đây là các cổ phiếu bứt phá mạnh nhất phiên hôm nay:"
            )
            for item in top_gainers[:5]:
                gtgd_ty = item["matched_value"] / 1e9
                text_parts.append(
                    f"- **{item['symbol']}** ({item['name']} - Sàn {item['exchange']}): Giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}%) | GTGD: {gtgd_ty:,.1f} tỷ đ"
                )
            lead_sym = top_gainers[0]["symbol"]
        elif ask_losers and top_losers:
            text_parts.append("Top cổ phiếu giảm điểm mạnh nhất hôm nay:")
            text_parts.append(
                f"Trong bối cảnh thị trường ghi nhận {declines} mã điều chỉnh, các cổ phiếu chịu áp lực giảm điểm mạnh nhất phiên hôm nay gồm:"
            )
            for item in top_losers[:5]:
                gtgd_ty = item["matched_value"] / 1e9
                text_parts.append(
                    f"- **{item['symbol']}** ({item['name']} - Sàn {item['exchange']}): Giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}%) | GTGD: {gtgd_ty:,.1f} tỷ đ"
                )
            lead_sym = top_losers[0]["symbol"]
        elif ask_liquidity and top_liquidity:
            text_parts.append("Top cổ phiếu giao dịch sôi nổi & thanh khoản cao nhất hôm nay:")
            text_parts.append(
                f"Tổng giá trị khớp lệnh toàn thị trường đạt khoảng {matched_val:,.1f} nghìn tỷ đồng. Tâm điểm thu hút dòng tiền lớn nhất thuộc về:"
            )
            for item in top_liquidity[:5]:
                gtgd_ty = item["matched_value"] / 1e9
                vol_m = item["volume"] / 1e6
                text_parts.append(
                    f"- **{item['symbol']}** ({item['name']}): GTGD đạt {gtgd_ty:,.1f} tỷ đ ({vol_m:,.2f} triệu cp) | Thị giá: {item['price']:,.0f} đ ({item['change_percent']:+.2f}%)"
                )
            lead_sym = top_liquidity[0]["symbol"]
        elif ask_foreign and (top_foreign_buy or top_foreign_sell):
            text_parts.append("Thống kê giao dịch khối ngoại hôm nay:")
            if top_foreign_buy:
                buy_str = ", ".join(
                    f"**{x['symbol']}** (+{x['foreign_net_value'] / 1e9:,.1f} tỷ đ, {x['change_percent']:+.2f}%)"
                    for x in top_foreign_buy[:4]
                )
                text_parts.append(f"- Top mua ròng mạnh nhất: {buy_str}.")
                lead_sym = top_foreign_buy[0]["symbol"]
            if top_foreign_sell:
                sell_str = ", ".join(
                    f"**{x['symbol']}** ({x['foreign_net_value'] / 1e9:,.1f} tỷ đ, {x['change_percent']:+.2f}%)"
                    for x in top_foreign_sell[:4]
                )
                text_parts.append(f"- Top bán ròng mạnh nhất: {sell_str}.")
        elif ask_sector and top_sectors:
            text_parts.append("Diễn biến các nhóm ngành dẫn dắt hôm nay:")
            for sec in top_sectors[:5]:
                sec_chg = float(sec.get("change_percent", 0) or 0)
                sec_val = float(sec.get("matched_value", 0) or 0) / 1e9
                text_parts.append(
                    f"- **Ngành {sec.get('name')}**: Biến động {sec_chg:+.2f}% ({sec.get('advances', 0)} mã tăng / {sec.get('declines', 0)} mã giảm) | Thanh khoản: {sec_val:,.1f} tỷ đ"
                )
        elif (
            ask_movers
            or "co phieu nao" in q_folded
            or "ma nao" in q_folded
            or "top co phieu" in q_folded
            or "vai co phieu" in q_folded
            or "dang chu y" in q_folded
        ) and top_movers:
            text_parts.append("Top cổ phiếu biến động mạnh nhất hôm nay:")
            text_parts.append(
                f"Dữ liệu thị trường phiên hôm nay ghi nhận VN-Index đạt {vn_val:,.2f} điểm ({vn_change:+.2f}%), với {advances} mã tăng và {declines} mã giảm. Các cổ phiếu có biên độ biến động lớn nhất trong ngày gồm:"
            )
            for item in top_movers[:5]:
                gtgd_ty = item["matched_value"] / 1e9
                direction_label = "Tăng mạnh" if item["change_percent"] >= 0 else "Giảm điểm"
                text_parts.append(
                    f"- **{item['symbol']}** ({item['name']} - Sàn {item['exchange']}): Giá {item['price']:,.0f} đ ({item['change_percent']:+.2f}% — {direction_label}) | GTGD: {gtgd_ty:,.1f} tỷ đ"
                )
            if top_gainers and top_losers:
                g_top = top_gainers[0]
                l_top = top_losers[0]
                text_parts.append(
                    f"- **Tâm điểm hai đầu biên độ**: Dẫn đầu chiều tăng là **{g_top['symbol']}** ({g_top['change_percent']:+.2f}%), trong khi chiều điều chỉnh mạnh nhất là **{l_top['symbol']}** ({l_top['change_percent']:+.2f}%)."
                )
        else:
            text_parts.append("Nhịp đập thị trường chứng khoán hôm nay:")
            text_parts.append(
                f"- Chỉ số chính: VN-Index đạt {vn_val:,.2f} điểm ({vn_change:+.2f}%) | VN30 đạt {vn30_val:,.2f} điểm ({vn30_change:+.2f}%)."
            )
            text_parts.append(
                f"- Độ rộng thị trường: {advances} mã tăng / {declines} mã giảm / {unchanged} mã tham chiếu."
            )
            text_parts.append(f"- Thanh khoản toàn sàn: Xấp xỉ {matched_val:,.1f} nghìn tỷ đồng.")
            if top_gainers:
                gainers_inline = ", ".join(
                    f"**{g['symbol']}** ({g['change_percent']:+.2f}%)" for g in top_gainers[:3]
                )
                text_parts.append(f"- Cổ phiếu bứt phá nổi bật: {gainers_inline}.")
            if top_liquidity:
                liq_inline = ", ".join(
                    f"**{liq['symbol']}** ({liq['matched_value'] / 1e9:,.0f} tỷ đ)"
                    for liq in top_liquidity[:3]
                )
                text_parts.append(f"- Tâm điểm thanh khoản: {liq_inline}.")

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
                    "label": f"Phân tích {lead_sym}",
                    "action_type": "SEND_PROMPT",
                    "prompt": f"Phân tích {lead_sym}",
                },
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
            ]
        )
    except Exception as exc:
        logger.error("Market overview fetch failed: %s", exc)
        text_parts.append(
            "Hệ thống đang đồng bộ dữ liệu thị trường mới nhất. Vui lòng thử lại sau giây lát."
        )


def _build_trade_order_section(
    *,
    symbol: str,
    side: str,
    quantity: int,
    stock_data: dict[str, Any],
    market_service: Any,
    text_parts: list[str],
    widgets: list[dict[str, Any]],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    del widgets  # Reserved for order ticket widget
    inst = stock_data.get(symbol, {}).get("instrument")
    if not inst and hasattr(market_service, "instrument"):
        try:
            inst = market_service.instrument(symbol, include_fundamentals=True)
        except Exception:
            inst = None

    name = _get_val(inst, "name", symbol)
    price_val = _get_val(inst, "price", 20000)
    price = float(price_val or 20000)
    change_pct = float(_get_val(inst, "change_percent", 0.0) or 0.0)
    exchange = _get_val(inst, "exchange", "HOSE")
    pe_raw = _get_val(inst, "pe")
    pb_raw = _get_val(inst, "pb")
    roe_raw = _get_val(inst, "roe_percent")
    pe = f"{float(pe_raw):.1f}" if pe_raw not in (None, "", "—") else "—"
    pb = f"{float(pb_raw):.1f}" if pb_raw not in (None, "", "—") else "—"
    roe = f"{float(roe_raw):.1f}" if roe_raw not in (None, "", "—") else "—"

    side_clean = "buy" if side.lower() == "buy" else "sell"
    side_vi = "Mua" if side_clean == "buy" else "Bán"
    order_val = price * quantity
    fee_sim = round(order_val * 0.0015)
    total_val = (order_val + fee_sim) if side_clean == "buy" else (order_val - fee_sim)

    text_parts.append(f"Hỗ trợ đặt lệnh mô phỏng: {side_vi.upper()} {quantity:,} {symbol} ({name})")
    text_parts.append(
        f"Tôi đã tiếp nhận yêu cầu đặt lệnh giao dịch mô phỏng của bạn cho mã **{symbol}**:\n\n"
        f"• **Mã cổ phiếu**: {symbol} (Sàn {exchange})\n"
        f"• **Chiều lệnh**: **{side_vi.upper()}** (Lệnh giới hạn LO / Khớp theo thị giá)\n"
        f"• **Khối lượng**: **{quantity:,} cổ phiếu** (Khối lượng chuẩn lô chẵn)\n"
        f"• **Thị giá hiện tại**: **{price:,.0f} ₫** ({change_pct:+.2f}%)\n"
        f"• **Giá trị lệnh tạm tính**: **{order_val:,.0f} ₫**\n"
        f"• **Phí giao dịch mô phỏng (0,15%)**: ~{fee_sim:,.0f} ₫\n"
        f"• **Tổng số tiền {'cần thanh toán' if side_clean == 'buy' else 'dự kiến nhận về'}**: **~{total_val:,.0f} ₫**\n\n"
        f"**Định giá & Tình trạng khớp lệnh**:\n"
        f"- Chỉ số định giá: P/E **{pe}x** | P/B **{pb}x** | ROE **{roe}%**\n"
        f"- Quy chế khớp lệnh: Hệ thống tự động ghi nhận khớp lệnh theo giá khớp thực tế trên sàn (09:00 - 11:30 & 13:00 - 14:45). Ngoài khung giờ giao dịch, lệnh được lưu vào sổ lệnh ở trạng thái chờ khớp cho phiên tiếp theo.\n\n"
        f"Bạn có thể bấm nút **'Đặt lệnh {side_vi} {quantity:,} {symbol} ngay'** bên dưới để mở phiếu lệnh đã điền sẵn và xác nhận giao dịch tức thì:"
    )

    sources.append(
        {
            "kind": "internal",
            "title": f"Sổ lệnh & Phòng thực hành đầu tư ({symbol})",
            "url": f"/portfolio?action=trade&symbol={symbol}&side={side_clean}&qty={quantity}",
        }
    )

    suggested_actions.extend(
        [
            {
                "label": f"Đặt lệnh {side_vi} {quantity:,} {symbol} ngay",
                "action_type": "TRADE_ORDER",
                "symbol": symbol,
                "side": side_clean,
                "quantity": quantity,
                "price": str(int(price)),
            },
            {
                "label": f"Mở phiếu lệnh {symbol}",
                "action_type": "NAVIGATE",
                "url": f"/portfolio?action=trade&symbol={symbol}&side={side_clean}&qty={quantity}",
            },
            {
                "label": "Vào Sổ lệnh & Danh mục",
                "action_type": "NAVIGATE",
                "url": "/portfolio",
            },
            {
                "label": f"Phân tích chuyên sâu {symbol}",
                "action_type": "SEND_PROMPT",
                "prompt": f"Phân tích {symbol}",
            },
        ]
    )


def _build_community_post_draft_section(
    *,
    symbol: str,
    user_message: str,
    stock_data: dict[str, Any],
    market_service: Any,
    text_parts: list[str],
    widgets: list[dict[str, Any]],
    sources: list[dict[str, str]],
    suggested_actions: list[dict[str, Any]],
) -> None:
    del user_message, widgets
    inst = stock_data.get(symbol, {}).get("instrument")
    if not inst and hasattr(market_service, "instrument"):
        try:
            inst = market_service.instrument(symbol, include_fundamentals=True)
        except Exception:
            inst = None

    name = _get_val(inst, "name", symbol)
    price_val = _get_val(inst, "price", 20000)
    price = float(price_val or 20000)
    target_price = int(round(price * 1.15 / 50) * 50)
    stop_loss_price = int(round(price * 0.93 / 50) * 50)
    pe_raw = _get_val(inst, "pe")
    pb_raw = _get_val(inst, "pb")
    roe_raw = _get_val(inst, "roe_percent")
    pe = f"{float(pe_raw):.1f}" if pe_raw not in (None, "", "—") else "6.5"
    pb = f"{float(pb_raw):.1f}" if pb_raw not in (None, "", "—") else "1.2"
    roe = f"{float(roe_raw):.1f}" if roe_raw not in (None, "", "—") else "20.5"

    draft_title = f"Luận điểm đầu tư {symbol}: Động lực tăng trưởng và vùng định giá hấp dẫn"
    draft_body = (
        f"1. Tổng quan cơ hội: Cổ phiếu {symbol} ({name}) đang tích lũy ở vùng giá {price:,.0f} ₫ với định giá P/E ~{pe}x, P/B ~{pb}x và ROE đạt ~{roe}%, tạo biên an toàn hấp dẫn cho vị thế nắm giữ trung hạn.\n\n"
        f"2. Lợi thế cốt lõi & Động lực kinh doanh: Doanh nghiệp sở hữu vị thế hàng đầu ngành, năng lực quản trị rủi ro tốt và hưởng lợi lớn từ chu kỳ phục hồi kinh tế vĩ mô cùng tăng trưởng tín dụng.\n\n"
        f"3. Quản trị rủi ro & Sức khỏe tài chính: Cơ cấu nguồn vốn an toàn, đòn bẩy tài chính duy trì trong ngưỡng kiểm soát, chất lượng tài sản lành mạnh.\n\n"
        f"4. Khuyến nghị hành động: Mua tích lũy tại vùng giá quanh {price:,.0f} ₫, mục tiêu kỳ vọng {target_price:,.0f} ₫ (+15%), quản trị rủi ro cắt lỗ nếu giá thủng {stop_loss_price:,.0f} ₫ (-7%)."
    )
    draft_catalysts = "Kết quả kinh doanh quý tới tăng trưởng tích cực, mở rộng quy mô hoạt động và dòng tiền tổ chức duy trì mua ròng."

    text_parts.append(f"Bản thảo Luận điểm Đầu tư: {symbol} - {name}")
    text_parts.append(
        f"Tôi đã soạn sẵn bản thảo luận điểm phân tích chuyên sâu cho **{symbol}** để bạn xuất bản lên Cộng đồng InvestIQ:\n\n"
        f"• **Tiêu đề**: {draft_title}\n"
        f"• **Quan điểm**: MUA / Khả quan (Bullish)\n"
        f"• **Khung thời gian**: 3 - 6 tháng\n"
        f"• **Giá tham chiếu hiện tại**: {price:,.0f} ₫\n"
        f"• **Giá mục tiêu (Target)**: **{target_price:,.0f} ₫** (+15.0%)\n"
        f"• **Giá cắt lỗ (Stop-loss)**: **{stop_loss_price:,.0f} ₫** (-7.0%)\n\n"
        f"**Tóm tắt nội dung luận điểm**:\n"
        f"{draft_body}\n\n"
        f"**Chất xúc tác tăng giá (Catalysts)**: {draft_catalysts}\n\n"
        f"Bấm nút **'Đăng bài lên Cộng đồng ngay'** bên dưới để chuyển sang Đấu trường Luận điểm với 100% dữ liệu đã điền sẵn:"
    )

    sources.append(
        {
            "kind": "internal",
            "title": f"Đấu trường Luận điểm Đầu tư InvestIQ ({symbol})",
            "url": f"/community?action=new-thesis&symbol={symbol}",
        }
    )

    suggested_actions.extend(
        [
            {
                "label": "Đăng bài lên Cộng đồng ngay",
                "action_type": "POST_COMMUNITY_THESIS",
                "symbol": symbol,
                "title": draft_title,
                "stance": "bullish",
                "target_price": target_price,
                "stop_loss_price": stop_loss_price,
                "horizon": 3,
                "content": draft_body,
                "catalysts": draft_catalysts,
                "url": f"/community?action=new-thesis&symbol={symbol}",
            },
            {
                "label": "Xem Đấu trường Luận điểm",
                "action_type": "NAVIGATE",
                "url": "/community",
            },
            {
                "label": f"Phân tích chuyên sâu {symbol}",
                "action_type": "SEND_PROMPT",
                "prompt": f"Phân tích {symbol}",
            },
        ]
    )


def generate_structured_response(
    *,
    market_service: Any,
    user_message: str,
    tickers: list[str],
    stock_data: dict[str, Any],
    knowledge_hits: list[KnowledgeHit],
    external_snippets: list[dict[str, str]],
    is_comparison: bool,
    is_gold_bank: bool,
    is_forensics: bool,
    is_market_general: bool,
    is_news: bool = False,
    news_articles: list[dict[str, Any]] | None = None,
    is_dividend: bool = False,
    dividend_events: list[dict[str, Any]] | None = None,
    market_events: list[dict[str, Any]] | None = None,
    is_leader: bool = False,
    leader_profile: Any = None,
    leader_id: str | None = None,
    leader_name: str | None = None,
    is_leader_rankings: bool = False,
    is_ecosystem: bool = False,
    ecosystem_id: str | None = None,
    is_trade_order: bool = False,
    trade_side: str | None = None,
    trade_quantity: int | None = None,
    trade_symbol: str | None = None,
    is_community_post: bool = False,
    community_symbol: str | None = None,
    comparison_mode: str = "ask",
    exceeded_limit: bool = False,
    invalid_tickers: list[str] | None = None,
) -> dict[str, Any]:
    """Synthesize in-depth analysis and format rich interactive widgets."""
    del is_gold_bank  # Kept in signature for compatibility
    widgets: list[dict[str, Any]] = []
    suggested_actions: list[dict[str, Any]] = []
    text_parts: list[str] = []
    sources: list[dict[str, str]] = []
    bad_tickers = list(invalid_tickers or [])

    if is_trade_order:
        target_sym = trade_symbol or (tickers[0] if tickers else None)
        is_bad_trade_sym = (
            target_sym is not None
            and (target_sym in bad_tickers or not is_valid_ticker(target_sym))
        ) or (target_sym is None and bool(bad_tickers))
        if is_bad_trade_sym:
            order_bad_tickers = list(bad_tickers)
            if target_sym and target_sym not in order_bad_tickers:
                order_bad_tickers.insert(0, target_sym)
            _build_typo_suggestion_section(
                invalid_tickers=order_bad_tickers,
                is_dividend=False,
                is_forensics=False,
                is_trade_order=True,
                trade_side=trade_side or "buy",
                trade_quantity=trade_quantity or 100,
                market_service=market_service,
                text_parts=text_parts,
                sources=sources,
                suggested_actions=suggested_actions,
            )
        else:
            _build_trade_order_section(
                symbol=target_sym or "MBB",
                side=trade_side or "buy",
                quantity=trade_quantity or 100,
                stock_data=stock_data,
                market_service=market_service,
                text_parts=text_parts,
                widgets=widgets,
                sources=sources,
                suggested_actions=suggested_actions,
            )
    elif is_community_post:
        target_sym = community_symbol or (tickers[0] if tickers else None)
        is_bad_comm_sym = (
            target_sym is not None
            and (target_sym in bad_tickers or not is_valid_ticker(target_sym))
        ) or (target_sym is None and bool(bad_tickers))
        if is_bad_comm_sym:
            comm_bad_tickers = list(bad_tickers)
            if target_sym and target_sym not in comm_bad_tickers:
                comm_bad_tickers.insert(0, target_sym)
            _build_typo_suggestion_section(
                invalid_tickers=comm_bad_tickers,
                is_dividend=False,
                is_forensics=False,
                is_community_post=True,
                market_service=market_service,
                text_parts=text_parts,
                sources=sources,
                suggested_actions=suggested_actions,
            )
        else:
            _build_community_post_draft_section(
                symbol=target_sym or "MBB",
                user_message=user_message,
                stock_data=stock_data,
                market_service=market_service,
                text_parts=text_parts,
                widgets=widgets,
                sources=sources,
                suggested_actions=suggested_actions,
            )
    elif is_leader:
        _build_leader_section(
            user_message=user_message,
            tickers=tickers,
            stock_data=stock_data,
            leader_profile=leader_profile,
            leader_id=leader_id,
            leader_name=leader_name,
            is_leader_rankings=is_leader_rankings,
            is_ecosystem=is_ecosystem,
            ecosystem_id=ecosystem_id,
            market_service=market_service,
            external_snippets=external_snippets,
            text_parts=text_parts,
            sources=sources,
            suggested_actions=suggested_actions,
        )
    elif is_dividend:
        if bad_tickers and not stock_data and not dividend_events:
            _build_typo_suggestion_section(
                invalid_tickers=bad_tickers,
                is_dividend=True,
                is_forensics=False,
                text_parts=text_parts,
                sources=sources,
                suggested_actions=suggested_actions,
            )
        else:
            _build_dividend_and_events_section(
                user_message=user_message,
                tickers=tickers,
                stock_data=stock_data,
                dividend_events=dividend_events,
                market_events=market_events,
                text_parts=text_parts,
                sources=sources,
                suggested_actions=suggested_actions,
            )
    elif is_news:
        _build_news_section(
            tickers=tickers,
            news_articles=news_articles,
            external_snippets=external_snippets,
            text_parts=text_parts,
            sources=sources,
            suggested_actions=suggested_actions,
        )
    elif is_comparison or (len(tickers) >= 2 and not is_forensics and not is_leader):
        _build_comparison_section(
            user_message=user_message,
            tickers=tickers,
            stock_data=stock_data,
            text_parts=text_parts,
            widgets=widgets,
            sources=sources,
            suggested_actions=suggested_actions,
            comparison_mode=comparison_mode,
            exceeded_limit=exceeded_limit,
            invalid_tickers=bad_tickers,
        )
    elif len(stock_data) == 1:
        _build_single_stock_section(
            stock_data=stock_data,
            is_forensics=is_forensics,
            text_parts=text_parts,
            widgets=widgets,
            sources=sources,
            suggested_actions=suggested_actions,
        )
    elif bad_tickers:
        _build_typo_suggestion_section(
            invalid_tickers=bad_tickers,
            is_dividend=False,
            is_forensics=is_forensics,
            text_parts=text_parts,
            sources=sources,
            suggested_actions=suggested_actions,
        )
    elif is_market_general:
        _build_market_overview_section(
            user_message=user_message,
            market_service=market_service,
            text_parts=text_parts,
            widgets=widgets,
            sources=sources,
            suggested_actions=suggested_actions,
        )
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

    # Deduplicate sources by URL while preserving order
    if sources:
        unique_sources: list[dict[str, str]] = []
        seen_urls: set[str] = set()
        for s in sources:
            u = s.get("url", "")
            if u and u not in seen_urls:
                seen_urls.add(u)
                unique_sources.append(s)
        sources = unique_sources

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
