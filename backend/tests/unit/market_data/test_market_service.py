from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast

from app.application.use_cases.market_data.market_service import MarketService, decode_cursor
from app.domain.entities.market import Candle, MarketIndex
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider


def test_vn30_sort_and_fifteen_row_pagination_are_stable() -> None:
    service = MarketService(FixtureMarketProvider())

    first = service.list_instruments(
        query="",
        exchange=None,
        sector=None,
        sort="vn30",
        direction="desc",
        limit=15,
        offset=0,
    )

    rows = first["data"]
    pagination = first["pagination"]
    assert isinstance(rows, list)
    assert isinstance(pagination, dict)
    assert len(rows) == 15
    assert all(row["is_vn30"] for row in rows[:13])
    assert all(not row["is_vn30"] for row in rows[13:])
    assert pagination["page"] == 1
    assert pagination["total_pages"] == 2
    assert pagination["previous_cursor"] is None
    assert decode_cursor(pagination["next_cursor"]) == 15

    second = service.list_instruments(
        query="",
        exchange=None,
        sector=None,
        sort="vn30",
        direction="desc",
        limit=15,
        offset=15,
    )
    second_pagination = second["pagination"]
    assert isinstance(second_pagination, dict)
    assert second_pagination["page"] == 2
    assert decode_cursor(cast(str | None, second_pagination["previous_cursor"])) == 0


def test_sector_aggregate_uses_every_instrument_not_one_page() -> None:
    provider = FixtureMarketProvider()
    response = MarketService(provider).sectors()
    rows = response["data"]
    assert isinstance(rows, list)

    assert sum(row["member_count"] for row in rows) == len(provider.instruments())
    banking = next(row for row in rows if row["name"] == "Ngân hàng")
    assert banking["member_count"] == sum(
        item.sector == "Ngân hàng" for item in provider.instruments()
    )
    assert banking["member_count"] > 1


def test_intraday_trade_contract_keeps_observed_values_and_provenance() -> None:
    response = MarketService(FixtureMarketProvider()).intraday_trades("FPT", 5)
    trades = response["data"]
    meta = response["meta"]
    assert isinstance(trades, list)
    assert isinstance(meta, dict)

    assert response["instrument"] == "FPT"
    assert len(trades) == 5
    assert trades[-1]["price"]
    assert trades[-1]["match_side"] == "unknown"
    assert trades[-1]["change"] is not None
    assert trades[-1]["change_percent"] is not None
    assert meta["provider"] == "investiq-fixture"


def test_stock_screening_filters_the_complete_universe_before_pagination() -> None:
    provider = FixtureMarketProvider()
    expected = [
        item
        for item in provider.instruments()
        if item.is_vn30
        and Decimal("0") <= item.change_percent <= Decimal("100")
        and item.matched_value >= Decimal("0")
        and item.market_cap >= Decimal("0")
        and item.volume_vs_20d >= Decimal("0.75")
    ]

    response = MarketService(provider).list_instruments(
        query="",
        exchange=None,
        sector=None,
        sort="volume_vs_20d",
        direction="desc",
        limit=5,
        offset=0,
        min_change=Decimal("0"),
        max_change=Decimal("100"),
        min_matched_value=Decimal("0"),
        min_market_cap=Decimal("0"),
        min_volume_ratio=Decimal("0.75"),
        vn30_only=True,
    )
    pagination = response["pagination"]
    rows = response["data"]
    assert isinstance(pagination, dict)
    assert isinstance(rows, list)

    assert pagination["total_items"] == len(expected)
    assert len(rows) <= 5
    assert all(row["is_vn30"] for row in rows)
    ratios = [Decimal(str(row["volume_vs_20d"])) for row in rows]
    assert ratios == sorted(ratios, reverse=True)


def test_index_payload_keeps_the_latest_one_hundred_seventy_candles() -> None:
    class LongIndexHistoryProvider(FixtureMarketProvider):
        def indices(self) -> tuple[MarketIndex, ...]:
            current = super().indices()[0]
            start = datetime(2026, 1, 1, tzinfo=UTC)
            candles = tuple(
                Candle(
                    timestamp=start + timedelta(days=index),
                    open=Decimal(1700 + index),
                    high=Decimal(1710 + index),
                    low=Decimal(1690 + index),
                    close=Decimal(1705 + index),
                    volume=Decimal(500_000_000 + index),
                )
                for index in range(200)
            )
            return (replace(current, candles=candles),)

    response = MarketService(LongIndexHistoryProvider()).indices()
    rows = cast(list[dict[str, Any]], response["data"])
    candles = cast(list[dict[str, str]], rows[0]["candles"])

    assert len(candles) == 170
    assert candles[0]["timestamp"] == "2026-01-31T00:00:00Z"
    assert candles[-1]["timestamp"] == "2026-07-19T00:00:00Z"


def test_stock_growth_returns_complete_profile_with_quarters_and_insights() -> None:
    provider = FixtureMarketProvider()
    service = MarketService(provider)
    result = service.growth("FPT")

    assert result is not None
    data = cast(dict[str, Any], result["data"])
    assert data["symbol"] == "FPT"
    assert data["health_status"] in {"expanding", "stable", "accumulating", "cautious"}
    assert data["health_title"]
    assert data["health_summary"]
    assert "tỷ" in data["market_cap"]
    assert data["volume_growth_20d"]
    assert len(data["quarters"]) >= 4
    assert len(data["insights"]) == 3

    q = data["quarters"][-1]
    assert "period" in q
    assert q["roe"] is not None


def test_stock_growth_tier2_fallback_when_no_fundamental_rows() -> None:
    class EmptyFundamentalsProvider(FixtureMarketProvider):
        def fundamental_growth_rows(self, symbol: str) -> list[dict[str, object]]:
            return []

    service = MarketService(EmptyFundamentalsProvider())
    result = service.growth("HPG")

    assert result is not None
    data = cast(dict[str, Any], result["data"])
    assert data["symbol"] == "HPG"
    assert len(data["quarters"]) == 4
    assert all("Q" in q["period"] for q in data["quarters"])
    assert len(data["insights"]) == 3


def test_stock_growth_returns_none_for_unknown_symbol() -> None:
    service = MarketService(FixtureMarketProvider())
    assert service.growth("UNKNOWN_XYZ") is None
