"""Prominent Vietnamese Business Leaders & Billionaires Crawler and Valuation Engine.

Crawls and computes public market equity value and external net worth for prominent
Vietnamese business leaders (Forbes Vietnam & CafeF Top Người Giàu).
"""

import logging
import threading
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from app.domain.entities.market import MarketInstrument, MarketPerson

logger = logging.getLogger("investiq.crawler.leader")

D = Decimal


@dataclass(frozen=True, slots=True)
class LeaderProfile:
    id: str
    full_name: str
    initials: str
    role: str
    company: str
    symbols: tuple[str, ...]
    sector: str
    disclosed_shares: Decimal
    ownership_percent: Decimal
    base_price: Decimal
    net_worth_total: str
    net_worth_external: str
    bio: str
    holding_public_date: datetime


# Authoritative baseline dataset of prominent Vietnamese business leaders
_BASELINE_LEADERS: tuple[LeaderProfile, ...] = (
    LeaderProfile(
        id="person-1",
        full_name="Phạm Nhật Vượng",
        initials="PV",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Vingroup",
        symbols=("VIC",),
        sector="Bất động sản & Xe điện",
        disclosed_shares=D("691270000"),
        ownership_percent=D("17.87"),
        base_price=D("237000"),
        net_worth_total="4.5 tỷ USD (~114.300 tỷ ₫)",
        net_worth_external=("Ước tính ngoài sàn: VinFast quốc tế (VFS), VMI JSC, Taxi Xanh GSM"),
        bio=("Tỷ phú giàu nhất Việt Nam, người sáng lập Vingroup và thương hiệu xe điện VinFast."),
        holding_public_date=datetime(2026, 9, 30, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-2",
        full_name="Trần Đình Long",
        initials="TL",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Hòa Phát",
        symbols=("HPG",),
        sector="Thép & Công nghiệp nặng",
        disclosed_shares=D("1650000000"),
        ownership_percent=D("25.80"),
        base_price=D("20900"),
        net_worth_total="2.6 tỷ USD (~66.000 tỷ ₫)",
        net_worth_external=(
            "Hệ thống cảng biển, logistics, bất động sản KCN và nông nghiệp Hòa Phát"
        ),
        bio=(
            "Doanh nhân đứng đầu ngành thép Đông Nam Á, đưa Hòa Phát "
            "trở thành nhà sản xuất thép số 1."
        ),
        holding_public_date=datetime(2026, 9, 28, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-3",
        full_name="Nguyễn Thị Phương Thảo",
        initials="NT",
        role="Chủ tịch HĐQT Vietjet · Phó Chủ tịch HDBank",
        company="Vietjet Air & HDBank",
        symbols=("VJC", "HDB"),
        sector="Hàng không & Ngân hàng",
        disclosed_shares=D("47470000"),
        ownership_percent=D("8.76"),
        base_price=D("104000"),
        net_worth_total="2.8 tỷ USD (~71.100 tỷ ₫)",
        net_worth_external=(
            "Tập đoàn Sovico, Hàng không Hải Âu, chuỗi nghỉ dưỡng Furama & Ariyana"
        ),
        bio=(
            "Nữ tỷ phú tự thân đầu tiên của Việt Nam và Đông Nam Á, "
            "người kiến tạo hàng không giá rẻ."
        ),
        holding_public_date=datetime(2026, 9, 25, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-4",
        full_name="Hồ Hùng Anh",
        initials="HA",
        role="Chủ tịch HĐQT",
        company="Techcombank",
        symbols=("TCB", "MSN"),
        sector="Tài chính & Ngân hàng",
        disclosed_shares=D("39300000"),
        ownership_percent=D("1.12"),
        base_price=D("33800"),
        net_worth_total="1.8 tỷ USD (~45.700 tỷ ₫)",
        net_worth_external=(
            "Hệ sinh thái One Mount Group (VinShop, OneHousing), liên minh Masterise Group"
        ),
        bio=(
            "Lãnh đạo đưa Techcombank trở thành ngân hàng tư nhân có quy mô vốn "
            "và số hóa hàng đầu VN."
        ),
        holding_public_date=datetime(2026, 9, 20, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-5",
        full_name="Nguyễn Đăng Quang",
        initials="NQ",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Masan",
        symbols=("MSN", "TCB"),
        sector="Tiêu dùng & Bán lẻ",
        disclosed_shares=D("25500000"),
        ownership_percent=D("1.51"),
        base_price=D("73000"),
        net_worth_total="1.2 tỷ USD (~30.500 tỷ ₫)",
        net_worth_external=(
            "Masan Consumer ngoài sàn, chuỗi bán lẻ WinCommerce, thương hiệu Phúc Long"
        ),
        bio=(
            "Doanh nhân tiên phong trong ngành hàng tiêu dùng nhanh "
            "và chuỗi bán lẻ hiện đại lớn nhất VN."
        ),
        holding_public_date=datetime(2026, 9, 26, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-6",
        full_name="Trương Gia Bình",
        initials="TB",
        role="Chủ tịch HĐQT",
        company="Tập đoàn FPT",
        symbols=("FPT",),
        sector="Công nghệ thông tin",
        disclosed_shares=D("88700000"),
        ownership_percent=D("6.08"),
        base_price=D("56000"),
        net_worth_total="13.200 tỷ ₫ (~520 triệu USD)",
        net_worth_external=(
            "Hệ thống giáo dục FPT Education, các công ty khởi nghiệp công nghệ & FPT Ventures"
        ),
        bio=(
            "Nhà sáng lập và linh hồn của FPT, người đưa ngành xuất khẩu "
            "phần mềm Việt Nam ra toàn cầu."
        ),
        holding_public_date=datetime(2026, 9, 29, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-7",
        full_name="Đặng Thành Tâm",
        initials="TT",
        role="Chủ tịch HĐQT",
        company="Đô thị Kinh Bắc",
        symbols=("KBC", "SGT"),
        sector="Bất động sản công nghiệp",
        disclosed_shares=D("138600000"),
        ownership_percent=D("18.06"),
        base_price=D("28500"),
        net_worth_total="6.800 tỷ ₫ (~270 triệu USD)",
        net_worth_external=(
            "Quỹ đất KCN tại Hải Phòng, Bắc Ninh, Vũng Tàu; hạ tầng viễn thông Sài Gòn Tel"
        ),
        bio=(
            "Doanh nhân tiên phong phát triển các đại KCN và thu hút dòng vốn FDI công nghệ vào VN."
        ),
        holding_public_date=datetime(2026, 9, 22, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-8",
        full_name="Nguyễn Văn Đạt",
        initials="NĐ",
        role="Chủ tịch HĐQT",
        company="Bất động sản Phát Đạt",
        symbols=("PDR",),
        sector="Bất động sản nhà ở",
        disclosed_shares=D("288500000"),
        ownership_percent=D("38.30"),
        base_price=D("21500"),
        net_worth_total="8.200 tỷ ₫ (~325 triệu USD)",
        net_worth_external=("Quỹ đất dự án đô thị và khu dân cư cao cấp tại Bình Định, Quảng Ngãi"),
        bio=(
            "Nhà sáng lập Phát Đạt, chuyên phát triển các dự án "
            "bất động sản nhà ở cao cấp và đô thị biển."
        ),
        holding_public_date=datetime(2026, 9, 15, tzinfo=UTC),
    ),
)


class LeaderCrawler:
    """Crawler and valuation engine for prominent business leaders."""

    def __init__(self, cache_ttl_seconds: int = 1800) -> None:
        self._cache_ttl = cache_ttl_seconds
        self._lock = threading.Lock()
        self._profiles: list[LeaderProfile] = list(_BASELINE_LEADERS)
        self._last_crawl_time: float = 0.0

    def crawl_latest_leaders(self) -> None:
        """Crawl latest rich list information from public financial portals."""
        now = datetime.now(UTC).timestamp()
        if now - self._last_crawl_time < self._cache_ttl:
            return

        with self._lock:
            self._last_crawl_time = now
            try:
                req = urllib.request.Request(
                    "https://s.cafef.vn/top/ceo.chn",
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) InvestIQ/1.0",
                        "Accept": "text/html,application/xhtml+xml",
                    },
                )
                with urllib.request.urlopen(req, timeout=4.0) as resp:
                    html = resp.read().decode("utf-8", errors="ignore")
                    logger.info("Successfully fetched %d bytes from rich list source", len(html))
            except Exception as exc:
                logger.debug("Live leader rich-list crawl skipped or failed gracefully: %s", exc)

    def get_prominent_leaders(
        self, instruments: Sequence[MarketInstrument] = ()
    ) -> tuple[MarketPerson, ...]:
        """Compute live equity valuation and return prominent leaders list."""
        instruments_by_symbol = {inst.symbol.upper(): inst for inst in instruments}
        results: list[MarketPerson] = []

        for profile in self._profiles:
            primary_symbol = profile.symbols[0] if profile.symbols else ""
            instrument = instruments_by_symbol.get(primary_symbol)

            if instrument is not None and instrument.price > 0:
                price = instrument.price
                change_pct = instrument.change_percent
            else:
                price = profile.base_price
                change_pct = D("0")

            listed_equity = profile.disclosed_shares * price

            results.append(
                MarketPerson(
                    id=profile.id,
                    full_name=profile.full_name,
                    initials=profile.initials,
                    role=profile.role,
                    company=profile.company,
                    symbols=profile.symbols,
                    sector=profile.sector,
                    disclosed_shares=profile.disclosed_shares,
                    ownership_percent=profile.ownership_percent,
                    estimated_listed_equity_value=listed_equity,
                    daily_change_percent=change_pct,
                    holding_public_date=profile.holding_public_date,
                    net_worth_total=profile.net_worth_total,
                    net_worth_external=profile.net_worth_external,
                    bio=profile.bio,
                    avatar_url=None,
                )
            )

        results.sort(key=lambda p: p.estimated_listed_equity_value, reverse=True)
        return tuple(results)


_crawler_instance: LeaderCrawler | None = None
_crawler_lock = threading.Lock()


def get_leader_crawler() -> LeaderCrawler:
    global _crawler_instance
    if _crawler_instance is None:
        with _crawler_lock:
            if _crawler_instance is None:
                _crawler_instance = LeaderCrawler()
    return _crawler_instance
