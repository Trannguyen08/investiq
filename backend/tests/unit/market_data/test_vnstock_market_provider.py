from __future__ import annotations

from datetime import date
from decimal import Decimal
from threading import Event, Thread

import pytest

from app.infrastructure.external.vnstock_market_provider import (
    OfficialVnstockGateway,
    VnstockConfig,
    VnstockMarketProvider,
    _fundamental_values,
    _latest_vci_fundamental_rows,
)


class FakeVnstockGateway:
    def __init__(self) -> None:
        self.fail = False
        self.fail_fundamentals = False
        self.block_quotes = False
        self.pre_open = False
        self.partial_open = False
        self.fundamental_calls = 0
        self.previous_session_calls = 0
        self.event_calls = 0
        self.fail_events = False
        self.refresh_started = Event()
        self.release_refresh = Event()

    def reference_rows(self) -> tuple[list[dict[str, object]], set[str], dict[str, str]]:
        if self.fail:
            raise RuntimeError("provider unavailable")
        return (
            [
                {
                    "symbol": "FPT",
                    "organ_name": "Công ty Cổ phần FPT",
                    "exchange": "HOSE",
                },
                {
                    "symbol": "SHS",
                    "organ_name": "Chứng khoán Sài Gòn Hà Nội",
                    "exchange": "HNX",
                },
            ],
            {"FPT"},
            {"FPT": "Công nghệ", "SHS": "Dịch vụ tài chính"},
        )

    def quote_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        assert symbols == ["FPT", "SHS"]
        if self.block_quotes:
            self.refresh_started.set()
            self.release_refresh.wait(timeout=2)
        rows = [
            {
                "symbol": "FPT",
                "close_price": 102_000,
                "reference_price": 100_000,
                "ceiling_price": 107_000,
                "floor_price": 93_000,
                "open_price": 100_500,
                "high_price": 103_000,
                "low_price": 99_500,
                "volume_accumulated": 2_000_000,
                "total_value": 204_000_000_000,
                "foreign_buy_volume": 50_000,
                "foreign_sell_volume": 40_000,
                "listed_shares": 1_000_000,
                "bid_price_1": 101_900,
                "bid_vol_1": 123_400,
                "bid_price_2": 101_800,
                "bid_vol_2": 98_700,
                "ask_price_1": 102_100,
                "ask_vol_1": 76_500,
                "ask_price_2": 102_200,
                "ask_vol_2": 88_800,
                "time": "2026-10-08 09:10:00",
            },
            {
                "symbol": "SHS",
                "close_price": 18_000,
                "reference_price": 18_500,
                "ceiling_price": 20_300,
                "floor_price": 16_700,
                "open_price": 18_400,
                "high_price": 18_600,
                "low_price": 17_900,
                "volume_accumulated": 1_000_000,
                "total_value": 18_000_000_000,
                "time": "2026-10-08 09:10:00",
            },
        ]
        if self.pre_open:
            return [
                {
                    **row,
                    "close_price": 0,
                    "open_price": 0,
                    "high_price": 0,
                    "low_price": 0,
                    "volume_accumulated": 0,
                    "total_value": 0,
                }
                for row in rows
            ]
        if self.partial_open:
            return [
                rows[0],
                {
                    **rows[1],
                    "close_price": 0,
                    "open_price": 0,
                    "high_price": 0,
                    "low_price": 0,
                    "volume_accumulated": 0,
                    "total_value": 0,
                },
            ]
        return rows

    def previous_session_rows(self, symbols: list[str]) -> list[dict[str, object]]:
        assert symbols == ["FPT", "SHS"]
        self.previous_session_calls += 1
        return [
            {
                "symbol": "FPT",
                "close_price": 102_000,
                "reference_price": 100_000,
            },
            {
                "symbol": "SHS",
                "close_price": 18_000,
                "reference_price": 18_500,
            },
        ]

    def candle_rows(
        self,
        symbol: str,
        interval: str,
        count: int,
    ) -> list[dict[str, object]]:
        assert interval in {"1D", "1H", "30m", "5m"}
        assert count in {170, 200, 500}
        if symbol in {"VNINDEX", "VN30", "HNXINDEX", "UPCOMINDEX"}:
            return [
                {
                    "time": "2026-10-06",
                    "open": 1360,
                    "high": 1372,
                    "low": 1358,
                    "close": 1368,
                    "volume": 800_000_000,
                    "value": 20_000_000_000_000,
                },
                {
                    "time": "2026-10-07",
                    "open": 1368,
                    "high": 1382,
                    "low": 1365,
                    "close": 1378,
                    "volume": 900_000_000,
                    "value": 22_000_000_000_000,
                },
            ]
        return [
            {
                "time": "2026-10-07 09:00:00",
                "open": 100,
                "high": 103,
                "low": 99,
                "close": 102,
                "volume": 2_000_000,
            }
        ]

    def fundamental_rows(self, symbol: str) -> list[dict[str, object]]:
        assert symbol == "FPT"
        self.fundamental_calls += 1
        if self.fail_fundamentals:
            raise RuntimeError("fundamentals unavailable")
        return [
            {"item_id": "pe_ratio", "2026-Q1": 16.1, "2026-Q2": 15.53},
            {"item_id": "pb_ratio", "2026-Q1": 3.73, "2026-Q2": 3.7},
            {"item_id": "trailing_eps", "2026-Q2": 6500},
            {"item_id": "roe", "2026-Q2": 5.89},
        ]

    def fundamental_quarterly_rows(self, symbol: str) -> list[dict[str, object]]:
        return []

    def trade_rows(self, symbol: str, limit: int) -> list[dict[str, object]]:
        assert symbol == "FPT"
        assert limit >= 2
        return [
            {"time": "2026-10-08 09:10:01", "price": 102, "volume": 200, "match_type": "buy"},
            {"time": "2026-10-08 09:10:02", "price": 101.9, "volume": 300, "match_type": "sell"},
        ]

    def event_rows(self, symbol: str) -> list[dict[str, object]]:
        self.event_calls += 1
        if self.fail_events:
            raise RuntimeError("events unavailable")
        if symbol != "FPT":
            return []
        return [
            {
                "id": "dividend-1",
                "ticker": "FPT",
                "event_code": "DIV",
                "event_name_vi": "Trả cổ tức bằng tiền mặt",
                "event_title_vi": "Trả cổ tức bằng tiền mặt - 1.000 đồng/cổ phiếu",
                "exright_date": "2026-10-07",
                "record_date": "2026-10-08",
                "payout_date": "2026-10-16T00:00:00",
            },
            {
                "id": "old-event",
                "ticker": "FPT",
                "event_code": "AGME",
                "event_name_vi": "Đại hội cổ đông",
                "event_title_vi": "Đại hội đồng cổ đông thường niên",
                "display_date1": "2026-09-01T00:00:00",
            },
        ]


def config() -> VnstockConfig:
    return VnstockConfig(
        api_key=None,
        refresh_seconds=60,
        candle_cache_seconds=300,
        fundamental_cache_seconds=3600,
        max_symbols=1800,
    )


def test_vnstock_rows_are_normalized_without_claiming_realtime() -> None:
    provider = VnstockMarketProvider(config(), gateway=FakeVnstockGateway())

    fpt = provider.instrument("fpt", include_fundamentals=True)
    index = provider.index("VNINDEX")

    assert fpt is not None
    assert fpt.price == 102_000
    assert fpt.change_percent == 2
    assert fpt.market_cap == 102_000_000_000
    assert fpt.foreign_net_value == 1_020_000_000
    assert fpt.sector == "Công nghệ"
    assert fpt.is_vn30 is True
    assert fpt.pe == Decimal("15.53")
    assert fpt.pb == Decimal("3.7")
    assert fpt.eps == Decimal("6500")
    assert fpt.roe_percent == Decimal("5.89")
    assert [(level.price, level.volume) for level in fpt.bid_levels] == [
        (Decimal("101900"), Decimal("123400")),
        (Decimal("101800"), Decimal("98700")),
    ]
    assert [(level.price, level.volume) for level in fpt.ask_levels] == [
        (Decimal("102100"), Decimal("76500")),
        (Decimal("102200"), Decimal("88800")),
    ]
    assert provider.delay_class == "source_delayed"
    assert provider.partial is True
    assert provider.market_time == "2026-10-08T02:10:00Z"
    assert index is not None
    assert index.value == 1378
    assert index.reference_value == 1368
    assert index.advances == 1
    assert index.declines == 0


def test_pre_open_zero_board_uses_latest_completed_session_batch() -> None:
    gateway = FakeVnstockGateway()
    gateway.pre_open = True
    provider = VnstockMarketProvider(config(), gateway=gateway)

    instruments = provider.instruments()
    fpt = next(item for item in instruments if item.symbol == "FPT")
    shs = next(item for item in instruments if item.symbol == "SHS")

    assert gateway.previous_session_calls == 1
    assert fpt.price == 102_000
    assert fpt.reference_price == 100_000
    assert fpt.change_percent == 2
    assert shs.change_percent < 0
    assert all(item.volume == 0 for item in instruments)


def test_unmatched_stock_stays_in_an_open_session_as_unchanged() -> None:
    gateway = FakeVnstockGateway()
    gateway.partial_open = True
    provider = VnstockMarketProvider(config(), gateway=gateway)

    instruments = provider.instruments()
    shs = next(item for item in instruments if item.symbol == "SHS")

    assert gateway.previous_session_calls == 0
    assert len(instruments) == 2
    assert shs.price == shs.reference_price == 18_500
    assert shs.change_percent == 0
    assert shs.open_price == 0
    assert shs.high_price == 0
    assert shs.low_price == 0


def test_vnstock_system_exit_is_normalized_as_provider_failure() -> None:
    class QuotaLimitedMarket:
        @staticmethod
        def quote(**_: object) -> object:
            raise SystemExit("rate limit")

    gateway = OfficialVnstockGateway.__new__(OfficialVnstockGateway)
    gateway._market = QuotaLimitedMarket()

    with pytest.raises(RuntimeError, match="quote request failed"):
        gateway.quote_rows(["FPT"])


def test_stock_candles_fall_back_to_vci_when_kbs_is_temporarily_unavailable() -> None:
    calls: list[str] = []

    class Frame:
        @staticmethod
        def to_dict(*, orient: str) -> list[dict[str, object]]:
            assert orient == "records"
            return [
                {
                    "time": "2026-10-13",
                    "open": 24.35,
                    "high": 24.5,
                    "low": 23.95,
                    "close": 24.4,
                    "volume": 15_227_600,
                }
            ]

    class Equity:
        @staticmethod
        def ohlcv(**kwargs: object) -> object:
            source = str(kwargs["source"])
            calls.append(source)
            if source == "kbs":
                raise SystemExit("temporary KBS quota exit")
            return Frame()

    class FallbackMarket:
        @staticmethod
        def equity(*, symbol: str) -> object:
            assert symbol == "VPB"
            return Equity()

    gateway = OfficialVnstockGateway.__new__(OfficialVnstockGateway)
    gateway._market = FallbackMarket()

    rows = gateway.candle_rows("VPB", "1D", 500)

    assert calls == ["kbs", "vci"]
    assert rows[0]["close"] == 24.4


def test_vci_event_request_is_bounded_and_normalizes_camel_case() -> None:
    calls: list[dict[str, object]] = []

    def send(**kwargs: object) -> dict[str, object]:
        calls.append(kwargs)
        return {
            "data": {
                "content": [
                    {
                        "id": "event-1",
                        "ticker": "FPT",
                        "eventCode": "DIV",
                        "eventTitleVi": "Trả cổ tức bằng tiền mặt",
                        "payoutDate": "2026-10-16T00:00:00",
                    }
                ]
            }
        }

    gateway = OfficialVnstockGateway.__new__(OfficialVnstockGateway)
    gateway._event_url = "https://events.example.test"
    gateway._event_headers = {"Accept": "application/json"}
    gateway._event_sender = send

    rows = gateway.event_rows("FPT")

    assert rows[0]["event_code"] == "DIV"
    assert rows[0]["payout_date"] == "2026-10-16T00:00:00"
    assert calls[0]["timeout"] == 5
    params = calls[0]["params"]
    assert isinstance(params, dict)
    assert params["ticker"] == "FPT"
    assert params["page"] == 0
    assert params["size"] == 50


def test_vci_fundamentals_use_the_latest_ttm_quarter_not_the_annual_row() -> None:
    rows = [
        {
            "year": 2025,
            "quarter": 4,
            "ratio_type": "RATIO_TTM",
            "pe": 13.6,
            "pb": 3.5,
            "roe": 0.28,
        },
        {
            "year": 2025,
            "quarter": 5,
            "ratio_type": "RATIO_YEAR",
            "pe": 10.3,
            "pb": 2.6,
            "roe": 0.27,
        },
        {
            "year": 2026,
            "quarter": 2,
            "ratio_type": "RATIO_TTM",
            "pe": 10.72,
            "pb": 2.69,
            "roe": 0.26,
        },
    ]

    normalized = _latest_vci_fundamental_rows(rows)
    pe, pb, eps, roe = _fundamental_values(normalized)

    assert pe == Decimal("10.72")
    assert pb == Decimal("2.69")
    assert eps is None
    assert roe == Decimal("26.00")


def test_fundamentals_are_loaded_on_detail_only_and_cached() -> None:
    gateway = FakeVnstockGateway()
    provider = VnstockMarketProvider(config(), gateway=gateway)

    assert provider.instruments()
    assert provider.instrument("FPT") is not None
    assert gateway.fundamental_calls == 0

    first = provider.instrument("FPT", include_fundamentals=True)
    second = provider.instrument("FPT", include_fundamentals=True)

    assert first is not None and second is not None
    assert first.pe == second.pe == Decimal("15.53")
    assert gateway.fundamental_calls == 1


def test_fundamental_failure_keeps_the_quote_available() -> None:
    gateway = FakeVnstockGateway()
    gateway.fail_fundamentals = True
    provider = VnstockMarketProvider(config(), gateway=gateway)

    value = provider.instrument("FPT", include_fundamentals=True)

    assert value is not None
    assert value.price == 102_000
    assert value.pe is None
    assert value.pb is None


def test_expired_fundamentals_serve_last_observed_values_after_provider_failure() -> None:
    gateway = FakeVnstockGateway()
    now = [0.0]
    provider = VnstockMarketProvider(config(), gateway=gateway, clock=lambda: now[0])

    first = provider.instrument("FPT", include_fundamentals=True)
    now[0] = 3601
    gateway.fail_fundamentals = True
    stale = provider.instrument("FPT", include_fundamentals=True)

    assert first is not None and stale is not None
    assert stale.pe == first.pe == Decimal("15.53")
    assert stale.pb == first.pb == Decimal("3.7")
    assert gateway.fundamental_calls == 2


def test_stock_history_is_scaled_from_vnstock_thousands_to_vnd_and_cached() -> None:
    gateway = FakeVnstockGateway()
    provider = VnstockMarketProvider(config(), gateway=gateway)

    candles = provider.candles("FPT", "1d")

    assert len(candles) == 2
    assert candles[0].open == 100_000
    assert candles[0].close == 102_000
    assert candles[-1].close == 102_000
    assert provider.candles("FPT", "1d") == candles
    assert provider.candles("FPT", "1h")[0].close == 102_000
    assert provider.candles("FPT", "30m")[0].close == 102_000


def test_intraday_trades_preserve_observed_side_and_vnd_price() -> None:
    provider = VnstockMarketProvider(config(), gateway=FakeVnstockGateway())

    trades = provider.intraday_trades("FPT", 100)

    assert [item.match_side for item in trades] == ["buy", "sell"]
    assert [item.price for item in trades] == [Decimal("102000"), Decimal("101900.0")]
    assert trades[-1].volume == 300


def test_upcoming_vci_events_use_the_next_published_milestone_and_are_cached() -> None:
    gateway = FakeVnstockGateway()
    provider = VnstockMarketProvider(
        config(),
        gateway=gateway,
        today=lambda: date(2026, 10, 13),
    )

    first = provider.events()
    second = provider.events()

    assert second == first
    assert gateway.event_calls == 2
    assert len(first) == 1
    assert first[0].symbol == "FPT"
    assert first[0].event_type == "cash_dividend"
    assert first[0].date_type == "payment_date"
    assert first[0].event_at.isoformat() == "2026-10-15T17:00:00+00:00"
    assert first[0].status == "official"
    assert first[0].source_name == "VCI qua Vnstock"


def test_event_refresh_failure_retains_last_observed_calendar() -> None:
    gateway = FakeVnstockGateway()
    now = [0.0]
    provider = VnstockMarketProvider(
        config(),
        gateway=gateway,
        clock=lambda: now[0],
        today=lambda: date(2026, 10, 13),
    )
    observed = provider.events()
    now[0] = 1801
    gateway.fail_events = True

    assert provider.events() == observed
    assert gateway.event_calls == 4


def test_refresh_failure_serves_a_labeled_stale_snapshot() -> None:
    gateway = FakeVnstockGateway()
    now = [0.0]
    provider = VnstockMarketProvider(config(), gateway=gateway, clock=lambda: now[0])
    assert provider.instruments()

    gateway.fail = True
    now[0] = 61

    assert provider.instruments()
    assert provider.freshness == "stale"


def test_expired_snapshot_returns_immediately_while_refresh_runs_in_background() -> None:
    gateway = FakeVnstockGateway()
    now = [0.0]
    provider = VnstockMarketProvider(config(), gateway=gateway, clock=lambda: now[0])
    original = provider.instruments()
    gateway.block_quotes = True
    now[0] = 61
    returned = Event()
    result: list[object] = []

    def read_snapshot() -> None:
        result.append(provider.instruments())
        returned.set()

    reader = Thread(target=read_snapshot)
    reader.start()
    try:
        assert gateway.refresh_started.wait(timeout=1)
        assert returned.wait(timeout=0.2)
        assert result == [original]
        assert provider.freshness == "stale"
    finally:
        gateway.release_refresh.set()
        reader.join(timeout=1)
