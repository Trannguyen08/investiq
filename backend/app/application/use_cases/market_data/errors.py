"""Stable application errors for market-data dependencies."""


class MarketDataUnavailable(RuntimeError):
    """Raised when the configured provider cannot serve a trustworthy snapshot."""

