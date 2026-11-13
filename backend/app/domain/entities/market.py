"""Canonical market entities independent from providers and delivery frameworks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Candle:
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


@dataclass(frozen=True, slots=True)
class IntradayTrade:
    timestamp: datetime
    price: Decimal
    volume: Decimal
    match_side: str


@dataclass(frozen=True, slots=True)
class MarketDepthLevel:
    price: Decimal
    volume: Decimal


@dataclass(frozen=True, slots=True)
class MarketInstrument:
    symbol: str
    name: str
    exchange: str
    sector: str
    price: Decimal
    reference_price: Decimal
    ceiling_price: Decimal
    floor_price: Decimal
    open_price: Decimal
    high_price: Decimal
    low_price: Decimal
    volume: Decimal
    matched_value: Decimal
    foreign_net_value: Decimal
    market_cap: Decimal
    pe: Decimal | None
    pb: Decimal | None
    eps: Decimal | None
    roe_percent: Decimal | None
    volume_vs_20d: Decimal
    interest_score: Decimal
    interest_reasons: tuple[str, ...]
    candles: tuple[Candle, ...]
    is_vn30: bool = False
    bid_levels: tuple[MarketDepthLevel, ...] = ()
    ask_levels: tuple[MarketDepthLevel, ...] = ()
    subsector: str = ""

    @property
    def change(self) -> Decimal:
        return self.price - self.reference_price

    @property
    def change_percent(self) -> Decimal:
        if self.reference_price == 0:
            return Decimal("0")
        return self.change * Decimal("100") / self.reference_price


@dataclass(frozen=True, slots=True)
class MarketIndex:
    symbol: str
    name: str
    value: Decimal
    reference_value: Decimal
    open_value: Decimal
    high_value: Decimal
    low_value: Decimal
    volume: Decimal
    matched_value: Decimal
    advances: int
    declines: int
    unchanged: int
    ceiling_count: int
    floor_count: int
    candles: tuple[Candle, ...]

    @property
    def change(self) -> Decimal:
        return self.value - self.reference_value

    @property
    def change_percent(self) -> Decimal:
        if self.reference_value == 0:
            return Decimal("0")
        return self.change * Decimal("100") / self.reference_value


@dataclass(frozen=True, slots=True)
class MarketEvent:
    id: str
    symbol: str
    event_type: str
    title: str
    summary: str
    date_type: str
    event_at: datetime
    status: str
    source_name: str
    source_url: str | None


@dataclass(frozen=True, slots=True)
class MarketPerson:
    id: str
    full_name: str
    initials: str
    role: str
    company: str
    symbols: tuple[str, ...]
    sector: str
    disclosed_shares: Decimal
    ownership_percent: Decimal
    estimated_listed_equity_value: Decimal
    daily_change_percent: Decimal
    holding_public_date: datetime
    net_worth_total: str | None = None
    net_worth_external: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


SUBSECTOR_PARENT_MAP: dict[str, str] = {
    # Tài chính
    "Ngân hàng": "Tài chính",
    "Dịch vụ tài chính": "Tài chính",
    "Bảo hiểm": "Tài chính",
    # Hàng tiêu dùng không thiết yếu
    "Bán lẻ": "Hàng tiêu dùng không thiết yếu",
    "Du lịch và Giải trí": "Hàng tiêu dùng không thiết yếu",
    "Hàng cá nhân & Gia dụng": "Hàng tiêu dùng không thiết yếu",
    "Ô tô và phụ tùng": "Hàng tiêu dùng không thiết yếu",
    # Hàng tiêu dùng thiết yếu
    "Thực phẩm và đồ uống": "Hàng tiêu dùng thiết yếu",
    "Thực phẩm": "Hàng tiêu dùng thiết yếu",
    "Tiêu dùng": "Hàng tiêu dùng thiết yếu",
    # Công nghệ
    "Công nghệ Thông tin": "Công nghệ",
    "Công nghệ thông tin": "Công nghệ",
    # Năng lượng
    "Dầu khí": "Năng lượng",
    # Công nghiệp
    "Hàng & Dịch vụ Công nghiệp": "Công nghiệp",
    # Nguyên vật liệu
    "Hóa chất": "Nguyên vật liệu",
    "Tài nguyên Cơ bản": "Nguyên vật liệu",
    "Tài nguyên cơ bản": "Nguyên vật liệu",
    # Viễn thông
    "Truyền thông": "Viễn thông",
    "Viễn thông": "Viễn thông",
    # Tiện ích
    "Điện, nước & xăng dầu khí đốt": "Tiện ích",
    # Y tế
    "Y tế": "Y tế",
    # Bất động sản
    "Bất động sản": "Bất động sản",
    # Xây dựng và Vật liệu
    "Xây dựng và Vật liệu": "Xây dựng và Vật liệu",
    "Xây dựng": "Xây dựng và Vật liệu",
}


def sector_parent(subsector: str | None) -> str | None:
    """Return the canonical broad parent sector for a given subsector label, if known."""
    if not subsector:
        return None
    raw = subsector.strip()
    parent = SUBSECTOR_PARENT_MAP.get(raw)
    if parent is not None:
        return parent
    folded = raw.casefold()
    for name, p in SUBSECTOR_PARENT_MAP.items():
        if name.casefold() == folded:
            return p
    return None


def resolve_sector_hierarchy(sector: str | None, subsector: str | None = "") -> tuple[str, str]:
    """Resolve an instrument's parent sector and subsector to a consistent hierarchy.

    If the subsector is known, its broad parent is strictly determined by the subsector-to-parent mapping,
    preventing discordant source parent sectors from misclassifying the subgroup.
    If subsector is empty but sector is a known subsector label (e.g. 'Ngân hàng'), sector is promoted
    to subsector and its mapped parent (e.g. 'Tài chính') becomes the broad sector.
    """
    clean_sub = (subsector or "").strip()
    clean_sec = (sector or "").strip()

    if clean_sub:
        parent = sector_parent(clean_sub)
        if parent:
            sub = clean_sub if clean_sub != parent else ""
            return parent, sub

    if clean_sec:
        parent = sector_parent(clean_sec)
        if parent:
            sub = clean_sec if clean_sec != parent else ""
            return parent, sub

    parent = clean_sec or "Chưa phân loại"
    sub = clean_sub if clean_sub != parent else ""
    return parent, sub
