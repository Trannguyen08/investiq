"""Google OpenID Connect authorization-code exchange and claim validation."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import cast
from urllib.parse import urlparse

import jwt


class GoogleOidcError(ValueError):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    display_name: str
    avatar_url: str | None


class GoogleOidcClient:
    token_url = "https://oauth2.googleapis.com/token"
    jwks_url = "https://www.googleapis.com/oauth2/v3/certs"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri

    def exchange(self, code: str, verifier: str, nonce: str) -> GoogleIdentity:
        body = urllib.parse.urlencode(
            {
                "code": code,
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "redirect_uri": self._redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": verifier,
            }
        ).encode()
        request = urllib.request.Request(
            self.token_url,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                raw = response.read(65537)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise GoogleOidcError("Google authentication is unavailable") from exc
        if len(raw) > 65536:
            raise GoogleOidcError("Google response is too large")
        try:
            token = json.loads(raw).get("id_token")
            if not isinstance(token, str):
                raise GoogleOidcError("Google did not return an identity token")
            signing_key = jwt.PyJWKClient(self.jwks_url, timeout=5).get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._client_id,
                issuer=["accounts.google.com", "https://accounts.google.com"],
                options={"require": ["sub", "email", "email_verified", "exp", "iat", "nonce"]},
            )
        except (json.JSONDecodeError, jwt.PyJWTError, ValueError, TypeError) as exc:
            raise GoogleOidcError("Google identity could not be verified") from exc
        if claims.get("nonce") != nonce or claims.get("email_verified") is not True:
            raise GoogleOidcError("Google identity could not be verified")
        picture = claims.get("picture") if isinstance(claims.get("picture"), str) else None
        if picture:
            parsed = urlparse(picture)
            if parsed.scheme != "https" or parsed.hostname not in {
                "lh3.googleusercontent.com",
                "googleusercontent.com",
            }:
                picture = None
        name = (
            claims.get("name")
            if isinstance(claims.get("name"), str)
            else str(claims["email"]).split("@", 1)[0]
        )
        return GoogleIdentity(str(claims["sub"]), str(claims["email"]), cast(str, name), picture)
