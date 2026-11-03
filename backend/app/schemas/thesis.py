"""Schemas for community investment thesis arena and social paper trading."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class CreateThesisRequest(BaseModel):
    symbol: str = Field(
        ..., min_length=1, max_length=10, description="Mã cổ phiếu niêm yết (vd: HPG, FPT)"
    )
    stance: str = Field(
        ..., description="'bullish' (Tăng giá), 'bearish' (Giảm giá), hoặc 'neutral'"
    )
    target_price: Decimal = Field(..., gt=0, description="Giá mục tiêu (VND)")
    stop_loss_price: Decimal = Field(..., gt=0, description="Giá cắt lỗ an toàn (VND)")
    horizon_months: int = Field(3, description="Khung thời gian đầu tư: 1, 3, 6, 12 tháng")
    title: str = Field(..., min_length=5, max_length=240, description="Tiêu đề luận điểm")
    thesis_body: str = Field(
        ..., min_length=20, max_length=5000, description="Nội dung phân tích cơ bản & kỹ thuật"
    )
    catalysts: list[str] = Field(
        default_factory=list, description="Danh sách sự kiện động lực tăng giá"
    )


class ThesisResponse(BaseModel):
    id: str
    user_id: str
    author_name: str
    symbol: str
    stance: str
    entry_price: str
    target_price: str
    stop_loss_price: str
    current_price: str
    progress_percent: str
    horizon_months: int
    title: str
    thesis_body: str
    catalysts: list[str]
    status: str
    outcome_roi: str | None = None
    closed_at: str | None = None
    closed_price: str | None = None
    upvotes: int
    created_at: str
    updated_at: str


class ThesesListResponse(BaseModel):
    data: list[ThesisResponse]
    total: int


class AnalystReputationResponse(BaseModel):
    user_id: str
    author_name: str
    total_theses: int
    active_theses: int
    successful_theses: int
    stopped_theses: int
    win_rate_percent: str
    avg_roi_percent: str
    rank_tier: str


class AnalystLeaderboardResponse(BaseModel):
    data: list[AnalystReputationResponse]


class SetPublicVisibilityRequest(BaseModel):
    is_public: bool = Field(..., description="Bật/tắt công khai danh mục mô phỏng")
    nickname: str | None = Field(
        None, max_length=60, description="Biệt danh hiển thị trên bảng xếp hạng"
    )


class SocialLeaderboardItem(BaseModel):
    portfolio_id: str
    nickname: str
    starting_cash: str
    cash_balance: str
    realized_pnl: str
    roi_percent: str
    roi_number: float
    holding_count: int
    total_trades: int
    win_trades: int


class SocialLeaderboardResponse(BaseModel):
    data: list[SocialLeaderboardItem]


class PublicPortfolioDetailResponse(BaseModel):
    id: str
    nickname: str
    starting_cash: str
    cash_balance: str
    total_assets: str
    realized_pnl: str
    roi_percent: str
    holdings: list[dict[str, Any]]
    trades: list[dict[str, Any]]
