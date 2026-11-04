"""Daily market data snapshot aggregation for AI Financial Assistant."""

from __future__ import annotations

from typing import Any

from app.application.use_cases.ai_chat.intent_parser import _get_val


def build_daily_market_snapshot(market_service: Any) -> dict[str, Any]:
    """Aggregate daily market data (indices, breadth, VN30 basket, top movers, gainers, losers, liquidity, foreign flow, sectors, upcoming events)."""
    overview_raw = market_service.overview() if hasattr(market_service, "overview") else {}
    overview_data = (
        overview_raw.get("data", overview_raw)
        if isinstance(overview_raw, dict)
        else {}
    )
    indices = overview_data.get("indices", []) if isinstance(overview_data, dict) else []
    breadth = overview_data.get("breadth", {}) if isinstance(overview_data, dict) else {}
    upcoming_events = (
        overview_data.get("upcoming_events", []) if isinstance(overview_data, dict) else []
    )

    vnindex = next(
        (i for i in indices if isinstance(i, dict) and i.get("symbol") == "VNINDEX"),
        None,
    )
    vn30 = next(
        (i for i in indices if isinstance(i, dict) and i.get("symbol") == "VN30"),
        None,
    )
    hnx = next(
        (i for i in indices if isinstance(i, dict) and i.get("symbol") == "HNXINDEX"),
        None,
    )

    raw_instruments: list[Any] = []
    provider = getattr(market_service, "_provider", None)
    if provider is not None and hasattr(provider, "instruments"):
        try:
            raw_instruments = list(provider.instruments())
        except Exception:
            raw_instruments = []
    if not raw_instruments and isinstance(overview_data, dict):
        raw_instruments = list(overview_data.get("trending", []))

    items: list[dict[str, Any]] = []
    for inst in raw_instruments:
        sym = str(_get_val(inst, "symbol", ""))
        if not sym:
            continue
        price = float(_get_val(inst, "price", 0) or 0)
        change_pct = float(_get_val(inst, "change_percent", 0) or 0)
        volume = float(_get_val(inst, "volume", 0) or 0)
        matched_val = float(_get_val(inst, "matched_value", 0) or 0)
        foreign_net = float(_get_val(inst, "foreign_net_value", 0) or 0)
        market_cap = float(_get_val(inst, "market_cap", 0) or 0)
        is_vn30 = bool(_get_val(inst, "is_vn30", False))
        items.append(
            {
                "symbol": sym,
                "name": str(_get_val(inst, "name", sym)),
                "exchange": str(_get_val(inst, "exchange", "HOSE")),
                "sector": str(_get_val(inst, "sector", "")),
                "price": price,
                "change_percent": change_pct,
                "abs_change_percent": abs(change_pct),
                "volume": volume,
                "matched_value": matched_val,
                "foreign_net_value": foreign_net,
                "market_cap": market_cap,
                "is_vn30": is_vn30,
            }
        )

    liquid_pool = [x for x in items if x["matched_value"] >= 1_000_000_000] or items
    vn30_pool = [x for x in items if x["is_vn30"]] or sorted(
        items, key=lambda x: x["market_cap"], reverse=True
    )[:30]

    top_movers = sorted(
        liquid_pool,
        key=lambda x: (x["abs_change_percent"], x["matched_value"]),
        reverse=True,
    )[:6]
    top_gainers = sorted(
        [x for x in liquid_pool if x["change_percent"] > 0],
        key=lambda x: (x["change_percent"], x["matched_value"]),
        reverse=True,
    )[:5]
    top_losers = sorted(
        [x for x in liquid_pool if x["change_percent"] < 0],
        key=lambda x: (x["change_percent"], -x["matched_value"]),
    )[:5]
    top_liquidity = sorted(
        items,
        key=lambda x: x["matched_value"],
        reverse=True,
    )[:5]
    top_foreign_buy = sorted(
        [x for x in items if x["foreign_net_value"] > 0],
        key=lambda x: x["foreign_net_value"],
        reverse=True,
    )[:5]
    top_foreign_sell = sorted(
        [x for x in items if x["foreign_net_value"] < 0],
        key=lambda x: x["foreign_net_value"],
    )[:5]

    vn30_active = sorted(
        vn30_pool,
        key=lambda x: (x["matched_value"], x["abs_change_percent"]),
        reverse=True,
    )[:6]
    vn30_movers = sorted(
        vn30_pool,
        key=lambda x: (x["abs_change_percent"], x["matched_value"]),
        reverse=True,
    )[:6]
    vn30_gainers = sorted(
        [x for x in vn30_pool if x["change_percent"] > 0],
        key=lambda x: (x["change_percent"], x["matched_value"]),
        reverse=True,
    )[:5]
    vn30_losers = sorted(
        [x for x in vn30_pool if x["change_percent"] < 0],
        key=lambda x: (x["change_percent"], -x["matched_value"]),
    )[:5]

    sectors_list: list[dict[str, Any]] = []
    if hasattr(market_service, "sectors"):
        try:
            sec_res = market_service.sectors()
            sec_data = sec_res.get("data", []) if isinstance(sec_res, dict) else []
            sectors_list = list(sec_data)[:5]
        except Exception:
            sectors_list = []

    return {
        "vnindex": vnindex,
        "vn30": vn30,
        "hnx": hnx,
        "breadth": breadth,
        "upcoming_events": list(upcoming_events),
        "top_movers": top_movers,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "top_liquidity": top_liquidity,
        "top_foreign_buy": top_foreign_buy,
        "top_foreign_sell": top_foreign_sell,
        "vn30_active": vn30_active,
        "vn30_movers": vn30_movers,
        "vn30_gainers": vn30_gainers,
        "vn30_losers": vn30_losers,
        "top_sectors": sectors_list,
        "total_stocks": len(items),
    }
