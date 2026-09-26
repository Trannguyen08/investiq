# Testing Rules

## Test placement

- Backend unit tests cover pure domain rules and application decisions without FastAPI, database,
  Redis, Celery, or provider infrastructure.
- Integration tests cover repositories, migrations, cache, broker, workers, and API boundaries;
  use real disposable services/containers where practical rather than imitating their behavior.
- Frontend component tests cover interaction and accessibility. E2E remains a small set of critical
  auth, portfolio, prediction, backtest, alert, and admin journeys.
- Contract tests validate API responses against the exported schema and keep frontend consumers in sync.

## Test quality

- Assert observable contracts and invariants, not private methods, call order, or implementation trivia.
- Mock external providers at owned adapter boundaries; do not mock the application's own layers just
  to make a unit test easy.
- Cover success, validation, authorization, concurrency/idempotency, empty/stale data, dependency
  failure, and meaningful boundary values according to risk.
- A bug regression test must fail for the original defect and pass with the fix; verify both when feasible.
- Financial calculations use table-driven examples with currency/precision, rounding, zero, negative,
  and large-value cases. ML tests use fixed seeds and frozen small fixtures, not production datasets.
- Control clock, timezone (`UTC`), randomness, network, and persistent state. Database tests isolate
  each test with rollback or a per-worker schema/database.
- Treat skips and retries as missing evidence. Diagnose/quarantine flaky tests visibly; never rerun
  until green and report a clean pass.
- Use coverage to find gaps, not as the goal. High-risk money, auth, parsers, and migrations deserve
  stronger assertions and property/fuzz or scoped mutation tests when tooling exists.
- Run focused tests first, then the affected service suite, lint/type checks, and relevant E2E checks.
  Report exact commands, failures, skips, and checks not run.
