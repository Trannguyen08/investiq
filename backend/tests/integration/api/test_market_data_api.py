from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import market_data
from app.infrastructure.external.market_fixture_provider import FixtureMarketProvider
from app.infrastructure.external.tcbs_market_provider import (
    TcbsConfig,
    TcbsMarketProvider,
    TcbsRequest,
    TcbsTransientError,
)
from app.main import app


def config() -> TcbsConfig:
    return TcbsConfig(
        api_base_url="https://openapi.tcbs.com.vn",
        ws_url="wss://openapi.tcbs.com.vn/ws/thesis/v1/stream/normal",
        api_key=None,
        otp=None,
        access_token="test-token",
        request_timeout_seconds=5,
        quote_refresh_seconds=3,
        security_refresh_seconds=21600,
        retry_attempts=1,
        circuit_failure_threshold=2,
        circuit_open_seconds=30,
    )


def successful_transport(request: TcbsRequest) -> object:
    if request.path == "/ananke/v1/securities":
        return {
            "content": [
                {
                    "symbol": "FPT",
                    "issuerName": "FPT Corporation",
                    "secType": "001",
                    "status": "Y",
                    "tradePlace": "001",
                    "securitiesInfo": {"listingQtty": 1_000_000},
                }
            ]
        }
    if request.path == "/tartarus/v1/tickerCommons":
        return {
            "data": [
                {
                    "symbol": "FPT",
                    "refPrice": 100_000,
                    "matchPrice": 102_000,
                    "open": 101_000,
                    "high": 103_000,
                    "low": 99_500,
                    "totalVol": 2_000_000,
                    "totalVal": 204_000_000_000,
                }
            ]
            if request.query["index"] in {"1", "2"}
            else []
        }
    if request.path == "/nyx/v1/intraday/FPT/his/paging":
        return {
            "d": "07/10",
            "data": [
                {"p": 101_000, "v": 100, "t": "09:01:00"},
                {"p": 102_000, "v": 200, "t": "09:04:00"},
            ],
        }
    raise AssertionError(request.path)


def test_market_instrument_endpoint_exposes_normalized_tcbs_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = TcbsMarketProvider(config(), transport=successful_transport)
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/instruments/FPT", headers={"X-Request-ID": "market"})

    assert response.status_code == 200
    assert response.json()["data"]["price"] == "102000"
    assert response.json()["data"]["exchange"] == "HOSE"
    assert response.json()["data"]["is_vn30"] is True
    assert response.json()["meta"]["provider"] == "tcbs-iflash"
    assert response.json()["meta"]["partial"] is True


def test_market_list_and_intraday_chart_contracts(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = TcbsMarketProvider(config(), transport=successful_transport)
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        listing = client.get("/api/v1/market/instruments")
        candles = client.get(
            "/api/v1/market/candles",
            params={"symbol": "FPT", "interval": "5m", "limit": 100},
        )

    assert listing.status_code == 200
    assert listing.json()["pagination"] == {
        "next_cursor": None,
        "previous_cursor": None,
        "has_more": False,
        "limit": 15,
        "total_items": 1,
        "page": 1,
        "total_pages": 1,
    }
    assert candles.status_code == 200
    assert candles.json()["instrument"] == "FPT"
    assert candles.json()["interval"] == "5m"
    assert candles.json()["data"][0]["close"] == "102000"


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


def test_index_endpoint_exposes_accumulated_stream_candles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = TcbsMarketProvider(config(), transport=successful_transport)
    first = 's|8|{"indexNumber":1,"index":1380,"change":10,"volume":1000000}'
    second = 's|8|{"indexNumber":1,"index":1382,"change":12,"volume":1000500}'
    assert provider.apply_stream_message(
        first,
        received_at=datetime(2026, 10, 7, 2, 1, tzinfo=UTC),
    )
    assert provider.apply_stream_message(
        second,
        received_at=datetime(2026, 10, 7, 2, 6, tzinfo=UTC),
    )
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/indices/VNINDEX")

    assert response.status_code == 200
    assert [item["close"] for item in response.json()["data"]["candles"]] == ["1380", "1382"]


def test_market_provider_failures_return_safe_503(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing_transport(_: TcbsRequest) -> object:
        raise TcbsTransientError("upstream detail must not leak")

    provider = TcbsMarketProvider(config(), transport=failing_transport)
    monkeypatch.setattr(market_data, "_provider", lambda: provider)

    with TestClient(app) as client:
        response = client.get("/api/v1/market/instruments/FPT")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MARKET_DATA_UNAVAILABLE"
    assert "upstream" not in response.json()["error"]["message"]
    assert response.headers["retry-after"] == "15"
