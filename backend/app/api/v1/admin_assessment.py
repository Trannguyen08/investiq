"""Admin management router for investor assessment questions, personas, and submissions."""

from __future__ import annotations

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_admin_user, require_auth_bff
from app.infrastructure.db.repositories.sql_assessment_repository import (
    SqlAssessmentRepository,
    get_assessment_repository,
)
from app.schemas.assessment import (
    AdminAssessmentPageResponse,
    AdminAssessmentStatsResponse,
    AdminAssessmentSummaryItem,
    AdminPersonaUpdateRequest,
    AdminQuestionCreateRequest,
    AdminQuestionStatusRequest,
    AdminQuestionUpdateRequest,
    AssessmentOptionSchema,
    AssessmentQuestionResponse,
    InvestorPersonaResponse,
)

router = APIRouter(
    prefix="/api/v1/admin/assessment",
    tags=["admin-assessment"],
    dependencies=[Depends(require_admin_user), Depends(require_auth_bff)],
)


@router.get("/stats", response_model=AdminAssessmentStatsResponse)
def get_admin_assessment_stats(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> AdminAssessmentStatsResponse:
    """Thống kê tổng quan về khảo sát và phân bổ các nhóm nhà đầu tư."""
    stats = repository.get_admin_stats()
    return AdminAssessmentStatsResponse(**stats)


@router.get("/submissions", response_model=AdminAssessmentPageResponse)
def list_admin_assessment_submissions(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
    page: Annotated[int, Query(ge=1, description="Số trang")] = 1,
    limit: Annotated[int, Query(ge=1, le=100, description="Số bản ghi mỗi trang")] = 20,
    persona_code: Annotated[str | None, Query(description="Lọc theo nhóm Persona")] = None,
    readiness_level: Annotated[str | None, Query(description="Lọc theo mức độ sẵn sàng")] = None,
) -> AdminAssessmentPageResponse:
    """Danh sách các bài khảo sát người dùng nộp có phân trang và bộ lọc."""
    items_raw, total = repository.list_admin_assessments(
        page=page,
        limit=limit,
        persona_code=persona_code,
        readiness_level=readiness_level,
    )
    pages = max(1, math.ceil(total / limit))
    items = [AdminAssessmentSummaryItem(**it) for it in items_raw]
    return AdminAssessmentPageResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/questions", response_model=list[AssessmentQuestionResponse])
def list_admin_assessment_questions(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> list[AssessmentQuestionResponse]:
    """Danh sách toàn bộ các câu hỏi trắc nghiệm (bao gồm cả bản nháp) dành cho Admin."""
    raw = repository.get_questions(status=None)
    results: list[AssessmentQuestionResponse] = []
    for q in raw:
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


@router.post("/questions", response_model=AssessmentQuestionResponse, status_code=status.HTTP_201_CREATED)
def create_admin_assessment_question(
    payload: AdminQuestionCreateRequest,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> AssessmentQuestionResponse:
    """Thêm một câu hỏi trắc nghiệm mới vào ngân hàng đề."""
    created = repository.create_question(payload.model_dump())
    options = [
        AssessmentOptionSchema(
            id=opt["id"],
            label=opt["label"],
            risk_weight=opt.get("risk_weight", 50),
            persona_weights=opt.get("persona_weights", {}),
        )
        for opt in created.get("options", [])
    ]
    return AssessmentQuestionResponse(
        id=created["id"],
        sort_order=int(created.get("sort_order", 1)),
        category=created.get("category", "risk_tolerance"),
        prompt=created["prompt"],
        subtext=created.get("subtext"),
        options=options,
        status=created.get("status", "published"),
    )


@router.put("/questions/{question_id}", response_model=AssessmentQuestionResponse)
def update_admin_assessment_question(
    question_id: str,
    payload: AdminQuestionUpdateRequest,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> AssessmentQuestionResponse:
    """Chỉnh sửa nội dung hoặc trọng số của câu hỏi trắc nghiệm."""
    updated = repository.update_question(question_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy câu hỏi với ID '{question_id}'.",
        )
    options = [
        AssessmentOptionSchema(
            id=opt["id"],
            label=opt["label"],
            risk_weight=opt.get("risk_weight", 50),
            persona_weights=opt.get("persona_weights", {}),
        )
        for opt in updated.get("options", [])
    ]
    return AssessmentQuestionResponse(
        id=updated["id"],
        sort_order=int(updated.get("sort_order", 1)),
        category=updated.get("category", "risk_tolerance"),
        prompt=updated["prompt"],
        subtext=updated.get("subtext"),
        options=options,
        status=updated.get("status", "published"),
    )


@router.delete("/questions/{question_id}")
def delete_admin_assessment_question(
    question_id: str,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> dict[str, str]:
    """Xóa một câu hỏi khỏi ngân hàng câu hỏi."""
    deleted = repository.delete_question(question_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy câu hỏi với ID '{question_id}'.",
        )
    return {"status": "ok", "message": f"Đã xóa câu hỏi '{question_id}'."}


@router.patch("/questions/{question_id}/status")
def toggle_admin_assessment_question_status(
    question_id: str,
    payload: AdminQuestionStatusRequest,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> dict[str, str]:
    """Đổi trạng thái xuất bản (published / draft) của câu hỏi."""
    updated = repository.update_question(question_id, {"status": payload.status})
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy câu hỏi với ID '{question_id}'.",
        )
    return {"status": "ok", "new_status": payload.status}


@router.get("/personas", response_model=list[InvestorPersonaResponse])
def list_admin_personas(
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> list[InvestorPersonaResponse]:
    """Danh sách các nhóm hình mẫu nhà đầu tư dành cho Admin quản trị."""
    personas = repository.get_personas()
    return [InvestorPersonaResponse(**p) for p in personas]


@router.put("/personas/{code}", response_model=InvestorPersonaResponse)
def update_admin_persona(
    code: str,
    payload: AdminPersonaUpdateRequest,
    repository: Annotated[SqlAssessmentRepository, Depends(get_assessment_repository)],
) -> InvestorPersonaResponse:
    """Cập nhật thông tin chiến lược hoặc tỷ lệ phân bổ tài sản của nhóm Persona."""
    updated = repository.update_persona(code, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Persona với mã '{code}'.",
        )
    return InvestorPersonaResponse(**updated)
