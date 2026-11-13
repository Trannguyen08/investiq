"""Vietnamese stock exchange (HOSE/HNX/UPCoM & VSDC) simulation rules for Paper Trading.

Implements:
- Option B: Dual execution mode ("instant" 24/7 educational mode vs. "exchange_hours" strict mode).
- Improvement 1: VSDC T+2 settlement cycle tracking & cash advance ("Ứng trước tiền bán" at 0.03%/day).
- Improvement 2: Price band (Ceiling/Floor: HOSE +-7%, HNX +-10%, UPCoM +-15%), Tick size (10/50/100 VND),
  and Lot size classification (Even lot 100 shares vs. Odd lot 1-99 shares).
- Improvement 3: 3-level Orderbook depth matching (Bid 1..3 / Ask 1..3), weighted average execution price,
  slippage calculation, and partial fills.
- Improvement 4: Full order types (LO, MP, ATO, ATC) and Anti-Lookahead Quarantine window (60s) for delayed feeds.
- Improvement 5: Automated Conditional Orders (Stop-Loss & Take-Profit triggers).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime, time, timedelta
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.domain.entities.market import MarketInstrument
from app.domain.entities.portfolio import PaperTrade
from app.domain.value_objects.money import decimal_text, round_vnd

ExecutionMode = Literal["instant", "exchange_hours"]
OrderTypeCode = Literal["LO", "MP", "ATO", "ATC"]
LotTypeCode = Literal["even", "odd", "mixed"]

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
ADVANCE_FEE_RATE_PER_DAY = Decimal("0.0003")  # 0.03% / day
ANTI_LOOKAHEAD_QUARANTINE_SECONDS = 60

EXCHANGE_PRICE_BANDS: dict[str, Decimal] = {
    "HOSE": Decimal("0.07"),
    "VN30": Decimal("0.07"),
    "HNX": Decimal("0.10"),
    "UPCOM": Decimal("0.15"),
}


@dataclass(frozen=True)
class LevelFill:
    level: int
    price: Decimal
    quantity: int


@dataclass(frozen=True)
class OrderbookMatchResult:
    can_fill_now: bool
    filled_quantity: int
    unfilled_quantity: int
    execution_price: Decimal
    reference_market_price: Decimal
    slippage_vnd: Decimal
    slippage_bps: Decimal
    lot_type: LotTypeCode
    level_fills: tuple[LevelFill, ...] = ()
    pending_reason: str | None = None


@dataclass
class ConditionalTriggerRecord:
    id: str
    user_id: str
    symbol: str
    stop_loss_price: Decimal | None
    take_profit_price: Decimal | None
    quantity: int | None
    status: Literal["active", "triggered", "cancelled"] = "active"
    trigger_reason: str | None = None
    triggered_trade_id: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    triggered_at: datetime | None = None


@dataclass
class CashAdvanceRecord:
    id: str
    user_id: str
    gross_amount: Decimal
    fee_amount: Decimal
    net_received: Decimal
    days_advanced: int
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class OrderExtendedMeta:
    order_id: str
    display_order_type: OrderTypeCode
    lot_type: LotTypeCode
    slippage_vnd: Decimal = Decimal("0")
    slippage_bps: Decimal = Decimal("0")
    quarantine_until: datetime | None = None
    pending_reason: str | None = None
    stop_loss_price: Decimal | None = None
    take_profit_price: Decimal | None = None


class ExchangeSimulationStore:
    """Thread-safe per-user simulation settings, T+2 cash advances, order metadata, and triggers."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._user_modes: dict[str, ExecutionMode] = {}
        self._order_meta: dict[str, OrderExtendedMeta] = {}
        self._triggers: dict[str, list[ConditionalTriggerRecord]] = {}
        self._advances: dict[str, list[CashAdvanceRecord]] = {}

    def get_mode(self, user_id: str) -> ExecutionMode:
        with self._lock:
            if user_id in self._user_modes:
                return self._user_modes[user_id]

        # Query persistent preference from database
        try:
            from app.infrastructure.db.session import get_pool

            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    "SELECT COALESCE(execution_mode, 'instant') FROM paper_portfolios WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
                if row and row[0] in ("instant", "exchange_hours"):
                    mode: ExecutionMode = row[0]
                    with self._lock:
                        self._user_modes[user_id] = mode
                    return mode
        except Exception:
            pass

        return "instant"

    def set_mode(self, user_id: str, mode: ExecutionMode) -> ExecutionMode:
        with self._lock:
            self._user_modes[user_id] = mode

        # Persist preference to database for user account
        try:
            from app.infrastructure.db.session import get_pool

            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    "UPDATE paper_portfolios SET execution_mode = %s, updated_at = now() WHERE user_id = %s",
                    (mode, user_id),
                )
                conn.commit()
        except Exception:
            pass

        return mode

    def save_order_meta(self, meta: OrderExtendedMeta) -> None:
        with self._lock:
            self._order_meta[meta.order_id] = meta

    def get_order_meta(self, order_id: str) -> OrderExtendedMeta | None:
        with self._lock:
            meta = self._order_meta.get(order_id)
            if meta is not None:
                return meta
        # Return sensible default meta if not in memory (e.g. after server reboot)
        return OrderExtendedMeta(
            order_id=order_id,
            display_order_type="LO",
            lot_type="even",
            slippage_vnd=Decimal("0"),
            slippage_bps=Decimal("0"),
            pending_reason="Ngoài khung giờ giao dịch (09:00 - 11:30 & 13:00 - 14:45). Lệnh được lưu chờ phiên kế tiếp.",
        )

    def upsert_trigger(
        self,
        user_id: str,
        symbol: str,
        stop_loss_price: Decimal | None,
        take_profit_price: Decimal | None,
        quantity: int | None = None,
    ) -> ConditionalTriggerRecord:
        symbol_upper = symbol.strip().upper()
        with self._lock:
            user_list = self._triggers.setdefault(user_id, [])
            for existing in user_list:
                if existing.symbol == symbol_upper and existing.status == "active":
                    existing.stop_loss_price = stop_loss_price
                    existing.take_profit_price = take_profit_price
                    existing.quantity = quantity
                    return existing
            record = ConditionalTriggerRecord(
                id=str(uuid4()),
                user_id=user_id,
                symbol=symbol_upper,
                stop_loss_price=stop_loss_price,
                take_profit_price=take_profit_price,
                quantity=quantity,
            )
            user_list.append(record)
            return record

    def cancel_trigger(self, user_id: str, trigger_id: str) -> bool:
        with self._lock:
            for item in self._triggers.get(user_id, []):
                if item.id == trigger_id and item.status == "active":
                    item.status = "cancelled"
                    return True
            return False

    def list_triggers(self, user_id: str) -> list[ConditionalTriggerRecord]:
        with self._lock:
            return list(self._triggers.get(user_id, []))

    def record_cash_advance(
        self,
        user_id: str,
        gross_amount: Decimal,
        fee_amount: Decimal,
        net_received: Decimal,
        days_advanced: int,
    ) -> CashAdvanceRecord:
        rec_id = str(uuid4())
        rec = CashAdvanceRecord(
            id=rec_id,
            user_id=user_id,
            gross_amount=gross_amount,
            fee_amount=fee_amount,
            net_received=net_received,
            days_advanced=days_advanced,
        )
        with self._lock:
            self._advances.setdefault(user_id, []).append(rec)

        try:
            from app.infrastructure.db.session import get_pool

            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO paper_cash_advances (id, user_id, gross_amount, fee_amount, net_received, days_advanced, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (
                        rec_id,
                        user_id,
                        gross_amount,
                        fee_amount,
                        net_received,
                        days_advanced,
                        rec.created_at,
                    ),
                )
                conn.commit()
        except Exception:
            pass
        return rec

    def list_cash_advances(self, user_id: str) -> list[CashAdvanceRecord]:
        with self._lock:
            if user_id in self._advances:
                return list(self._advances[user_id])

        records: list[CashAdvanceRecord] = []
        try:
            from app.infrastructure.db.session import get_pool

            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """SELECT id::text, user_id::text, gross_amount, fee_amount, net_received, days_advanced, created_at
                       FROM paper_cash_advances WHERE user_id = %s ORDER BY created_at ASC""",
                    (user_id,),
                )
                for row in cur.fetchall():
                    records.append(
                        CashAdvanceRecord(
                            id=str(row[0]),
                            user_id=str(row[1]),
                            gross_amount=Decimal(str(row[2])),
                            fee_amount=Decimal(str(row[3])),
                            net_received=Decimal(str(row[4])),
                            days_advanced=int(row[5]),
                            created_at=row[6],
                        )
                    )
        except Exception:
            pass

        with self._lock:
            self._advances[user_id] = records
        return list(records)

    def reset_user(self, user_id: str) -> None:
        with self._lock:
            self._user_modes.pop(user_id, None)
            self._triggers.pop(user_id, None)
            self._advances.pop(user_id, None)
        try:
            from app.infrastructure.db.session import get_pool

            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute("DELETE FROM paper_cash_advances WHERE user_id = %s", (user_id,))
                conn.commit()
        except Exception:
            pass


_GLOBAL_SIM_STORE = ExchangeSimulationStore()


def get_exchange_simulation_store() -> ExchangeSimulationStore:
    return _GLOBAL_SIM_STORE


def get_tick_size(exchange: str, price: Decimal) -> Decimal:
    """Return the official Vietnamese exchange tick size for a price level."""
    ex = exchange.upper()
    # Support both full VND (e.g., 28500) and thousand-VND fixture notation (e.g., 28.50)
    is_thousand_unit = price < Decimal("1000")
    if ex in {"HOSE", "VN30"}:
        if is_thousand_unit:
            if price < Decimal("10"):
                return Decimal("0.01")
            if price < Decimal("50"):
                return Decimal("0.05")
            return Decimal("0.10")
        if price < Decimal("10000"):
            return Decimal("10")
        if price < Decimal("50000"):
            return Decimal("50")
        return Decimal("100")
    # HNX & UPCoM use 100 VND (or 0.10 in thousand-VND unit)
    return Decimal("0.10") if is_thousand_unit else Decimal("100")


def calculate_price_band(instrument: MarketInstrument) -> tuple[Decimal, Decimal]:
    """Return (floor_price, ceiling_price) for the given instrument."""
    if instrument.floor_price > 0 and instrument.ceiling_price > 0:
        return instrument.floor_price, instrument.ceiling_price
    ref = instrument.reference_price if instrument.reference_price > 0 else instrument.price
    band = EXCHANGE_PRICE_BANDS.get(instrument.exchange.upper(), Decimal("0.07"))
    tick = get_tick_size(instrument.exchange, ref)
    raw_floor = ref * (Decimal("1") - band)
    raw_ceiling = ref * (Decimal("1") + band)
    floor_price = (raw_floor / tick).to_integral_value(rounding=ROUND_CEILING) * tick
    ceiling_price = (raw_ceiling / tick).to_integral_value(rounding=ROUND_FLOOR) * tick
    return floor_price, ceiling_price


def classify_lot_type(quantity: int) -> LotTypeCode:
    if quantity <= 0:
        return "mixed"
    if quantity % 100 == 0:
        return "even"
    if 1 <= quantity <= 99:
        return "odd"
    return "mixed"


def is_within_exchange_trading_hours(
    now: datetime,
    provider_session: str,
    order_type: OrderTypeCode = "LO",
) -> tuple[bool, str]:
    """Check if the order can be matched immediately under real HOSE/HNX session hours."""
    local = now.astimezone(_MARKET_TZ)
    if local.weekday() >= 5:
        return (
            False,
            "Thị trường nghỉ cuối tuần (Thứ Bảy / Chủ Nhật). Lệnh được lưu chờ phiên sáng Thứ Hai.",
        )

    t = local.time()
    morning_open = time(9, 0)
    ato_end = time(9, 15)
    morning_close = time(11, 30)
    afternoon_open = time(13, 0)
    atc_start = time(14, 30)
    afternoon_close = time(14, 45)

    sess = provider_session.lower()
    if sess in {"lunch_break", "intermission"} or (morning_close < t < afternoon_open):
        return (
            False,
            "Thị trường đang nghỉ giữa phiên (11:30 - 13:00). Lệnh được lưu chờ phiên chiều.",
        )

    if order_type == "ATO":
        if morning_open <= t <= ato_end:
            return True, "Đang trong phiên khớp lệnh định kỳ mở cửa (ATO 09:00 - 09:15)."
        if t < morning_open:
            return False, "Lệnh ATO đã được tiếp nhận và chờ khớp vào phiên mở cửa (09:00 - 09:15)."
        return False, "Đã qua phiên ATO (09:00 - 09:15). Lệnh được lưu chờ phiên ATO ngày kế tiếp."

    if order_type == "ATC":
        if atc_start <= t <= afternoon_close:
            return True, "Đang trong phiên khớp lệnh định kỳ đóng cửa (ATC 14:30 - 14:45)."
        if t < atc_start:
            return (
                False,
                "Lệnh ATC đã được tiếp nhận và chờ khớp vào phiên đóng cửa (14:30 - 14:45).",
            )
        return False, "Đã qua phiên ATC (14:30 - 14:45). Lệnh được lưu chờ phiên kế tiếp."

    if (morning_open <= t <= morning_close) or (afternoon_open <= t <= afternoon_close):
        if sess == "closed":
            return (
                False,
                "Phiên giao dịch hiện tại đang đóng (Provider: closed). Lệnh được lưu vào sổ lệnh chờ.",
            )
        return True, "Đang trong phiên giao dịch khớp lệnh liên tục."

    return (
        False,
        "Ngoài khung giờ giao dịch (09:00 - 11:30 & 13:00 - 14:45). Lệnh được lưu chờ phiên kế tiếp.",
    )


def validate_vietnam_exchange_rules(
    *,
    side: str,
    order_type: OrderTypeCode,
    quantity: int,
    limit_price: Decimal,
    instrument: MarketInstrument,
    strict_rules: bool,
) -> tuple[bool, str | None, str | None]:
    """Validate lot size, price band (Ceiling/Floor), and tick size.

    Returns (is_valid, error_code, error_message).
    """
    lot_type = classify_lot_type(quantity)
    if strict_rules and lot_type == "mixed":
        return (
            False,
            "MIXED_LOT_NOT_ALLOWED",
            f"Sàn {instrument.exchange} quy định lô chẵn là bội số của 100 CP (100, 200, 300...) "
            f"và lô lẻ từ 1 đến 99 CP. Không thể gộp {quantity} CP trong cùng một lệnh.",
        )

    if strict_rules and lot_type == "odd" and order_type != "LO":
        return (
            False,
            "ODD_LOT_ONLY_LO",
            "Giao dịch lô lẻ (1 - 99 CP) trên sàn chỉ hỗ trợ duy nhất loại lệnh giới hạn (LO).",
        )

    if order_type == "LO" and strict_rules:
        floor_price, ceiling_price = calculate_price_band(instrument)
        if (
            floor_price > 0
            and ceiling_price > 0
            and (limit_price < floor_price or limit_price > ceiling_price)
        ):
            return (
                False,
                "PRICE_OUT_OF_BAND",
                f"Giá đặt lệnh ({decimal_text(limit_price)}) nằm ngoài biên độ Trần - Sàn trong ngày "
                f"[{decimal_text(floor_price)} - {decimal_text(ceiling_price)}] của sàn {instrument.exchange}.",
            )

        tick = get_tick_size(instrument.exchange, limit_price)
        if tick > 0 and (limit_price % tick) != Decimal("0"):
            nearest_valid = (limit_price / tick).to_integral_value(rounding=ROUND_FLOOR) * tick
            return (
                False,
                "INVALID_TICK_SIZE",
                f"Giá đặt ({decimal_text(limit_price)}) không đúng bước giá quy định ({decimal_text(tick)}) "
                f"của sàn {instrument.exchange}. Gợi ý mức giá hợp lệ gần nhất: {decimal_text(nearest_valid)}.",
            )

    return True, None, None


def match_against_orderbook(
    *,
    side: str,
    order_type: OrderTypeCode,
    quantity: int,
    limit_price: Decimal,
    instrument: MarketInstrument,
    execution_mode: ExecutionMode,
    use_orderbook_depth: bool = False,
) -> OrderbookMatchResult:
    """Match an order against the 3-level orderbook depth (or top-of-book observed price)."""
    lot_type = classify_lot_type(quantity)
    base_price = instrument.price

    # In default "instant" educational mode without explicit orderbook depth sweep,
    # preserve exact full fill at instrument.price for 100% compatibility with beginner flow.
    if execution_mode == "instant" and not use_orderbook_depth and order_type == "LO":
        return OrderbookMatchResult(
            can_fill_now=True,
            filled_quantity=quantity,
            unfilled_quantity=0,
            execution_price=base_price,
            reference_market_price=base_price,
            slippage_vnd=Decimal("0"),
            slippage_bps=Decimal("0"),
            lot_type=lot_type,
            level_fills=(LevelFill(level=1, price=base_price, quantity=quantity),),
        )

    tick = get_tick_size(instrument.exchange, base_price)
    floor_price, ceiling_price = calculate_price_band(instrument)

    # Build 3 levels of resting liquidity on the opposite side of the book
    levels: list[tuple[Decimal, int]] = []
    if side == "buy":
        if instrument.ask_levels:
            for lvl in instrument.ask_levels[:3]:
                if lvl.price > 0 and lvl.volume > 0:
                    levels.append((lvl.price, int(lvl.volume)))
        if not levels:
            p1 = base_price
            p2 = min(ceiling_price, base_price + tick) if ceiling_price > 0 else base_price + tick
            p3 = (
                min(ceiling_price, base_price + tick * 2)
                if ceiling_price > 0
                else base_price + tick * 2
            )
            levels = [(p1, 2000), (p2, 3000), (p3, 5000)]
    else:
        if instrument.bid_levels:
            for lvl in instrument.bid_levels[:3]:
                if lvl.price > 0 and lvl.volume > 0:
                    levels.append((lvl.price, int(lvl.volume)))
        if not levels:
            p1 = base_price
            p2 = (
                max(floor_price, base_price - tick)
                if floor_price > 0
                else max(tick, base_price - tick)
            )
            p3 = (
                max(floor_price, base_price - tick * 2)
                if floor_price > 0
                else max(tick, base_price - tick * 2)
            )
            levels = [(p1, 2000), (p2, 3000), (p3, 5000)]

    # Check if LO order is marketable against Best Ask / Best Bid
    best_opposite_price = levels[0][0]
    if order_type == "LO":
        if side == "buy" and limit_price < best_opposite_price:
            return OrderbookMatchResult(
                can_fill_now=False,
                filled_quantity=0,
                unfilled_quantity=quantity,
                execution_price=limit_price,
                reference_market_price=best_opposite_price,
                slippage_vnd=Decimal("0"),
                slippage_bps=Decimal("0"),
                lot_type=lot_type,
                pending_reason=(
                    f"Lệnh mua LO giá {decimal_text(limit_price)} thấp hơn giá chào bán tốt nhất "
                    f"({decimal_text(best_opposite_price)}). Đang xếp hàng chờ khớp trên sổ lệnh."
                ),
            )
        if side == "sell" and limit_price > best_opposite_price:
            return OrderbookMatchResult(
                can_fill_now=False,
                filled_quantity=0,
                unfilled_quantity=quantity,
                execution_price=limit_price,
                reference_market_price=best_opposite_price,
                slippage_vnd=Decimal("0"),
                slippage_bps=Decimal("0"),
                lot_type=lot_type,
                pending_reason=(
                    f"Lệnh bán LO giá {decimal_text(limit_price)} cao hơn giá chào mua tốt nhất "
                    f"({decimal_text(best_opposite_price)}). Đang xếp hàng chờ khớp trên sổ lệnh."
                ),
            )

    # Sweep across eligible orderbook levels
    remaining = quantity
    total_cost = Decimal("0")
    fills: list[LevelFill] = []

    for idx, (lvl_price, lvl_vol) in enumerate(levels, start=1):
        if remaining <= 0:
            break
        if order_type == "LO":
            if side == "buy" and lvl_price > limit_price:
                break
            if side == "sell" and lvl_price < limit_price:
                break
        take_qty = min(remaining, lvl_vol) if use_orderbook_depth else remaining
        if take_qty > 0:
            fills.append(LevelFill(level=idx, price=lvl_price, quantity=take_qty))
            total_cost += lvl_price * Decimal(take_qty)
            remaining -= take_qty

    filled_qty = quantity - remaining
    if filled_qty <= 0:
        return OrderbookMatchResult(
            can_fill_now=False,
            filled_quantity=0,
            unfilled_quantity=quantity,
            execution_price=limit_price,
            reference_market_price=best_opposite_price,
            slippage_vnd=Decimal("0"),
            slippage_bps=Decimal("0"),
            lot_type=lot_type,
            pending_reason="Chưa đủ thanh khoản đối ứng tại mức giá yêu cầu.",
        )

    avg_price = (total_cost / Decimal(filled_qty)).quantize(Decimal("0.01"))
    slippage_vnd = abs(avg_price - best_opposite_price).quantize(Decimal("0.01"))
    slippage_bps = (
        (slippage_vnd / best_opposite_price * Decimal("10000")).quantize(Decimal("0.1"))
        if best_opposite_price > 0
        else Decimal("0")
    )

    return OrderbookMatchResult(
        can_fill_now=True,
        filled_quantity=filled_qty,
        unfilled_quantity=remaining,
        execution_price=avg_price,
        reference_market_price=best_opposite_price,
        slippage_vnd=slippage_vnd,
        slippage_bps=slippage_bps,
        lot_type=lot_type,
        level_fills=tuple(fills),
        pending_reason=(
            f"Đã khớp một phần {filled_qty}/{quantity} CP qua {len(fills)} bước giá; "
            f"phần dư {remaining} CP đang treo chờ khớp tiếp."
            if remaining > 0
            else None
        ),
    )


def compute_t2_settlement_date(trade_time: datetime) -> datetime:
    """Compute VSDC T+2 settlement time (13:00 Asia/Ho_Chi_Minh on business day T+2)."""
    local = trade_time.astimezone(_MARKET_TZ)
    current_date = local.date()
    business_days_added = 0
    while business_days_added < 2:
        current_date += timedelta(days=1)
        if current_date.weekday() < 5:
            business_days_added += 1
    settled_local = datetime.combine(current_date, time(13, 0), tzinfo=_MARKET_TZ)
    return settled_local.astimezone(UTC)


def build_t2_settlement_summary(
    user_id: str,
    trades: tuple[PaperTrade, ...],
    now: datetime | None = None,
    store: ExchangeSimulationStore | None = None,
) -> dict[str, object]:
    """Calculate pending T+2 buy shares and T+2 receivable sell cash + cash advance availability."""
    current_time = now or datetime.now(UTC)
    sim_store = store or _GLOBAL_SIM_STORE

    pending_buys: list[dict[str, object]] = []
    pending_sells: list[dict[str, object]] = []
    pending_shares_by_symbol: dict[str, int] = {}
    total_receivable_cash = Decimal("0")
    max_days_remaining = 1

    for trade in trades:
        settle_at = compute_t2_settlement_date(trade.created_at)
        if settle_at > current_time:
            days_left = max(1, min(3, (settle_at.date() - current_time.date()).days or 1))
            if trade.side == "buy":
                pending_shares_by_symbol[trade.symbol] = (
                    pending_shares_by_symbol.get(trade.symbol, 0) + trade.quantity
                )
                pending_buys.append(
                    {
                        "trade_id": trade.id,
                        "symbol": trade.symbol,
                        "quantity": trade.quantity,
                        "execution_price": decimal_text(trade.execution_price),
                        "trade_at": trade.created_at.isoformat().replace("+00:00", "Z"),
                        "settles_at": settle_at.isoformat().replace("+00:00", "Z"),
                        "cycle": f"T+{2 - min(1, days_left - 1)}",
                    }
                )
            else:
                net_proceeds = max(Decimal("0"), trade.cash_effect)
                total_receivable_cash += net_proceeds
                max_days_remaining = max(max_days_remaining, days_left)
                pending_sells.append(
                    {
                        "trade_id": trade.id,
                        "symbol": trade.symbol,
                        "quantity": trade.quantity,
                        "net_proceeds": decimal_text(net_proceeds),
                        "trade_at": trade.created_at.isoformat().replace("+00:00", "Z"),
                        "settles_at": settle_at.isoformat().replace("+00:00", "Z"),
                        "days_remaining": days_left,
                    }
                )

    advances = sim_store.list_cash_advances(user_id)
    # Only count advances created within the last 2 days against current pending receivables
    cutoff = current_time - timedelta(days=3)
    recent_advances = [a for a in advances if a.created_at >= cutoff]
    already_advanced = sum((a.gross_amount for a in recent_advances), Decimal("0"))
    advanceable_cash = max(Decimal("0"), total_receivable_cash - already_advanced)
    estimated_fee = round_vnd(
        advanceable_cash * ADVANCE_FEE_RATE_PER_DAY * Decimal(max_days_remaining)
    )

    return {
        "cycle_rule": "T+2 (Chuẩn VSDC Việt Nam - Cổ phiếu & Tiền về lúc 13:00 ngày T+2)",
        "advance_fee_rate_per_day": decimal_text(ADVANCE_FEE_RATE_PER_DAY),
        "pending_buy_shares_by_symbol": pending_shares_by_symbol,
        "pending_buy_settlements": pending_buys[:15],
        "pending_sell_settlements": pending_sells[:15],
        "receivable_cash_t2": decimal_text(advanceable_cash),
        "gross_receivable_cash_t2": decimal_text(total_receivable_cash),
        "already_advanced_cash": decimal_text(already_advanced),
        "advanceable_cash": decimal_text(advanceable_cash),
        "estimated_advance_fee": decimal_text(estimated_fee),
        "net_advance_available": decimal_text(max(Decimal("0"), advanceable_cash - estimated_fee)),
        "recent_advances": [
            {
                "id": a.id,
                "gross_amount": decimal_text(a.gross_amount),
                "fee_amount": decimal_text(a.fee_amount),
                "net_received": decimal_text(a.net_received),
                "days_advanced": a.days_advanced,
                "created_at": a.created_at.isoformat().replace("+00:00", "Z"),
            }
            for a in reversed(recent_advances[-10:])
        ],
    }
