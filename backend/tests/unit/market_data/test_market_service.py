from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast

from app.application.use_cases.market_data.market_service import MarketService, decode_cursor
from app.domain.entities.market import Candle, MarketIndex, MarketInstrument
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
    financial = next(row for row in rows if row["name"] == "Tài chính")
    assert financial["member_count"] == sum(
        item.sector == "Tài chính" for item in provider.instruments()
    )
    assert financial["member_count"] >= 5
    subsectors = response["subsectors"]
    assert isinstance(subsectors, list)
    banking = next(
        sub
        for sub in subsectors
        if sub["parent_sector"] == "Tài chính" and sub["name"] == "Ngân hàng"
    )
    assert banking["member_count"] == 5


def test_sector_subgroups_aggregate_metrics_and_filter_stocks() -> None:
    class SubsectorFixtureProvider(FixtureMarketProvider):
        def instruments(self) -> tuple[MarketInstrument, ...]:
            financial_labels = {
                "Ng\u00e2n h\u00e0ng",
                "D\u1ecbch v\u1ee5 t\u00e0i ch\u00ednh",
                "B\u1ea3o hi\u1ec3m",
            }
            return tuple(
                replace(item, sector="T\u00e0i ch\u00ednh", subsector=item.sector)
                if item.sector in financial_labels
                else item
                for item in super().instruments()
            )

    provider = SubsectorFixtureProvider()
    service = MarketService(provider)
    response = service.sectors()
    subsectors = response["subsectors"]
    assert isinstance(subsectors, list)

    banks = next(
        item
        for item in subsectors
        if item["parent_sector"] == "Tài chính" and item["name"] == "Ngân hàng"
    )
    assert banks["member_count"] == 5
    assert banks["market_cap"] == str(
        sum(item.market_cap for item in provider.instruments() if item.subsector == "Ngân hàng")
    )

    filtered = service.list_instruments(
        query="",
        exchange=None,
        sector="Ngân hàng",
        sort="symbol",
        direction="asc",
        limit=15,
        offset=0,
    )
    rows = filtered["data"]
    assert isinstance(rows, list)
    assert [item["symbol"] for item in rows] == ["ACB", "MBB", "STB", "TCB", "VCB"]
    assert all(item["subsector"] == "Ngân hàng" for item in rows)


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


def test_index_payload_keeps_the_latest_five_hundred_candles() -> None:
    class LongIndexHistoryProvider(FixtureMarketProvider):
        def indices(self) -> tuple[MarketIndex, ...]:
            current = super().indices()[0]
            start = datetime(2025, 1, 1, tzinfo=UTC)
            candles = tuple(
                Candle(
                    timestamp=start + timedelta(days=index),
                    open=Decimal(1700 + index),
                    high=Decimal(1710 + index),
                    low=Decimal(1690 + index),
                    close=Decimal(1705 + index),
                    volume=Decimal(500_000_000 + index),
                )
                for index in range(550)
            )
            return (replace(current, candles=candles),)

    response = MarketService(LongIndexHistoryProvider()).indices()
    rows = cast(list[dict[str, Any]], response["data"])
    candles = cast(list[dict[str, str]], rows[0]["candles"])

    assert len(candles) == 500
    assert candles[0]["timestamp"] == "2025-02-20T00:00:00Z"
    assert candles[-1]["timestamp"] == "2026-07-04T00:00:00Z"


def test_missing_stock_history_stays_empty_instead_of_generating_fake_candles() -> None:
    class NoHistoryProvider(FixtureMarketProvider):
        def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
            return ()

    response = MarketService(NoHistoryProvider()).candles("FPT", "1d", 120)

    assert response["data"] == []
    assert response["instrument"] == "FPT"


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


def test_stock_growth_keeps_fundamental_metrics_unavailable_without_source_rows() -> None:
    class EmptyFundamentalsProvider(FixtureMarketProvider):
        def fundamental_growth_rows(self, symbol: str) -> list[dict[str, object]]:
            return []

    service = MarketService(EmptyFundamentalsProvider())
    result = service.growth("HPG")

    assert result is not None
    data = cast(dict[str, Any], result["data"])
    assert data["symbol"] == "HPG"
    assert data["quarters"] == []
    assert data["revenue_ttm"] is None
    assert data["profit_ttm"] is None
    assert data["roa_percent"] is None
    assert len(data["insights"]) == 3


def test_stock_growth_uses_reported_v6_ttm_rows_for_yoy_and_financial_metrics() -> None:
    class StatementProvider(FixtureMarketProvider):
        def fundamental_growth_rows(self, symbol: str) -> list[dict[str, object]]:
            assert symbol == "FPT"
            return [
                {
                    "ratio_type": "RATIO_TTM",
                    "year": 2024,
                    "quarter": 4,
                    "revenue_ttm": Decimal("1000000000000"),
                    "profit_ttm": Decimal("100000000000"),
                    "roe": Decimal("0.08"),
                    "roa": Decimal("0.02"),
                    "after_tax_profit_margin": Decimal("0.1"),
                    "gross_margin": Decimal("0.4"),
                    "owners_equity": Decimal("1000000000000"),
                },
                {
                    "ratio_type": "RATIO_TTM",
                    "year": 2025,
                    "quarter": 4,
                    "revenue_ttm": Decimal("1400000000000"),
                    "profit_ttm": Decimal("140000000000"),
                    "roe": Decimal("0.1"),
                    "roa": Decimal("0.025"),
                    "after_tax_profit_margin": Decimal("0.1"),
                    "gross_margin": Decimal("0.5"),
                    "owners_equity": Decimal("1500000000000"),
                    "current_ratio": Decimal("1.4"),
                    "debt_to_equity": Decimal("0.43"),
                },
            ]

    result = MarketService(StatementProvider()).growth("FPT")

    assert result is not None
    data = cast(dict[str, Any], result["data"])
    assert data["revenue_ttm"] == "1,400 tỷ"
    assert data["profit_ttm"] == "140 tỷ"
    assert data["roa_percent"] == "2.5%"
    assert data["current_ratio"] == "1.40 lần"
    assert data["debt_to_equity"] == "0.43 lần"
    assert data["quarters"][-1]["revenue_growth_yoy"] == "+40.0%"
    assert data["quarters"][-1]["profit_growth_yoy"] == "+40.0%"


def test_stock_growth_returns_none_for_unknown_symbol() -> None:
    service = MarketService(FixtureMarketProvider())
    assert service.growth("UNKNOWN_XYZ") is None


def test_stock_growth_computes_profit_yoy_fallback_for_bank_rows() -> None:
    class BankGrowthProvider(FixtureMarketProvider):
        def fundamental_growth_rows(self, symbol: str) -> list[dict[str, object]]:
            return [
                {
                    "ratio_type": "RATIO_TTM",
                    "year": 2025,
                    "quarter": 2,
                    "loans_growth": Decimal("0.10"),
                    "after_tax_profit_margin": Decimal("0.20"),
                },
                {
                    "ratio_type": "RATIO_TTM",
                    "year": 2026,
                    "quarter": 2,
                    "loans_growth": Decimal("0.136"),
                    "after_tax_profit_margin": Decimal("0.25"),
                },
            ]

    result = MarketService(BankGrowthProvider()).growth("VCB")
    assert result is not None
    data = cast(dict[str, Any], result["data"])
    latest_q = data["quarters"][-1]
    assert latest_q["revenue_growth_yoy"] == "+13.6%"
    assert latest_q["profit_growth_yoy"] is not None
    assert latest_q["profit_growth_yoy"] == "+42.0%"
