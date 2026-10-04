# Architecture Memory

## Current state

The monorepo has a runnable container and delivery baseline. FastAPI health/status endpoints, the
Next.js shell, Celery configuration, Docker Compose, Nginx, and CI/CD are implemented. Six-source
Vietnamese stock news and a fixture-backed home/market vertical slice are implemented; most
portfolio and ML modules remain placeholders. End-user authentication is implemented behind a
fail-closed feature flag and remains separate from the existing Admin News session boundary.

## Repository layout

```text
investiq/
|-- backend/
|   |-- Dockerfile
|   |-- app/
|   |   |-- domain/           # Framework-independent enterprise rules
|   |   |-- application/      # Use cases and ports
|   |   |-- infrastructure/   # PostgreSQL, Redis, external, ML, security, config adapters
|   |   |-- api/              # HTTP and WebSocket delivery modules
|   |   |-- middleware/
|   |   |-- workers/          # Celery app and task modules
|   |   `-- main.py           # FastAPI composition and health endpoints
|   `-- tests/
|-- frontend/
|   |-- Dockerfile
|   `-- src/                  # Next.js App Router, UI, hooks, state, and contracts
|-- docs/
|   `-- plan/                 # Feature specifications and implementation evidence
|-- infra/
|   |-- log-viewer/           # Default local runtime-log viewer profile
|   |-- nginx/nginx.conf      # Public reverse proxy and structured access logs
|   `-- scripts/              # Operational scripts
|-- .github/workflows/        # Service CI and staging/production delivery
|-- test-results/             # Ignored local JUnit and feature coverage reports
|-- DEVELOPMENT_GUIDE.md      # Docker, ports, and feature-test command reference
`-- docker-compose.yml        # Ten-service topology
```

## Runtime topology

- Nginx is the only publicly bound application service. It routes `/` to Next.js, `/api/` to
  FastAPI, and `/ws/` to the backend with WebSocket upgrade headers. Public access to
  `/api/v1/auth/` is blocked because browsers use the Next.js `/auth-api/` BFF boundary.
- Dozzle is published separately on a loopback-only host port for local runtime log inspection. It
  can read only labeled service logs through an internal endpoint-restricted Docker socket proxy;
  container actions, exec/shell access, MCP, and non-GET Docker operations are disabled.
- Backend and frontend images are built from service-local Dockerfiles. Deployment overrides their
  Compose image names with immutable GHCR tags.
- PostgreSQL and Redis are private to the Compose network and persist in named volumes.
- Backend services use an internal-only network. The notification worker joins a mail outbound
  network for SMTP; the news worker joins a separate news outbound network for publishers.
- News articles, immutable revisions, source policies, verified symbols, publisher-explicit symbol
  candidates, versioned sentiment/market-impact analysis, crawl runs, and durable
  ingestion jobs are stored in PostgreSQL. Celery/Redis deliver work; a PostgreSQL dispatcher
  recovers pending and expired-lease jobs.
- Vietstock archive backfill checkpoints scanned pages in PostgreSQL; Beat resumes stale runs.
  Public news lists use a versioned Redis read cache with a 30-second TTL and invalidation after
  article ingestion. Numbered pagination uses bounded SQL offsets and filtered counts.
- Redis database 0 is reserved for application caching, database 1 is the Celery broker, and database
  2 is the Celery result backend. Redis database 3 stores encrypted Next.js BFF sessions,
  pre-authentication state, CSRF context, and refresh locks. No Kafka, RabbitMQ, or generic event bus
  is present.
- End-user authentication uses a Next.js BFF. Browsers receive opaque HttpOnly session identifiers;
  short-lived JWT access tokens and rotating refresh tokens remain encrypted in Redis and are sent
  only from the BFF to FastAPI. PostgreSQL owns users, identities, challenges, session/token hashes,
  reset grants, audit events, and durable email jobs.
- News provider traffic is coordinated per domain through Redis-backed request budgets and circuit
  state, with a bounded process-local fallback when Redis is temporarily unavailable. Freshness is
  enforced before persistence and again on public queries; retention cleanup is explicit and
  dry-run by default.
- Protected news operations endpoints use a dedicated bearer token, optimistic source row versions,
  and PostgreSQL audit records. They fail closed when no token is configured.
- Public market routes use canonical domain entities and an application-owned provider port. The
  development adapter emits deterministic fixture data with an explicit fixture freshness label;
  `MARKET_DATA_MODE=disabled` is the shared/production default. Redis caches bounded public read
  models, while PostgreSQL migration `0011_market_foundation` owns future licensed history, events,
  public people/holding snapshots, engagement retention, and current private watchlists.
- `/ws/v1/market` sends versioned hello/heartbeat/snapshot events with bounded symbol subscriptions.
  It is an ephemeral delivery path; REST remains the resync source. Live provider sequence/gap
  reconciliation is not active until a licensed adapter is configured.
- Private watchlists use the existing Next.js server-held user session. The browser calls the
  same-origin `/market-api/watchlists` BFF; FastAPI independently verifies the BFF secret, bearer
  session, active user, and row ownership. Personalized responses are never shared-cacheable.
- The Next.js Admin News workspace uses a server-validated, HMAC-signed HttpOnly session cookie.
  Browser actions execute as server actions, while the FastAPI operations token remains server-only;
  both layers fail closed when their independent runtime secrets are absent.
- Celery news worker, isolated authentication notification worker, and Beat reuse the backend image.
  The news worker has publisher outbound access; the notification worker has SMTP outbound access.
  Each environment must run only one Beat scheduler.
- FastAPI, Celery, and Nginx produce sanitized structured runtime fields. Health access logs and
  image-build output are excluded from the viewer to limit operational noise.

## Dependency boundaries

- `frontend/` consumes backend HTTP/WebSocket contracts and never imports backend source.
- `backend/app/domain/` remains independent of frameworks and infrastructure.
- `backend/app/application/` coordinates use cases through owned interfaces.
- `backend/app/infrastructure/` implements persistence, cache, external, ML, security, and config.
- API, middleware, workers, and `main.py` are delivery/composition boundaries.

## Delivery boundaries

- Pull requests and pushes validate backend and frontend independently.
- Staging publishes on `develop`; production publishes on `v*` tags. GHCR images use immutable
  commit/version tags in addition to convenience tags.
- Deployment runs Compose on environment-specific self-hosted Linux runners. GitHub environments own
  runtime secrets and production approval policy.
- Backend feature tests are registered in `backend/tests/run_feature_tests.py`; generated JUnit and
  branch-coverage reports are written by feature and test level under ignored `test-results/` paths.

## Structure maintenance

The user-authentication specification is in `docs/plan/auth.md`. Its Next.js BFF, PostgreSQL auth
schema, Redis database 3 session store, isolated notification worker, email/Google flows, and UI are
implemented. `AUTH_ENABLED` defaults to false until required secrets and providers are configured.
The existing Admin News authentication remains a separate boundary pending a scoped RBAC migration.

News ingestion, database/backups, and API/UI specifications are documented under `docs/plan/`,
starting at `docs/plan/vietnam-stock-news.md`; implementation evidence is in
`docs/plan/news-implementation-report.md`. Vietstock and CafeF full-article adapters plus HNX,
StockBiz, VnEconomy, and VnExpress metadata-only adapters, public news APIs/UI, and backup/restore scripts are
implemented. Celery Beat queues initial discovery for the six configured sources at scheduler
startup and continues five-minute discovery; `NEWS_INGESTION_ENABLED` defaults to true and can pause
all ingestion. Production operation still requires source storage/display policy approval and a
reviewed security-master import. The user selected periodic backups only, with no database replica;
backup scheduling is an external script and adds no runtime service here.

The planned post-news product phase is specified in `docs/plan/community-market-roadmap.md`.
It keeps the existing FastAPI/Next.js/PostgreSQL/Redis/Celery boundaries and begins with licensed
EOD or delayed market data. It plans private watchlists, a moderated community, versioned investment
theses with market snapshots, outcome tracking, contextual reputation, and source-linked AI
counter-analysis. These are product and architecture intentions, not implemented runtime facts.

`docs/plan/home-market-pages.md` defines the market boundary now implemented for local development.
Provider-specific clients remain infrastructure adapters behind canonical application ports, and
browsers call only InvestIQ APIs. PostgreSQL owns the market/watchlist schema and Redis holds
short-lived public read models. The current fixture WebSocket supplies bounded snapshots and
heartbeat; licensed delayed/realtime ingestion, provider sequence/gap reconciliation, history
backfill, and provider failover remain future adapter/worker work. Every current market response
carries provider, market time, received time, delay class and freshness.

This file is the canonical architectural overview. Every path or boundary change updates this file
and all affected references in the same task, following `.agents/rules/project-structure.md`.

## Admin user management

The account-management route `/api/v1/admin/users` is protected by the server-only BFF secret plus a verified bearer session whose active database user currently has the admin role. Next.js server code forwards its encrypted Redis-held access token; the browser never receives it. User changes run through the ManageUsers use case and PostgreSQL repository transaction, audit actor/target data, prevent self-change and last-active-admin lockout, and revoke sessions on disable. Admin News retains its independent shared-password/session boundary.
