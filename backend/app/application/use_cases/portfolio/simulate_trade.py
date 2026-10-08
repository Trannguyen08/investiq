"""Paper-trading orchestration and valuation."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.application.dto.portfolio_dto import PlacePaperOrder
from app.domain.entities.portfolio import PaperPortfolio, PaperTrade
from app.domain.repositories.i_market_provider import IMarketProvider
from app.domain.repositories.i_portfolio_repository import IPortfolioRepository, PaperExecution
from app.domain.value_objects.money import decimal_text, round_vnd

STARTING_CASH = Decimal("100000000")
BROKER_FEE_RATE = Decimal("0.0015")
SELL_TAX_RATE = Decimal("0.001")
MAX_HOLDINGS = 20


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


class PaperTradingService:
    def __init__(self, repository: IPortfolioRepository, provider: IMarketProvider) -> None:
        self._repository = repository
        self._provider = provider

    def place_order(self, user_id: str, command: PlacePaperOrder) -> PaperTrade:
        instrument = self._provider.instrument(command.symbol, include_fundamentals=False)
        if instrument is None:
            raise PaperOrderError("UNKNOWN_INSTRUMENT", "Không tìm thấy mã cổ phiếu này.")
        if instrument.price <= 0:
            raise PaperOrderError(
                "PRICE_UNAVAILABLE",
                "Chưa có giá quan sát hợp lệ để mô phỏng khớp lệnh.",
            )
        gross = round_vnd(instrument.price * Decimal(command.quantity))
        fee = round_vnd(gross * BROKER_FEE_RATE)
        tax_rate = SELL_TAX_RATE if command.side == "sell" else Decimal()
        tax = round_vnd(gross * tax_rate)
        execution = PaperExecution(
            idempotency_key=command.idempotency_key,
            side=command.side,
            symbol=instrument.symbol,
            name=instrument.name,
            exchange=instrument.exchange,
            sector=instrument.sector,
            quantity=command.quantity,
            execution_price=instrument.price,
            gross_amount=gross,
            fee_rate=BROKER_FEE_RATE,
            fee_amount=fee,
            tax_rate=tax_rate,
            tax_amount=tax,
            provider=self._provider.slug,
            price_at=_market_datetime(self._provider.market_time),
            received_at=datetime.now(UTC),
            delay_class=self._provider.delay_class,
        )
        return self._repository.execute(user_id, STARTING_CASH, execution, MAX_HOLDINGS)

    def dashboard(self, user_id: str) -> dict[str, object]:
        portfolio = self._repository.get_or_create(user_id, STARTING_CASH)
        holdings: list[dict[str, object]] = []
        total_market_value = Decimal()
        missing_prices = 0
        notices: list[dict[str, str]] = []

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
                market_value - holding.total_cost_basis
                if market_value is not None
                else None
            )
            unrealized_percent = (
                unrealized / holding.total_cost_basis * Decimal("100")
                if unrealized is not None and holding.total_cost_basis
                else None
            )
            candles = list(self._provider.candles(holding.symbol, "1d"))[-30:]
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
            total_pnl / portfolio.starting_cash * Decimal("100")
            if total_pnl is not None
            else None
        )
        for holding_payload in holdings:
            raw_market_value = holding_payload["market_value"]
            weight = (
                Decimal(str(raw_market_value)) / total_value * Decimal("100")
                if raw_market_value is not None and total_value
                else None
            )
            holding_payload["portfolio_weight_percent"] = (
                decimal_text(weight.quantize(Decimal("0.01")))
                if weight is not None
                else None
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
        equity_curve = self._equity_curve(portfolio)
        return {
            "account": {
                "id": portfolio.id,
                "currency": portfolio.currency,
                "starting_cash": decimal_text(portfolio.starting_cash),
                "cash_balance": decimal_text(portfolio.cash_balance),
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
                "created_at": _iso(portfolio.created_at),
                "updated_at": _iso(portfolio.updated_at),
            },
            "holdings": holdings,
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
                "fill_model": "latest_observed_price",
                "max_holdings": MAX_HOLDINGS,
                "disclaimer": (
                    "Mô phỏng giáo dục, không đặt lệnh thật và không phải khuyến nghị đầu tư."
                ),
            },
            "market": {
                "provider": self._provider.slug,
                "provider_name": self._provider.display_name,
                "market_time": self._provider.market_time,
                "received_at": _iso(datetime.now(UTC)),
                "delay_class": self._provider.delay_class,
                "freshness": self._provider.freshness,
                "session": self._provider.session,
                "partial": self._provider.partial,
            },
        }

    def _equity_curve(self, portfolio: PaperPortfolio) -> list[dict[str, str]]:
        if not portfolio.holdings:
            return []
        close_by_symbol: dict[str, dict[str, Decimal]] = {}
        for holding in portfolio.holdings:
            candles = self._provider.candles(holding.symbol, "1d")[-90:]
            if not candles:
                continue
            close_by_symbol[holding.symbol] = {
                candle.timestamp.date().isoformat(): candle.close for candle in candles
            }
        if not close_by_symbol:
            return []
        common_days = set.intersection(
            *(set(values) for values in close_by_symbol.values())
        )
        holding_by_symbol = {item.symbol: item for item in portfolio.holdings}
        by_date = {
            day: portfolio.cash_balance
            + sum(
                (
                    round_vnd(
                        values[day] * Decimal(holding_by_symbol[symbol].quantity)
                    )
                    for symbol, values in close_by_symbol.items()
                ),
                Decimal(),
            )
            for day in common_days
        }
        return [
            {"timestamp": f"{day}T08:00:00Z", "value": decimal_text(value)}
            for day, value in sorted(by_date.items())[-90:]
        ]
