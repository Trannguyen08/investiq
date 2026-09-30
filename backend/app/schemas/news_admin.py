"""Protected news operations API contracts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StrictAdminModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceAdminResponse(StrictAdminModel):
    slug: str
    name: str
    status: str
    storage_mode: str
    display_mode: str
    row_version: int
    last_success_at: datetime | None
    blocked_reason: str | None


class SourceStatusUpdate(StrictAdminModel):
    status: str = Field(pattern="^(active|paused)$")
    expected_row_version: int = Field(ge=1)


class ManualCrawlRequest(StrictAdminModel):
    source_slug: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    limit: int = Field(default=50, ge=1, le=100)


class RetentionRequest(StrictAdminModel):
    retention_days: int = Field(default=90, ge=7, le=3650)
    dry_run: bool = True
    confirm: bool = False


class OperationResponse(StrictAdminModel):
    status: str
    operation_id: str | None = None
    matched: int | None = None
    deleted: int | None = None
    retention_days: int | None = None
    dry_run: bool | None = None


class CrawlRunResponse(StrictAdminModel):
    id: str
    source_slug: str
    trigger: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    discovered_count: int
    queued_count: int
    succeeded_count: int
    skipped_count: int
    failed_count: int
    error_code: str | None
