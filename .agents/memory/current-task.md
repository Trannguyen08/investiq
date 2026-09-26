# Current Task

## Status

Complete.

## Objective

Standardize feature-level unit/integration testing and coverage reporting, install pytest-cov, and
document Docker, ports, and per-feature test commands from the repository root.

## Completed

- Pinned pytest-cov 7.1.0 and coverage.py 7.16.1; configured statement and branch reporting.
- Updated the testing rule so every feature requires meaningful unit and integration evidence, with
  frontend component/API-E2E equivalents and documented exceptions only when a level cannot apply.
- Added `backend/tests/run_feature_tests.py` as the registry/runner for isolated feature suites.
- Added the ignored `test-results/<feature>/<unit|integration>/` workspace for JUnit, Markdown, XML,
  and browsable HTML coverage reports.
- Expanded logging-viewer tests for redaction, exception/duration formatting, logger configuration,
  valid/invalid request IDs, health exclusions, 404 warnings, 503 errors, and unhandled exceptions.
- Added `DEVELOPMENT_GUIDE.md` at the repository root with environment setup, Docker lifecycle,
  active host/internal ports, all-backend tests, and per-feature commands.
- Updated backend CI to exercise pytest-cov, and synchronized README, architecture/project memory,
  and the architecture decision log.

## Validation

- Logging-viewer unit suite: 6 passed; 100.00% statement and branch coverage for
  `logging_config.py`.
- Logging-viewer integration suite: 5 passed; 100.00% statement and branch coverage for
  `request_logging.py`.
- Full backend suite: 13 passed; 89.18% statement/branch coverage across currently imported app
  modules, with only dependency-backed readiness branches in `main.py` uncovered.
- Ruff and strict mypy passed. Generated feature reports exist locally and are ignored by Git.
- `pip check`, Docker Compose resolution, test collection, runner help, and final diff/config checks
  passed.

## Next step

Register each new backend feature in `backend/tests/run_feature_tests.py`, run its `all` suite, and
review both HTML reports before considering the feature complete.
