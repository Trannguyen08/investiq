"""Account administration decisions independent of HTTP and persistence details."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol


class UserAdministrationRepository(Protocol):
    def list_admin_users(
        self,
        query: str,
        role: str | None,
        account_status: str | None,
        provider: str | None,
        limit: int,
        pagination_cursor: tuple[datetime, str, str] | None,
    ) -> tuple[list[dict[str, Any]], int]: ...

    def update_admin_user(
        self,
        *,
        actor_id: str,
        target_id: str,
        role: str | None,
        account_status: str | None,
        request_id: str,
    ) -> dict[str, Any] | None: ...


class ManageUsers:
    def __init__(self, repository: UserAdministrationRepository) -> None:
        self._repository = repository

    def list(
        self,
        *,
        query: str = "",
        role: str | None = None,
        status: str | None = None,
        provider: str | None = None,
        limit: int = 25,
        cursor: tuple[datetime, str, str] | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        if len(query) > 120:
            raise ValueError("Search query is too long")
        if not 1 <= limit <= 100:
            raise ValueError("Pagination values are outside the allowed range")
        if role not in (None, "user", "admin"):
            raise ValueError("Role filter is invalid")
        if status not in (None, "active", "disabled"):
            raise ValueError("Status filter is invalid")
        if provider not in (None, "password", "google"):
            raise ValueError("Provider filter is invalid")
        return self._repository.list_admin_users(
            query.strip(), role, status, provider, limit, cursor
        )

    def update(
        self,
        *,
        actor_id: str,
        target_id: str,
        role: str | None,
        status: str | None,
        request_id: str,
    ) -> dict[str, Any] | None:
        if role is None and status is None:
            raise ValueError("At least one field must be updated")
        if role not in (None, "user", "admin"):
            raise ValueError("Role is invalid")
        if status not in (None, "active", "disabled"):
            raise ValueError("Status is invalid")
        return self._repository.update_admin_user(
            actor_id=actor_id,
            target_id=target_id,
            role=role,
            account_status=status,
            request_id=request_id,
        )
