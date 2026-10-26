from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import market_data
from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.infrastructure.config.settings import settings
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider
from app.main import app


def test_market_instrument_endpoint_exposes_normalized_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = FixtureMarketProvider()
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/instruments/FPT", headers={"X-Request-ID": "market"})

    assert response.status_code == 200
    assert response.json()["data"]["symbol"] == "FPT"
    assert response.json()["data"]["exchange"] == "HOSE"
    assert response.json()["data"]["is_vn30"] is True
    assert response.json()["meta"]["provider"] == "investiq-fixture"


def test_market_list_and_intraday_chart_contracts(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = FixtureMarketProvider()
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        listing = client.get("/api/v1/market/instruments")
        candles = client.get(
            "/api/v1/market/candles",
            params={"symbol": "FPT", "interval": "5m", "limit": 100},
        )
        trades = client.get(
            "/api/v1/market/intraday-trades",
            params={"symbol": "FPT", "limit": 100},
        )

    assert listing.status_code == 200
    assert candles.status_code == 200
    assert candles.json()["instrument"] == "FPT"
    assert trades.status_code == 200
    assert trades.json()["instrument"] == "FPT"


def test_sector_endpoint_aggregates_the_complete_provider_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = FixtureMarketProvider()
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/sectors")

    assert response.status_code == 200
    rows = response.json()["data"]
    assert sum(row["member_count"] for row in rows) == len(provider.instruments())
    assert next(row for row in rows if row["name"] == "Ngân hàng")["member_count"] > 1


def test_market_instrument_screener_contract_and_invalid_range(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(market_data, "_provider", lambda: FixtureMarketProvider())

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/market/instruments",
            params={
                "vn30": "true",
                "min_change": "0",
                "min_matched_value_billion": "0",
                "min_market_cap_billion": "0",
                "min_volume_ratio": "0.75",
                "sort": "volume_vs_20d",
                "direction": "desc",
            },
        )
        invalid = client.get(
            "/api/v1/market/instruments",
            params={"min_change": "5", "max_change": "1"},
        )

    assert response.status_code == 200
    assert response.json()["data"]
    assert all(row["is_vn30"] for row in response.json()["data"])
    assert all(float(row["change_percent"]) >= 0 for row in response.json()["data"])
    assert invalid.status_code == 422


def test_index_endpoint_exposes_candles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = FixtureMarketProvider()
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/indices/VNINDEX")

    assert response.status_code == 200
    assert len(response.json()["data"]["candles"]) > 0


def test_market_provider_failures_return_safe_503(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingProvider(FixtureMarketProvider):
        def instrument(self, symbol: str, *, include_fundamentals: bool = False):
            raise MarketDataUnavailable("upstream detail must not leak")

    provider = FailingProvider()
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/instruments/FPT")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MARKET_DATA_UNAVAILABLE"
    assert "upstream" not in response.json()["error"]["message"]
    assert response.headers["retry-after"] == "15"


@pytest.mark.anyio
async def test_vnstock_provider_is_initialized_once_during_application_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[object] = []
    provider = FixtureMarketProvider()
    monkeypatch.setattr(settings, "market_data_mode", "vnstock")

    def provider_factory() -> FixtureMarketProvider:
        calls.append(provider)
        return provider

    monkeypatch.setattr(market_data, "_provider", provider_factory)

    await market_data.start_market_provider()

    assert calls == [provider]
