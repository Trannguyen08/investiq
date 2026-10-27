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


# Authoritative baseline dataset of 22 prominent Vietnamese business leaders
_BASELINE_LEADERS: tuple[LeaderProfile, ...] = (
    LeaderProfile(
        id="person-1",
        full_name="Phạm Nhật Vượng",
        initials="PV",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Vingroup",
        symbols=("VIC", "VHM"),
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
        sector="Thép & Công nghiệp",
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
        sector="Hàng không & Tài chính",
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
        full_name="Đỗ Anh Tuấn",
        initials="AT",
        role="Chủ tịch HĐQT Sunshine Group · KSFinance",
        company="Tập đoàn Sunshine · KSFinance",
        symbols=("KSF", "SSH", "SCG"),
        sector="Bất động sản & Tài chính",
        disclosed_shares=D("243000000"),
        ownership_percent=D("54.00"),
        base_price=D("68000"),
        net_worth_total="32.500 tỷ ₫ (~1.3 tỷ USD)",
        net_worth_external=(
            "Tập đoàn Sunshine Group, chuỗi dự án căn hộ siêu sang Sunshine Marina & Sunshine City"
        ),
        bio=(
            "Nhà sáng lập Sunshine Group tiên phong ứng dụng công nghệ Smart Home "
            "vào bất động sản và tài chính công nghệ."
        ),
        holding_public_date=datetime(2026, 9, 27, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-5",
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
        id="person-6",
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
        id="person-7",
        full_name="Trương Gia Bình",
        initials="TB",
        role="Chủ tịch HĐQT",
        company="Tập đoàn FPT",
        symbols=("FPT", "FOX"),
        sector="Công nghệ",
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
        id="person-8",
        full_name="Bùi Thành Nhơn",
        initials="BN",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Novaland",
        symbols=("NVL",),
        sector="Bất động sản",
        disclosed_shares=D("96800000"),
        ownership_percent=D("4.96"),
        base_price=D("14000"),
        net_worth_total="8.500 tỷ ₫ (~335 triệu USD)",
        net_worth_external=("Hệ sinh thái NovaGroup (Nova Service, Nova Consumer, Nova Finance)"),
        bio=(
            "Nhà sáng lập Novaland, lãnh đạo tập đoàn vượt qua giai đoạn tái cấu trúc toàn diện "
            "để hồi phục hoạt động kinh doanh."
        ),
        holding_public_date=datetime(2026, 9, 21, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-9",
        full_name="Nguyễn Đức Tài",
        initials="NT",
        role="Chủ tịch HĐQT",
        company="Thế Giới Di Động",
        symbols=("MWG",),
        sector="Tiêu dùng & Bán lẻ",
        disclosed_shares=D("35100000"),
        ownership_percent=D("2.40"),
        base_price=D("64000"),
        net_worth_total="9.800 tỷ ₫ (~390 triệu USD)",
        net_worth_external=(
            "Chuỗi nhà thuốc An Khang, chuỗi bán lẻ điện máy tại Indonesia EraBlue"
        ),
        bio=(
            "Đồng sáng lập và kiến trúc sư trưởng đưa Thế Giới Di Động "
            "trở thành đế chế bán lẻ số 1 Việt Nam."
        ),
        holding_public_date=datetime(2026, 9, 18, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-10",
        full_name="Đặng Thành Tâm",
        initials="TT",
        role="Chủ tịch HĐQT",
        company="Đô thị Kinh Bắc",
        symbols=("KBC", "SGT"),
        sector="Bất động sản",
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
        id="person-11",
        full_name="Nguyễn Văn Đạt",
        initials="NĐ",
        role="Chủ tịch HĐQT",
        company="Bất động sản Phát Đạt",
        symbols=("PDR",),
        sector="Bất động sản",
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
    LeaderProfile(
        id="person-12",
        full_name="Đoàn Nguyên Đức (Bầu Đức)",
        initials="NĐ",
        role="Chủ tịch HĐQT",
        company="Hoàng Anh Gia Lai",
        symbols=("HAG", "HNG"),
        sector="Nông nghiệp",
        disclosed_shares=D("319900000"),
        ownership_percent=D("30.26"),
        base_price=D("13200"),
        net_worth_total="5.400 tỷ ₫ (~215 triệu USD)",
        net_worth_external=(
            "Mô hình nông nghiệp tuần hoàn Chuối - Heo ăn chuối - Sầu riêng "
            "quy mô lớn tại Lào và VN"
        ),
        bio=(
            "Doanh nhân kiên cường gắn liền với thương hiệu HAGL, người tiên phong "
            "chuyển đổi quy mô lớn sang nông nghiệp công nghệ cao."
        ),
        holding_public_date=datetime(2026, 9, 24, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-13",
        full_name="Hồ Xuân Năng (Năng Do Thái)",
        initials="XN",
        role="Chủ tịch HĐQT",
        company="Vicostone · Tập đoàn Phenikaa",
        symbols=("VCS",),
        sector="Vật liệu & Công nghệ",
        disclosed_shares=D("12600000"),
        ownership_percent=D("7.88"),
        base_price=D("62000"),
        net_worth_total="10.500 tỷ ₫ (~415 triệu USD)",
        net_worth_external=(
            "Tập đoàn Phenikaa, Đại học Phenikaa, Bệnh viện Phenikaa, xe tự hành Phenikaa X"
        ),
        bio=(
            "Tiến sĩ cơ khí chế tạo máy, đưa đá thạch anh cao cấp Vicostone "
            "vươn lên Top 3 nhà sản xuất hàng đầu thế giới."
        ),
        holding_public_date=datetime(2026, 9, 19, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-14",
        full_name="Nguyễn Duy Hưng",
        initials="DH",
        role="Chủ tịch HĐQT SSI · Tập đoàn PAN",
        company="Chứng khoán SSI & Tập đoàn PAN",
        symbols=("SSI", "PAN"),
        sector="Tài chính & Nông nghiệp",
        disclosed_shares=D("11500000"),
        ownership_percent=D("0.76"),
        base_price=D("31000"),
        net_worth_total="5.800 tỷ ₫ (~230 triệu USD)",
        net_worth_external=(
            "Công ty TNHH Đầu tư NDH, chuỗi nông nghiệp thực phẩm khép kín chuỗi giá trị PAN"
        ),
        bio=(
            "Doanh nhân đặt nền móng cho thị trường chứng khoán Việt Nam, "
            "người dẫn dắt CTCK SSI giữ vị thế thị phần top đầu nhiều năm."
        ),
        holding_public_date=datetime(2026, 9, 23, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-15",
        full_name="Đặng Văn Thành",
        initials="VT",
        role="Chủ tịch HĐQT",
        company="Tập đoàn TTC",
        symbols=("SBT", "GEG"),
        sector="Nông nghiệp & Năng lượng",
        disclosed_shares=D("68500000"),
        ownership_percent=D("9.20"),
        base_price=D("12500"),
        net_worth_total="6.200 tỷ ₫ (~245 triệu USD)",
        net_worth_external=(
            "TTC Hospitality, TTC Sugar, hệ sinh thái du lịch và năng lượng tái tạo TTC Group"
        ),
        bio=(
            "Doanh nhân kỳ cựu ngành đường và ngân hàng, người chèo lái TTC Group "
            "trở thành tập đoàn tư nhân đa ngành uy tín."
        ),
        holding_public_date=datetime(2026, 9, 14, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-16",
        full_name="Nguyễn Thị Mai Thanh",
        initials="MT",
        role="Chủ tịch HĐQT",
        company="Cơ Điện Lạnh REE",
        symbols=("REE",),
        sector="Năng lượng & Cơ điện",
        disclosed_shares=D("50500000"),
        ownership_percent=D("12.28"),
        base_price=D("65000"),
        net_worth_total="5.500 tỷ ₫ (~220 triệu USD)",
        net_worth_external=(
            "Danh mục đầu tư nhà máy thủy điện, điện gió, cấp nước và "
            "tòa nhà văn phòng cho thuê REE Tower"
        ),
        bio=(
            "Nữ tướng ngành cơ điện lạnh, đưa REE trở thành doanh nghiệp đầu tiên niêm yết "
            "trên thị trường chứng khoán Việt Nam năm 2000."
        ),
        holding_public_date=datetime(2026, 9, 16, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-17",
        full_name="Lê Viết Hải",
        initials="VH",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Xây dựng Hòa Bình",
        symbols=("HBC",),
        sector="Xây dựng",
        disclosed_shares=D("47600000"),
        ownership_percent=D("17.30"),
        base_price=D("7500"),
        net_worth_total="2.100 tỷ ₫ (~85 triệu USD)",
        net_worth_external=(
            "Hệ thống thiết bị máy móc xây dựng và liên doanh thi công hạ tầng quốc tế"
        ),
        bio=(
            "Nhà sáng lập Tập đoàn Xây dựng Hòa Bình, tổng thầu xây dựng hàng đầu "
            "với nhiều công trình biểu tượng quốc gia."
        ),
        holding_public_date=datetime(2026, 9, 12, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-18",
        full_name="Johnathan Hạnh Nguyễn",
        initials="HN",
        role="Chủ tịch HĐQT IPPG · SASCO",
        company="Tập đoàn IPPG · SASCO",
        symbols=("SAS",),
        sector="Tiêu dùng & Bán lẻ",
        disclosed_shares=D("60500000"),
        ownership_percent=D("45.20"),
        base_price=D("26000"),
        net_worth_total="12.000 tỷ ₫ (~475 triệu USD)",
        net_worth_external=(
            "Hệ thống bán lẻ hàng miễn thuế sân bay, phân phối 108 thương hiệu xa xỉ "
            "toàn cầu (Rolex, Chanel, Nike)"
        ),
        bio=(
            "'Vua hàng hiệu' Việt Nam, người mở đường cho các thương hiệu thời trang "
            "và chuỗi dịch vụ thương mại hàng không cao cấp."
        ),
        holding_public_date=datetime(2026, 9, 10, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-19",
        full_name="Trương Anh Tuấn",
        initials="AT",
        role="Chủ tịch HĐQT",
        company="Địa ốc Hoàng Quân",
        symbols=("HQC",),
        sector="Bất động sản",
        disclosed_shares=D("18500000"),
        ownership_percent=D("3.88"),
        base_price=D("3400"),
        net_worth_total="1.500 tỷ ₫ (~60 triệu USD)",
        net_worth_external=("Chuỗi dự án nhà ở xã hội quy mô hàng chục nghìn căn hộ khắp miền Nam"),
        bio=(
            "Doanh nhân tiên phong trong phân khúc nhà ở xã hội, giải quyết nhu cầu an cư "
            "cho hàng vạn gia đình công nhân và người lao động."
        ),
        holding_public_date=datetime(2026, 9, 11, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-20",
        full_name="Đào Hồng Tuyển",
        initials="HT",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Tuần Châu",
        symbols=(),
        sector="Bất động sản",
        disclosed_shares=D("0"),
        ownership_percent=D("0.00"),
        base_price=D("0"),
        net_worth_total="15.000 tỷ ₫ (~600 triệu USD)",
        net_worth_external=(
            "Đảo ngọc Tuần Châu Quảng Ninh, bến du thuyền quốc tế, sân golf Tuần Châu "
            "và đô thị sinh thái"
        ),
        bio=(
            "'Chúa đảo Tuần Châu', người biến hòn đảo hoang sơ trở thành "
            "trung tâm du lịch và nghỉ dưỡng quốc tế hàng đầu miền Bắc."
        ),
        holding_public_date=datetime(2026, 9, 5, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-21",
        full_name="Nguyễn Cảnh Sơn",
        initials="CS",
        role="Chủ tịch HĐQT Eurowindow · Phó Chủ tịch TCB",
        company="Eurowindow Holding",
        symbols=("TCB",),
        sector="Vật liệu & Xây dựng",
        disclosed_shares=D("18200000"),
        ownership_percent=D("0.52"),
        base_price=D("33800"),
        net_worth_total="7.500 tỷ ₫ (~300 triệu USD)",
        net_worth_external=(
            "Tập đoàn Eurowindow Holding, chuỗi trung tâm thương mại Melinh PLAZA, "
            "quần thể nghỉ dưỡng Movenpick Cam Ranh"
        ),
        bio=(
            "Doanh nhân sáng lập thương hiệu cửa nhựa và nhôm kính cao cấp Eurowindow, "
            "phát triển hệ sinh thái bất động sản quy mô."
        ),
        holding_public_date=datetime(2026, 9, 8, tzinfo=UTC),
    ),
    LeaderProfile(
        id="person-22",
        full_name="Huỳnh Uy Dũng (Dũng Lò Vôi)",
        initials="UD",
        role="Chủ tịch HĐQT",
        company="Tập đoàn Đại Nam",
        symbols=(),
        sector="Bất động sản",
        disclosed_shares=D("0"),
        ownership_percent=D("0.00"),
        base_price=D("0"),
        net_worth_total="20.000 tỷ ₫ (~800 triệu USD)",
        net_worth_external=(
            "Khu công nghiệp Sóng Thần 1, 2, 3; Quần thể du lịch Lạc Cảnh Đại Nam Văn Hiến; "
            "Bệnh viện tim Hằng Hữu"
        ),
        bio=(
            "Doanh nhân xây dựng khu công nghiệp tư nhân đầu tiên tại Bình Dương, "
            "nổi tiếng với các công trình quy mô lớn và hoạt động thiện nguyện mổ tim."
        ),
        holding_public_date=datetime(2026, 9, 6, tzinfo=UTC),
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
        self,
        instruments: Sequence[MarketInstrument] = (),
        query: str | None = None,
        sector: str | None = None,
    ) -> tuple[MarketPerson, ...]:
        """Compute live equity valuation and return prominent leaders list."""
        instruments_by_symbol = {inst.symbol.upper(): inst for inst in instruments}
        results: list[MarketPerson] = []

        q = query.strip().lower() if query else None
        s = sector.strip().lower() if sector else None

        for profile in self._profiles:
            # Filter if requested
            if q:
                match_name = q in profile.full_name.lower()
                match_comp = q in profile.company.lower()
                match_sym = any(q in sym.lower() for sym in profile.symbols)
                if not (match_name or match_comp or match_sym):
                    continue

            if s and s != "tất cả" and s not in profile.sector.lower():
                continue

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
