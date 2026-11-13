"""Public investor persona discovery, discipline scoring, and readiness evaluation endpoints."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import optional_user_id
from app.infrastructure.db.repositories.sql_assessment_repository import (
    SqlAssessmentRepository,
    get_assessment_repository,
)
from app.schemas.assessment import (
    AssessmentOptionSchema,
    AssessmentQuestionResponse,
    DisciplineMetricsResponse,
    InvestorPersonaResponse,
    ReadinessEvaluationResponse,
    SubmitAssessmentRequest,
)

router = APIRouter(
    prefix="/api/v1/assessment",
    tags=["assessment"],
)


@router.get("/questions", response_model=list[AssessmentQuestionResponse])
def get_assessment_questions(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> list[AssessmentQuestionResponse]:
    """Lấy danh sách 10 câu hỏi trắc nghiệm định hướng nhà đầu tư đã xuất bản."""
    raw_questions = repository.get_questions(status="published")
    results: list[AssessmentQuestionResponse] = []
    for q in raw_questions:
        options = [
            AssessmentOptionSchema(
                id=opt["id"],
                label=opt["label"],
                risk_weight=opt.get("risk_weight", 50),
                persona_weights=opt.get("persona_weights", {}),
            )
            for opt in q.get("options", [])
        ]
        results.append(
            AssessmentQuestionResponse(
                id=q["id"],
                sort_order=int(q.get("sort_order", 1)),
                category=q.get("category", "risk_tolerance"),
                prompt=q["prompt"],
                subtext=q.get("subtext"),
                options=options,
                status=q.get("status", "published"),
            )
        )
    return results


@router.get("/personas", response_model=list[InvestorPersonaResponse])
def get_investor_personas(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> list[InvestorPersonaResponse]:
    """Lấy danh sách 4 nhóm hình mẫu nhà đầu tư chuẩn mực."""
    personas = repository.get_personas()
    return [InvestorPersonaResponse(**p) for p in personas]


@router.get("/personas/{code}", response_model=InvestorPersonaResponse)
def get_investor_persona_detail(
    code: str,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> InvestorPersonaResponse:
    """Xem thông tin chi tiết của một hình mẫu nhà đầu tư theo mã."""
    persona = repository.get_persona(code)
    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hình mẫu nhà đầu tư với mã '{code}'.",
        )
    return InvestorPersonaResponse(**persona)


@router.post("/evaluate", response_model=ReadinessEvaluationResponse)
def submit_and_evaluate_assessment(
    payload: SubmitAssessmentRequest,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
    user_id: Annotated[str | None, Depends(optional_user_id)],
) -> ReadinessEvaluationResponse:
    """Nộp bài trắc nghiệm, tính toán Persona, khẩu vị rủi ro và mức độ sẵn sàng đầu tư."""
    if not payload.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách câu trả lời không được để trống.",
        )

    record = repository.evaluate_assessment(
        answers=payload.answers,
        user_id=user_id,
        guest_identifier=payload.guest_identifier,
        knowledge_score=payload.knowledge_score,
        discipline_score=payload.discipline_score,
    )

    persona = record["persona"]
    persona_resp = InvestorPersonaResponse(**persona)

    return ReadinessEvaluationResponse(
        id=record["id"],
        persona=persona_resp,
        risk_score=record["risk_score"],
        knowledge_score=record["knowledge_score"],
        discipline_score=record["discipline_score"],
        overall_readiness_score=record["overall_readiness_score"],
        readiness_level=record["readiness_level"],
        readiness_label=record["readiness_label"],
        verdict_summary=record["verdict_summary"],
        can_trade_real_money=record["can_trade_real_money"],
        recommended_action=record["recommended_action"],
        created_at=record["created_at"],
        answers=record.get("answers", {}),
    )


@router.get("/latest", response_model=ReadinessEvaluationResponse | None)
def get_latest_readiness_report(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
    user_id: Annotated[str | None, Depends(optional_user_id)],
    guest_identifier: Annotated[str | None, Query(description="Mã ẩn danh")] = None,
) -> ReadinessEvaluationResponse | None:
    """Lấy kết quả đánh giá sẵn sàng gần nhất của người dùng hoặc khách."""
    record = repository.get_latest_assessment(user_id=user_id, guest_identifier=guest_identifier)
    if not record:
        return None

    persona = record["persona"]
    persona_resp = InvestorPersonaResponse(**persona)

    return ReadinessEvaluationResponse(
        id=record["id"],
        persona=persona_resp,
        risk_score=record["risk_score"],
        knowledge_score=record["knowledge_score"],
        discipline_score=record["discipline_score"],
        overall_readiness_score=record["overall_readiness_score"],
        readiness_level=record["readiness_level"],
        readiness_label=record["readiness_label"],
        verdict_summary=record["verdict_summary"],
        can_trade_real_money=record["can_trade_real_money"],
        recommended_action=record["recommended_action"],
        created_at=record["created_at"],
        answers=record.get("answers", {}),
    )


@router.get("/discipline", response_model=DisciplineMetricsResponse)
def get_trading_discipline_metrics(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
    user_id: Annotated[str | None, Depends(optional_user_id)],
) -> DisciplineMetricsResponse:
    """Tính toán chỉ số kỷ luật giao dịch thực tế từ tài khoản Paper Trading."""
    cash_vnd = 100_000_000.0
    holdings: list[dict[str, Any]] = []
    orders: list[dict[str, Any]] = []

    # In a full run, if user_id is provided, try retrieving real paper portfolio data
    if user_id:
        try:
            from app.api.v1.portfolio import get_paper_trading_service

            service = get_paper_trading_service()
            dash = service.dashboard(user_id)
            cash_vnd = float(str(dash.get("cash_balance_vnd", 100_000_000.0)))
            raw_holdings = dash.get("holdings") or []
            if isinstance(raw_holdings, list):
                holdings = [
                    {
                        "symbol": str(h.get("symbol", "")),
                        "market_value": float(str(h.get("current_value_vnd", 0))),
                        "unrealized_pnl_percent": float(str(h.get("unrealized_pnl_percent", 0))),
                    }
                    for h in raw_holdings
                    if isinstance(h, dict)
                ]
            raw_trades = dash.get("trades") or []
            if isinstance(raw_trades, list):
                orders = [
                    {"id": str(t.get("id")), "symbol": str(t.get("symbol"))}
                    for t in raw_trades
                    if isinstance(t, dict)
                ]
        except Exception:
            pass

    metrics = repository.calculate_discipline_score(
        cash_vnd=cash_vnd,
        holdings=holdings,
        realized_orders=orders,
    )
    return DisciplineMetricsResponse(**metrics)
