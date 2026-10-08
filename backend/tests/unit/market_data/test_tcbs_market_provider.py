from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal
from threading import Event

import pytest

from app.application.use_cases.market_data.market_service import MarketService
from app.infrastructure.external.tcbs_market_provider import (
    TcbsConfig,
    TcbsMarketProvider,
    TcbsRequest,
    TcbsRestClient,
    TcbsTransientError,
    parse_tcbs_stream_message,
)


def config(*, access_token: str | None = "access-token") -> TcbsConfig:
    return TcbsConfig(
        api_base_url="https://openapi.tcbs.com.vn",
        ws_url="wss://openapi.tcbs.com.vn/ws/thesis/v1/stream/normal",
        api_key="api-key" if access_token is None else None,
        otp="123456" if access_token is None else None,
        access_token=access_token,
        request_timeout_seconds=5,
        quote_refresh_seconds=3,
        security_refresh_seconds=21600,
        retry_attempts=3,
        circuit_failure_threshold=5,
        circuit_open_seconds=30,
    )


def market_transport(request: TcbsRequest) -> object:
    assert request.headers.get("Authorization") == "Bearer access-token"
    if request.path == "/ananke/v1/securities":
        return {
            "content": [
                {
                    "symbol": "FPT",
                    "issuerName": "Công ty Cổ phần FPT",
                    "secType": "001",
                    "status": "Y",
                    "tradePlace": "001",
                    "securitiesInfo": {"listingQtty": 1_000_000},
                }
            ]
        }
    if request.path == "/tartarus/v1/tickerCommons":
        if request.query["index"] not in {"1", "2"}:
            return {"data": []}
        return {
            "tradingDate": "06/10/2026",
            "data": [
                {
                    "symbol": "FPT",
                    "ceilPrice": 110_000,
                    "floorPrice": 96_000,
                    "refPrice": 100_000,
                    "matchPrice": 102_000,
                    "open": 101_000,
                    "high": 103_000,
                    "low": 99_500,
                    "totalVol": 2_000_000,
                    "totalVal": 204_000_000_000,
                    "buyForeignQtty": 50_000,
                    "sellForeignQtty": 40_000,
                }
            ],
        }
    raise AssertionError(f"Unexpected path: {request.path}")


def test_token_exchange_happens_once_and_token_is_reused() -> None:
    requests: list[TcbsRequest] = []

    def transport(request: TcbsRequest) -> object:
        requests.append(request)
        if request.path == "/gaia/v1/oauth2/openapi/token":
            assert json.loads(request.body or b"{}") == {"apiKey": "api-key", "otp": "123456"}
            assert "Authorization" not in request.headers
            return {"token": "issued-token"}
        assert request.headers["Authorization"] == "Bearer issued-token"
        return {"data": []}

    client = TcbsRestClient(config(access_token=None), transport=transport)
    client.get("/tartarus/v1/tickerCommons", {"index": "1"})
    client.get("/tartarus/v1/tickerCommons", {"index": "3"})

    assert [request.path for request in requests].count("/gaia/v1/oauth2/openapi/token") == 1


def test_concurrent_consumers_share_one_otp_exchange() -> None:
    exchange_started = Event()
    release_exchange = Event()
    exchange_calls = 0

    def transport(request: TcbsRequest) -> object:
        nonlocal exchange_calls
        assert request.path == "/gaia/v1/oauth2/openapi/token"
        exchange_calls += 1
        exchange_started.set()
        assert release_exchange.wait(timeout=1)
        return {"token": "issued-token"}

    client = TcbsRestClient(config(access_token=None), transport=transport)
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(client.access_token)
        assert exchange_started.wait(timeout=1)
        second = executor.submit(client.access_token)
        release_exchange.set()

    assert first.result() == "issued-token"
    assert second.result() == "issued-token"
    assert exchange_calls == 1


def test_transient_reads_retry_with_a_bounded_budget() -> None:
    calls = 0
    sleeps: list[float] = []

    def transport(_: TcbsRequest) -> object:
        nonlocal calls
        calls += 1
        if calls < 3:
            raise TcbsTransientError("temporary")
        return {"data": []}

    client = TcbsRestClient(config(), transport=transport, sleeper=sleeps.append)
    assert client.get("/tartarus/v1/tickerCommons") == {"data": []}
    assert calls == 3
    assert len(sleeps) == 2
    assert all(0 <= delay <= 1.5 for delay in sleeps)


def test_tcbs_rows_are_normalized_to_decimal_financial_entities() -> None:
    provider = TcbsMarketProvider(config(), transport=market_transport)
    instrument = provider.instrument("fpt")

    assert instrument is not None
    assert instrument.symbol == "FPT"
    assert instrument.exchange == "HOSE"
    assert instrument.name == "Công ty Cổ phần FPT"
    assert str(instrument.price) == "102000"
    assert instrument.change_percent == Decimal("2")
    assert str(instrument.market_cap) == "102000000000"
    assert str(instrument.foreign_net_value) == "1020000000"
    assert instrument.pe is None
    assert instrument.candles == ()
    assert instrument.is_vn30 is True
    assert provider.partial is True
    assert provider.market_time == "2026-10-06T08:00:00Z"

    response = MarketService(provider).instrument("FPT")
    assert response is not None
    meta = response["meta"]
    assert isinstance(meta, dict)
    assert meta["provider"] == "tcbs-iflash"
    assert meta["freshness"] == "fresh"
    assert meta["partial"] is True


def test_index_stream_frames_update_a_canonical_snapshot() -> None:
    provider = TcbsMarketProvider(config(), transport=market_transport)
    message = (
        's|8|{"indexNumber":1,"index":1380.5,"change":10.5,"volume":1000000,'
        '"value":25000000000,"increase":210,"decrease":100,"notChange":40,'
        '"ceilIncrease":8,"floorDecrease":2}'
    )

    assert provider.apply_stream_message(
        message,
        received_at=datetime(2026, 10, 7, 2, 1, tzinfo=UTC),
    ) is True
    assert provider.apply_stream_message(
        message.replace('"index":1380.5', '"index":1378.5').replace(
            '"volume":1000000', '"volume":1000500'
        ),
        received_at=datetime(2026, 10, 7, 2, 6, tzinfo=UTC),
    ) is True
    index = provider.index("VNINDEX")
    assert index is not None
    assert str(index.reference_value) == "1368.0"
    assert index.advances == 210
    assert index.floor_count == 2
    assert len(index.candles) == 2
    assert str(index.candles[0].close) == "1380.5"
    assert str(index.candles[1].close) == "1378.5"
    assert str(index.candles[1].volume) == "500"
    assert parse_tcbs_stream_message("d|p|||") is None
    assert parse_tcbs_stream_message("s|8|not-json") is None


def test_security_master_is_split_by_exchange_and_filters_non_common_instruments() -> None:
    security_filters: list[str] = []

    def transport(request: TcbsRequest) -> object:
        if request.path == "/ananke/v1/securities":
            selected_filter = request.query["filter"]
            security_filters.append(selected_filter)
            content = (
                [
                    {
                        "symbol": "FPT",
                        "issuerName": "FPT",
                        "secType": "001",
                        "status": "Y",
                        "tradePlace": "001",
                    },
                    {"symbol": "FUESSVFL", "secType": "004", "status": "Y"},
                ]
                if selected_filter == "tradePlace=001"
                else [
                    {
                        "symbol": "VCB",
                        "issuerName": "VCB",
                        "secType": "001",
                        "status": "Y",
                        "tradePlace": "002",
                    }
                ]
                if selected_filter == "tradePlace=002"
                else []
            )
            return {"content": content}
        if request.path == "/tartarus/v1/tickerCommons":
            return {
                "tradingDate": "07/10/2026",
                "data": [
                    {"symbol": "FPT", "refPrice": 100, "matchPrice": 101},
                    {"symbol": "VCB", "refPrice": 50, "matchPrice": 51},
                    {"symbol": "FUESSVFL", "refPrice": 20, "matchPrice": 21},
                ],
            }
        raise AssertionError(f"Unexpected path: {request.path}")

    provider = TcbsMarketProvider(config(), transport=transport)

    assert {item.symbol for item in provider.instruments()} == {"FPT", "VCB"}
    assert security_filters == ["tradePlace=001", "tradePlace=002", "tradePlace=005"]


def test_intraday_trades_are_aggregated_into_five_minute_candles() -> None:
    def transport(request: TcbsRequest) -> object:
        assert request.path == "/nyx/v1/intraday/FPT/his/paging"
        assert request.query == {"page": "0", "size": "100"}
        return {
            "d": "07/10",
            "data": [
                {"p": 102_000, "v": 200, "t": "09:04:30"},
                {"p": 101_000, "v": 100, "t": "09:01:00"},
                {"p": 103_000, "v": 300, "t": "09:06:00"},
            ],
        }

    provider = TcbsMarketProvider(config(), transport=transport)
    candles = provider.candles("fpt", "5m")

    assert len(candles) == 2
    assert str(candles[0].open) == "101000"
    assert str(candles[0].close) == "102000"
    assert str(candles[0].volume) == "300"
    assert str(candles[1].close) == "103000"
    assert provider.candles("FPT", "1d") == ()


def test_overview_breadth_does_not_double_count_vn30() -> None:
    provider = TcbsMarketProvider(config(), transport=market_transport)
    for board, advances, value in ((1, 200, 1000), (2, 20, 300), (3, 100, 500), (5, 50, 200)):
        assert provider.apply_stream_message(
            "s|8|"
            + json.dumps(
                {
                    "indexNumber": board,
                    "index": 1000,
                    "change": 10,
                    "value": value,
                    "increase": advances,
                    "decrease": 10,
                    "notChange": 5,
                }
            )
        )

    data = MarketService(provider).overview()["data"]
    assert isinstance(data, dict)
    breadth = data["breadth"]
    assert isinstance(breadth, dict)

    assert breadth["advances"] == 350
    assert breadth["declines"] == 30
    assert breadth["unchanged"] == 15
    assert breadth["matched_value"] == "1700"


@pytest.mark.parametrize("payload", [b"{}", b'{"token":""}'])
def test_invalid_token_exchange_response_fails_closed(payload: bytes) -> None:
    def transport(_: TcbsRequest) -> object:
        return json.loads(payload)

    client = TcbsRestClient(config(access_token=None), transport=transport)
    with pytest.raises(RuntimeError, match="did not issue"):
        client.access_token()
