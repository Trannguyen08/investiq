"""Precise VND money helpers used by simulated portfolio rules."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

VND = Decimal("1")


def round_vnd(value: Decimal) -> Decimal:
    """Round a modeled cash amount to the nearest đồng."""
    return value.quantize(VND, rounding=ROUND_HALF_UP)


def decimal_text(value: Decimal) -> str:
    return format(value, "f")
