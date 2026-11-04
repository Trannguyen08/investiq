"""Per-step tracing, evaluation, and in-process metrics for the AI assistant.

Every chat request produces an ``AiTrace``: an ordered list of steps (guardrail, cache lookup,
intent detection, retrieval, generation, redaction, evaluation, cache store) with status, latency,
and a per-step evaluation verdict. The trace is logged as structured lines and aggregated into a
process-local ``AiMetricsRegistry`` that admins can read.

Telemetry never contains the raw question, answer, user ID, or ticker symbols: only bounded labels
(step names, statuses, guardrail categories, check names) and numbers.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger("investiq.ai.chat")

StepName = Literal[
    "guardrail",
    "cache_lookup",
    "intent_detection",
    "internal_data_retrieval",
    "knowledge_retrieval",
    "external_search",
    "response_generation",
    "citation",
    "output_redaction",
    "evaluation",
    "cache_store",
]
StepStatus = Literal["ok", "skipped", "blocked", "hit", "miss", "error"]
RequestOutcome = Literal["answered", "cached", "blocked", "error"]

LATENCY_BUDGET_MS = 3000.0


@dataclass
class AiStepRecord:
    name: StepName
    status: StepStatus = "ok"
    duration_ms: float = 0.0
    passed: bool | None = None
    note: str = ""

    def mark(self, status: StepStatus, *, passed: bool | None = None, note: str = "") -> None:
        self.status = status
        if passed is not None:
            self.passed = passed
        if note:
            self.note = note

    def as_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "status": self.status,
            "duration_ms": round(self.duration_ms, 2),
            "passed": self.passed,
            "note": self.note,
        }


@dataclass(frozen=True)
class AiEvaluation:
    score: float
    checks: dict[str, bool]

    @property
    def failed_checks(self) -> list[str]:
        return [name for name, ok in self.checks.items() if not ok]

    def as_dict(self) -> dict[str, object]:
        return {"score": self.score, "checks": dict(self.checks)}


def evaluate_response(
    content: str,
    *,
    blocked: bool,
    requested_tickers: list[str],
    resolved_tickers: list[str],
    external_urls: list[str],
    redactions: int,
    elapsed_ms: float,
) -> AiEvaluation:
    """Rule-based online evaluation of a single answer.

    Checks are deterministic so they can run on every request without another model call:
    - ``non_empty``: the answer has text.
    - ``grounded_on_internal_data``: every resolved ticker is mentioned in the answer.
    - ``external_sources_cited``: every crawled external URL is cited in the answer.
    - ``no_sensitive_leak``: output redaction found nothing to mask.
    - ``within_latency_budget``: end-to-end latency stayed under the budget.
    - ``ticker_coverage``: every requested ticker resolved to internal data (skipped if blocked).
    """
    checks: dict[str, bool] = {
        "non_empty": bool(content.strip()),
        "no_sensitive_leak": redactions == 0,
        "within_latency_budget": elapsed_ms <= LATENCY_BUDGET_MS,
    }
    if not blocked:
        checks["grounded_on_internal_data"] = all(t in content for t in resolved_tickers)
        checks["external_sources_cited"] = all(url in content for url in external_urls)
        if requested_tickers:
            checks["ticker_coverage"] = set(requested_tickers[:3]) <= set(resolved_tickers)
    score = round(sum(checks.values()) / len(checks), 3)
    return AiEvaluation(score=score, checks=checks)


@dataclass
class _StepStats:
    count: int = 0
    errors: int = 0
    failed_evals: int = 0
    total_ms: float = 0.0
    max_ms: float = 0.0
    statuses: dict[str, int] = field(default_factory=dict)


class AiMetricsRegistry:
    """Thread-safe, process-local aggregates; safe to lose and not coherent across replicas."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._requests: dict[str, int] = {}
        self._guardrail_blocks: dict[str, int] = {}
        self._cache: dict[str, int] = {"hit": 0, "miss": 0, "store": 0}
        self._steps: dict[str, _StepStats] = {}
        self._eval_count = 0
        self._eval_score_sum = 0.0
        self._failed_checks: dict[str, int] = {}
        self._sources: dict[str, int] = {"internal": 0, "external": 0}
        self._latency_total_ms = 0.0
        self._latency_max_ms = 0.0

    def record_step(self, step: AiStepRecord) -> None:
        with self._lock:
            stats = self._steps.setdefault(step.name, _StepStats())
            stats.count += 1
            stats.total_ms += step.duration_ms
            stats.max_ms = max(stats.max_ms, step.duration_ms)
            stats.statuses[step.status] = stats.statuses.get(step.status, 0) + 1
            if step.status == "error":
                stats.errors += 1
            if step.passed is False:
                stats.failed_evals += 1
            if step.name == "cache_lookup" and step.status in ("hit", "miss"):
                self._cache[step.status] += 1
            if step.name == "cache_store" and step.status == "ok":
                self._cache["store"] += 1

    def record_request(
        self,
        outcome: RequestOutcome,
        *,
        elapsed_ms: float,
        evaluation: AiEvaluation | None,
        guardrail_category: str | None,
        internal_sources: int,
        external_sources: int,
    ) -> None:
        with self._lock:
            self._requests[outcome] = self._requests.get(outcome, 0) + 1
            self._latency_total_ms += elapsed_ms
            self._latency_max_ms = max(self._latency_max_ms, elapsed_ms)
            if guardrail_category:
                self._guardrail_blocks[guardrail_category] = (
                    self._guardrail_blocks.get(guardrail_category, 0) + 1
                )
            self._sources["internal"] += internal_sources
            self._sources["external"] += external_sources
            if evaluation is not None:
                self._eval_count += 1
                self._eval_score_sum += evaluation.score
                for name in evaluation.failed_checks:
                    self._failed_checks[name] = self._failed_checks.get(name, 0) + 1

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            total_requests = sum(self._requests.values())
            lookups = self._cache["hit"] + self._cache["miss"]
            return {
                "requests": {"total": total_requests, **self._requests},
                "latency_ms": {
                    "avg": round(self._latency_total_ms / total_requests, 2)
                    if total_requests
                    else 0.0,
                    "max": round(self._latency_max_ms, 2),
                },
                "guardrail_blocks": dict(self._guardrail_blocks),
                "cache": {
                    **self._cache,
                    "hit_ratio": round(self._cache["hit"] / lookups, 3) if lookups else 0.0,
                },
                "sources": dict(self._sources),
                "evaluation": {
                    "count": self._eval_count,
                    "avg_score": round(self._eval_score_sum / self._eval_count, 3)
                    if self._eval_count
                    else 0.0,
                    "failed_checks": dict(self._failed_checks),
                },
                "steps": {
                    name: {
                        "count": stats.count,
                        "errors": stats.errors,
                        "failed_evals": stats.failed_evals,
                        "avg_ms": round(stats.total_ms / stats.count, 2) if stats.count else 0.0,
                        "max_ms": round(stats.max_ms, 2),
                        "statuses": dict(stats.statuses),
                    }
                    for name, stats in self._steps.items()
                },
            }


class AiTrace:
    def __init__(
        self,
        metrics: AiMetricsRegistry,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self._metrics = metrics
        self._clock = clock
        self._started = clock()
        self.steps: list[AiStepRecord] = []

    @contextmanager
    def step(self, name: StepName) -> Iterator[AiStepRecord]:
        record = AiStepRecord(name=name)
        started = self._clock()
        try:
            yield record
        except Exception:
            record.mark("error", passed=False, note="exception")
            raise
        finally:
            record.duration_ms = (self._clock() - started) * 1000.0
            self.steps.append(record)
            self._metrics.record_step(record)
            logger.info(
                "ai_step name=%s status=%s passed=%s note=%s",
                record.name,
                record.status,
                record.passed,
                record.note or "-",
                extra={"duration_ms": round(record.duration_ms, 2)},
            )

    def skip(self, name: StepName, note: str) -> None:
        with self.step(name) as record:
            record.mark("skipped", note=note)

    def elapsed_ms(self) -> float:
        return (self._clock() - self._started) * 1000.0

    def finish(
        self,
        outcome: RequestOutcome,
        *,
        evaluation: AiEvaluation | None,
        guardrail_category: str | None = None,
        internal_sources: int = 0,
        external_sources: int = 0,
    ) -> float:
        elapsed = self.elapsed_ms()
        self._metrics.record_request(
            outcome,
            elapsed_ms=elapsed,
            evaluation=evaluation,
            guardrail_category=guardrail_category,
            internal_sources=internal_sources,
            external_sources=external_sources,
        )
        logger.info(
            "ai_request outcome=%s score=%s failed_checks=%s steps=%d",
            outcome,
            evaluation.score if evaluation else "-",
            ",".join(evaluation.failed_checks) if evaluation and evaluation.failed_checks else "-",
            len(self.steps),
            extra={"duration_ms": round(elapsed, 2)},
        )
        return elapsed
