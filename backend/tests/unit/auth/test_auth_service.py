from datetime import UTC, datetime

import pytest
from cryptography.fernet import Fernet

from app.application.use_cases.auth.auth_service import AuthError, AuthService
from app.domain.entities.user import User
from app.infrastructure.security.jwt_handler import JwtError, JwtHandler
from app.infrastructure.security.password_hasher import PasswordHasher


class LoginRepository:
    def __init__(self, password_hash: str) -> None:
        self.user = User(
            "11111111-1111-4111-8111-111111111111",
            "user@example.com",
            "Nguyễn An",
            "user",
            "active",
            datetime.now(UTC),
        )
        self.password_hash = password_hash
        self.session: dict[str, object] = {}
        self.audit: list[tuple[str, str]] = []

    def authenticate(self, email: str) -> tuple[User, str] | None:
        return (self.user, self.password_hash) if email == self.user.email else None

    def create_session(self, user: User, **values: object) -> None:
        self.session = values

    def record_audit(self, event_type: str, outcome: str, *args: object, **kwargs: object) -> None:
        self.audit.append((event_type, outcome))


def make_service(repository: object) -> AuthService:
    return AuthService(
        repository,  # type: ignore[arg-type]
        PasswordHasher(),
        JwtHandler("j" * 48, "investiq", "investiq-api", 300),
        "o" * 48,
        Fernet.generate_key().decode(),
    )


def test_login_hashes_password_and_creates_server_session() -> None:
    password = "a-secure-password-long-enough"
    password_hash = PasswordHasher().hash(password)
    repository = LoginRepository(password_hash)

    credentials = make_service(repository).login(" User@Example.com ", password, remember=True)

    assert credentials.user.email == "user@example.com"
    assert credentials.refresh_token.startswith(f"{credentials.session_id}.")
    assert repository.session["remember"] is True
    assert repository.session["refresh_hash"] != credentials.refresh_token
    assert repository.audit == [("login", "success")]


def test_login_returns_uniform_error_for_unknown_or_wrong_password() -> None:
    repository = LoginRepository(PasswordHasher().hash("a-secure-password-long-enough"))
    service = make_service(repository)

    for email in ("missing@example.com", "user@example.com"):
        with pytest.raises(AuthError) as error:
            service.login(email, "definitely-the-wrong-password", remember=False)
        assert error.value.code == "INVALID_CREDENTIALS"
        assert error.value.message == "Email hoặc mật khẩu không đúng."


def test_password_policy_and_jwt_claim_validation() -> None:
    with pytest.raises(AuthError, match="15"):
        AuthService.validate_password("short", "short")
    with pytest.raises(AuthError, match="khớp"):
        AuthService.validate_password("long-password-value", "different-value-long")

    handler = JwtHandler("k" * 48, "investiq", "investiq-api", 300)
    token, _ = handler.issue("user-id", "session-id")
    assert handler.verify(token)["sid"] == "session-id"
    with pytest.raises(JwtError):
        JwtHandler("x" * 48, "other", "investiq-api", 300).verify(token)


def test_google_login_rejects_disabled_identity_before_creating_session() -> None:
    class DisabledGoogleRepository:
        def __init__(self) -> None:
            self.session_created = False
            self.audit: list[tuple[str, str]] = []

        def create_google_user_or_login(self, **_: object) -> tuple[User, None]:
            return (
                User(
                    "11111111-1111-4111-8111-111111111111",
                    "user@example.com",
                    "Nguyễn An",
                    "user",
                    "disabled",
                    datetime.now(UTC),
                    "google",
                ),
                None,
            )

        def create_session(self, *_: object, **__: object) -> None:
            self.session_created = True

        def record_audit(self, event_type: str, outcome: str, *args: object) -> None:
            self.audit.append((event_type, outcome))

    repository = DisabledGoogleRepository()

    with pytest.raises(AuthError) as error:
        make_service(repository).google_login(
            subject="google-subject",
            email="user@example.com",
            display_name="Nguyễn An",
            avatar_url=None,
            remember=False,
        )

    assert error.value.code == "INVALID_CREDENTIALS"
    assert repository.session_created is False
    assert repository.audit == [("google_login", "denied")]
