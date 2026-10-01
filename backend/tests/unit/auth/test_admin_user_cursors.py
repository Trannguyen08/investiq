from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from app.api.v1.admin_users import _decode_cursor, _encode_cursor


def test_user_cursor_round_trips_time_order_and_page() -> None:
    created_at = datetime(2026, 10, 1, 12, 30, tzinfo=UTC)
    user_id = "eb7240ac-1fa4-4af7-a57e-a85e74a454a3"

    encoded = _encode_cursor(created_at, user_id, "after", 2)

    assert _decode_cursor(encoded) == (created_at, user_id, "after", 2)


@pytest.mark.parametrize("cursor", ["bad", "e30", "W10"])
def test_user_cursor_rejects_invalid_payloads(cursor: str) -> None:
    with pytest.raises(HTTPException) as error:
        _decode_cursor(cursor)

    assert error.value.status_code == 422
