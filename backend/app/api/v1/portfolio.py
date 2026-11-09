"""Authenticated private paper-trading endpoints."""

from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status

from app.api.deps import authenticated_user_id, require_auth_bff
from app.api.v1.market_data import get_market_provider
from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.simulate_trade import (
    PaperOrderError,
    PaperTradingService,
)
from app.domain.entities.portfolio import PaperOrder, PaperTrade
from app.domain.repositories.i_portfolio_repository import (
    HoldingLimitError,
    InsufficientCashError,
    InsufficientSharesError,
    OrderNotCancellableError,
    PortfolioConflictError,
)
from app.infrastructure.db.repositories.sql_portfolio_repository import (
    SqlPortfolioRepository,
)
from app.infrastructure.db.session import get_pool
from app.schemas.portfolio import (
    AdvanceSaleCashRequest,
    AdvanceSaleCashResponse,
    CancelPaperOrderResponse,
    PaperDashboardResponse,
    PaperReportSubscriptionResponse,
    PlacePaperOrderRequest,
    PlacePaperOrderResponse,
    SendPaperReportNowResponse,
    SetExecutionModeRequest,
    SetPaperReportSubscriptionRequest,
    UpsertConditionalTriggerRequest,
)
from app.schemas.thesis import (
    PublicPortfolioDetailResponse,
    SetPublicVisibilityRequest,
    SocialLeaderboardResponse,
)

router = APIRouter(
    prefix="/api/v1/paper-portfolio",
    tags=["paper-portfolio"],
    dependencies=[Depends(require_auth_bff)],
)


@lru_cache
def get_paper_trading_service() -> PaperTradingService:
    return PaperTradingService(SqlPortfolioRepository(get_pool()), get_market_provider())


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"


def _order_response(order: PaperOrder) -> dict[str, object]:
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
        "limit_price": format(order.limit_price, "f"),
        "reserved_cash": format(order.reserved_cash, "f"),
        "reserved_quantity": order.reserved_quantity,
        "provider": order.provider,
        "price_at": order.price_at,
        "received_at": order.received_at,
        "delay_class": order.delay_class,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "expires_at": order.expires_at,
        "cancelled_at": order.cancelled_at,
    }


def _trade_response(trade: PaperTrade | None) -> dict[str, object] | None:
    if trade is None:
        return None
    return {
        "id": trade.id,
        "side": trade.side,
        "symbol": trade.symbol,
        "name": trade.name,
        "exchange": trade.exchange,
        "quantity": trade.quantity,
        "execution_price": format(trade.execution_price, "f"),
        "gross_amount": format(trade.gross_amount, "f"),
        "fee_amount": format(trade.fee_amount, "f"),
        "tax_amount": format(trade.tax_amount, "f"),
        "cash_effect": format(trade.cash_effect, "f"),
        "realized_pnl": format(trade.realized_pnl, "f") if trade.realized_pnl is not None else None,
        "provider": trade.provider,
        "price_at": trade.price_at,
        "received_at": trade.received_at,
        "delay_class": trade.delay_class,
        "created_at": trade.created_at,
    }


@router.get("", response_model=PaperDashboardResponse)
def paper_dashboard(
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    return service.dashboard(user_id)


@router.post("/orders", response_model=PlacePaperOrderResponse, status_code=status.HTTP_201_CREATED)
def place_paper_order(
    body: PlacePaperOrderRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=16, max_length=128)],
) -> dict[str, object]:
    _private(response)
    try:
        order, trade = service.place_order(
            user_id,
            PlacePaperOrder(
                side=body.side,
                symbol=body.symbol.upper(),
                quantity=body.quantity,
                order_type=body.order_type,
                limit_price=Decimal(body.limit_price),
                idempotency_key=idempotency_key,
                execution_mode=body.execution_mode,
                use_orderbook_depth=body.use_orderbook_depth,
                strict_rules=body.strict_rules,
                stop_loss_price=Decimal(body.stop_loss_price) if body.stop_loss_price else None,
                take_profit_price=(
                    Decimal(body.take_profit_price) if body.take_profit_price else None
                ),
            ),
        )
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except (InsufficientCashError, InsufficientSharesError, HoldingLimitError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PortfolioConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "order": _order_response(order),
        "trade": _trade_response(trade),
        "data": service.dashboard(user_id),
    }


@router.post(
    "/orders/{order_id}/fill",
    response_model=PlacePaperOrderResponse,
)
def force_fill_paper_order(
    order_id: UUID,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    try:
        order, trade = service.force_fill_order(user_id, str(order_id))
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except (InsufficientCashError, InsufficientSharesError, HoldingLimitError, PortfolioConflictError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "order": _order_response(order),
        "trade": _trade_response(trade),
        "data": service.dashboard(user_id),
    }


@router.post(
    "/execution-mode",
    response_model=PaperDashboardResponse,
)
def set_paper_execution_mode(
    body: SetExecutionModeRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    try:
        return service.set_execution_mode(user_id, body.execution_mode)
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc


@router.post(
    "/advance-cash",
    response_model=AdvanceSaleCashResponse,
)
def advance_paper_sale_cash(
    body: AdvanceSaleCashRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    try:
        return service.advance_sale_cash(
            user_id,
            Decimal(body.amount) if body.amount else None,
        )
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc


@router.post(
    "/conditional-triggers",
    response_model=PaperDashboardResponse,
)
def upsert_paper_conditional_trigger(
    body: UpsertConditionalTriggerRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    try:
        return service.upsert_conditional_trigger(
            user_id=user_id,
            symbol=body.symbol,
            stop_loss_price=Decimal(body.stop_loss_price) if body.stop_loss_price else None,
            take_profit_price=Decimal(body.take_profit_price) if body.take_profit_price else None,
            quantity=body.quantity,
        )
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc


@router.delete(
    "/conditional-triggers/{trigger_id}",
    response_model=PaperDashboardResponse,
)
def cancel_paper_conditional_trigger(
    trigger_id: str,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    return service.cancel_conditional_trigger(user_id, trigger_id)



@router.delete(
    "/orders/{order_id}",
    response_model=CancelPaperOrderResponse,
)
def cancel_paper_order(
    order_id: UUID,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    try:
        order = service.cancel_order(user_id, str(order_id))
    except (OrderNotCancellableError, PortfolioConflictError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"order": _order_response(order), "data": service.dashboard(user_id)}


@router.post(
    "/visibility",
    response_model=PaperDashboardResponse,
)
def set_visibility(
    body: SetPublicVisibilityRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    service.set_public_visibility(
        user_id=user_id,
        is_public=body.is_public,
        nickname=body.nickname,
    )
    return service.dashboard(user_id)


@router.get(
    "/daily-report/subscription",
    response_model=PaperReportSubscriptionResponse,
)
def get_daily_report_subscription(
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> dict[str, object]:
    _private(response)
    from app.infrastructure.db.repositories.sql_paper_report_repository import (
        get_paper_report_repository,
    )

    repo = get_paper_report_repository()
    sub = repo.get_subscription(user_id)
    if sub:
        return sub
    default_email = f"user_{user_id[:8]}@investiq.vn"
    return repo.upsert_subscription(user_id=user_id, email=default_email, is_active=True)


@router.post(
    "/daily-report/subscription",
    response_model=PaperReportSubscriptionResponse,
)
def update_daily_report_subscription(
    body: SetPaperReportSubscriptionRequest,
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
) -> dict[str, object]:
    _private(response)
    from app.infrastructure.db.repositories.sql_paper_report_repository import (
        get_paper_report_repository,
    )

    repo = get_paper_report_repository()
    return repo.upsert_subscription(user_id=user_id, email=body.email, is_active=body.is_active)


@router.post(
    "/daily-report/send-now",
    response_model=SendPaperReportNowResponse,
)
def send_daily_report_now(
    response: Response,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    _private(response)
    from app.application.use_cases.portfolio.ai_portfolio_advisor import (
        generate_ai_portfolio_review,
    )
    from app.infrastructure.db.repositories.sql_paper_report_repository import (
        get_paper_report_repository,
    )
    from app.infrastructure.external.notifications.paper_portfolio_email import (
        send_paper_portfolio_daily_email,
    )

    repo = get_paper_report_repository()
    sub = repo.get_subscription(user_id)
    target_email = (sub.get("email") if sub else None) or f"user_{user_id[:8]}@investiq.vn"
    dashboard = service.dashboard(user_id)
    account_raw = dashboard.get("account")
    account_dict: dict[str, Any] = dict(account_raw) if isinstance(account_raw, dict) else {}
    holdings_raw = dashboard.get("holdings")
    holdings_list: list[dict[str, Any]] = list(holdings_raw) if isinstance(holdings_raw, list) else []
    trades_raw = dashboard.get("trades")
    trades_list: list[dict[str, Any]] | None = list(trades_raw) if isinstance(trades_raw, list) else None

    ai_review = generate_ai_portfolio_review(
        account_data=account_dict,
        holdings_data=holdings_list,
        trades_data=trades_list,
    )

    success, msg = send_paper_portfolio_daily_email(
        to_email=target_email,
        account_data=account_dict,
        ai_review=ai_review,
    )
    repo.mark_sent(user_id)
    return {
        "success": success,
        "message": msg,
        "recipient": target_email,
    }


public_portfolio_router = APIRouter(
    prefix="/api/v1/paper-portfolio",
    tags=["paper-portfolio"],
)


@public_portfolio_router.get("/leaderboard", response_model=SocialLeaderboardResponse)
def get_social_leaderboard(
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
    limit: int = 10,
) -> dict[str, object]:
    return {"data": service.get_social_leaderboard(limit=min(50, max(1, limit)))}


@public_portfolio_router.get(
    "/public/{portfolio_id}",
    response_model=PublicPortfolioDetailResponse,
)
def get_public_portfolio(
    portfolio_id: UUID,
    service: Annotated[PaperTradingService, Depends(get_paper_trading_service)],
) -> dict[str, object]:
    result = service.get_public_portfolio_detail(str(portfolio_id))
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục công khai này.")
    return result
