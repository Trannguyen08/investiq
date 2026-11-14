"""Paper-trading orchestration and valuation."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from time import monotonic as _monotonic
from typing import cast
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.exchange_simulator import (
    ADVANCE_FEE_RATE_PER_DAY,
    ANTI_LOOKAHEAD_QUARANTINE_SECONDS,
    ExchangeSimulationStore,
    ExecutionMode,
    OrderExtendedMeta,
    OrderTypeCode,
    build_t2_settlement_summary,
    classify_lot_type,
    get_exchange_simulation_store,
    is_within_exchange_trading_hours,
    match_against_orderbook,
    validate_vietnam_exchange_rules,
)
from app.domain.entities.market import Candle, MarketInstrument
from app.domain.entities.portfolio import PaperOrder, PaperPortfolio, PaperTrade
from app.domain.repositories.i_market_provider import IMarketProvider
from app.domain.repositories.i_portfolio_repository import (
    IPortfolioRepository,
    PaperExecution,
    PaperOrderSubmission,
)
from app.domain.value_objects.money import decimal_text, round_vnd

STARTING_CASH = Decimal("100000000")
BROKER_FEE_RATE = Decimal("0.0015")
SELL_TAX_RATE = Decimal("0.001")
MAX_HOLDINGS = 20
_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
SUPPORTED_ORDER_TYPES: set[str] = {"LO", "MP", "ATO", "ATC"}


class PaperOrderError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _market_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _trade_payload(trade: PaperTrade) -> dict[str, object]:
    return {
        "id": trade.id,
        "side": trade.side,
        "symbol": trade.symbol,
        "name": trade.name,
        "exchange": trade.exchange,
        "quantity": trade.quantity,
        "execution_price": decimal_text(trade.execution_price),
        "gross_amount": decimal_text(trade.gross_amount),
        "fee_amount": decimal_text(trade.fee_amount),
        "tax_amount": decimal_text(trade.tax_amount),
        "cash_effect": decimal_text(trade.cash_effect),
        "realized_pnl": (
            decimal_text(trade.realized_pnl) if trade.realized_pnl is not None else None
        ),
        "provider": trade.provider,
        "price_at": _iso(trade.price_at),
        "received_at": _iso(trade.received_at),
        "delay_class": trade.delay_class,
        "created_at": _iso(trade.created_at),
    }


def _order_payload(order: PaperOrder) -> dict[str, object]:
    return {
        "id": order.id,
        "side": order.side,
        "order_type": order.order_type,
        "status": order.status,
        "symbol": order.symbol,
        "name": order.name,
        "exchange": order.exchange,
        "quantity": order.quantity,
        "filled_quantity": order.filled_quantity,
        "limit_price": decimal_text(order.limit_price),
        "reserved_cash": decimal_text(order.reserved_cash),
        "reserved_quantity": order.reserved_quantity,
        "provider": order.provider,
        "price_at": _iso(order.price_at),
        "received_at": _iso(order.received_at),
        "delay_class": order.delay_class,
        "created_at": _iso(order.created_at),
        "updated_at": _iso(order.updated_at),
        "expires_at": _iso(order.expires_at),
        "cancelled_at": _iso(order.cancelled_at) if order.cancelled_at else None,
    }


def _day_order_expiry(now: datetime) -> datetime:
    local = now.astimezone(_MARKET_TZ)
    candidate = datetime.combine(local.date(), time(15, 0), tzinfo=_MARKET_TZ)
    if local >= candidate or local.weekday() >= 5:
        candidate += timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate.astimezone(UTC)


_SHARED_DASHBOARD_CACHE: dict[str, tuple[float, dict[str, object]]] = {}
_HOLDING_CANDLES_FILE = (
    Path(__file__).resolve().parent.parent.parent.parent / "storage" / "holding_candles_cache.json"
)


def _load_persisted_candles() -> dict[str, tuple[float, list[Candle]]]:
    result: dict[str, tuple[float, list[Candle]]] = {}
    if not _HOLDING_CANDLES_FILE.exists():
        return result
    try:
        with open(_HOLDING_CANDLES_FILE, encoding="utf-8") as f:
            raw = json.load(f)
        far_future = _monotonic() + 86400.0 * 7
        for sym, items in raw.items():
            candle_list: list[Candle] = []
            for item in items:
                try:
                    ts = datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00"))
                    candle_list.append(
                        Candle(
                            timestamp=ts,
                            open=Decimal(str(item.get("open", 0))),
                            high=Decimal(str(item.get("high", 0))),
                            low=Decimal(str(item.get("low", 0))),
                            close=Decimal(str(item.get("close", 0))),
                            volume=Decimal(str(item.get("volume", 0))),
                        )
                    )
                except Exception:
                    pass
            if candle_list:
                result[sym] = (far_future, candle_list)
    except Exception:
        pass
    return result


def _persist_candles_to_disk(sym: str, candles: list[Candle]) -> None:
    try:
        _HOLDING_CANDLES_FILE.parent.mkdir(parents=True, exist_ok=True)
        raw: dict[str, list[dict[str, str]]] = {}
        if _HOLDING_CANDLES_FILE.exists():
            try:
                with open(_HOLDING_CANDLES_FILE, encoding="utf-8") as f:
                    raw = json.load(f)
            except Exception:
                pass
        raw[sym] = [
            {
                "timestamp": c.timestamp.isoformat().replace("+00:00", "Z"),
                "open": str(c.open),
                "high": str(c.high),
                "low": str(c.low),
                "close": str(c.close),
                "volume": str(c.volume),
            }
            for c in candles
        ]
        with open(_HOLDING_CANDLES_FILE, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2)
    except Exception:
        pass


_SHARED_HOLDING_CANDLES_CACHE: dict[str, tuple[float, list[Candle]]] = _load_persisted_candles()


class PaperTradingService:
    def __init__(
        self,
        repository: IPortfolioRepository,
        provider: IMarketProvider,
        sim_store: ExchangeSimulationStore | None = None,
        clock: datetime | None = None,
    ) -> None:
        self._repository = repository
        self._provider = provider
        self._sim_store = sim_store or get_exchange_simulation_store()
        self._clock = clock
        self._dashboard_cache = _SHARED_DASHBOARD_CACHE if clock is None else {}
        self._holding_candles_cache = _SHARED_HOLDING_CANDLES_CACHE if clock is None else {}

    def invalidate_dashboard_cache(self, user_id: str | None = None) -> None:
        if user_id:
            self._dashboard_cache.pop(user_id, None)
        else:
            self._dashboard_cache.clear()

    def _now(self) -> datetime:
        return self._clock or datetime.now(UTC)

    def _now_ts(self) -> float:
        if self._clock is not None:
            return self._clock.timestamp()
        return _monotonic()

    def _execution(
        self,
        order: PaperOrder,
        instrument: MarketInstrument,
        execution_price: Decimal | None = None,
    ) -> PaperExecution:
        fill_price = execution_price if execution_price is not None else instrument.price
        gross = round_vnd(fill_price * Decimal(order.quantity))
        fee = round_vnd(gross * BROKER_FEE_RATE)
        tax_rate = SELL_TAX_RATE if order.side == "sell" else Decimal()
        return PaperExecution(
            idempotency_key=f"order:{order.id}",
            side=order.side,
            symbol=instrument.symbol,
            name=instrument.name,
            exchange=instrument.exchange,
            sector=instrument.sector,
            quantity=order.quantity,
            execution_price=fill_price,
            gross_amount=gross,
            fee_rate=BROKER_FEE_RATE,
            fee_amount=fee,
            tax_rate=tax_rate,
            tax_amount=round_vnd(gross * tax_rate),
            provider=self._provider.slug,
            price_at=_market_datetime(self._provider.market_time),
            received_at=self._now(),
            delay_class=self._provider.delay_class,
        )

    def _can_simulate_fill(self, user_id: str | None = None) -> bool:
        if user_id is None:
            return True
        mode = self._sim_store.get_mode(user_id)
        if mode == "instant":
            return True
        in_session, _ = is_within_exchange_trading_hours(
            self._now(),
            self._provider.session,
            "LO",
        )
        return in_session

    def set_execution_mode(self, user_id: str, mode: ExecutionMode) -> dict[str, object]:
        if mode not in {"instant", "exchange_hours"}:
            raise PaperOrderError(
                "INVALID_EXECUTION_MODE",
                "Chế độ khớp lệnh chỉ hỗ trợ 'instant' hoặc 'exchange_hours'.",
            )
        self._sim_store.set_mode(user_id, mode)
        cached_entry = self._dashboard_cache.get(user_id)
        if cached_entry:
            expires_at, cached_dash = cached_entry
            portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
            if portfolio:
                updated_dash = dict(cached_dash)
                updated_dash["exchange_simulation"] = self._exchange_simulation_payload(
                    user_id, portfolio
                )
                self._dashboard_cache[user_id] = (expires_at, updated_dash)
                return updated_dash
        cached_entry = self._dashboard_cache.get(user_id)
        if cached_entry:
            expires_at, cached_dash = cached_entry
            portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
            if portfolio:
                updated_dash = dict(cached_dash)
                updated_dash["exchange_simulation"] = self._exchange_simulation_payload(
                    user_id, portfolio
                )
                self._dashboard_cache[user_id] = (expires_at, updated_dash)
                return updated_dash
        self.invalidate_dashboard_cache(user_id)
        return self.dashboard(user_id)

    def place_order(
        self,
        user_id: str,
        command: PlacePaperOrder,
    ) -> tuple[PaperOrder, PaperTrade | None]:
        self.invalidate_dashboard_cache(user_id)
        instrument = self._provider.instrument(command.symbol, include_fundamentals=False)
        if instrument is None:
            raise PaperOrderError("UNKNOWN_INSTRUMENT", "Không tìm thấy mã cổ phiếu này.")
        if instrument.price <= 0:
            raise PaperOrderError(
                "PRICE_UNAVAILABLE",
                "Chưa có giá quan sát hợp lệ để mô phỏng khớp lệnh.",
            )
        order_type_upper = command.order_type.strip().upper()
        if order_type_upper not in SUPPORTED_ORDER_TYPES:
            raise PaperOrderError(
                "UNSUPPORTED_ORDER_TYPE",
                "Hiện chỉ hỗ trợ các loại lệnh chuẩn HOSE/HNX: LO, MP, ATO, ATC.",
            )
        typed_order_type = cast(OrderTypeCode, order_type_upper)
        if command.limit_price <= 0:
            raise PaperOrderError("INVALID_LIMIT_PRICE", "Giá đặt lệnh phải lớn hơn 0.")

        active_mode: ExecutionMode = (
            cast(ExecutionMode, command.execution_mode)
            if command.execution_mode in {"instant", "exchange_hours"}
            else self._sim_store.get_mode(user_id)
        )
        enforce_strict = (
            command.strict_rules or active_mode == "exchange_hours" or typed_order_type != "LO"
        )

        is_valid, err_code, err_msg = validate_vietnam_exchange_rules(
            side=command.side,
            order_type=typed_order_type,
            quantity=command.quantity,
            limit_price=command.limit_price,
            instrument=instrument,
            strict_rules=enforce_strict,
        )
        if not is_valid and err_code and err_msg:
            raise PaperOrderError(err_code, err_msg)

        now = self._now()
        self._repository.expire_orders(user_id, now)
        lot_type = classify_lot_type(command.quantity)

        # Determine if we are in strict exchange hours mode and outside session
        in_session = True
        session_reason: str | None = None
        if active_mode == "exchange_hours":
            in_session, session_reason = is_within_exchange_trading_hours(
                now,
                self._provider.session,
                typed_order_type,
            )

        # Match against orderbook depth / limit price
        match = match_against_orderbook(
            side=command.side,
            order_type=typed_order_type,
            quantity=command.quantity,
            limit_price=command.limit_price,
            instrument=instrument,
            execution_mode=active_mode,
            use_orderbook_depth=command.use_orderbook_depth or active_mode == "exchange_hours",
        )

        # Register Stop-Loss / Take-Profit conditional trigger if provided on buy
        if command.side == "buy" and (
            command.stop_loss_price is not None or command.take_profit_price is not None
        ):
            base_order_price = (
                command.limit_price
                if (active_mode == "exchange_hours" or command.use_orderbook_depth)
                and command.limit_price
                else instrument.price
            )
            if (
                command.stop_loss_price is not None
                and command.take_profit_price is not None
                and command.stop_loss_price >= command.take_profit_price
            ):
                raise PaperOrderError(
                    "INVALID_TRIGGER_RANGE",
                    "Giá cắt lỗ (Stop-Loss) phải nhỏ hơn giá chốt lời (Take-Profit).",
                )
            if command.stop_loss_price is not None and command.stop_loss_price >= base_order_price:
                raise PaperOrderError(
                    "INVALID_STOP_LOSS",
                    f"Giá cắt lỗ ({decimal_text(command.stop_loss_price)} đ) phải nhỏ hơn giá đặt mua ({decimal_text(base_order_price)} đ).",
                )
            if (
                command.take_profit_price is not None
                and command.take_profit_price <= base_order_price
            ):
                raise PaperOrderError(
                    "INVALID_TAKE_PROFIT",
                    f"Giá chốt lời ({decimal_text(command.take_profit_price)} đ) phải lớn hơn giá đặt mua ({decimal_text(base_order_price)} đ).",
                )
            self._sim_store.upsert_trigger(
                user_id=user_id,
                symbol=instrument.symbol,
                stop_loss_price=command.stop_loss_price,
                take_profit_price=command.take_profit_price,
                quantity=command.quantity,
            )

        # Case 1: Order cannot fill immediately (outside exchange hours or non-marketable LO)
        if not in_session or not match.can_fill_now:
            effective_limit = (
                command.limit_price
                if (active_mode == "exchange_hours" or command.use_orderbook_depth)
                else instrument.price
            )
            reserved_gross = round_vnd(effective_limit * Decimal(command.quantity))
            reserved_fee = round_vnd(reserved_gross * BROKER_FEE_RATE)
            submission = PaperOrderSubmission(
                idempotency_key=command.idempotency_key,
                side=command.side,
                order_type="LO",  # Stored as LO in DB check constraint; display_order_type in meta
                symbol=instrument.symbol,
                name=instrument.name,
                exchange=instrument.exchange,
                sector=instrument.sector,
                quantity=command.quantity,
                limit_price=effective_limit,
                reserved_cash=(
                    reserved_gross + reserved_fee if command.side == "buy" else Decimal()
                ),
                reserved_quantity=command.quantity if command.side == "sell" else 0,
                provider=self._provider.slug,
                price_at=_market_datetime(self._provider.market_time),
                received_at=now,
                delay_class=self._provider.delay_class,
                initial_status="open",
                expires_at=_day_order_expiry(now),
            )
            order = self._repository.place_order(
                user_id,
                STARTING_CASH,
                submission,
                MAX_HOLDINGS,
            )
            quarantine_until = (
                now + timedelta(seconds=ANTI_LOOKAHEAD_QUARANTINE_SECONDS)
                if not match.can_fill_now
                else None
            )
            self._sim_store.save_order_meta(
                OrderExtendedMeta(
                    order_id=order.id,
                    display_order_type=typed_order_type,
                    lot_type=lot_type,
                    slippage_vnd=Decimal("0"),
                    slippage_bps=Decimal("0"),
                    quarantine_until=quarantine_until,
                    pending_reason=session_reason if not in_session else match.pending_reason,
                    stop_loss_price=command.stop_loss_price,
                    take_profit_price=command.take_profit_price,
                )
            )
            return order, None

        # Case 2: Immediate fill (full or partial fill across 3-level orderbook)
        filled_qty = match.filled_quantity
        unfilled_qty = match.unfilled_quantity
        exec_price = match.execution_price

        submission_limit_price = (
            instrument.price
            if (
                active_mode == "instant"
                and not command.use_orderbook_depth
                and typed_order_type == "LO"
            )
            else exec_price
        )
        reserved_gross = round_vnd(submission_limit_price * Decimal(filled_qty))
        reserved_fee = round_vnd(reserved_gross * BROKER_FEE_RATE)
        submission = PaperOrderSubmission(
            idempotency_key=command.idempotency_key,
            side=command.side,
            order_type="LO",
            symbol=instrument.symbol,
            name=instrument.name,
            exchange=instrument.exchange,
            sector=instrument.sector,
            quantity=filled_qty,
            limit_price=submission_limit_price,
            reserved_cash=(reserved_gross + reserved_fee if command.side == "buy" else Decimal()),
            reserved_quantity=filled_qty if command.side == "sell" else 0,
            provider=self._provider.slug,
            price_at=_market_datetime(self._provider.market_time),
            received_at=now,
            delay_class=self._provider.delay_class,
            initial_status="open",
            expires_at=_day_order_expiry(now),
        )
        order = self._repository.place_order(
            user_id,
            STARTING_CASH,
            submission,
            MAX_HOLDINGS,
        )
        self._sim_store.save_order_meta(
            OrderExtendedMeta(
                order_id=order.id,
                display_order_type=typed_order_type,
                lot_type=lot_type,
                slippage_vnd=match.slippage_vnd,
                slippage_bps=match.slippage_bps,
                pending_reason=match.pending_reason,
                stop_loss_price=command.stop_loss_price,
                take_profit_price=command.take_profit_price,
            )
        )
        if order.status == "pending":
            order = self._repository.activate_order(user_id, order.id)
        if order.status in {"open", "filled"}:
            filled_order, trade = self._repository.fill_order(
                user_id,
                order.id,
                self._execution(order, instrument, execution_price=exec_price),
                MAX_HOLDINGS,
            )
        else:
            return order, None

        # If partial fill occurred, place a resting open child order for the remaining shares
        if unfilled_qty > 0:
            rem_gross = round_vnd(command.limit_price * Decimal(unfilled_qty))
            rem_fee = round_vnd(rem_gross * BROKER_FEE_RATE)
            rem_submission = PaperOrderSubmission(
                idempotency_key=f"{command.idempotency_key[:110]}:rem",
                side=command.side,
                order_type="LO",
                symbol=instrument.symbol,
                name=instrument.name,
                exchange=instrument.exchange,
                sector=instrument.sector,
                quantity=unfilled_qty,
                limit_price=command.limit_price,
                reserved_cash=(rem_gross + rem_fee if command.side == "buy" else Decimal()),
                reserved_quantity=unfilled_qty if command.side == "sell" else 0,
                provider=self._provider.slug,
                price_at=_market_datetime(self._provider.market_time),
                received_at=now,
                delay_class=self._provider.delay_class,
                initial_status="open",
                expires_at=_day_order_expiry(now),
            )
            rem_order = self._repository.place_order(
                user_id,
                STARTING_CASH,
                rem_submission,
                MAX_HOLDINGS,
            )
            self._sim_store.save_order_meta(
                OrderExtendedMeta(
                    order_id=rem_order.id,
                    display_order_type=typed_order_type,
                    lot_type=classify_lot_type(unfilled_qty),
                    pending_reason=(
                        f"Phần dư {unfilled_qty} CP từ lệnh khớp một phần đang chờ thanh khoản tại giá "
                        f"{decimal_text(command.limit_price)}."
                    ),
                )
            )

        return filled_order, trade

    def force_fill_order(
        self,
        user_id: str,
        order_id: str,
    ) -> tuple[PaperOrder, PaperTrade | None]:
        self.invalidate_dashboard_cache(user_id)
        portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
        target = next((o for o in portfolio.orders if o.id == order_id), None)
        if target is None:
            raise PaperOrderError("ORDER_NOT_FOUND", "Không tìm thấy lệnh chờ này.")
        if target.status not in {"pending", "open"}:
            raise PaperOrderError("ORDER_NOT_OPEN", "Chỉ có thể khớp nhanh các lệnh đang chờ.")
        instrument = self._provider.instrument(target.symbol, include_fundamentals=False)
        if instrument is None or instrument.price <= 0:
            raise PaperOrderError(
                "PRICE_UNAVAILABLE",
                "Chưa có giá thị trường hợp lệ để khớp lệnh này.",
            )
        active = (
            self._repository.activate_order(user_id, target.id)
            if target.status == "pending"
            else target
        )
        return self._repository.fill_order(
            user_id,
            active.id,
            self._execution(active, instrument, execution_price=instrument.price),
            MAX_HOLDINGS,
        )

    def advance_sale_cash(
        self,
        user_id: str,
        requested_amount: Decimal | None = None,
    ) -> dict[str, object]:
        portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
        t2_summary = build_t2_settlement_summary(
            user_id=user_id,
            trades=portfolio.trades,
            now=self._now(),
            store=self._sim_store,
        )
        advanceable = Decimal(str(t2_summary["advanceable_cash"]))
        if advanceable <= 0:
            raise PaperOrderError(
                "NO_ADVANCEABLE_CASH",
                "Hiện không có tiền bán chờ về (T+2) khả dụng để ứng trước.",
            )
        gross = requested_amount if requested_amount is not None else advanceable
        if gross <= 0 or gross > advanceable:
            raise PaperOrderError(
                "INVALID_ADVANCE_AMOUNT",
                f"Số tiền ứng trước phải lớn hơn 0 và không vượt quá {decimal_text(advanceable)} ₫.",
            )
        days_advanced = 2
        fee = round_vnd(gross * ADVANCE_FEE_RATE_PER_DAY * Decimal(days_advanced))
        net_received = max(Decimal("0"), gross - fee)
        record = self._sim_store.record_cash_advance(
            user_id=user_id,
            gross_amount=gross,
            fee_amount=fee,
            net_received=net_received,
            days_advanced=days_advanced,
        )
        if hasattr(self._repository, "credit_cash") and callable(self._repository.credit_cash):
            self._repository.credit_cash(user_id, net_received)
        self.invalidate_dashboard_cache(user_id)
        return {
            "advance": {
                "id": record.id,
                "gross_amount": decimal_text(record.gross_amount),
                "fee_amount": decimal_text(record.fee_amount),
                "net_received": decimal_text(record.net_received),
                "days_advanced": record.days_advanced,
                "created_at": _iso(record.created_at),
            },
            "data": self.dashboard(user_id),
        }

    def upsert_conditional_trigger(
        self,
        user_id: str,
        symbol: str,
        stop_loss_price: Decimal | None,
        take_profit_price: Decimal | None,
        quantity: int | None = None,
    ) -> dict[str, object]:
        if stop_loss_price is None and take_profit_price is None:
            raise PaperOrderError(
                "EMPTY_CONDITIONAL_TRIGGER",
                "Vui lòng nhập ít nhất một mức giá Cắt lỗ (Stop-Loss) hoặc Chốt lời (Take-Profit).",
            )
        if stop_loss_price is not None and stop_loss_price <= 0:
            raise PaperOrderError("INVALID_STOP_LOSS", "Giá cắt lỗ phải lớn hơn 0.")
        if take_profit_price is not None and take_profit_price <= 0:
            raise PaperOrderError("INVALID_TAKE_PROFIT", "Giá chốt lời phải lớn hơn 0.")
        if (
            stop_loss_price is not None
            and take_profit_price is not None
            and stop_loss_price >= take_profit_price
        ):
            raise PaperOrderError(
                "INVALID_TRIGGER_RANGE",
                "Giá cắt lỗ (Stop-Loss) phải nhỏ hơn giá chốt lời (Take-Profit).",
            )
        self._sim_store.upsert_trigger(
            user_id=user_id,
            symbol=symbol,
            stop_loss_price=stop_loss_price,
            take_profit_price=take_profit_price,
            quantity=quantity,
        )
        self.invalidate_dashboard_cache(user_id)
        return self.dashboard(user_id)

    def cancel_conditional_trigger(self, user_id: str, trigger_id: str) -> dict[str, object]:
        self._sim_store.cancel_trigger(user_id, trigger_id)
        self.invalidate_dashboard_cache(user_id)
        return self.dashboard(user_id)

    def cancel_order(self, user_id: str, order_id: str) -> PaperOrder:
        self.invalidate_dashboard_cache(user_id)
        return self._repository.cancel_order(user_id, order_id)

    def _refresh_orders(self, user_id: str) -> PaperPortfolio:
        now = self._now()
        self._repository.expire_orders(user_id, now)
        portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
        mode = self._sim_store.get_mode(user_id)
        if not self._can_simulate_fill(user_id):
            return portfolio

        for order in portfolio.orders:
            if order.status not in {"pending", "open"}:
                continue
            meta = self._sim_store.get_order_meta(order.id)
            if meta and meta.quarantine_until and now < meta.quarantine_until:
                continue
            instrument = self._provider.instrument(order.symbol, include_fundamentals=False)
            if instrument is None or instrument.price <= 0:
                continue

            if mode == "exchange_hours":
                display_type: OrderTypeCode = meta.display_order_type if meta else "LO"
                in_sess, sess_reason = is_within_exchange_trading_hours(
                    now,
                    self._provider.session,
                    display_type,
                )
                if not in_sess:
                    if meta:
                        meta.pending_reason = sess_reason
                    continue
                match = match_against_orderbook(
                    side=order.side,
                    order_type=display_type,
                    quantity=order.quantity,
                    limit_price=order.limit_price,
                    instrument=instrument,
                    execution_mode=mode,
                    use_orderbook_depth=True,
                )
                if not match.can_fill_now:
                    if meta:
                        meta.pending_reason = match.pending_reason
                    continue
                fill_price = match.execution_price
            else:
                fill_price = instrument.price

            active = (
                self._repository.activate_order(user_id, order.id)
                if order.status == "pending"
                else order
            )
            self._repository.fill_order(
                user_id,
                active.id,
                self._execution(active, instrument, execution_price=fill_price),
                MAX_HOLDINGS,
            )

        # Evaluate automated Stop-Loss / Take-Profit triggers against current holdings
        portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
        triggers = self._sim_store.list_triggers(user_id)
        active_triggers = [t for t in triggers if t.status == "active"]
        if active_triggers:
            holding_by_sym = {h.symbol: h for h in portfolio.holdings}
            for trig in active_triggers:
                holding = holding_by_sym.get(trig.symbol)
                if holding is None or holding.quantity <= 0:
                    continue
                instrument = self._provider.instrument(trig.symbol, include_fundamentals=False)
                if instrument is None or instrument.price <= 0:
                    continue
                reason: str | None = None
                if trig.stop_loss_price is not None and instrument.price <= trig.stop_loss_price:
                    reason = (
                        f"Kích hoạt Cắt lỗ tự động (Stop-Loss <= {decimal_text(trig.stop_loss_price)}) "
                        f"khi giá thị trường chạm {decimal_text(instrument.price)}."
                    )
                elif (
                    trig.take_profit_price is not None
                    and instrument.price >= trig.take_profit_price
                ):
                    reason = (
                        f"Kích hoạt Chốt lời tự động (Take-Profit >= {decimal_text(trig.take_profit_price)}) "
                        f"khi giá thị trường chạm {decimal_text(instrument.price)}."
                    )
                if reason is not None:
                    sell_qty = (
                        min(holding.quantity, trig.quantity)
                        if trig.quantity and trig.quantity > 0
                        else holding.quantity
                    )
                    gross = round_vnd(instrument.price * Decimal(sell_qty))
                    fee = round_vnd(gross * BROKER_FEE_RATE)
                    exec_cmd = PaperExecution(
                        idempotency_key=f"trigger:{trig.id}:{uuid4().hex[:8]}",
                        side="sell",
                        symbol=instrument.symbol,
                        name=instrument.name,
                        exchange=instrument.exchange,
                        sector=instrument.sector,
                        quantity=sell_qty,
                        execution_price=instrument.price,
                        gross_amount=gross,
                        fee_rate=BROKER_FEE_RATE,
                        fee_amount=fee,
                        tax_rate=SELL_TAX_RATE,
                        tax_amount=round_vnd(gross * SELL_TAX_RATE),
                        provider=self._provider.slug,
                        price_at=_market_datetime(self._provider.market_time),
                        received_at=now,
                        delay_class=self._provider.delay_class,
                    )
                    trade = self._repository.execute(
                        user_id,
                        STARTING_CASH,
                        exec_cmd,
                        MAX_HOLDINGS,
                    )
                    trig.status = "triggered"
                    trig.trigger_reason = reason
                    trig.triggered_trade_id = trade.id
                    trig.triggered_at = now

        return self._repository.get_or_create(user_id, STARTING_CASH)

    def dashboard(self, user_id: str) -> dict[str, object]:
        now_ts = self._now_ts()
        cached = self._dashboard_cache.get(user_id)
        if cached and cached[0] > now_ts:
            return cached[1]

        portfolio = self._refresh_orders(user_id)
        open_orders = tuple(
            order for order in portfolio.orders if order.status in {"pending", "open"}
        )
        reserved_cash = sum((order.reserved_cash for order in open_orders), Decimal())
        reserved_shares: dict[str, int] = {}
        for order in open_orders:
            reserved_shares[order.symbol] = (
                reserved_shares.get(order.symbol, 0) + order.reserved_quantity
            )
        holdings: list[dict[str, object]] = []
        total_market_value = Decimal()
        missing_prices = 0
        notices: list[dict[str, str]] = []

        # Gather 90-day daily candles for holdings, refreshing stale cache so daily history stays current
        holding_symbols = [holding.symbol for holding in portfolio.holdings]
        all_candles: dict[str, list[Candle]] = {}
        market_tz = ZoneInfo("Asia/Ho_Chi_Minh")
        today_market = datetime.now(market_tz).date()
        if holding_symbols:
            now_mono = _monotonic()
            symbols_to_fetch: list[str] = []
            for sym in holding_symbols:
                cached_c = self._holding_candles_cache.get(sym)
                if cached_c is not None and cached_c[0] > now_mono and bool(cached_c[1]):
                    all_candles[sym] = cached_c[1]
                else:
                    symbols_to_fetch.append(sym)

            if symbols_to_fetch:
                def _fetch_holding_candles(sym: str) -> list[Candle]:
                    try:
                        fetched = list(self._provider.candles(sym, "1d"))[-90:]
                    except Exception:
                        return []
                    if fetched:
                        self._holding_candles_cache[sym] = (_monotonic() + 300.0, fetched)
                        _persist_candles_to_disk(sym, fetched)
                    return fetched

                pool = ThreadPoolExecutor(max_workers=min(8, len(symbols_to_fetch)))
                futures = {pool.submit(_fetch_holding_candles, sym): sym for sym in symbols_to_fetch}
                done, _ = wait(futures.keys(), timeout=6.0)
                pool.shutdown(wait=False, cancel_futures=False)

                for sym in symbols_to_fetch:
                    fetched: list[Candle] = []
                    for fut, fut_sym in futures.items():
                        if fut_sym == sym and fut in done:
                            try:
                                fetched = fut.result()
                            except Exception:
                                fetched = []
                            break
                    if fetched:
                        all_candles[sym] = fetched
                    else:
                        fallback_c = self._holding_candles_cache.get(sym)
                        if fallback_c and fallback_c[1]:
                            all_candles[sym] = fallback_c[1]

        histories: dict[str, list[dict[str, str]]] = {}
        for holding in portfolio.holdings:
            instrument = self._provider.instrument(holding.symbol, include_fundamentals=False)
            price = instrument.price if instrument is not None and instrument.price > 0 else None
            market_value = (
                round_vnd(price * Decimal(holding.quantity)) if price is not None else None
            )
            if market_value is None:
                missing_prices += 1
            else:
                total_market_value += market_value
            unrealized = (
                market_value - holding.total_cost_basis if market_value is not None else None
            )
            unrealized_percent = (
                unrealized / holding.total_cost_basis * Decimal("100")
                if unrealized is not None and holding.total_cost_basis
                else None
            )
            candles = list(all_candles.get(holding.symbol, [])[-30:])
            if price is not None and (
                not candles or candles[-1].timestamp.astimezone(market_tz).date() < today_market
            ):
                candles.append(
                    Candle(
                        timestamp=datetime.now(UTC),
                        open=price,
                        high=price,
                        low=price,
                        close=price,
                        volume=instrument.volume if instrument else Decimal("0"),
                    )
                )
            histories[holding.symbol] = [
                {"timestamp": _iso(item.timestamp), "close": decimal_text(item.close)}
                for item in candles
            ]
            consecutive_falls = 0
            for candle in reversed(candles):
                if candle.close < candle.open:
                    consecutive_falls += 1
                else:
                    break
            change_percent = instrument.change_percent if instrument else Decimal()
            if change_percent <= Decimal("-3"):
                notices.append(
                    {
                        "level": "warning",
                        "symbol": holding.symbol,
                        "title": f"{holding.symbol} giảm mạnh trong phiên",
                        "message": (
                            f"Giá quan sát giảm {abs(change_percent):.2f}% so với tham chiếu. "
                            "Hãy xem lại giả định đầu tư; đây không phải chỉ dẫn bán."
                        ),
                    }
                )
            if consecutive_falls >= 3:
                notices.append(
                    {
                        "level": "warning",
                        "symbol": holding.symbol,
                        "title": f"{holding.symbol} có chuỗi giảm",
                        "message": (
                            "Giá đóng cửa giảm trong "
                            f"{consecutive_falls} phiên quan sát liên tiếp. "
                            "Nên đọc lại tin và mức chịu rủi ro trước khi quyết định."
                        ),
                    }
                )
            holdings.append(
                {
                    "symbol": holding.symbol,
                    "name": holding.name,
                    "exchange": holding.exchange,
                    "sector": holding.sector,
                    "quantity": holding.quantity,
                    "available_quantity": max(
                        0, holding.quantity - reserved_shares.get(holding.symbol, 0)
                    ),
                    "average_cost": decimal_text(holding.average_cost),
                    "total_cost_basis": decimal_text(holding.total_cost_basis),
                    "current_price": decimal_text(price) if price is not None else None,
                    "market_value": (
                        decimal_text(market_value) if market_value is not None else None
                    ),
                    "unrealized_pnl": (
                        decimal_text(unrealized) if unrealized is not None else None
                    ),
                    "unrealized_pnl_percent": (
                        decimal_text(unrealized_percent.quantize(Decimal("0.01")))
                        if unrealized_percent is not None
                        else None
                    ),
                    "daily_change_percent": (
                        decimal_text(change_percent.quantize(Decimal("0.01")))
                        if instrument
                        else None
                    ),
                    "price_history": histories[holding.symbol],
                }
            )

        total_value = portfolio.cash_balance + total_market_value if not missing_prices else None
        total_pnl = total_value - portfolio.starting_cash if total_value is not None else None
        total_return = (
            total_pnl / portfolio.starting_cash * Decimal("100") if total_pnl is not None else None
        )
        for holding_payload in holdings:
            raw_market_value = holding_payload["market_value"]
            weight = (
                Decimal(str(raw_market_value)) / total_value * Decimal("100")
                if raw_market_value is not None and total_value
                else None
            )
            holding_payload["portfolio_weight_percent"] = (
                decimal_text(weight.quantize(Decimal("0.01"))) if weight is not None else None
            )
            if weight is not None and weight > Decimal("40"):
                notices.append(
                    {
                        "level": "info",
                        "symbol": str(holding_payload["symbol"]),
                        "title": "Danh mục đang tập trung",
                        "message": (
                            f"{holding_payload['symbol']} chiếm {weight:.1f}% "
                            "tổng tài sản mô phỏng. "
                            "Hãy tìm hiểu rủi ro tập trung trước khi mua thêm."
                        ),
                    }
                )

        if self._provider.freshness == "stale":
            notices.insert(
                0,
                {
                    "level": "warning",
                    "symbol": "",
                    "title": "Giá đang cũ",
                    "message": "Không nên xem giá này là giá có thể khớp ngoài thị trường thật.",
                },
            )
        if not portfolio.holdings:
            notices.append(
                {
                    "level": "info",
                    "symbol": "",
                    "title": "Bắt đầu với một vị thế nhỏ",
                    "message": (
                        "Chọn mã bạn đã tìm hiểu, nhập số lượng nhỏ và quan sát biến động trước "
                        "khi phân bổ thêm tiền mô phỏng."
                    ),
                }
            )

        opportunities = sorted(
            (
                item
                for item in self._provider.instruments()
                if item.price > 0 and item.change_percent > 0
            ),
            key=lambda item: (item.change_percent, item.matched_value),
            reverse=True,
        )[:6]
        equity_curve = self._equity_curve(
            portfolio,
            precomputed_candles=all_candles,
            current_total_value=total_value,
        )
        res: dict[str, object] = {
            "account": {
                "id": portfolio.id,
                "currency": portfolio.currency,
                "starting_cash": decimal_text(portfolio.starting_cash),
                "cash_balance": decimal_text(portfolio.cash_balance),
                "available_cash": decimal_text(portfolio.cash_balance - reserved_cash),
                "reserved_cash": decimal_text(reserved_cash),
                "invested_cost": decimal_text(
                    sum((item.total_cost_basis for item in portfolio.holdings), Decimal())
                ),
                "market_value": decimal_text(total_market_value) if not missing_prices else None,
                "total_value": decimal_text(total_value) if total_value is not None else None,
                "realized_pnl": decimal_text(portfolio.realized_pnl),
                "unrealized_pnl": (
                    decimal_text(
                        sum(
                            (Decimal(str(item["unrealized_pnl"])) for item in holdings),
                            Decimal(),
                        )
                    )
                    if not missing_prices
                    else None
                ),
                "total_pnl": decimal_text(total_pnl) if total_pnl is not None else None,
                "total_return_percent": (
                    decimal_text(total_return.quantize(Decimal("0.01")))
                    if total_return is not None
                    else None
                ),
                "valuation_partial": missing_prices > 0,
                "version": portfolio.version,
                "is_public": portfolio.is_public,
                "nickname": portfolio.nickname,
                "created_at": _iso(portfolio.created_at),
                "updated_at": _iso(portfolio.updated_at),
            },
            "holdings": holdings,
            "orders": [_order_payload(item) for item in portfolio.orders],
            "trades": [_trade_payload(item) for item in portfolio.trades],
            "equity_curve": equity_curve,
            "equity_curve_method": "current_holdings_replay",
            "notices": notices[:12],
            "opportunities": [
                {
                    "symbol": item.symbol,
                    "name": item.name,
                    "price": decimal_text(item.price),
                    "change_percent": decimal_text(item.change_percent.quantize(Decimal("0.01"))),
                    "volume": decimal_text(item.volume),
                    "matched_value": decimal_text(item.matched_value),
                    "interest_reasons": list(item.interest_reasons),
                }
                for item in opportunities
            ],
            "assumptions": {
                "starting_cash": decimal_text(STARTING_CASH),
                "broker_fee_rate": decimal_text(BROKER_FEE_RATE),
                "sell_tax_rate": decimal_text(SELL_TAX_RATE),
                "fill_model": "automatic_latest_observed_price",
                "max_holdings": MAX_HOLDINGS,
                "disclaimer": (
                    "Mô phỏng giáo dục tự động khớp theo giá quan sát mới nhất; không đặt lệnh "
                    "thật và không phải khuyến nghị đầu tư."
                ),
            },
            "market": {
                "provider": self._provider.slug,
                "provider_name": self._provider.display_name,
                "market_time": self._provider.market_time,
                "received_at": _iso(self._now()),
                "delay_class": self._provider.delay_class,
                "freshness": self._provider.freshness,
                "session": self._provider.session,
                "partial": self._provider.partial,
            },
            "exchange_simulation": self._exchange_simulation_payload(user_id, portfolio),
        }
        self._dashboard_cache[user_id] = (now_ts + 60.0, res)
        return res

    def _exchange_simulation_payload(
        self,
        user_id: str,
        portfolio: PaperPortfolio,
    ) -> dict[str, object]:
        now = self._now()
        mode = self._sim_store.get_mode(user_id)
        in_session, session_msg = is_within_exchange_trading_hours(
            now,
            self._provider.session,
            "LO",
        )
        t2_summary = build_t2_settlement_summary(
            user_id=user_id,
            trades=portfolio.trades,
            now=now,
            store=self._sim_store,
        )
        triggers = [
            {
                "id": t.id,
                "symbol": t.symbol,
                "stop_loss_price": (
                    decimal_text(t.stop_loss_price) if t.stop_loss_price is not None else None
                ),
                "take_profit_price": (
                    decimal_text(t.take_profit_price) if t.take_profit_price is not None else None
                ),
                "quantity": t.quantity,
                "status": t.status,
                "trigger_reason": t.trigger_reason,
                "triggered_trade_id": t.triggered_trade_id,
                "created_at": _iso(t.created_at),
                "triggered_at": _iso(t.triggered_at) if t.triggered_at else None,
            }
            for t in self._sim_store.list_triggers(user_id)
        ]
        order_meta_map: dict[str, dict[str, object]] = {}
        for o in portfolio.orders:
            meta = self._sim_store.get_order_meta(o.id)
            if meta is not None:
                order_meta_map[o.id] = {
                    "display_order_type": meta.display_order_type,
                    "lot_type": meta.lot_type,
                    "slippage_vnd": decimal_text(meta.slippage_vnd),
                    "slippage_bps": decimal_text(meta.slippage_bps),
                    "quarantine_until": (
                        _iso(meta.quarantine_until) if meta.quarantine_until else None
                    ),
                    "pending_reason": meta.pending_reason,
                    "stop_loss_price": (
                        decimal_text(meta.stop_loss_price)
                        if meta.stop_loss_price is not None
                        else None
                    ),
                    "take_profit_price": (
                        decimal_text(meta.take_profit_price)
                        if meta.take_profit_price is not None
                        else None
                    ),
                }
        return {
            "execution_mode": mode,
            "session_active": in_session,
            "session_message": session_msg,
            "supported_order_types": ["LO", "MP", "ATO", "ATC"],
            "price_bands": {"HOSE": "7%", "HNX": "10%", "UPCoM": "15%"},
            "t2_settlement": t2_summary,
            "conditional_triggers": triggers,
            "order_meta": order_meta_map,
        }

    def _equity_curve(
        self,
        portfolio: PaperPortfolio,
        precomputed_candles: dict[str, list[Candle]] | None = None,
        current_total_value: Decimal | None = None,
    ) -> list[dict[str, str]]:
        if not portfolio.holdings and not portfolio.trades:
            return []

        holding_by_symbol = {item.symbol: item for item in portfolio.holdings}
        close_by_symbol: dict[str, dict[str, Decimal]] = {}
        fallback_prices: dict[str, Decimal] = {}

        # 1. Gather all candle history and establish safe fallback price per holding
        for holding in portfolio.holdings:
            candles: list[Candle] = []
            if precomputed_candles and holding.symbol in precomputed_candles:
                candles = precomputed_candles[holding.symbol]

            inst = self._provider.instrument(holding.symbol, include_fundamentals=False)
            safe_price = (
                inst.price
                if inst and inst.price > 0
                else (candles[-1].close if candles else holding.average_cost)
            )
            fallback_prices[holding.symbol] = safe_price if safe_price > 0 else Decimal("10000")

            if candles:
                close_by_symbol[holding.symbol] = {
                    candle.timestamp.date().isoformat(): candle.close for candle in candles
                }
            else:
                close_by_symbol[holding.symbol] = {}

        # 2. Determine earliest buy trade date (or trade date / inception)
        all_dates_set: set[str] = set()
        for c_dict in close_by_symbol.values():
            all_dates_set.update(c_dict.keys())

        buy_trades = [t for t in portfolio.trades if t.side == "buy"]
        if buy_trades:
            first_buy_date = min(t.created_at.astimezone(_MARKET_TZ).date() for t in buy_trades)
        elif portfolio.trades:
            first_buy_date = min(
                t.created_at.astimezone(_MARKET_TZ).date() for t in portfolio.trades
            )
        else:
            first_buy_date = portfolio.created_at.astimezone(_MARKET_TZ).date()

        baseline_date = first_buy_date - timedelta(days=1)
        baseline_iso = baseline_date.isoformat()
        first_buy_iso = first_buy_date.isoformat()
        today_iso = datetime.now(_MARKET_TZ).date().isoformat()

        # Collect candidate dates strictly from the baseline date (day before first buy) up to today
        # This eliminates months of flat starting capital prior to the first trade.
        eligible_days = {d for d in all_dates_set if d >= baseline_iso}
        eligible_days.add(baseline_iso)
        eligible_days.add(first_buy_iso)
        eligible_days.add(today_iso)

        trade_dates = [
            t.created_at.astimezone(_MARKET_TZ).date().isoformat() for t in portfolio.trades
        ]
        for td in trade_dates:
            if td >= baseline_iso:
                eligible_days.add(td)

        sorted_days = sorted(eligible_days)

        # 3. For each day, calculate portfolio equity with all holdings strictly included
        by_date: dict[str, Decimal] = {}
        for day in sorted_days:
            if day == today_iso and current_total_value is not None:
                by_date[day] = current_total_value
                continue

            if day <= baseline_iso:
                by_date[day] = portfolio.starting_cash
                continue

            day_holdings_val = Decimal()
            for symbol, holding in holding_by_symbol.items():
                price = close_by_symbol.get(symbol, {}).get(day)
                if price is None or price <= 0:
                    price = fallback_prices.get(symbol, holding.average_cost)
                day_holdings_val += round_vnd(price * Decimal(holding.quantity))

            by_date[day] = portfolio.cash_balance + day_holdings_val

        # 4. Guarantee today's endpoint strictly matches current_total_value
        if current_total_value is not None:
            by_date[today_iso] = current_total_value

        # 5. Guarantee at least 2 points for chart visualization
        if len(by_date) < 2:
            yesterday_iso = (datetime.now(_MARKET_TZ).date() - timedelta(days=1)).isoformat()
            if yesterday_iso not in by_date:
                by_date[yesterday_iso] = portfolio.starting_cash
                by_date[yesterday_iso] = portfolio.starting_cash

        return [
            {"timestamp": f"{day}T08:00:00Z", "value": decimal_text(value)}
            for day, value in sorted(by_date.items())
        ]

    def set_public_visibility(
        self, user_id: str, is_public: bool, nickname: str | None = None
    ) -> dict[str, object]:
        self.invalidate_dashboard_cache(user_id)
        self._repository.set_public_status(user_id=user_id, is_public=is_public, nickname=nickname)
        return self.dashboard(user_id)

    def get_social_leaderboard(self, limit: int = 10) -> list[dict[str, object]]:
        rows = self._repository.get_public_leaderboard(limit=limit)
        result: list[dict[str, object]] = []
        for r in rows:
            starting = Decimal(str(r.get("starting_cash", 100000000)))
            realized = Decimal(str(r.get("realized_pnl", 0)))
            roi = (
                (realized / starting * Decimal("100")).quantize(Decimal("0.01"))
                if starting
                else Decimal("0")
            )
            result.append(
                {
                    "portfolio_id": r["portfolio_id"],
                    "nickname": r["nickname"],
                    "starting_cash": f"{starting:,.0f} đ",
                    "cash_balance": f"{Decimal(str(r.get('cash_balance', 0))):,.0f} đ",
                    "realized_pnl": f"{realized:+,.0f} đ",
                    "roi_percent": f"{roi:+.2f}%",
                    "roi_number": float(roi),
                    "holding_count": int(r.get("holding_count", 0)),
                    "total_trades": int(r.get("total_trades", 0)),
                    "win_trades": int(r.get("win_trades", 0)),
                }
            )
        return result

    def get_public_portfolio_detail(self, portfolio_id: str) -> dict[str, object] | None:
        portfolio = self._repository.get_public_portfolio(portfolio_id)
        if not portfolio:
            return None

        # Build asset allocation and public trades list
        instruments = {item.symbol: item for item in self._provider.instruments()}
        holdings_list: list[dict[str, object]] = []
        total_market_value = Decimal()

        for h in portfolio.holdings:
            inst = instruments.get(h.symbol)
            cur_price = inst.price if inst and inst.price > 0 else Decimal("30000")
            mv = round_vnd(cur_price * Decimal(h.quantity))
            total_market_value += mv
            unrealized = mv - h.total_cost_basis
            roi = (
                ((unrealized / h.total_cost_basis) * Decimal("100")).quantize(Decimal("0.01"))
                if h.total_cost_basis
                else Decimal("0")
            )
            holdings_list.append(
                {
                    "symbol": h.symbol,
                    "name": h.name,
                    "exchange": h.exchange,
                    "sector": h.sector,
                    "quantity": h.quantity,
                    "current_price": f"{cur_price:,.0f} đ",
                    "cost_basis": f"{h.total_cost_basis:,.0f} đ",
                    "market_value": f"{mv:,.0f} đ",
                    "unrealized_pnl": f"{unrealized:+,.0f} đ",
                    "roi_percent": f"{roi:+.2f}%",
                }
            )

        total_assets = portfolio.cash_balance + total_market_value
        realized = portfolio.realized_pnl
        total_roi = (
            (realized / portfolio.starting_cash * Decimal("100")).quantize(Decimal("0.01"))
            if portfolio.starting_cash
            else Decimal("0")
        )

        return {
            "id": portfolio.id,
            "nickname": portfolio.nickname or "Nhà đầu tư ẩn danh",
            "starting_cash": f"{portfolio.starting_cash:,.0f} đ",
            "cash_balance": f"{portfolio.cash_balance:,.0f} đ",
            "total_assets": f"{total_assets:,.0f} đ",
            "realized_pnl": f"{realized:+,.0f} đ",
            "roi_percent": f"{total_roi:+.2f}%",
            "holdings": holdings_list,
            "trades": [_trade_payload(t) for t in portfolio.trades[:30]],
        }
