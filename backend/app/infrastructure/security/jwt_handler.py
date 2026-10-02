"""Short-lived signed access tokens with strict claim verification."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt


class JwtError(ValueError):
    pass


class JwtHandler:
    algorithm = "HS256"

    def __init__(
        self,
        secret: str,
        issuer: str,
        audience: str,
        ttl_seconds: int,
        previous_secret: str | None = None,
    ) -> None:
        if len(secret) < 32:
            raise ValueError("AUTH_JWT_SECRET must contain at least 32 characters")
        self._secret = secret
        self._previous_secret = previous_secret
        self._issuer = issuer
        self._audience = audience
        self._ttl = ttl_seconds

    def issue(self, user_id: str, session_id: str, role: str = "user") -> tuple[str, datetime]:
        issued_at = datetime.now(UTC)
        expires_at = issued_at + timedelta(seconds=self._ttl)
        token = jwt.encode(
            {
                "sub": user_id,
                "sid": session_id,
                "jti": str(uuid4()),
                "role": role,
                "iss": self._issuer,
                "aud": self._audience,
                "iat": issued_at,
                "exp": expires_at,
            },
            self._secret,
            algorithm=self.algorithm,
            headers={"kid": "current", "typ": "JWT"},
        )
        return token, expires_at

    def verify(self, token: str) -> dict[str, object]:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if kid not in {"current", "previous"}:
                raise JwtError("Unknown signing key")
            secret = self._secret if kid == "current" else self._previous_secret
            if secret is None:
                raise JwtError("Signing key is unavailable")
            claims = jwt.decode(
                token,
                secret,
                algorithms=[self.algorithm],
                issuer=self._issuer,
                audience=self._audience,
                options={"require": ["sub", "sid", "jti", "iss", "aud", "iat", "exp"]},
            )
        except (jwt.PyJWTError, ValueError, TypeError) as exc:
            raise JwtError("Invalid access token") from exc
        if not isinstance(claims.get("sub"), str) or not isinstance(claims.get("sid"), str):
            raise JwtError("Invalid access token claims")
        return claims
