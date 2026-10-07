from __future__ import annotations

from threading import Event, Thread

from app.infrastructure.external.vnstock_market_provider import (
    VnstockConfig,
    VnstockMarketProvider,
)


class FakeVnstockGateway:
    def __init__(self) -> None:
        self.fail = False
        self.block_quotes = False
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
        return [
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
            },
        ]

    def candle_rows(
        self,
        symbol: str,
        interval: str,
        count: int,
    ) -> list[dict[str, object]]:
        assert interval in {"1D", "5m"}
        assert count in {90, 160, 500}
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


def config() -> VnstockConfig:
    return VnstockConfig(
        api_key=None,
        refresh_seconds=60,
        candle_cache_seconds=300,
        max_symbols=1800,
    )


def test_vnstock_rows_are_normalized_without_claiming_realtime() -> None:
    provider = VnstockMarketProvider(config(), gateway=FakeVnstockGateway())

    fpt = provider.instrument("fpt")
    index = provider.index("VNINDEX")

    assert fpt is not None
    assert fpt.price == 102_000
    assert fpt.change_percent == 2
    assert fpt.market_cap == 102_000_000_000
    assert fpt.foreign_net_value == 1_020_000_000
    assert fpt.sector == "Công nghệ"
    assert fpt.is_vn30 is True
    assert provider.delay_class == "source_delayed"
    assert provider.partial is True
    assert index is not None
    assert index.value == 1378
    assert index.reference_value == 1368
    assert index.advances == 1
    assert index.declines == 0


def test_stock_history_is_scaled_from_vnstock_thousands_to_vnd_and_cached() -> None:
    gateway = FakeVnstockGateway()
    provider = VnstockMarketProvider(config(), gateway=gateway)

    candles = provider.candles("FPT", "1d")

    assert len(candles) == 1
    assert candles[0].open == 100_000
    assert candles[0].close == 102_000
    assert provider.candles("FPT", "1d") is candles


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
