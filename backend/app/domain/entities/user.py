"""Framework-independent authenticated user representation."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class User:
    id: str
    email: str
    display_name: str
    role: str
    status: str
    email_verified_at: datetime | None
    provider: str = "password"
    avatar_url: str | None = None
