"""Authenticated private paper-trading endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status

from app.api.deps import authenticated_user_id, require_auth_bff
from app.api.v1.market_data import get_market_provider
from app.application.dto.portfolio_dto import PlacePaperOrder
from app.application.use_cases.portfolio.simulate_trade import PaperOrderError, PaperTradingService
from app.domain.repositories.i_portfolio_repository import (
    HoldingLimitError,
    InsufficientCashError,
    InsufficientSharesError,
    PortfolioConflictError,
)
from app.infrastructure.db.repositories.sql_portfolio_repository import SqlPortfolioRepository
from app.infrastructure.db.session import get_pool
from app.schemas.portfolio import (
    PaperDashboardResponse,
    PlacePaperOrderRequest,
    PlacePaperOrderResponse,
)

router = APIRouter(
    prefix="/api/v1/paper-portfolio",
    tags=["paper-portfolio"],
    dependencies=[Depends(require_auth_bff)],
)


def get_paper_trading_service() -> PaperTradingService:
    return PaperTradingService(SqlPortfolioRepository(get_pool()), get_market_provider())


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"


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
        trade = service.place_order(
            user_id,
            PlacePaperOrder(
                side=body.side,
                symbol=body.symbol.upper(),
                quantity=body.quantity,
                idempotency_key=idempotency_key,
            ),
        )
    except PaperOrderError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except (InsufficientCashError, InsufficientSharesError, HoldingLimitError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PortfolioConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "trade": {
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
            "realized_pnl": (
                format(trade.realized_pnl, "f") if trade.realized_pnl is not None else None
            ),
            "provider": trade.provider,
            "price_at": trade.price_at,
            "received_at": trade.received_at,
            "delay_class": trade.delay_class,
            "created_at": trade.created_at,
        },
        "data": service.dashboard(user_id),
    }
