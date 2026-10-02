"""Strict contracts for administrator-managed user accounts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    email: str
    display_name: str
    role: str
    status: str
    provider: str
    email_verified_at: datetime | None
    created_at: datetime


class AdminUserPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminUserResponse]
    total: int
    limit: int
    page: int
    next_cursor: str | None
    previous_cursor: str | None


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str | None = Field(default=None, pattern="^(user|admin)$")
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
