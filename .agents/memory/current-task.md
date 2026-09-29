# Current Task

## Status

Complete: researched all nine candidate sources and delivered a tested two-source Vietnamese
stock-market news MVP. No deployment was requested or performed.

## Objective

Deliver a runnable vertical slice for Vietstock and CafeF from discovery/parsing through PostgreSQL,
sentiment/symbol enrichment, versioned APIs, and responsive Next.js list/detail pages. Add periodic
backup/restore tooling, register feature tests, and report all nine candidate sources accurately.

## Confirmed constraints

- Periodic database backups only; no PostgreSQL replica.
- Preserve FastAPI/Next.js/PostgreSQL/Celery/Redis and Clean Architecture boundaries.
- Public crawler inputs are allowlisted and bounded; live websites are not called from CI tests.
- Vietstock exposes RSS feeds. CafeF robots currently allows crawling and advertises sitemap/news
  sitemap endpoints; full-text republication rights still require product/legal approval.
- Seven other candidate sources remain profiled until a public ingestion route and policy are confirmed.
- No standalone logo asset exists; implement a local accessible InvestIQ SVG mark based on the
  visible blue/green wordmark direction.

## Acceptance conditions

- Migration/repository support idempotent revisions, symbols, sentiment, and durable jobs.
- Vietstock/CafeF adapters parse deterministic fixtures and discover only allowlisted URLs.
- Public list/detail/source/security APIs use explicit schemas and stable cursor pagination.
- Celery work is bounded/idempotent and scheduled only when ingestion is enabled.
- News UI/header are responsive and handle empty/error/partial states.
- Backup/restore scripts are safe, configurable, checksum-aware, and dry-run capable.
- News unit/integration suites are registered and relevant checks pass, or exact limitations are reported.

## Completion evidence

- Backend: Ruff and mypy pass; 33 pytest tests pass.
- News feature: 14 unit and 6 PostgreSQL/API integration tests pass with generated local reports.
- Frontend: ESLint, TypeScript, and 4 Vitest tests pass.
- Operations: Compose validation and shell syntax pass; PostgreSQL 17 backup/isolated restore drill
  succeeds.
- Report: `docs/plan/news-implementation-report.md` lists source research, delivered behavior,
  activation requirements, and remaining pre-production gaps.
- Preview validation: controlled live backfill stored 50 Vietstock and 10 CafeF articles with full
  content blocks; demo rows were removed. The list returns 30 items per page and the detail view adds
  extracted key passages before the full article body. One short dynamic-table article is correctly
  marked partial.
- Analysis follow-up: cards show sentiment followed by at most three verified or publisher-explicit
  tickers and an overflow count. Detail headings are smaller, and the analysis panel now provides a
  weighted position, sentence evidence, scope, short-term market impact, and mentioned tickers.
  Preview reanalysis found 63 ticker references across 25/60 articles and reduced neutral labels from
  21 to 9. Final checks pass: 39 backend tests with an isolated PostgreSQL database, Ruff, mypy over
  138 files, frontend lint/typecheck, and 4 Vitest tests.
- Log-viewer follow-up: corrected the Dozzle v11 `visibleKeys` profile shape that crashed the browser
  during state hydration. A clean Chrome session renders the viewer and both labeled preview
  containers on port 9999; all 7 logging unit tests and 5 request-logging integration tests pass.
- Preview observability follow-up: replaced the host Uvicorn preview process with the labeled
  `investiq-preview-api` container on the same host port 8001. It retains the existing preview
  PostgreSQL/Redis data, emits structured request logs, and is visible beside those containers in
  Dozzle. The frontend list and API list/detail smoke checks return HTTP 200.
- Structured-log display follow-up: the Dozzle v11 profile now stores field visibility in its
  per-image-command map format. API rows prioritize status, route, duration, content, explanation,
  and request ID while hiding five duplicate fields. Runtime DOM validation confirms the selected
  fields render in order for `investiq-preview-api` and the hidden fields are absent.
