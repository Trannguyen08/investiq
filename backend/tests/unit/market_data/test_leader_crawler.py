from decimal import Decimal

from app.domain.entities.market import MarketInstrument
from app.infrastructure.external.crawlers.leader_crawler import LeaderCrawler, get_leader_crawler


def test_leader_crawler_returns_prominent_leaders() -> None:
    crawler = LeaderCrawler()
    leaders = crawler.get_prominent_leaders()

    assert len(leaders) >= 20
    # Sorted descending by listed equity value
    for i in range(len(leaders) - 1):
        val_cur = leaders[i].estimated_listed_equity_value
        val_next = leaders[i + 1].estimated_listed_equity_value
        assert val_cur >= val_next

    vuong = next(person for person in leaders if "Phạm Nhật Vượng" in person.full_name)
    assert "VIC" in vuong.symbols
    assert vuong.net_worth_total is not None
    assert "tỷ USD" in vuong.net_worth_total
    assert vuong.net_worth_external is not None


def test_leader_crawler_filters_by_query_and_sector() -> None:
    crawler = LeaderCrawler()

    # Filter by name query
    fpt_leaders = crawler.get_prominent_leaders(query="Trương Gia Bình")
    assert len(fpt_leaders) == 1
    assert "Trương Gia Bình" in fpt_leaders[0].full_name

    # Filter by ticker query
    hpg_leaders = crawler.get_prominent_leaders(query="HPG")
    assert len(hpg_leaders) >= 1
    assert any("Trần Đình Long" in p.full_name for p in hpg_leaders)

    # Filter by sector
    steel_leaders = crawler.get_prominent_leaders(sector="Thép & Công nghiệp")
    assert len(steel_leaders) >= 1
    assert all("Thép" in p.sector for p in steel_leaders)


def test_leader_crawler_dynamically_updates_equity_with_live_instruments() -> None:
    crawler = LeaderCrawler()
    test_instruments = [
        MarketInstrument(
            symbol="VIC",
            name="Tập đoàn VINGROUP",
            exchange="HOSE",
            sector="Bất động sản",
            price=Decimal("250000"),
            reference_price=Decimal("245000"),
            ceiling_price=Decimal("262000"),
            floor_price=Decimal("228000"),
            open_price=Decimal("246000"),
            high_price=Decimal("251000"),
            low_price=Decimal("245000"),
            volume=Decimal("1000000"),
            matched_value=Decimal("250000000000"),
            foreign_net_value=Decimal("50000000000"),
            market_cap=Decimal("1900000000000000"),
            pe=Decimal("70"),
            pb=Decimal("9"),
            eps=Decimal("3000"),
            roe_percent=Decimal("12"),
            volume_vs_20d=Decimal("1.2"),
            interest_score=Decimal("95"),
            interest_reasons=("vn30",),
            is_vn30=True,
            candles=(),
        )
    ]

    leaders = crawler.get_prominent_leaders(test_instruments)
    vuong = next(person for person in leaders if "Phạm Nhật Vượng" in person.full_name)

    # 691,270,000 * 250,000 = 172,817,500,000,000
    expected_value = Decimal("691270000") * Decimal("250000")
    assert vuong.estimated_listed_equity_value == expected_value
    assert round(vuong.daily_change_percent, 2) == Decimal("2.04")


def test_get_leader_crawler_returns_singleton() -> None:
    c1 = get_leader_crawler()
    c2 = get_leader_crawler()
    assert c1 is c2
