"""Last-known-good market snapshot fallback for provider outages."""

from __future__ import annotations

from typing import Any

import pytest

from app.api.v1 import market_data
from app.application.use_cases.market_data.errors import MarketDataUnavailable
from app.infrastructure.cache.market_snapshot_store import MarketSnapshotStore, mark_stale


class _FakeConnection:
    def __init__(self, rows: dict[str, dict[str, Any]], *, fail: bool) -> None:
        self._rows = rows
        self._fail = fail
        self._result: tuple[Any, ...] | None = None

    def __enter__(self) -> _FakeConnection:
        if self._fail:
            raise OSError("database unreachable")
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, sql: str, params: tuple[Any, ...]) -> _FakeConnection:
        if sql.lstrip().startswith("INSERT"):
            import json

            self._rows[params[0]] = json.loads(params[2])
            self._result = None
        else:
            payload = self._rows.get(params[0])
            self._result = (payload,) if payload is not None else None
        return self

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._result


class _FakePool:
    def __init__(self, *, fail: bool = False) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.fail = fail
        self.calls = 0

    def connection(self) -> _FakeConnection:
        self.calls += 1
        return _FakeConnection(self.rows, fail=self.fail)


class _Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _payload() -> dict[str, Any]:
    return {"meta": {"freshness": "fresh", "market_time": "2026-11-13T07:45:00+00:00"}, "data": [1]}


def test_store_persists_and_reloads_after_process_restart() -> None:
    pool = _FakePool()
    writer = MarketSnapshotStore(lambda: pool)  # type: ignore[arg-type, return-value]
    writer.save("overview", "k1", _payload())

    cold_start = MarketSnapshotStore(lambda: pool)  # type: ignore[arg-type, return-value]
    assert cold_start.load("k1") == _payload()
    assert cold_start.load("missing") is None


def test_store_throttles_writes_per_key() -> None:
    pool = _FakePool()
    clock = _Clock()
    store = MarketSnapshotStore(
        lambda: pool,  # type: ignore[arg-type, return-value]
        write_interval_seconds=300,
        clock=clock,
    )
    store.save("overview", "k1", _payload())
    store.save("overview", "k1", _payload())
    assert pool.calls == 1
    clock.now += 301
    store.save("overview", "k1", _payload())
    assert pool.calls == 2


def test_store_backs_off_when_database_is_unreachable() -> None:
    pool = _FakePool(fail=True)
    clock = _Clock()
    store = MarketSnapshotStore(
        lambda: pool,  # type: ignore[arg-type, return-value]
        failure_backoff_seconds=60,
        clock=clock,
    )
    assert store.load("k1") is None
    assert store.load("k2") is None
    assert pool.calls == 1


def test_disabled_store_is_a_no_op() -> None:
    pool = _FakePool()
    store = MarketSnapshotStore(lambda: pool, enabled=False)  # type: ignore[arg-type, return-value]
    store.save("overview", "k1", _payload())
    assert store.load("k1") is None
    assert pool.calls == 0


def test_mark_stale_keeps_original_market_time() -> None:
    stale = mark_stale(_payload())
    assert stale["meta"]["freshness"] == "stale"
    assert stale["meta"]["market_time"] == "2026-11-13T07:45:00+00:00"
    assert _payload()["meta"]["freshness"] == "fresh"


def test_fallback_serves_stale_snapshot_when_provider_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store = MarketSnapshotStore(_FakePool)  # type: ignore[arg-type]
    monkeypatch.setattr(market_data, "get_market_snapshot_store", lambda: store)

    payload, from_snapshot = market_data._with_snapshot_fallback("events", "k1", _payload)
    assert from_snapshot is False

    def unavailable() -> dict[str, Any]:
        raise MarketDataUnavailable("maintenance window")

    stale, from_snapshot = market_data._with_snapshot_fallback("events", "k1", unavailable)
    assert from_snapshot is True
    assert isinstance(stale, dict)
    assert stale["meta"]["freshness"] == "stale"
    assert stale["data"] == payload["data"]  # type: ignore[index]

    with pytest.raises(MarketDataUnavailable):
        market_data._with_snapshot_fallback("events", "never-stored", unavailable)
