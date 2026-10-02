"""Strict authentication request/response contracts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RegisterRequest(StrictModel):
    pre_auth_id: str = Field(min_length=36, max_length=36)
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=1, max_length=128)
    password_confirmation: str = Field(min_length=1, max_length=128)


class LoginRequest(StrictModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class VerifyOtpRequest(StrictModel):
    pre_auth_id: str = Field(min_length=36, max_length=36)
    challenge_id: str = Field(min_length=36, max_length=36)
    otp: str = Field(pattern=r"^\d{6}$")


class ResendRequest(StrictModel):
    pre_auth_id: str = Field(min_length=36, max_length=36)
    challenge_id: str = Field(min_length=36, max_length=36)
    purpose: str = Field(pattern="^(registration|password_reset)$")


class PasswordResetRequest(StrictModel):
    pre_auth_id: str = Field(min_length=36, max_length=36)
    email: str = Field(min_length=3, max_length=320)


class PasswordResetCompleteRequest(StrictModel):
    reset_grant: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=1, max_length=128)
    password_confirmation: str = Field(min_length=1, max_length=128)


class RefreshRequest(StrictModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class GoogleExchangeRequest(StrictModel):
    code: str = Field(min_length=1, max_length=4096)
    code_verifier: str = Field(min_length=43, max_length=128)
    nonce: str = Field(min_length=20, max_length=256)


class UserResponse(StrictModel):
    id: str
    email: str
    display_name: str
    role: str
    provider: str
    avatar_url: str | None


class CredentialsResponse(StrictModel):
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    session_id: str
    user: UserResponse


class ChallengeResponse(StrictModel):
    challenge_id: str
    email_queued: bool
    expires_in: int = 90


class ChallengeStatusResponse(StrictModel):
    challenge_id: str
    purpose: str
    masked_email: str
    delivery_status: str
    expires_at: datetime
    resend_available_at: datetime
    consumed: bool


class ResetGrantResponse(StrictModel):
    reset_grant: str
