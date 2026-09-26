# Testing Rules

## Test placement

- Every new feature must add or update meaningful tests at both unit and integration levels before
  it is complete. Unit tests prove isolated decisions; integration tests prove the feature through
  its real application boundary. Do not add assertion-free, duplicate, or implementation-only tests
  merely to satisfy this requirement.
- Frontend-only features use component tests as the unit level and an API-boundary or focused E2E
  test as the integration level. If a feature genuinely has no applicable level, record the reason
  and the equivalent higher-confidence test in `.agents/memory/current-task.md`.
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

## Feature coverage reports

- Run backend feature suites through `backend/tests/run_feature_tests.py` and register each new
  feature's unit paths, integration paths, and owned coverage modules in that file.
- Generate branch-aware JUnit, Markdown, XML, and HTML output under
  `test-results/<feature-slug>/<unit|integration>/`. Generated reports stay untracked; only the
  report workspace documentation and ignore policy are committed.
- Review missing lines and branches for the modules owned by the feature. Coverage percentage is
  diagnostic evidence, not permission to omit boundary, failure, authorization, or concurrency
  behavior. Report unit and integration percentages separately.
