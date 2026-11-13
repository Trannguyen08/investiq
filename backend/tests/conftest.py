"""Shared backend test configuration."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _block_live_db_pool_in_unit_tests(request: pytest.FixtureRequest) -> Iterator[None]:
    """Fail fast if unmocked code in unit tests attempts to open a real DB pool."""
    normalized_path = str(request.path).replace("\\", "/")
    if "/tests/unit/" in normalized_path:
        with patch(
            "app.infrastructure.db.session.get_pool",
            side_effect=RuntimeError("Real PostgreSQL pool disabled in unit tests"),
        ):
            yield
        return
    yield
