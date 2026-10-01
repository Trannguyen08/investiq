# Current Task

## Latest task — 2026-10-01 authentication implementation

Complete: implemented `docs/plan/auth.md` across PostgreSQL/FastAPI, a Next.js BFF/UI, Redis-backed
browser sessions, durable authentication email delivery, Google OIDC, registration OTP, password
recovery, header account menu/logout, and separate remember-email/persistent-login choices. JWT and
refresh credentials stay encrypted in server-side Redis state; refresh tokens are rotated and stored
only as hashes in PostgreSQL. Existing Admin News authentication remains separate.

Authentication is fail-closed and defaults to `AUTH_ENABLED=false`. Blank key/provider entries were
added to the ignored local `.env` and tracked `.env.example`. The ignored local
`docs/tutorial/auth-keys.md` explains key generation plus Google OAuth and SMTP setup.

Local direct validation later enabled auth after replacing an undersized OTP key and generating the
previously missing local PostgreSQL, Redis, and application secrets. An isolated Docker project
applied migrations 0001-0005 and passed browser-bound BFF flows for registration/OTP, persistent
opaque HttpOnly sessions, refresh, logout/login, password reset, old-password rejection, old-session
revocation, direct-backend rejection, and Google OIDC start with state/nonce/PKCE. The notification
worker stayed off, so no real email was sent; the isolated containers and volumes were removed.

Validation: backend Ruff and strict mypy passed; full backend suite passed 61 tests with 8 existing
environment-dependent skips. Auth feature suites passed 4 unit tests and 1 API integration test; the
PostgreSQL repository integration test was skipped because `TEST_DATABASE_URL`/Docker was
unavailable. Frontend lint, typecheck, and 11 tests passed. `docker compose config --quiet` passed
with required placeholder environment values. No production build or deployment was run.

## Status

Complete: the authenticated Admin News dashboard is wired to protected operations, and a controlled
five-source crawl populated the isolated development database. No staging or production data was
changed.

## Objective

Keep crawled news current, make source operations controllable and observable, improve data quality
and analysis, expose operational controls through an authenticated Admin UI, and populate the active
development runtime with recent articles while preserving bounded durable workers.

## Confirmed constraints

- Periodic database backups only; no PostgreSQL replica.
- Preserve FastAPI/Next.js/PostgreSQL/Celery/Redis and Clean Architecture boundaries.
- Public crawler inputs are allowlisted and bounded; live websites are not called from CI tests.
- Vietstock exposes RSS feeds. CafeF robots currently allows crawling and advertises sitemap/news
  sitemap endpoints; full-text republication rights still require product/legal approval.
- HNX, VnEconomy, and VnExpress expose public RSS routes. The new adapters are metadata-only and keep
  attribution plus canonical links; ingestion remains globally disabled by default.
- Six other candidate sources remain profiled until a public ingestion route and policy are confirmed.
- No standalone logo asset exists; implement a local accessible InvestIQ SVG mark based on the
  visible blue/green wordmark direction.
- Default proposed policy is to reject articles older than 72 hours at ingestion and retain served
  articles for 90 days. Cleanup must support dry-run and no real database deletion will run until
  the user confirms both the retention period and target environment.

## Acceptance conditions

- Migration/repository support idempotent revisions, symbols, sentiment, and durable jobs.
- All five adapters parse deterministic fixtures and discover only allowlisted URLs.
- Public list/detail/source/security APIs use explicit schemas and stable cursor pagination.
- Celery work is bounded/idempotent and scheduled only when ingestion is enabled.
- News UI/header are responsive and handle empty/error/partial states.
- Backup/restore scripts are safe, configurable, checksum-aware, and dry-run capable.
- News unit/integration suites are registered and relevant checks pass, or exact limitations are reported.

## Completion evidence

- Admin workspace: `/admin-login` issues an HMAC-signed HttpOnly session; `/admin/data-pipeline`
  manages source pause/resume, manual crawl, the latest 100 crawl runs, retention dry-run, and
  confirmed deletion. The operations token remains server-only. Unauthenticated backend/UI smoke
  checks return 401/redirect, while an authenticated browser flow renders the dashboard.
- Development crawl: 87 current articles were stored (Vietstock 25, CafeF 5, HNX 24, VnEconomy 25,
  VnExpress 8). Their publisher times span 27–30 September 2026, all 87 fetch jobs succeeded, one
  explicitly stale HNX item was cancelled, and no fetch job failed. A CafeF regression was fixed so
  timezone-naive metadata is interpreted as Vietnam time rather than UTC.
- Retention: a 90-day dry-run matched zero rows in the development database, so no article deletion
  was performed.
- Final validation: Ruff passes, mypy passes over 146 source files, and all 63 backend tests pass on
  an isolated PostgreSQL 17 container. The news workflow passes 34 unit and 14 integration tests.
  Frontend ESLint, TypeScript, and 8 Vitest tests pass. The temporary test container was removed.

- Freshness hardening: explicitly stale discovery entries are filtered before article fetch; the
  worker rejects undated, stale, or future-dated articles before persistence. Public lists default
  to seven days and public detail/list access is capped by the configured retention window.
- Operations: protected source status, manual crawl, crawl-run telemetry, and retention endpoints
  fail closed without a dedicated token and write audit records. Retention is dry-run by default and
  destructive execution requires explicit confirmation.
- Resilience and quality: Redis-coordinated per-domain request budgets/circuit state have a bounded
  local fallback; exact normalized headlines receive cross-source counts; rule analysis now emits
  topics and event types surfaced by the API/UI.
- Final validation: all 61 backend tests pass on a fresh isolated PostgreSQL 17 instance; Ruff and
  mypy pass. The feature workflow passes 33 news unit and 13 news integration tests with generated
  reports. Frontend ESLint, TypeScript, and all four Vitest tests pass. Compose configuration validates
  with required test secrets. The temporary PostgreSQL containers were removed.

- Five-source expansion: HNX official/issuer RSS, VnEconomy Chứng khoán RSS, and filtered VnExpress
  Kinh doanh RSS are registered in Celery and seeded as active metadata-only sources. Live smoke
  discovery/fetch succeeded for two current URLs per new source.
- Expansion validation: 25 news unit tests and 9 PostgreSQL/API integration tests pass; the full
  backend has 49 passing tests. Ruff passes, and mypy passes over 141 source files. The isolated
  PostgreSQL 17 test container was removed after validation.

- Earlier two-source baseline: Ruff and mypy passed with 33 backend tests; the news feature had
  14 unit and 6 PostgreSQL/API integration tests with generated local reports.
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
  21 to 9. At that follow-up milestone, 39 backend tests, Ruff, mypy over 138 files, frontend
  lint/typecheck, and 4 Vitest tests passed.
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
- Frontend CI follow-up: anchored the generic Python `lib/` and `lib64/` ignore patterns to the
  repository root so `frontend/src/lib` is included in Git. The previously missing typed news API
  client and its tests now reach clean CI checkouts; frontend lint, typecheck, and all four Vitest
  tests pass locally.

## Latest task — Admin account management (2026-10-01)

Complete: implemented role-protected account search, filters, pagination, role/status changes, self/last-admin protections, session revocation on disable, shared Redis rate limiting, and audit details. Added migration 0006, account-management documentation, backend/frontend coverage, and updated README. Validation: Ruff, targeted strict mypy, frontend ESLint/typecheck, 14 frontend tests, and 13 backend unit tests passed. Backend integration API tests passed; 2 PostgreSQL repository tests skipped because `TEST_DATABASE_URL` was unavailable. No deployment performed.
