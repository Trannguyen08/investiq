# Project Memory

## Identity

- Name: InvestIQ
- Repository: `C:\investiq`
- Application type: FastAPI and Next.js monorepo
- Status: Runnable operational baseline with six-source stock news, feature-flagged end-user
  authentication, a beginner-first home/market vertical slice, a source-delayed Vnstock evaluation
  adapter, a credential-gated TCBS iFlash adapter, and an authenticated beginner paper-trading
  vertical slice; production market redistribution and ML modules remain gated or placeholders.

## Confirmed stack

- Backend: Python 3.13 container, FastAPI, Uvicorn, and Clean Architecture modules under `backend/`.
- Frontend: Node.js 24 container, Next.js 16, React 19, and TypeScript under `frontend/`.
- Persistence: PostgreSQL 17.
- Cache and jobs: Redis 8 for cache plus Celery broker/result storage; separate news/notification
  Celery workers and one Beat scheduler. Compose health-checks the news worker and scheduler, and the
  API and public Nginx services depend on both so local and deployed application startup includes
  ingestion.
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
  StockBiz, VnEconomy, and VnExpress are metadata-only sources retained for ingestion operations but
  withheld from the complete-only public feed.
- User confirmed periodic database backups only; no database replica in this feature scope.
- Feature plans live in `docs/plan/`; see `docs/plan/vietnam-stock-news.md` and its database/API/UI
  companion documents. `docs/plan/news-implementation-report.md` records implemented behavior,
  validation, activation gates, and the five sources that remain pending/blocked. No deployment
  has been performed; Celery Beat starts six-source news discovery automatically by default at
  scheduler startup and every five minutes. Discovery canonicalizes and de-duplicates URLs before
  durable hourly job keys, while PostgreSQL retains the per-source canonical-URL article invariant.
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
  honest current-session data. The Indices tab also uses that renderer for its complete bounded
  170-session payload, including OHLC/volume detail, axes, MA5/MA20, keyboard inspection, and the
  accessible table alternative instead of a 24-candle thumbnail. Stock detail merges a
  provider-observed current-session daily candle
  into lagging cached history. Stock detail now presents the provider-observed three best resting
  bid/ask levels with bounded depth totals and bars beside a recent execution tape whose price change
  is derived server-side from the reference price; it keeps resting depth distinct from the source's
  aggressive buy/sell/auction classification. Below the trading data, it shows up to six newest
  complete related articles matched by a verified relation or exact publisher-explicit ticker, with
  independent empty/error states and a link to the full qualified-symbol News view. Its
  Day/Week/Month/Year candlestick windows use
  five-minute, 30-minute, hourly, and daily source bars with market-time axis labels, dense bodies,
  hover detail, and bounded horizontal panning into older fetched history. Pointer panning stops on
  release/cancel. Every shared financial chart supports bounded pointer-anchored wheel and keyboard
  zoom without scrolling the enclosing page while a wheel gesture is handled over the chart. The
  Market VN-Index highlight stays between 50 and 120 visible daily candles, while Index detail stays
  between 70 and 170 from the latest 170-session payload; non-index charts retain the shared
  10-candle default minimum. Axis labels
  derive intraday-versus-daily semantics from observed timestamp spacing, so an unlabelled daily
  snapshot cannot fall back to repeated `07:00` market-time labels. Home
  and Market share clickable sector heatmaps sized by
  absolute daily sector movement computed server-side across the complete provider snapshot rather
  than a 100-row instrument page. The bounded 16 sectors pack into two desktop rows of at most eight;
  each row fills the card while retaining tile widths proportional to absolute movement. Home starts
  with a four-index snapshot and continues through a clearly snapshot-scoped gain/loss/liquidity
  board, source/status-aware event timeline, six database-backed news items from the latest 24 hours,
  a beginner decision checklist, and direct routes to real tools; it does not imply course progress
  or an available community feature. Absolute prices remain unsigned and visually distinct from
  signed movement. Every market view exposes a clear last-data-update time. In Vnstock mode, stock detail lazily loads
  and caches VCI current-TTM P/E, P/B, and ROE while preserving explicit unavailable states and the
  last observed values across transient failures; stock tables load only their current visible page
  in bounded batches of 15. A reset pre-open
  KBS board uses VCI's batch latest-close/preceding-reference fields rather than presenting every
  stock and sector as 0%; after the session begins, unmatched symbols remain in the snapshot at their
  reference price instead of disappearing. The Vnstock provider is instantiated once during
  application startup before concurrent reads can stampede the guest quota. Stock OHLCV reads prefer
  KBS and use VCI as a bounded fallback when KBS fails or returns no rows, while successful series
  retain the existing process cache and VND normalization. The detail headline and enclosing metric panel consume
  WebSocket snapshots, label auction fields as unavailable until a trade occurs, explain each metric,
  and show quote-based market time; Vnstock snapshots refresh every minute by default. Quota exits
  degrade through the provider failure path. Activation still
  requires a current token or API key plus Smart OTP and explicit redistribution rights. In local
  Vnstock mode, Home and Events now show observed VCI milestones for the next 30 days across the eight
  highest-interest snapshot symbols, with bounded fan-out, a 30-minute cache, explicit partial-scope
  copy, and stale fallback. FiinGroup remains recommended for licensed full-market
  corporate/event/people coverage. Provider failover, licensed history
  backfill and traffic-derived production popularity are not active.
- The Market stock page is advanced-only: its default VN-Index view is a candlestick chart and its
  nine-column stock table fits inside the card without a horizontal scrollbar; narrow screens use
  labeled two-column stock cards. Legacy display-mode query parameters are ignored.
- Market stock screening is URL-addressable and runs over the complete provider snapshot before
  cursor pagination. It supports bounded daily-change, matched-value, market-cap, volume-versus-20-day,
  and VN30 conditions plus compatible sort keys. The UI provides practical presets with prominent
  thresholds and an accessible URL-backed dialog that compares charts and metrics for up to three
  replaceable stocks while preserving explicit unavailable ratios. AI outlook is labeled unavailable
  until a validated prediction model exists.
  Volume-baseline controls are hidden when the active source does not provide that field. Home also
  derives a daily focus block only from observed breadth, sectors, provider events, and database news;
  the shared status bar explains the current trading-session context.
- `/portfolio` is an authenticated paper-trading workspace with one private 100-million-VND
  simulation account per user. Migrations `0012_paper_trading` and `0013_paper_orders` store
  row-locked cash/share validation, durable audit orders, weighted-average holdings, and immutable
  idempotent fills. The API/UI expose modeled fees/tax, current and realized/
  unrealized performance, bounded price/equity history, observed gainers, positive tagged news, and
  deterministic risk notices without placing broker orders or presenting predictions as facts. Its
  advanced market table, stock detail, and owned-position table use one automatic observed-price
  dialog; accepted practice trades fill in full, close the dialog, and surface a fixed confirmation
  outside it so users cannot mistake a completed request for an idle form. Real execution differences
  remain explicit. The unrealized/realized summary cards open accessible detail dialogs that attribute
  gains and losses by symbol or completed sale. The unrealized view is read-only except for an adjustable
  hypothetical sale quantity and recalculates exact VND proceeds, costs, result, and return without
  exposing an order action. Sell appears only for available owned quantities. The market picker lazily enriches P/E and P/B across its
  bounded universe through sequential 15-symbol calls, while a separate position table manages
  purchased stocks. Pagination and detail-return links keep the originating table in view. The
  same-origin `/portfolio-api` BFF enforces CSRF while FastAPI independently verifies the BFF secret,
  bearer session, active user, and resource ownership. See `docs/plan/paper-trading.md`.
- Market-data work must follow `.agents/rules/market-data-freshness.md`: verify runtime provider
  timestamps against the latest valid Vietnam trading session, refresh only bounded relevant caches,
  and never manufacture calendar-day candles for weekends or holidays.

## Local development

- Authentication is implemented behind `AUTH_ENABLED=false` by default. It provides email/Google
  login, 90-second registration and password-reset OTPs, server-held JWT/refresh credentials, and
  automatic persistent sessions with rotating refresh tokens. Email addresses are not remembered
  in browser storage. Configure the blank auth entries in `.env`
  using the ignored local guide `docs/tutorial/auth-keys.md` before enabling it.

- Copy `.env.example` to `.env`, replace placeholder secrets, then use `docker compose up --build
  --wait` for the complete stack. The default `development` profile owns a repository-managed
  Next.js HMR service at loopback `http://localhost:3000`; Nginx remains available at port 8080.
- `docs/tutorial/market-data-api-keys.md` ranks current Vietnam market-data options and documents
  credential acquisition for Vnstock, TCBS, FinLens, DNSE, SSI, and FiinGroup without storing keys.
- Use development servers for interactive code work and do not run the frontend production build
  during agent sessions.
- Keep `frontend/package-lock.json` synchronized with `package.json` and backend requirement pins
  synchronized with the Docker image.
- Use `DEVELOPMENT_GUIDE.md` for Docker/port commands and `backend/tests/run_feature_tests.py` for
  per-feature unit/integration Allure JSON, automatic single-file Allure HTML, and terminal branch
  coverage.
- Follow `.agents/rules/project-structure.md` for every path or boundary change.

## Admin account management

Implemented `/admin/users` with backend role checks, stable search/filter pagination, account role/status updates, active-session revocation on disable, Redis rate limits, and audit details. The Admin News shared password remains a separate gate and does not authorize the account API. See `docs/plan/admin-user-management.md`.
