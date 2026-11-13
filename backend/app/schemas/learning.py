"""Pydantic schemas for stock basics learning platform and admin management."""

from __future__ import annotations

from pydantic import BaseModel, Field


class QuizOptionSchema(BaseModel):
    id: str = Field(..., description="Mã đáp án (vd: opt1, opt2)")
    label: str = Field(..., description="Nội dung đáp án")
    correct: bool = Field(..., description="Đáp án đúng hay sai")
    feedback: str = Field(..., description="Giải thích chi tiết phản hồi")


class QuizQuestionSchema(BaseModel):
    id: str = Field(..., description="Mã câu hỏi (vd: q1, q2)")
    prompt: str = Field(..., description="Nội dung câu hỏi")
    options: list[QuizOptionSchema] = Field(..., min_length=2, description="Danh sách các lựa chọn")


class PracticalExampleSchema(BaseModel):
    title: str = Field(..., description="Tiêu đề ví dụ thực tế")
    ticker: str | None = Field(default=None, description="Mã cổ phiếu liên quan (vd: HPG, VCB)")
    scenario: str = Field(..., description="Tình huống thực tế trên thị trường")
    analysis: str = Field(..., description="Phân tích tình huống")
    key_takeaway: str = Field(..., description="Bài học mấu chốt rút ra")


class GlossaryTermSchema(BaseModel):
    term: str = Field(..., description="Thuật ngữ tài chính")
    definition: str = Field(..., description="Định nghĩa ngắn gọn")


class PracticeActionSchema(BaseModel):
    href: str = Field(default="/portfolio", description="Đường dẫn hành động")
    label: str = Field(default="Xem danh mục mô phỏng", description="Nhãn nút hành động")
    description: str = Field(
        default="Thực hành với dữ liệu mô phỏng", description="Mô tả hành động"
    )


class LearningTopicSummaryResponse(BaseModel):
    id: str
    slug: str
    level: str  # 'beginner' | 'intermediate' | 'advanced'
    stage: int
    sort_order: int
    title: str
    eyebrow: str
    summary: str
    estimated_minutes: int
    quiz_count: int
    status: str
    updated_at: str


class LearningTopicDetailResponse(BaseModel):
    id: str
    slug: str
    level: str
    stage: int
    sort_order: int
    title: str
    eyebrow: str
    summary: str
    estimated_minutes: int
    theory_content: str
    practical_example: PracticalExampleSchema
    quizzes: list[QuizQuestionSchema]
    glossary: list[GlossaryTermSchema]
    practice_action: PracticeActionSchema
    status: str
    created_at: str
    updated_at: str


class SubmitQuizRequest(BaseModel):
    answers: dict[str, str] = Field(
        ..., description="Bản đồ các câu trả lời: question_id -> option_id"
    )


class QuizAnswerResult(BaseModel):
    question_id: str
    selected_option_id: str
    correct: bool
    feedback: str


class SubmitQuizResponse(BaseModel):
    score: int
    total: int
    percentage: float
    passed: bool
    details: list[QuizAnswerResult]


class AdminTopicCreateRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=120)
    level: str = Field("beginner", pattern="^(beginner|intermediate|advanced)$")
    stage: int = Field(1, ge=1, le=10)
    sort_order: int = Field(1, ge=1, le=1000)
    title: str = Field(..., min_length=5, max_length=255)
    eyebrow: str = Field("", max_length=120)
    summary: str = Field(..., min_length=10)
    estimated_minutes: int = Field(5, ge=1, le=120)
    theory_content: str = Field(..., min_length=20)
    practical_example: PracticalExampleSchema
    quizzes: list[QuizQuestionSchema] = Field(default_factory=list)
    glossary: list[GlossaryTermSchema] = Field(default_factory=list)
    practice_action: PracticeActionSchema = Field(default_factory=PracticeActionSchema)
    status: str = Field("published", pattern="^(published|draft)$")


class AdminTopicUpdateRequest(BaseModel):
    level: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    stage: int | None = Field(default=None, ge=1, le=10)
    sort_order: int | None = Field(default=None, ge=1, le=1000)
    title: str | None = Field(default=None, min_length=5, max_length=255)
    eyebrow: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, min_length=10)
    estimated_minutes: int | None = Field(default=None, ge=1, le=120)
    theory_content: str | None = Field(default=None, min_length=20)
    practical_example: PracticalExampleSchema | None = None
    quizzes: list[QuizQuestionSchema] | None = None
    glossary: list[GlossaryTermSchema] | None = None
    practice_action: PracticeActionSchema | None = None
    status: str | None = Field(default=None, pattern="^(published|draft)$")


class AdminTopicStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(published|draft)$")


class AdminLearningTopicPage(BaseModel):
    items: list[LearningTopicDetailResponse]
    total: int
    page: int
    limit: int
    total_pages: int
