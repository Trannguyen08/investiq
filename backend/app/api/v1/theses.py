"""API endpoints for community investment theses and analyst reputation."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import authenticated_user_id, require_auth_bff
from app.api.v1.market_data import get_market_provider
from app.application.use_cases.community.thesis_service import (
    ThesisService,
    ThesisValidationError,
)
from app.infrastructure.db.repositories.sql_thesis_repository import SqlThesisRepository
from app.infrastructure.db.session import get_pool
from app.schemas.thesis import (
    AnalystLeaderboardResponse,
    CreateThesisRequest,
    ThesesListResponse,
    ThesisResponse,
)

router = APIRouter(
    prefix="/api/v1/theses",
    tags=["theses"],
)


def get_thesis_service() -> ThesisService:
    return ThesisService(SqlThesisRepository(get_pool()), get_market_provider())


@router.post("", response_model=ThesisResponse, status_code=status.HTTP_201_CREATED)
def create_thesis(
    body: CreateThesisRequest,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    _auth: Annotated[None, Depends(require_auth_bff)],
    service: Annotated[ThesisService, Depends(get_thesis_service)],
) -> dict[str, object]:
    try:
        created = service.publish_thesis(
            user_id=user_id,
            author_name=f"Analyst {user_id[:6]}",
            symbol=body.symbol,
            stance=body.stance,
            target_price=body.target_price,
            stop_loss_price=body.stop_loss_price,
            horizon_months=body.horizon_months,
            title=body.title,
            thesis_body=body.thesis_body,
            catalysts=tuple(body.catalysts),
        )
        return service._format_thesis(created)
    except ThesisValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc


@router.get("", response_model=ThesesListResponse)
def list_theses(
    service: Annotated[ThesisService, Depends(get_thesis_service)],
    symbol: str | None = Query(None, description="Lọc theo mã cổ phiếu"),
    status_filter: str | None = Query(
        None, alias="status", description="Lọc theo trạng thái: active, hit_target, stopped_out"
    ),
    sort: str = Query(
        "engagement",
        description="Sắp xếp: engagement (tương tác cao nhất & mới nhất) hoặc recent (mới nhất)",
    ),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict[str, object]:
    items = service.list_theses(
        symbol=symbol,
        status=status_filter,
        limit=limit,
        offset=offset,
        sort=sort,
    )
    return {"data": items, "total": len(items)}


@router.get("/leaderboard", response_model=AnalystLeaderboardResponse)
def get_analyst_leaderboard(
    service: Annotated[ThesisService, Depends(get_thesis_service)],
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, object]:
    return {"data": service.get_leaderboard(limit=limit)}


@router.get("/my", response_model=ThesesListResponse)
def list_my_theses(
    user_id: Annotated[str, Depends(authenticated_user_id)],
    _auth: Annotated[None, Depends(require_auth_bff)],
    service: Annotated[ThesisService, Depends(get_thesis_service)],
) -> dict[str, object]:
    items = service.list_by_user(user_id)
    return {"data": items, "total": len(items)}


@router.get("/{thesis_id}", response_model=ThesisResponse)
def get_thesis(
    thesis_id: UUID,
    service: Annotated[ThesisService, Depends(get_thesis_service)],
) -> dict[str, object]:
    item = service.get_thesis(str(thesis_id))
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy luận điểm đầu tư này.")
    return item


@router.post("/{thesis_id}/upvote")
def upvote_thesis(
    thesis_id: UUID,
    service: Annotated[ThesisService, Depends(get_thesis_service)],
) -> dict[str, int]:
    new_votes = service.upvote_thesis(str(thesis_id))
    return {"upvotes": new_votes}
