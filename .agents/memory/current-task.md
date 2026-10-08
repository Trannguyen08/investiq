# Current Task

## News crawl backend CI repair — 2026-10-08 (complete)

Reproduced pull request #5's Backend CI failure with the workflow's strict mypy command. Updated
the news repository and crawler HTTP test doubles to satisfy their expanded type contracts. Strict
mypy, Ruff, 21 focused news tests, the full backend suite (82 passed, 11 database tests skipped
without `TEST_DATABASE_URL`), and Compose model validation pass. Docker image validation remains
assigned to GitHub Actions because the local Docker Desktop engine is unavailable.

## Community and market product roadmap — 2026-10-04 (complete)

Added `docs/plan/community-market-roadmap.md` as the accepted direction after auth and news. The
roadmap positions InvestIQ as an evidence-based investment community instead of a FireAnt clone. It
covers licensed EOD/delayed market data, market context, private watchlists, community moderation,
structured and versioned theses, outcome-based contextual reputation, source-linked AI critique,
privacy/security constraints, a prioritized backlog, success metrics, risks, decision gates, and a
12-week differentiated MVP / 28-week public-beta timeline. Linked it from the plan index and root
README, and synchronized project/architecture memory. No application code or runtime was changed.

## News crawl completion — 2026-10-04 (complete)

Implemented numbered 10-item news pages, partial accent-insensitive search with trigram index,
30-second versioned Redis list caching, StockBiz metadata-only RSS ingestion, and Vietstock
90-day archive scanning with PostgreSQL page checkpoints and Beat recovery. Local migrations
0007–0010 were applied locally. The 90-day Vietstock archive scan completed and its PostgreSQL
checkpoint is marked complete; persisted fetch jobs continue automatically at the provider rate limit.
The local database includes articles back to 2026-07-07, within the 90-day filter. HNX TLS verification
now uses the publisher's missing GlobalSign intermediate locally; live feed discovery and ingest
succeeded. A transient CafeF provider failure was recovered with a new successful ingestion job.
Backend Ruff, mypy, and 44 focused tests passed; frontend lint and typecheck passed. The development
news page and numbered page 2 return HTTP 200; the API demonstrated Redis MISS then HIT. Docker
backend, worker, and Beat remain running for queued historical fetches.

## Latest follow-up - Automatic news crawling, 2026-10-02

Implemented startup discovery for the five configured news sources when the single Celery Beat
scheduler starts, in addition to the existing five-minute schedule. Ingestion now defaults to
enabled in application settings, Compose, and `.env.example`; operators can pause it with
`NEWS_INGESTION_ENABLED=false`. Updated README, architecture memory, project memory, and the news
implementation report. No deployment or tests were run.

## Latest follow-up — News feed population, 2026-10-02

Investigated the empty news feed. The active local database initially had configured sources but
zero articles, revisions, crawl runs, or ingestion jobs. `/news` and `/api/v1/news` are public.
Using the existing ingestion pipeline, a bounded manual crawl stored 41 published articles with
revisions: 3 CafeF, 15 Vietstock, 15 VnEconomy, and 8 VnExpress. One CafeF fetch failed. HNX could
not be crawled because its TLS certificate chain failed verification; verification stayed enabled.
The API returns 20 items on its first page with `freshness=fresh`, and guest `/news` returns HTTP
Ingestion was disabled at the time of this earlier follow-up. The temporary worker was removed and the normal worker restarted.

# Latest follow-up — auth account feedback and validation, 2026-10-02

Complete: duplicate registration now returns 409 before issuing an OTP, including a concurrent
duplicate caught at verification. Password recovery returns actionable 404 for unknown/inactive
email and 409 for Google-only accounts; the UI directs Google users to Google sign-in. Added a
10/hour per-IP recovery limit alongside the existing 5/hour per-email/per-IP limit. The auth plan
and decision log record the account-enumeration tradeoff requested by the user.
The OTP screen explains how to check Spam and mark the message “Not spam”. Authentication emails
now include RFC 5322 Date and Message-ID headers.

Validation: backend auth feature run passed 19 unit and 8 API/PostgreSQL integration tests on an
isolated temporary PostgreSQL 17 container; Ruff and strict mypy passed. Frontend ESLint,
TypeScript, and all 18 Vitest tests passed. E2E was not run per user instruction. No actual OTP
email was sent. Gmail SMTP had previously accepted a job, but inbox placement cannot be established
without recipient-side “Show original” headers; SPF/DKIM/DMARC results and Gmail spam feedback are
still needed to attribute the spam placement.

## Latest follow-up — password-change success notice, 2026-10-02

Complete: successful password recovery redirects to the login form with a success status message
explaining that the password was updated and the user can sign in with the new password. The login
page passes the URL status into the client form without a client-side search-param dependency.
Frontend ESLint, TypeScript, and 5 auth component tests passed.

## Latest follow-up — password-recovery OTP alignment, 2026-10-02

Complete: registration and password-reset OTP email messages use the same tested HTML/text
presentation. OTP lifetime is fixed at 90 seconds for both flows. The forgot-password UI now receives
the server lifetime, shows a 90-second countdown, disables confirmation after expiry, and allows a
new code to be requested; OTP confirmation uses the primary blue button style. Frontend lint,
typecheck, and 4 auth component tests passed; 2 focused backend tests passed. Backend/frontend images
were rebuilt and backend, notification worker, frontend, and Nginx restarted; the services are
healthy and `/forgot-password` returns HTTP 200.

## Latest follow-up — auth screen visual refresh, 2026-10-02

Complete: login and registration now use a larger centered brand mark and centered heading; the
“Tài khoản” eyebrow was removed. Password visibility is controlled by accessible eye icons, and
the Google button has a recognizable multicolor G icon. Frontend ESLint and TypeScript checks pass.
Rebuilt and recreated `investiq-frontend-1` from `investiq-frontend:local`; it is healthy, and both
`/login` and `/register` return HTTP 200 from the updated container.

## Latest follow-up — OTP email presentation and automatic sessions, 2026-10-02

Complete: OTP, password-reset, registration-success, and password-changed emails now include a
styled inline HTML version and a matching plain-text version; OTP is prominent and the Vietnamese
copy explains the 90-second limit and privacy guidance. Removed email persistence and session-choice
checkboxes from login/registration; all new email, OTP, and Google sessions use the configured
`AUTH_SESSION_DAYS` lifetime (30 days by default) with persistent HttpOnly cookies and automatic
server-side refresh-token rotation. Updated API/BFF schemas, docs, project memory, and decision log.

Frontend ESLint, TypeScript, and backend Python compilation passed. Ruff was unavailable in the host
environment, and automated tests were not run. No production build or container recreation was run.

## Latest follow-up — OTP email egress fix, 2026-10-02

Root cause: Compose attached `celery-notifications` only to `backend`, which is `internal: true`.
This prevented DNS and outbound TCP to `smtp.gmail.com`; SMTP credentials and STARTTLS settings
were configured. Added a dedicated non-internal `mail-egress` network for the notification worker
while leaving other backend services isolated. README, architecture memory, and the decision log
now describe this network boundary. Compose validation passed; the notification service was
recreated, resolved Gmail, completed STARTTLS on port 587, and authenticated successfully without
sending a message. The supplied `EMAIL_USE_TLS`/`EMAIL_USE_SSL` variables are not consumed; the
equivalent active application setting is `AUTH_SMTP_STARTTLS=true` with port 587.

Follow-up diagnosis: three historical email jobs (two registration OTPs and one registration
success message) ended as `failed` with `gaierror`, matching the old DNS/egress failure; all were
created before/at the original network fix. The current worker is attached to both `backend` and
`mail-egress`; current DNS resolution, TCP connection, STARTTLS, and SMTP authentication succeed.
The next registration attempt arrived through the backend and created an OTP job that completed as
`sent` in 4.4 seconds. The challenge expired 90 seconds after creation while checking it. Backend
`/healthz` and frontend root both return HTTP 200, and all Compose services are up/healthy where
health checks are configured. SMTP accepted the OTP message; inbox delivery is outside SMTP's
acceptance signal. The user reports it did not arrive, so mailbox placement/address spelling remain
the relevant checks; a resend will create a fresh 90-second challenge.

## Latest follow-up — local auth and notification fixes, 2026-10-02

The local Docker stack is running at `http://localhost:8080`. Earlier follow-ups fixed migration
setup, Google callback redirects, and logout CSRF origin validation. Current registration report
was traced to the BFF CSRF gate: Nginx logged `/auth-api/register` as 403 and no backend request.
`getOrCreatePreAuth` now refreshes the readable CSRF cookie from the active Redis-backed pre-auth
record whenever it returns that record, preventing stale double-submit cookie state. Auth fetches
explicitly use same-origin credentials. The shared global success toast now anchors bottom-right,
including on mobile; inline form errors remain adjacent to their fields/form for accessibility.
Frontend lint passed, its container rebuilt and reported healthy, and `/register` plus
`/auth-api/csrf` returned HTTP 200.

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

## Latest task — Local Google login startup issue (2026-10-02)

Complete: the Google callback first reached FastAPI before local migrations were applied; the new PostgreSQL volume lacked auth tables and account persistence returned HTTP 500 (`AUTH_FAILED`). Applied migrations 0001–0006 without deleting the volume. A later browser screenshot showed Google login succeeded but the BFF redirected to invalid `0.0.0.0:3000` because it derived callback redirects from the incoming request URL. The callback now derives success/error redirect origins from `AUTH_GOOGLE_REDIRECT_URI`. A subsequent logout attempt returned 403 because CSRF validation compared the browser origin with the proxy's internal request URL; it now validates against the configured public auth origin. Rebuilt the frontend and verified a same-origin CSRF logout request returns HTTP 204, `/login` returns HTTP 200, and all Compose services are healthy. README documents applying migrations before UI/API use. Full browser retries remain user driven.

## News search and feed follow-up - 2026-10-02

Implemented automatic URL-backed news filters (search debounce, immediate select/input changes), reduced the feed page size to 10, added PostgreSQL accent-insensitive substring matching alongside full-text search, and constrained article thumbnails to prevent tall source images stretching a single result card. Frontend ESLint and TypeScript checks passed.

Not completed: numbered/previous-page pagination, query cache, expanded crawler integrations, and three-month historical ingestion. The API currently exposes signed forward cursors; ingestion rejects articles older than the configured 72-hour freshness window. FireAnt's crawler module is a placeholder, so its pending source cannot safely be activated. No database crawl/backfill was run.
