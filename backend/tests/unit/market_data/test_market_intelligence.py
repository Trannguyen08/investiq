from decimal import Decimal

from app.domain.entities.market import MarketIndex, MarketInstrument
from app.infrastructure.external.digest.daily_digest_service import generate_daily_digest
from app.infrastructure.external.ecosystem.ecosystem_service import (
    get_ecosystem_service,
)
from app.infrastructure.external.forensics.financial_forensics import compute_forensics
from app.infrastructure.external.simulator.dca_simulator import simulate_dca


def _sample_instrument(
    symbol: str = "HPG", pe: Decimal = Decimal("12.5"), pb: Decimal = Decimal("1.6")
) -> MarketInstrument:
    return MarketInstrument(
        symbol=symbol,
        name="Tập đoàn Hòa Phát",
        exchange="HOSE",
        sector="Thép",
        price=Decimal("28000"),
        reference_price=Decimal("27500"),
        ceiling_price=Decimal("29400"),
        floor_price=Decimal("25600"),
        open_price=Decimal("27800"),
        high_price=Decimal("28200"),
        low_price=Decimal("27600"),
        volume=Decimal("15000000"),
        matched_value=Decimal("420000000000"),
        foreign_net_value=Decimal("35000000000"),
        market_cap=Decimal("160000000000000"),
        pe=pe,
        pb=pb,
        eps=Decimal("2200"),
        roe_percent=Decimal("14.5"),
        volume_vs_20d=Decimal("1.85"),
        interest_score=Decimal("92"),
        interest_reasons=("vn30",),
        is_vn30=True,
        candles=(),
    )


def test_ecosystem_service_lists_conglomerates_and_detail() -> None:
    service = get_ecosystem_service()
    inst = _sample_instrument("HPG")
    all_ecos = service.list_ecosystems([inst])

    assert len(all_ecos) >= 5
    ids = [e["id"] for e in all_ecos]
    assert "vingroup" in ids
    assert "hoaphat" in ids
    assert "fpt" in ids
    assert "masan-techcombank" in ids

    # Check detail
    hoaphat = service.get_ecosystem_detail("hoaphat", [inst])
    assert hoaphat is not None
    assert hoaphat["founder_name"] == "Trần Đình Long"
    assert len(hoaphat["nodes"]) >= 3
    assert len(hoaphat["links"]) >= 2

    # Non-existent
    assert service.get_ecosystem_detail("invalid-eco-id") is None


def test_financial_forensics_computes_z_score_and_red_flags() -> None:
    # 1. Healthy manufacturing stock
    inst_healthy = _sample_instrument("HPG", pe=Decimal("12.0"), pb=Decimal("1.5"))
    report = compute_forensics(inst_healthy)

    assert report["symbol"] == "HPG"
    assert float(report["z_score"]) >= 1.5
    assert report["z_zone"] in ("safe", "grey", "distress")
    assert report["health_score"] >= 50
    assert len(report["red_flags"]) >= 4

    # 2. Distressed / Over-stretched stock
    inst_distressed = MarketInstrument(
        symbol="DISTRESS",
        name="Doanh nghiệp nguy cơ",
        exchange="UPCOM",
        sector="Bất động sản",
        price=Decimal("4000"),
        reference_price=Decimal("4200"),
        ceiling_price=Decimal("4800"),
        floor_price=Decimal("3600"),
        open_price=Decimal("4100"),
        high_price=Decimal("4100"),
        low_price=Decimal("3900"),
        volume=Decimal("10000"),
        matched_value=Decimal("40000000"),
        foreign_net_value=Decimal("0"),
        market_cap=Decimal("50000000000"),
        pe=Decimal("-1.0"),
        pb=Decimal("4.5"),
        eps=Decimal("-500"),
        roe_percent=Decimal("-5.0"),
        volume_vs_20d=Decimal("0.5"),
        interest_score=Decimal("10"),
        interest_reasons=(),
        is_vn30=False,
        candles=(),
    )
    distress_report = compute_forensics(inst_distressed)
    assert distress_report["health_score"] < 60
    assert any(f["severity"] == "high" for f in distress_report["red_flags"])


def test_dca_simulator_computes_wealth_growth_and_savings_comparison() -> None:
    result = simulate_dca(
        symbol="FPT",
        monthly_amount=Decimal("5000000"),
        duration_years=3,
        annual_savings_rate=Decimal("6.0"),
        current_price=Decimal("130000"),
    )

    assert result["symbol"] == "FPT"
    assert result["duration_years"] == 3
    assert result["duration_months"] == 36
    # 36 months * 5,000,000 = 180,000,000
    assert Decimal(result["total_invested"]) == Decimal("180000000")
    assert result["total_shares"] > 0
    assert Decimal(result["portfolio_value"]) > 0
    assert Decimal(result["savings_value"]) > Decimal("180000000")
    assert len(result["timeline"]) == 36


def test_daily_digest_service_generates_briefing() -> None:
    indices = [
        MarketIndex(
            symbol="VNINDEX",
            name="VN-INDEX",
            value=Decimal("1285.50"),
            reference_value=Decimal("1280.00"),
            open_value=Decimal("1282.00"),
            high_value=Decimal("1288.00"),
            low_value=Decimal("1280.00"),
            volume=Decimal("750000000"),
            matched_value=Decimal("19500000000000"),
            advances=230,
            declines=140,
            unchanged=75,
            ceiling_count=8,
            floor_count=2,
            candles=(),
        )
    ]
    instruments = [_sample_instrument("HPG")]
    digest = generate_daily_digest(indices=indices, instruments=instruments, events=())

    assert "VN-Index" in digest["headline"]
    assert digest["session_summary"]["vnindex_value"] == "1,285.50"
    assert len(digest["key_drivers"]) >= 3
    assert len(digest["gainers"]) >= 1
    assert "generated_at" in digest["meta"]
