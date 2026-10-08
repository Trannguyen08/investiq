# Project Memory

## Identity

- Name: InvestIQ
- Repository: `C:\investiq`
- Application type: FastAPI and Next.js monorepo
- Status: Runnable operational baseline with six-source stock news, feature-flagged end-user
  authentication, a beginner-first home/market vertical slice, a source-delayed Vnstock evaluation
  adapter, and a credential-gated TCBS iFlash adapter; production market redistribution and most
  portfolio/ML modules remain gated or placeholders.

## Confirmed stack

- Backend: Python 3.13 container, FastAPI, Uvicorn, and Clean Architecture modules under `backend/`.
- Frontend: Node.js 24 container, Next.js 16, React 19, and TypeScript under `frontend/`.
- Persistence: PostgreSQL 17.
- Cache and jobs: Redis 8 for cache plus Celery broker/result storage; separate news/notification
  Celery workers and Beat.
- Edge: Nginx is the public application entry point; the runtime log viewer is separately published
  on a loopback-only host port.
- Operations: Docker Compose, GHCR images, GitHub Actions CI, and self-hosted deployment runners.
- Messaging constraint: no Kafka, RabbitMQ, or separate event-streaming/message-bus platform.
- Observability: a localhost-only Dozzle viewer reads labeled runtime logs through an
  endpoint-restricted, GET-only Docker socket proxy. Actions, shell access, MCP, and build logs are
  disabled.

## Goals

- Implemented MVP: Vietnamese stock-market news aggregation for Vietstock, CafeF, HNX, StockBiz,
  VnEconomy, and VnExpress with article history, stock-symbol identification, rule sentiment, public list/detail
  pages, freshness/retention policy, exact-title cross-source grouping, topic/event classification,
  provider rate limiting/circuit breaking, protected operational APIs, and an authenticated Admin
  workspace for source status, manual crawl, crawl-run history, and retention cleanup. HNX,
  StockBiz, VnEconomy, and VnExpress are metadata-only sources.
- User confirmed periodic database backups only; no database replica in this feature scope.
- Feature plans live in `docs/plan/`; see `docs/plan/vietnam-stock-news.md` and its database/API/UI
  companion documents. `docs/plan/news-implementation-report.md` records implemented behavior,
  validation, activation gates, and the five sources that remain pending/blocked. No deployment
  has been performed; Celery Beat now starts news discovery automatically by default.
- The accepted next product direction is documented in `docs/plan/community-market-roadmap.md`:
  licensed EOD/delayed market data, private watchlists, moderated community posts, structured
  evidence-backed investment theses, immutable updates, outcome-based contextual reputation, and
  source-linked AI counter-analysis. Target: differentiated MVP in 12 weeks and public beta in 28
  weeks. This roadmap is planned only; implementation has not started.
- `docs/plan/home-market-pages.md` defines the public home page and stable `/market/<tab>` routes.
  The local vertical slice and TCBS iFlash adapter are implemented: index/trending/breadth/event home
  cards; Stocks, Watchlist, Indices, Events and People routes; canonical provider port; strict REST
  contracts; versioned snapshot/quote WebSocket; Redis public-read cache; PostgreSQL market/watchlist
  migration; and private watchlist BFF/API operations. TCBS mode normalizes security metadata and REST
  quotes, identifies VN30 membership from board 2, consumes the official index WebSocket with an
  initial snapshot request plus text heartbeat/reconnect, and fails partial rather than fabricating
  unsupported events, people, fundamentals or multi-session daily candles. The dark navy UI now has
  a 15-row VN30-first stock table, centered numeric columns, a large VN-Index red/green candlestick
  chart, and `/market/stocks/<symbol>` detail pages using the same volume-and-MA chart renderer with
  honest current-session five-minute data. Home and Market share clickable sector heatmaps sized by
  absolute daily sector movement computed server-side across the complete provider snapshot rather
  than a 100-row instrument page, Home highlights database-backed news from the latest 24 hours, and
  every market view exposes a clear last-data-update time. In Vnstock mode, stock detail lazily loads
  and caches KBS P/E, P/B, EPS, and ROE while preserving explicit unavailable states. A reset pre-open
  KBS board uses VCI's batch latest-close/preceding-reference fields rather than presenting every
  stock and sector as 0%; after the session begins, unmatched symbols remain in the snapshot at their
  reference price instead of disappearing. The detail headline and enclosing metric panel consume
  WebSocket snapshots, label auction fields as unavailable until a trade occurs, explain each metric,
  and show quote-based market time; Vnstock snapshots refresh every minute by default. Quota exits
  degrade through the provider failure path. Activation still
  requires a current token or API key plus Smart OTP and explicit redistribution rights. FiinGroup
  remains recommended for corporate/event/people coverage. Provider failover, licensed history
  backfill and traffic-derived production popularity are not active.
- The Market stock table fits both basic and nine-column advanced data inside its card without a
  horizontal scrollbar; narrow screens use labeled two-column stock cards. Its volatility scale uses
  the product-requested Low red, Medium yellow, and High green mapping.
- Market stock screening is URL-addressable and runs over the complete provider snapshot before
  cursor pagination. It supports bounded daily-change, matched-value, market-cap, volume-versus-20-day,
  and VN30 conditions plus compatible sort keys. The UI provides practical presets with prominent
  thresholds and an accessible URL-backed dialog that compares charts and metrics for up to three
  replaceable stocks while preserving explicit unavailable ratios. AI outlook is labeled unavailable
  until a validated prediction model exists.
  Volume-baseline controls are hidden when the active source does not provide that field. Home also
  derives a daily focus block only from observed breadth, sectors, provider events, and database news;
  the shared status bar explains the current trading-session context.

## Local development

- Authentication is implemented behind `AUTH_ENABLED=false` by default. It provides email/Google
  login, 90-second registration and password-reset OTPs, server-held JWT/refresh credentials, and
  automatic persistent sessions with rotating refresh tokens. Email addresses are not remembered
  in browser storage. Configure the blank auth entries in `.env`
  using the ignored local guide `docs/tutorial/auth-keys.md` before enabling it.

- Copy `.env.example` to `.env`, replace placeholder secrets, then use `docker compose up --build
  --wait` for the complete stack.
- `docs/tutorial/market-data-api-keys.md` ranks current Vietnam market-data options and documents
  credential acquisition for Vnstock, TCBS, FinLens, DNSE, SSI, and FiinGroup without storing keys.
- Use development servers for interactive code work and do not run the frontend production build
  during agent sessions.
- Keep `frontend/package-lock.json` synchronized with `package.json` and backend requirement pins
  synchronized with the Docker image.
- Use `DEVELOPMENT_GUIDE.md` for Docker/port commands and `backend/tests/run_feature_tests.py` for
  per-feature unit, integration, and branch-coverage reports.
- Follow `.agents/rules/project-structure.md` for every path or boundary change.

## Admin account management

Implemented `/admin/users` with backend role checks, stable search/filter pagination, account role/status updates, active-session revocation on disable, Redis rate limits, and audit details. The Admin News shared password remains a separate gate and does not authorize the account API. See `docs/plan/admin-user-management.md`.
