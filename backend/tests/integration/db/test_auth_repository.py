import os
from collections.abc import Generator

import pytest
from cryptography.fernet import Fernet
from psycopg_pool import ConnectionPool

from app.application.use_cases.admin.manage_users import ManageUsers
from app.application.use_cases.auth.auth_service import AuthError, AuthService
from app.infrastructure.db.base import apply_migrations
from app.infrastructure.db.repositories.sql_user_repository import SqlUserRepository
from app.infrastructure.security.jwt_handler import JwtHandler
from app.infrastructure.security.password_hasher import PasswordHasher

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def auth_repository() -> Generator[SqlUserRepository, None, None]:
    database_url = TEST_DATABASE_URL
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is required for auth repository integration tests")
    apply_migrations(database_url)
    pool = ConnectionPool(database_url, min_size=1, max_size=2, open=True)
    with pool.connection() as connection, connection.transaction():
        connection.execute(
            """TRUNCATE auth_audit_events, auth_email_jobs, password_reset_grants,
               refresh_tokens, auth_sessions, auth_challenges, user_identities, users
               RESTART IDENTITY CASCADE"""
        )
    try:
        yield SqlUserRepository(pool)
    finally:
        pool.close()


def test_registration_login_refresh_reuse_and_logout(auth_repository: SqlUserRepository) -> None:
    service = AuthService(
        auth_repository,
        PasswordHasher(),
        JwtHandler("j" * 48, "investiq", "investiq-api", 300),
        "o" * 48,
        Fernet.generate_key().decode(),
    )
    service._otp = lambda: "123456"  # type: ignore[method-assign]
    pre_auth_id = "11111111-1111-4111-8111-111111111111"
    challenge_id, job_id = service.register(
        pre_auth_id,
        " An@example.com ",
        "Nguyễn An",
        "a-secure-password-long-enough",
        "a-secure-password-long-enough",
    )
    assert job_id

    verified = service.verify_registration(pre_auth_id, challenge_id, "123456", False)
    assert service.current_user(verified.access_token).display_name == "Nguyễn An"

    logged_in = service.login("an@example.com", "a-secure-password-long-enough", remember=True)
    rotated = service.refresh(logged_in.refresh_token)
    assert rotated.refresh_token != logged_in.refresh_token

    with pytest.raises(AuthError, match="hết hạn"):
        service.refresh(logged_in.refresh_token)
    with pytest.raises(AuthError, match="hết hạn"):
        service.current_user(rotated.access_token)

    service.logout(verified.access_token)
    with pytest.raises(AuthError):
        service.current_user(verified.access_token)


def test_admin_user_update_revokes_sessions_and_audits(auth_repository: SqlUserRepository) -> None:
    service = AuthService(
        auth_repository,
        PasswordHasher(),
        JwtHandler("j" * 48, "investiq", "investiq-api", 300),
        "o" * 48,
        Fernet.generate_key().decode(),
    )
    service._otp = lambda: "123456"  # type: ignore[method-assign]

    def register(email: str, preauth: str) -> str:
        challenge, _ = service.register(
            preauth,
            email,
            "Test Account",
            "a-secure-password-long-enough",
            "a-secure-password-long-enough",
        )
        return service.verify_registration(preauth, challenge, "123456", False).user.id

    admin_id = register("admin@example.com", "11111111-1111-4111-8111-111111111111")
    target_id = register("target@example.com", "22222222-2222-4222-8222-222222222222")
    with auth_repository._pool.connection() as connection:
        connection.execute("UPDATE users SET role = 'admin' WHERE id = %s", (admin_id,))
    admin = service.login("admin@example.com", "a-secure-password-long-enough", False)
    target_session = service.login("target@example.com", "a-secure-password-long-enough", False)

    items, total = ManageUsers(auth_repository).list(query="target@", limit=10)
    assert total == 1
    assert items[0]["id"] == target_id
    assert "password_hash" not in items[0]

    updated = ManageUsers(auth_repository).update(
        actor_id=admin_id,
        target_id=target_id,
        role=None,
        status="disabled",
        request_id="request-admin-update",
    )
    assert updated is not None and updated["status"] == "disabled"
    with pytest.raises(AuthError):
        service.current_user(target_session.access_token)

    with pytest.raises(ValueError, match="last active administrator"):
        ManageUsers(auth_repository).update(
            actor_id=target_id,
            target_id=admin_id,
            role="user",
            status=None,
            request_id="request-last-admin",
        )
    with auth_repository._pool.connection() as connection:
        assert connection.execute(
            """SELECT count(*) FROM auth_audit_events
               WHERE event_type = 'admin_user_update' AND outcome = 'rejected'"""
        ).fetchone()[0] == 1
    assert service.current_user(admin.access_token).role == "admin"
