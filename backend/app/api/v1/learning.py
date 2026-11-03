"""Public learning curriculum and interactive quiz evaluation router."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.infrastructure.db.repositories.sql_learning_repository import (
    SqlLearningRepository,
    get_learning_repository,
)
from app.schemas.learning import (
    LearningTopicDetailResponse,
    LearningTopicSummaryResponse,
    QuizAnswerResult,
    SubmitQuizRequest,
    SubmitQuizResponse,
)

router = APIRouter(
    prefix="/api/v1/learning",
    tags=["learning"],
)


@router.get("/topics")
def get_learning_topics(
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
    level: Annotated[
        str | None,
        Query(pattern="^(beginner|intermediate|advanced)$", description="Lọc theo cấp độ bài học"),
    ] = None,
    full: Annotated[bool, Query(description="Lấy chi tiết đầy đủ của bài học")] = False,
) -> list[Any]:
    """Lấy danh sách các bài học chứng khoán đã xuất bản, sắp xếp từ cơ bản tới nâng cao."""
    topics = repository.get_topics(level=level, status="published")
    if full:
        return [LearningTopicDetailResponse(**item) for item in topics]

    results: list[LearningTopicSummaryResponse] = []
    for item in topics:
        quizzes = item.get("quizzes") or []
        results.append(
            LearningTopicSummaryResponse(
                id=item["id"],
                slug=item["slug"],
                level=item.get("level", "beginner"),
                stage=int(item.get("stage", 1)),
                sort_order=int(item.get("sort_order", 1)),
                title=item["title"],
                eyebrow=item.get("eyebrow", ""),
                summary=item.get("summary", ""),
                estimated_minutes=int(item.get("estimated_minutes", 5)),
                quiz_count=len(quizzes),
                status=item.get("status", "published"),
                updated_at=str(item.get("updated_at", "")),
            )
        )
    return results


@router.get("/topics/{slug}", response_model=LearningTopicDetailResponse)
def get_learning_topic_detail(
    slug: str,
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> LearningTopicDetailResponse:
    """Lấy chi tiết bài học gồm lý thuyết, ví dụ thực tế và bộ câu hỏi trắc nghiệm."""
    topic = repository.get_topic_by_slug(slug)
    if not topic or topic.get("status") != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học '{slug}' hoặc bài học chưa xuất bản.",
        )
    return LearningTopicDetailResponse(**topic)


@router.post("/topics/{slug}/submit-quiz", response_model=SubmitQuizResponse)
def submit_topic_quiz(
    slug: str,
    payload: SubmitQuizRequest,
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> SubmitQuizResponse:
    """Chấm điểm bài kiểm tra trắc nghiệm củng cố kiến thức."""
    topic = repository.get_topic_by_slug(slug)
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học '{slug}'.",
        )

    quizzes: list[dict[str, Any]] = topic.get("quizzes") or []
    if not quizzes:
        return SubmitQuizResponse(
            score=0,
            total=0,
            percentage=100.0,
            passed=True,
            details=[],
        )

    score = 0
    total = len(quizzes)
    details: list[QuizAnswerResult] = []

    for q in quizzes:
        q_id = str(q.get("id"))
        selected_opt_id = payload.answers.get(q_id, "")
        options: list[dict[str, Any]] = q.get("options") or []

        matched_opt = next((opt for opt in options if str(opt.get("id")) == selected_opt_id), None)
        is_correct = bool(matched_opt and matched_opt.get("correct"))

        if is_correct:
            score += 1
            feedback = matched_opt.get("feedback") or "Chính xác!" if matched_opt else "Đúng."
        else:
            correct_opt = next((opt for opt in options if opt.get("correct")), None)
            feedback = (
                matched_opt.get("feedback")
                if matched_opt and matched_opt.get("feedback")
                else f"Chưa đúng. Đáp án đúng là: {correct_opt.get('label') if correct_opt else ''}"
            )

        details.append(
            QuizAnswerResult(
                question_id=q_id,
                selected_option_id=selected_opt_id,
                correct=is_correct,
                feedback=feedback,
            )
        )

    percentage = round((score / total) * 100, 1) if total > 0 else 100.0
    passed = score == total

    return SubmitQuizResponse(
        score=score,
        total=total,
        percentage=percentage,
        passed=passed,
        details=details,
    )
