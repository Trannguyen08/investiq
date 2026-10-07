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
    assert second["pagination"]["page"] == 2
    assert decode_cursor(second["pagination"]["previous_cursor"]) == 0
