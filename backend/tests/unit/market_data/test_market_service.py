from decimal import Decimal

from app.application.use_cases.market_data.market_service import MarketService, decode_cursor
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
    assert decode_cursor(second_pagination["previous_cursor"]) == 0


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
