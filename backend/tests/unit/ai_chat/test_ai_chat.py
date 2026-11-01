import pytest
from app.application.use_cases.ai_chat.ai_financial_service import (
    AiFinancialService,
    _extract_tickers,
    _calculate_rsi,
)
from app.application.use_cases.market_data.market_service import MarketService
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider


def test_ticker_extraction() -> None:
    assert _extract_tickers("Phân tích mã HPG và VNM giúp tôi") == ["HPG", "VNM"]
    assert _extract_tickers("So sánh VCB vs MBB") == ["VCB", "MBB"]
    # Stop words should not be mistaken as tickers
    assert "CHO" not in _extract_tickers("Cho tôi xem giá")
    assert "MUA" not in _extract_tickers("Có nên mua cổ phiếu không?")


def test_calculate_rsi() -> None:
    # 20 flat numbers -> RSI should be ~50
    flat = [100.0] * 20
    assert _calculate_rsi(flat) == 50.0

    # Steadily rising closes -> RSI > 70
    rising = [float(100 + i * 2) for i in range(25)]
    assert _calculate_rsi(rising) > 70.0


@pytest.mark.anyio
async def test_ai_financial_service_stock_analysis() -> None:
    provider = FixtureMarketProvider()
    service = MarketService(provider)
    ai_service = AiFinancialService(service)

    result = await ai_service.process_chat("Phân tích nhanh mã HPG")
    assert "HPG" in result["content"]
    assert len(result["widgets"]) >= 1
    widget_types = [w["type"] for w in result["widgets"]]
    assert "stock_score_card" in widget_types
    assert any(a["action_type"] == "NAVIGATE" for a in result["suggested_actions"])


@pytest.mark.anyio
async def test_ai_financial_service_comparison() -> None:
    provider = FixtureMarketProvider()
    service = MarketService(provider)
    ai_service = AiFinancialService(service)

    result = await ai_service.process_chat("So sánh VNM và HPG")
    assert "VNM" in result["content"] and "HPG" in result["content"]
    widget_types = [w["type"] for w in result["widgets"]]
    assert "stock_comparison" in widget_types


@pytest.mark.anyio
async def test_ai_financial_service_forensics() -> None:
    provider = FixtureMarketProvider()
    service = MarketService(provider)
    ai_service = AiFinancialService(service)

    result = await ai_service.process_chat("Kiểm tra rủi ro bẫy kế toán BCTC của HPG")
    widget_types = [w["type"] for w in result["widgets"]]
    assert "forensic_warning" in widget_types
