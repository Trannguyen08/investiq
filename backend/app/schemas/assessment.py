"""Pydantic schemas for investor persona discovery, discipline scoring, and readiness report."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    """Base model forbidding unexpected extra fields."""

    model_config = ConfigDict(extra="forbid")


class AssessmentOptionSchema(StrictModel):
    id: str = Field(..., description="Mã định danh lựa chọn")
    label: str = Field(..., description="Nội dung hiển thị của phương án")
    risk_weight: int = Field(..., ge=0, le=100, description="Trọng số rủi ro (0-100)")
    persona_weights: dict[str, int] = Field(
        ...,
        description="Trọng số tương thích với từng Persona (dca_accumulator, value_growth, active_swing, conservative_fund)",
    )


class AssessmentQuestionResponse(StrictModel):
    id: str
    sort_order: int
    category: str
    prompt: str
    subtext: str | None = None
    options: list[AssessmentOptionSchema]
    status: str = "published"


class InvestorPersonaResponse(StrictModel):
    code: str
    title: str
    tagline: str
    description: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_strategy: str
    asset_allocation: dict[str, int]
    ideal_time_hours_per_week: int
    suitable_instruments: list[str]


class DisciplineMetricsResponse(StrictModel):
    cut_loss_score: float = Field(..., ge=0, le=100, description="Điểm tuân thủ cắt lỗ")
    diversification_score: float = Field(..., ge=0, le=100, description="Điểm đa dạng hóa danh mục")
    cash_management_score: float = Field(
        ..., ge=0, le=100, description="Điểm quản trị tiền mặt dự phòng"
    )
    emotional_pacing_score: float = Field(
        ..., ge=0, le=100, description="Điểm kiểm soát nhịp độ giao dịch"
    )
    overall_discipline_score: float = Field(..., ge=0, le=100, description="Điểm kỷ luật tổng thể")
    badge: str = Field(..., description="Huy hiệu kỷ luật")
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class SubmitAssessmentRequest(StrictModel):
    answers: dict[str, str] = Field(
        ...,
        description="Bản đồ các câu trả lời: {question_id_or_number: option_id}",
    )
    guest_identifier: str | None = Field(default=None, description="Mã ẩn danh nếu chưa đăng nhập")
    knowledge_score: float | None = Field(
        default=None, ge=0, le=100, description="Điểm kiến thức từ bài học /learn"
    )
    discipline_score: float | None = Field(
        default=None, ge=0, le=100, description="Điểm kỷ luật từ paper trading"
    )


class ReadinessEvaluationResponse(StrictModel):
    id: str
    persona: InvestorPersonaResponse
    risk_score: float
    knowledge_score: float
    discipline_score: float
    overall_readiness_score: float
    readiness_level: str
    readiness_label: str
    verdict_summary: str
    can_trade_real_money: bool
    recommended_action: str
    created_at: str
    answers: dict[str, str] = Field(default_factory=dict)


# Admin Schemas
class AdminQuestionCreateRequest(StrictModel):
    sort_order: int = Field(default=1, ge=1)
    category: str = Field(..., min_length=2, max_length=50)
    prompt: str = Field(..., min_length=10)
    subtext: str | None = None
    options: list[AssessmentOptionSchema] = Field(..., min_length=2)
    status: str = Field(default="published", pattern="^(published|draft)$")


class AdminQuestionUpdateRequest(StrictModel):
    sort_order: int | None = Field(default=None, ge=1)
    category: str | None = Field(default=None, min_length=2, max_length=50)
    prompt: str | None = Field(default=None, min_length=10)
    subtext: str | None = None
    options: list[AssessmentOptionSchema] | None = None
    status: str | None = Field(default=None, pattern="^(published|draft)$")


class AdminQuestionStatusRequest(StrictModel):
    status: str = Field(..., pattern="^(published|draft)$")


class AdminPersonaUpdateRequest(StrictModel):
    title: str | None = None
    tagline: str | None = None
    description: str | None = None
    strengths: list[str] | None = None
    weaknesses: list[str] | None = None
    recommended_strategy: str | None = None
    asset_allocation: dict[str, int] | None = None
    ideal_time_hours_per_week: int | None = None
    suitable_instruments: list[str] | None = None


class AdminAssessmentSummaryItem(StrictModel):
    id: str
    user_id: str | None = None
    guest_identifier: str | None = None
    persona_code: str
    persona_title: str
    risk_score: float
    knowledge_score: float
    discipline_score: float
    readiness_score: float
    readiness_level: str
    readiness_label: str
    can_trade_real_money: bool
    created_at: str


class AdminAssessmentStatsResponse(StrictModel):
    total_assessments: int
    average_readiness_score: float
    ready_percentage: float
    top_persona_code: str
    top_persona_title: str
    persona_distribution: dict[str, int]


class AdminAssessmentPageResponse(StrictModel):
    items: list[AdminAssessmentSummaryItem]
    total: int
    page: int
    limit: int
    pages: int
