"""Deterministic development market data with an explicit non-production label."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.domain.entities.market import (
    Candle,
    MarketEvent,
    MarketIndex,
    MarketInstrument,
    MarketPerson,
)

D = Decimal
FIXTURE_TIME = datetime(2026, 10, 2, 8, 0, tzinfo=UTC)
_VN30_FIXTURE = {
    "FPT",
    "HPG",
    "VIC",
    "SSI",
    "TCB",
    "VCB",
    "VNM",
    "MWG",
    "MBB",
    "VHM",
    "GAS",
    "MSN",
    "STB",
}


def _candles(base: Decimal, seed: int, count: int = 30) -> tuple[Candle, ...]:
    pattern = (D("-0.012"), D("0.006"), D("0.014"), D("-0.004"), D("0.009"), D("-0.007"))
    values: list[Candle] = []
    current = base * (D("0.88") + D(seed % 5) / D("100"))
    start = FIXTURE_TIME - timedelta(days=count)
    for position in range(count):
        movement = pattern[(position + seed) % len(pattern)]
        opened = current
        closed = opened * (D("1") + movement)
        high = max(opened, closed) * D("1.006")
        low = min(opened, closed) * D("0.994")
        values.append(
            Candle(
                timestamp=start + timedelta(days=position),
                open=opened.quantize(D("0.01")),
                high=high.quantize(D("0.01")),
                low=low.quantize(D("0.01")),
                close=closed.quantize(D("0.01")),
                volume=D(800_000 + seed * 37_000 + position * 23_000),
            )
        )
        current = closed
    return tuple(values)


def _instrument(
    symbol: str,
    name: str,
    exchange: str,
    sector: str,
    price: str,
    reference: str,
    volume: int,
    market_cap_billion: int,
    seed: int,
    interest: str,
    reasons: tuple[str, ...],
) -> MarketInstrument:
    last = D(price)
    ref = D(reference)
    return MarketInstrument(
        symbol=symbol,
        name=name,
        exchange=exchange,
        sector=sector,
        price=last,
        reference_price=ref,
        ceiling_price=(ref * D("1.07")).quantize(D("0.01")),
        floor_price=(ref * D("0.93")).quantize(D("0.01")),
        open_price=(ref * (D("1") + D((seed % 3) - 1) / D("1000"))).quantize(D("0.01")),
        high_price=(max(last, ref) * D("1.012")).quantize(D("0.01")),
        low_price=(min(last, ref) * D("0.989")).quantize(D("0.01")),
        volume=D(volume),
        matched_value=(last * D(volume) * D("1000")).quantize(D("1")),
        foreign_net_value=D((seed % 7 - 3) * 8_500_000_000),
        market_cap=D(market_cap_billion) * D("1000000000"),
        pe=(D("8.5") + D(seed) / D("3")).quantize(D("0.01")),
        pb=(D("1.1") + D(seed % 8) / D("10")).quantize(D("0.01")),
        eps=D(1900 + seed * 165),
        roe_percent=(D("9.5") + D(seed % 9) * D("1.35")).quantize(D("0.01")),
        volume_vs_20d=(D("0.75") + D(seed % 8) * D("0.24")).quantize(D("0.01")),
        interest_score=D(interest),
        interest_reasons=reasons,
        candles=_candles(last, seed),
        is_vn30=symbol in _VN30_FIXTURE,
    )


class FixtureMarketProvider:
    """A bounded deterministic feed for local UI/API development only."""

    slug = "investiq-fixture"
    display_name = "InvestIQ — dữ liệu minh họa"
    delay_class = "development_fixture"
    market_time = FIXTURE_TIME.isoformat().replace("+00:00", "Z")
    freshness = "fixture"
    session = "closed"
    partial = False

    _instruments = (
        _instrument(
            "FPT",
            "CTCP FPT",
            "HOSE",
            "Công nghệ",
            "102.40",
            "100.80",
            7_850_000,
            148_600,
            1,
            "96",
            ("Lượt xem tăng", "GTGD đột biến"),
        ),
        _instrument(
            "HPG",
            "Tập đoàn Hòa Phát",
            "HOSE",
            "Tài nguyên cơ bản",
            "29.15",
            "28.40",
            31_200_000,
            185_400,
            2,
            "94",
            ("Thanh khoản cao", "Nhiều lượt thêm watchlist"),
        ),
        _instrument(
            "VIC",
            "Tập đoàn Vingroup",
            "HOSE",
            "Bất động sản",
            "46.80",
            "47.25",
            12_900_000,
            180_900,
            3,
            "92",
            ("Nhiều tin mới", "Lượt tìm kiếm tăng"),
        ),
        _instrument(
            "SSI",
            "Chứng khoán SSI",
            "HOSE",
            "Dịch vụ tài chính",
            "34.60",
            "33.90",
            22_450_000,
            68_700,
            4,
            "90",
            ("GTGD gấp 1,9 lần 20 phiên",),
        ),
        _instrument(
            "TCB",
            "Ngân hàng Techcombank",
            "HOSE",
            "Ngân hàng",
            "38.25",
            "37.90",
            14_800_000,
            267_000,
            5,
            "87",
            ("Nhiều lượt thêm watchlist",),
        ),
        _instrument(
            "VCB",
            "Vietcombank",
            "HOSE",
            "Ngân hàng",
            "64.90",
            "65.30",
            4_200_000,
            542_000,
            6,
            "84",
            ("Lượt xem tăng",),
        ),
        _instrument(
            "VNM",
            "Vinamilk",
            "HOSE",
            "Thực phẩm",
            "62.70",
            "62.10",
            5_600_000,
            131_000,
            7,
            "81",
            ("Sự kiện sắp diễn ra",),
        ),
        _instrument(
            "MWG",
            "Đầu tư Thế Giới Di Động",
            "HOSE",
            "Bán lẻ",
            "58.40",
            "57.20",
            10_700_000,
            86_300,
            8,
            "79",
            ("Khối lượng cao hơn 20 phiên",),
        ),
        _instrument(
            "MBB",
            "Ngân hàng Quân đội",
            "HOSE",
            "Ngân hàng",
            "25.35",
            "25.10",
            18_100_000,
            134_000,
            9,
            "76",
            ("Thanh khoản cao",),
        ),
        _instrument(
            "VHM",
            "Vinhomes",
            "HOSE",
            "Bất động sản",
            "43.20",
            "44.00",
            9_300_000,
            178_000,
            10,
            "74",
            ("Nhiều tin mới",),
        ),
        _instrument(
            "ACB",
            "Ngân hàng Á Châu",
            "HOSE",
            "Ngân hàng",
            "26.15",
            "25.95",
            8_750_000,
            116_000,
            11,
            "71",
            ("Lượt xem tăng",),
        ),
        _instrument(
            "GAS",
            "PV GAS",
            "HOSE",
            "Dầu khí",
            "73.80",
            "72.90",
            2_650_000,
            142_000,
            12,
            "68",
            ("Giá trị giao dịch tăng",),
        ),
        _instrument(
            "MSN",
            "Tập đoàn Masan",
            "HOSE",
            "Tiêu dùng",
            "75.10",
            "76.20",
            6_900_000,
            110_000,
            13,
            "65",
            ("Lượt tìm kiếm tăng",),
        ),
        _instrument(
            "STB",
            "Sacombank",
            "HOSE",
            "Ngân hàng",
            "36.55",
            "36.20",
            16_200_000,
            69_000,
            14,
            "62",
            ("Thanh khoản cao",),
        ),
        _instrument(
            "SHS",
            "Chứng khoán Sài Gòn Hà Nội",
            "HNX",
            "Dịch vụ tài chính",
            "18.70",
            "18.30",
            15_100_000,
            15_200,
            15,
            "60",
            ("Khối lượng đột biến",),
        ),
        _instrument(
            "PVS",
            "Dịch vụ Kỹ thuật Dầu khí",
            "HNX",
            "Dầu khí",
            "39.40",
            "38.80",
            7_400_000,
            18_700,
            16,
            "58",
            ("Giá trị giao dịch tăng",),
        ),
    )

    _indices = (
        MarketIndex(
            "VNINDEX",
            "VN-Index",
            D("1378.62"),
            D("1369.14"),
            D("1371.30"),
            D("1382.45"),
            D("1366.72"),
            D("812300000"),
            D("21500000000000"),
            214,
            102,
            71,
            8,
            3,
            _candles(D("1378.62"), 21),
        ),
        MarketIndex(
            "VN30",
            "VN30-Index",
            D("1482.31"),
            D("1471.86"),
            D("1473.05"),
            D("1488.12"),
            D("1468.34"),
            D("301800000"),
            D("10400000000000"),
            19,
            8,
            3,
            1,
            0,
            _candles(D("1482.31"), 22),
        ),
        MarketIndex(
            "HNXINDEX",
            "HNX-Index",
            D("231.54"),
            D("229.90"),
            D("230.21"),
            D("232.08"),
            D("229.77"),
            D("92500000"),
            D("1870000000000"),
            86,
            54,
            48,
            5,
            4,
            _candles(D("231.54"), 23),
        ),
        MarketIndex(
            "UPCOMINDEX",
            "UPCoM-Index",
            D("101.18"),
            D("100.72"),
            D("100.81"),
            D("101.42"),
            D("100.61"),
            D("63300000"),
            D("1150000000000"),
            121,
            79,
            66,
            9,
            5,
            _candles(D("101.18"), 24),
        ),
    )

    _events = (
        MarketEvent(
            "evt-fpt-1",
            "FPT",
            "shareholder_meeting",
            "Đại hội đồng cổ đông bất thường",
            "Trình phương án cập nhật kế hoạch kinh doanh.",
            "meeting_date",
            datetime(2026, 10, 7, 2, 0, tzinfo=UTC),
            "expected",
            "Nguồn minh họa",
            None,
        ),
        MarketEvent(
            "evt-vnm-1",
            "VNM",
            "cash_dividend",
            "Ngày đăng ký cuối cùng nhận cổ tức",
            "Cổ tức tiền mặt theo thông báo mẫu.",
            "record_date",
            datetime(2026, 10, 9, 0, 0, tzinfo=UTC),
            "expected",
            "Nguồn minh họa",
            None,
        ),
        MarketEvent(
            "evt-hpg-1",
            "HPG",
            "earnings",
            "Cập nhật kết quả kinh doanh quý",
            "Thời điểm công bố dự kiến; chờ thông báo chính thức.",
            "announcement_date",
            datetime(2026, 10, 15, 8, 0, tzinfo=UTC),
            "expected",
            "Nguồn minh họa",
            None,
        ),
        MarketEvent(
            "evt-tcb-1",
            "TCB",
            "stock_dividend",
            "Ngày giao dịch không hưởng quyền",
            "Phát hành cổ phiếu trả cổ tức theo dữ liệu minh họa.",
            "ex_right_date",
            datetime(2026, 10, 20, 0, 0, tzinfo=UTC),
            "expected",
            "Nguồn minh họa",
            None,
        ),
        MarketEvent(
            "evt-ssi-1",
            "SSI",
            "additional_listing",
            "Niêm yết bổ sung",
            "Ngày hiệu lực dự kiến của đợt niêm yết bổ sung.",
            "effective_date",
            datetime(2026, 10, 23, 0, 0, tzinfo=UTC),
            "expected",
            "Nguồn minh họa",
            None,
        ),
    )

    _people = (
        MarketPerson(
            "person-1",
            "Phạm Nhật Vượng",
            "PV",
            "Chủ tịch HĐQT",
            "Tập đoàn Vingroup",
            ("VIC",),
            "Bất động sản",
            D("691270000"),
            D("17.87"),
            D("32351436000000"),
            D("-0.95"),
            datetime(2026, 9, 30, tzinfo=UTC),
        ),
        MarketPerson(
            "person-2",
            "Trần Đình Long",
            "TL",
            "Chủ tịch HĐQT",
            "Tập đoàn Hòa Phát",
            ("HPG",),
            "Tài nguyên cơ bản",
            D("1650000000"),
            D("25.80"),
            D("48097500000000"),
            D("2.64"),
            datetime(2026, 9, 28, tzinfo=UTC),
        ),
        MarketPerson(
            "person-3",
            "Nguyễn Thị Phương Thảo",
            "NT",
            "Chủ tịch HĐQT",
            "Vietjet Air",
            ("VJC",),
            "Hàng không",
            D("47000000"),
            D("8.70"),
            D("5100000000000"),
            D("0.42"),
            datetime(2026, 9, 25, tzinfo=UTC),
        ),
        MarketPerson(
            "person-4",
            "Nguyễn Đăng Quang",
            "NQ",
            "Chủ tịch HĐQT",
            "Tập đoàn Masan",
            ("MSN",),
            "Tiêu dùng",
            D("22000000"),
            D("1.51"),
            D("1652200000000"),
            D("-1.44"),
            datetime(2026, 9, 26, tzinfo=UTC),
        ),
        MarketPerson(
            "person-5",
            "Hồ Hùng Anh",
            "HA",
            "Chủ tịch HĐQT",
            "Ngân hàng Techcombank",
            ("TCB",),
            "Ngân hàng",
            D("112000000"),
            D("1.60"),
            D("4284000000000"),
            D("0.92"),
            datetime(2026, 9, 29, tzinfo=UTC),
        ),
    )

    def instruments(self) -> tuple[MarketInstrument, ...]:
        return self._instruments

    def indices(self) -> tuple[MarketIndex, ...]:
        return self._indices

    def events(self) -> tuple[MarketEvent, ...]:
        return self._events

    def people(self) -> tuple[MarketPerson, ...]:
        return self._people

    def candles(self, symbol: str, interval: str) -> tuple[Candle, ...]:
        if interval not in {"1d", "5m"}:
            return ()
        instrument = self.instrument(symbol)
        if instrument:
            return instrument.candles
        index = self.index(symbol)
        return index.candles if index else ()

    def instrument(self, symbol: str) -> MarketInstrument | None:
        normalized = symbol.upper()
        return next((item for item in self._instruments if item.symbol == normalized), None)

    def index(self, symbol: str) -> MarketIndex | None:
        normalized = symbol.upper()
        return next((item for item in self._indices if item.symbol == normalized), None)
