from typing import Any

import pytest

from app.application.use_cases.admin.manage_users import ManageUsers


class UserRepositoryFake:
    def __init__(self) -> None:
        self.list_args: tuple[Any, ...] | None = None
        self.update_args: dict[str, Any] | None = None

    def list_admin_users(self, *args: Any) -> tuple[list[dict[str, Any]], int]:
        self.list_args = args
        return [], 0

    def update_admin_user(self, **kwargs: Any) -> dict[str, Any] | None:
        self.update_args = kwargs
        return None


def test_user_list_filters_are_validated_and_trimmed() -> None:
    repository = UserRepositoryFake()

    assert ManageUsers(repository).list(
        query="  alice ", role="user", limit=10
    ) == ([], 0)

    assert repository.list_args == ("alice", "user", None, None, 10, None)


@pytest.mark.parametrize(
    "values",
    [
        {"query": "x" * 121},
        {"role": "owner"},
        {"status": "deleted"},
        {"provider": "other"},
        {"limit": 101},
    ],
)
def test_user_list_rejects_invalid_filters(values: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        ManageUsers(UserRepositoryFake()).list(**values)


def test_user_update_requires_a_mutable_field() -> None:
    with pytest.raises(ValueError, match="At least one field"):
        ManageUsers(UserRepositoryFake()).update(
            actor_id="actor",
            target_id="target",
            role=None,
            status=None,
            request_id="request",
        )


@pytest.mark.parametrize(
    "role,status",
    [("owner", None), (None, "deleted")],
)
def test_user_update_rejects_unknown_role_and_status(role: str | None, status: str | None) -> None:
    with pytest.raises(ValueError):
        ManageUsers(UserRepositoryFake()).update(
            actor_id="actor",
            target_id="target",
            role=role,
            status=status,
            request_id="request",
        )
