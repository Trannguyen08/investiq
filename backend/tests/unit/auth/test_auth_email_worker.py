import re
from email.message import EmailMessage

import pytest
from pydantic import ValidationError

from app.infrastructure.config.settings import Settings
from app.workers.auth_email_worker import _message


def test_auth_otp_lifetime_is_fixed_at_90_seconds() -> None:
    assert Settings().auth_otp_seconds == 90
    with pytest.raises(ValidationError):
        Settings.model_validate({"auth_otp_seconds": 120})


def test_registration_and_password_reset_otp_emails_share_the_same_design(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.infrastructure.config.settings import settings

    monkeypatch.setattr(settings, "auth_mail_from", "InvestIQ <no-reply@example.com>")
    messages: list[EmailMessage] = []
    for template in ("registration_otp", "password_reset_otp"):
        messages.append(
            _message({"template": template, "email": "user@example.com", "otp": "123456"})
        )

    assert all(message["Date"] for message in messages)
    assert all(message["Message-ID"] for message in messages)
    html_parts = [message.get_body(preferencelist=("html",)) for message in messages]
    text_parts = [message.get_body(preferencelist=("plain",)) for message in messages]
    assert all(part is not None for part in html_parts)
    assert all(part is not None for part in text_parts)
    html_bodies = [part.get_content() for part in html_parts if part is not None]
    styles = [re.findall(r'style="([^"]+)"', body) for body in html_bodies]
    for text_part, html in zip(text_parts, html_bodies, strict=True):
        assert text_part is not None
        assert "123456" in text_part.get_content()
        assert "90 giây" in text_part.get_content()
        assert "123456" in html
        assert "90 giây" in html
    assert styles[0] == styles[1]
