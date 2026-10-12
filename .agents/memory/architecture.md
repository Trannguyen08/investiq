# Architecture Memory

## Current state

The monorepo has a runnable container and delivery baseline. FastAPI health/status endpoints, the
Next.js shell, Celery configuration, Docker Compose, Nginx, and CI/CD are implemented. Six-source
Vietnamese stock news, a fixture-backed home/market vertical slice, a credential-gated TCBS
iFlash adapter, and a private paper-trading portfolio are implemented; ML modules remain placeholders.
End-user authentication is implemented behind a
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
|-- test-results/             # Ignored local Allure JSON plus single-file HTML reports
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
- Backend services use an internal-only network. The API additionally joins a dedicated market-data
  egress network for TCBS; the notification worker joins a mail outbound
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
  the TCBS adapter filters its active common-stock security master by documented exchange fields,
  marks VN30 membership from board 2, supplies normalized security/quote REST data, preserves the
  provider trading date for closed-session snapshots, and
  consumes official index WebSocket snapshots/updates with bounded retries, circuit breaking,
  reconnect and stale/partial state. `MARKET_DATA_MODE=disabled`
  is the shared/production default. Redis caches bounded public read
  models, while PostgreSQL migration `0011_market_foundation` owns future licensed history, events,
  public people/holding snapshots, engagement retention, and current private watchlists.
- Vnstock is a local/private evaluation adapter behind the same port. It uses source-delayed KBS
  reference/quote/OHLCV data plus VCI industry labels, normalizes equity candles to VND, caches
  snapshots, candles, and recent KBS executions, and lazily loads per-symbol KBS P/E, P/B, EPS, and
  ROE for stock detail or a bounded table universe in sequential 15-symbol batches with a one-hour
  cache, three-call concurrency ceiling, and null fallback. Detail responses preserve up to three
  provider-observed resting bid/ask levels; recent executions retain the source's aggressive
  buy/sell/ATO/ATC classification, and the API derives each execution's Decimal change from the
  canonical reference price. A fully reset pre-open KBS board is replaced by one
  VCI batch containing the latest completed close and preceding reference, so sector moves and
  breadth remain meaningful without per-symbol history fan-out. Vnstock quota `SystemExit` signals
  are normalized as provider failures. It serves labeled stale price data after a transient upstream
  failure. Live quote timestamps drive the displayed market time, snapshots refresh every minute by
  default, and opening-auction OHLC/volume remain unavailable until the source reports an execution
  rather than being copied from the indicative price. Its optional key stays server-side. Because the client aggregates third-party
  sources, this adapter is not evidence of public redistribution rights and is not a production
  licensing substitute.
- Stock discovery defaults to VN30-first ordering with 15-row cursor pages and one advanced-only
  nine-column presentation; the removed Basic display mode is not part of route state. The path-addressable
  `/market/stocks/<symbol>` view aggregates documented current-session TCBS trades into five-minute,
  30-minute, or hourly candles and exposes bounded recent executions through `/api/v1/market/intraday-trades`.
  Vnstock also maps KBS `5m`, `30m`, `1H`, and `1D` OHLCV into the canonical candle endpoint. For daily
  history, an observed current-session snapshot with real OHLC and volume replaces or appends only
  that market day's candle, so a lagging cache does not hide a valid session and pre-open data is not
  fabricated. Stock-detail Day, Week, Month, and Year views choose current-session, trailing-seven-day,
  previous-month-start, and same-month-prior-year windows respectively from observed source bars.
  The shared chart keeps hover/focus OHLC detail, ends pointer panning on release/cancel, and clamps
  drag/button panning so users may reveal older fetched history but cannot move beyond the newest
  observation. The Month and Year views additionally use a chart-local non-passive wheel listener for
  pointer-anchored zoom, prevent handled gestures from scrolling the enclosing page, and expose
  accessible zoom buttons between 40 candles and the selected range's full source window. Home and
  Market share a scoped dark navy visual system; their common movement-weighted sector heatmap packs
  at most eight sectors per desktop row and normalizes each row using absolute percentage movement,
  so widths stay proportional while the bounded 16-sector view occupies exactly two rows. Home derives
  its market-wide breadth summary from canonical exchange snapshots. One shared accessible SVG
  candlestick renderer serves the Home VN-Index chart and stock detail pages with red/green OHLC,
  volume, MA5/MA20, axes, and a table alternative. The TCBS adapter accumulates bounded five-minute
  VN-Index candles from real index stream ticks in process; absent historical ticks remain absent.
  Stock detail merges its subscribed quote stream into both the headline and its equal-height metric
  panel; the panel explains each metric and distinguishes no trade yet from a numeric zero. Market
  and Portfolio pagination, sector filters, and stock-detail return links retain an explicit table
  anchor. The paper-order modal is an accessible application overlay and does not depend on the
  browser's native dialog API.
- The default beginner presentation uses plain-language summaries, an estimated sentiment gauge,
  line charts, inline definitions, a fixed five-color price legend, clickable sector heatmaps sized
  by absolute percentage movement, relative sector-strength indicator, database-backed 24-hour Home
  news, a visible authoritative data timestamp, and a simplified stock table. `mode=advanced` is
  URL-addressable and reveals candlesticks and detailed columns; a URL-addressable stock drawer
  provides a 90-session line chart without inventing community posts or causal news explanations.
  The bounded `/api/v1/market/sectors` read model aggregates the provider's complete in-memory
  instrument snapshot for sector counts, movement, breadth, liquidity, foreign flow, and market cap;
  instrument tables retain separate cursor pagination, so UI summary counts are not page samples.
  Instrument screening applies bounded numeric/VN30 conditions to that complete in-memory universe
  before sorting and cursor pagination. Filter and comparison state remain in the URL. An accessible
  modal loads canonical instrument detail and 90-session candles for at most three replaceable symbols,
  preserves null fundamentals as unavailable, and does not claim an AI outlook while prediction remains
  unvalidated. Home daily-focus cards
  are deterministic links derived from observed breadth, sector movement, provider events, and stored
  news, without claiming a causal explanation.
- `/ws/v1/market` sends versioned hello/heartbeat/snapshot/quote events with bounded symbol
  subscriptions and local sequence numbers. Clients deduplicate event IDs and reconnect for a REST-
  backed snapshot after a sequence gap. It is an ephemeral delivery path; REST remains the resync
  source. TCBS wire messages have no documented provider sequence, so reconnect reconciliation uses
  a fresh REST snapshot rather than claiming provider-level gap recovery.
- Private watchlists use the existing Next.js server-held user session. The browser calls the
  same-origin `/market-api/watchlists` BFF; FastAPI independently verifies the BFF secret, bearer
  session, active user, and row ownership. Personalized responses are never shared-cacheable.
- Private paper trading reuses that BFF/session boundary at `/portfolio-api` and
  `/api/v1/paper-portfolio`. PostgreSQL migrations `0012_paper_trading` and `0013_paper_orders` own
  one account per user, row-locked cash/share validation, durable audit orders, and immutable
  provider-stamped fills with a per-account idempotency key. Buy cost basis includes the modeled fee;
  sales allocate weighted-average basis and persist
  modeled fee/tax plus realized profit or loss. Dashboard reads mark holdings against the canonical
  market provider, return null/partial valuation when a price is unavailable, and derive bounded
  current-holdings history and educational notices without shared caching or personal-data logging.
  The UI reuses the advanced market data fields as a searchable, paged trade picker. The board,
  stock detail, and owned-position table open one observed-price-and-quantity dialog. Accepted
  practice orders automatically fill in full at the latest authoritative observed price whenever
  provider freshness is acceptable; closed-session practice uses the latest valid trading session.
  After a valid filled response, the shared dialog updates its owning dashboard, emits a visible
  page-level success notice, and closes; failed responses remain in the dialog for correction/retry.
  Legacy pending/open rows are reconciled during dashboard reads, and the UI explains that real
  exchange execution can differ; partial fills remain out of scope for the simulator.
- The Next.js Admin News workspace uses a server-validated, HMAC-signed HttpOnly session cookie.
  Browser actions execute as server actions, while the FastAPI operations token remains server-only;
  both layers fail closed when their independent runtime secrets are absent.
- Celery news worker, isolated authentication notification worker, and Beat reuse the backend image.
  The news worker has publisher outbound access; the notification worker has SMTP outbound access.
  Each environment must run only one Beat scheduler.
- FastAPI, Celery, and Nginx produce sanitized structured runtime fields. Health access logs and
  image-build output are excluded from the viewer to limit operational noise.
- Every Compose service uses the `json-file` driver with three 10 MB rotated files, bounding local
  Docker log storage to approximately 30 MB per container independently of host daemon defaults.

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
- Backend feature tests are registered in `backend/tests/run_feature_tests.py`; branch coverage is
  printed in the terminal, Python `allure-pytest` writes JSON by feature and level, and the pinned
  official Allure Commandline creates a sibling single-file `allure-report/index.html` after passed
  or failed suites. Both stay under ignored `test-results/` paths. Legacy `pytest-html`, JUnit,
  coverage XML, and coverage Markdown files are not generated.

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

`docs/plan/home-market-pages.md` defines the market boundary now implemented for local development
and credential-gated TCBS evaluation. Provider-specific clients remain infrastructure adapters behind
canonical application ports, and browsers call only InvestIQ APIs. PostgreSQL owns the market/watchlist
schema and Redis holds short-lived public read models. The TCBS adapter uses in-memory token reuse,
REST snapshot refresh, one upstream index stream with an initial index request, official text
heartbeat and bounded reconnect;
credentials are never sent to Redis or the browser. TCBS requires a Smart OTP for token issuance and
documents no refresh token, so unattended key-only renewal is impossible. Licensed history backfill,
provider-level sequence reconciliation, secondary-provider failover and Events/People sources remain
future work. Every market response carries provider, market time, received time, delay class,
freshness and partial state.

Market-data tasks follow `.agents/rules/market-data-freshness.md`: agents compare runtime timestamps
with the latest valid `Asia/Ho_Chi_Minh` trading session, use bounded revalidation when stale, and do
not fabricate weekend/holiday candles to match the current calendar date.

`docs/plan/paper-trading.md` defines the implemented beginner simulation boundary. It deliberately
uses automatic full fills at a qualifying observed provider price and discloses that this is not
exchange order-book matching. Production activation remains gated by authentication configuration,
migrations through `0013`, and approved market-data display/redistribution rights; partial fills,
settlement, corporate actions, margin, short sales, and broker connectivity remain outside this slice.

This file is the canonical architectural overview. Every path or boundary change updates this file
and all affected references in the same task, following `.agents/rules/project-structure.md`.

## Admin user management

The account-management route `/api/v1/admin/users` is protected by the server-only BFF secret plus a verified bearer session whose active database user currently has the admin role. Next.js server code forwards its encrypted Redis-held access token; the browser never receives it. User changes run through the ManageUsers use case and PostgreSQL repository transaction, audit actor/target data, prevent self-change and last-active-admin lockout, and revoke sessions on disable. Admin News retains its independent shared-password/session boundary.
