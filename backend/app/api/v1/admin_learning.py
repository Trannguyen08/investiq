"""Admin router for managing learning curriculum, topics, and quizzes."""

from __future__ import annotations

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_admin_user, require_auth_bff
from app.infrastructure.db.repositories.sql_learning_repository import (
    SqlLearningRepository,
    get_learning_repository,
)
from app.schemas.learning import (
    AdminLearningTopicPage,
    AdminTopicCreateRequest,
    AdminTopicStatusRequest,
    AdminTopicUpdateRequest,
    LearningTopicDetailResponse,
)

router = APIRouter(
    prefix="/api/v1/admin/learning",
    tags=["admin-learning"],
    dependencies=[Depends(require_auth_bff)],
)


@router.get("/topics", response_model=AdminLearningTopicPage)
def list_admin_learning_topics(
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    level: Annotated[str | None, Query(pattern="^(beginner|intermediate|advanced)$")] = None,
    status_filter: Annotated[
        str | None, Query(alias="status", pattern="^(published|draft)$")
    ] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminLearningTopicPage:
    """Quản trị viên lấy danh sách bài học với bộ lọc tìm kiếm và phân trang."""
    del actor_id
    items, total = repository.list_admin_topics(
        q=q,
        level=level,
        status=status_filter,
        page=page,
        limit=limit,
    )
    total_pages = max(1, math.ceil(total / limit))
    return AdminLearningTopicPage(
        items=[LearningTopicDetailResponse(**item) for item in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.post(
    "/topics", response_model=LearningTopicDetailResponse, status_code=status.HTTP_201_CREATED
)
def create_admin_learning_topic(
    payload: AdminTopicCreateRequest,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> LearningTopicDetailResponse:
    """Quản trị viên thêm bài học mới vào lộ trình đào tạo."""
    del actor_id
    existing = repository.get_topic_by_slug(payload.slug)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đường dẫn slug '{payload.slug}' đã tồn tại trong hệ thống.",
        )

    created = repository.create_topic(payload.model_dump())
    return LearningTopicDetailResponse(**created)


@router.get("/topics/{topic_id}", response_model=LearningTopicDetailResponse)
def get_admin_learning_topic_detail(
    topic_id: str,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> LearningTopicDetailResponse:
    """Quản trị viên lấy chi tiết bài học theo ID."""
    del actor_id
    topic = repository.get_topic_by_id(topic_id)
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học với ID '{topic_id}'.",
        )
    return LearningTopicDetailResponse(**topic)


@router.put("/topics/{topic_id}", response_model=LearningTopicDetailResponse)
def update_admin_learning_topic(
    topic_id: str,
    payload: AdminTopicUpdateRequest,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> LearningTopicDetailResponse:
    """Quản trị viên cập nhật bài học (Lý thuyết, ví dụ, trắc nghiệm)."""
    del actor_id
    data = payload.model_dump(exclude_unset=True)
    updated = repository.update_topic(topic_id, data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học với ID '{topic_id}' để cập nhật.",
        )
    return LearningTopicDetailResponse(**updated)


@router.delete("/topics/{topic_id}")
def delete_admin_learning_topic(
    topic_id: str,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> dict[str, str]:
    """Quản trị viên xóa bài học khỏi hệ thống."""
    del actor_id
    success = repository.delete_topic(topic_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học với ID '{topic_id}' để xóa.",
        )
    return {"status": "ok", "message": "Đã xóa bài học thành công."}


@router.patch("/topics/{topic_id}/status")
def toggle_admin_learning_topic_status(
    topic_id: str,
    payload: AdminTopicStatusRequest,
    actor_id: Annotated[str, Depends(require_admin_user)],
    repository: Annotated[SqlLearningRepository, Depends(get_learning_repository)],
) -> dict[str, str]:
    """Quản trị viên chuyển trạng thái bài học (Xuất bản / Bản nháp)."""
    del actor_id
    success = repository.update_topic_status(topic_id, payload.status)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bài học với ID '{topic_id}'.",
        )
    return {"status": "ok", "new_status": payload.status}
