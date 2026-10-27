# Architecture Decision Log

Record durable decisions in reverse chronological order. Do not record routine implementation
details.

## 2026-10-27 — Proof-of-Thesis Arena & Social Paper Trading Architecture

- **Status:** Accepted and implemented on `feature/community-thesis-paper-trading`
- **Context:** Generic social networks (unstructured feeds, comments, likes) offer low differentiation and devolve into noise, hype, and untraceable pump-and-dump claims. Users requested high-value community capabilities where analytical skill is verifiable and transparent.
- **Decision:**
  1. *Proof-of-Thesis Arena*:
     - Structured thesis schema: symbol, stance (bullish/bearish), target price, stop-loss price, horizon (1-12M), catalysts, and detailed analysis body.
     - Anti-cheat Entry Stamping: To prevent hindsight bias and manipulated entry claims, `ThesisService` queries `market_provider.instrument(symbol)` upon publish to lock the exact real-time execution price. Users cannot supply their own entry prices.
     - Automated Outcome Evaluation: Background/real-time checks compare live market prices against target/stop-loss. Bullish theses hit target if `current >= target` or stop out if `current <= stop_loss` (vice versa for bearish).
     - Analyst Reputation: Win rate and average ROI are calculated strictly from completed theses. Tiers (Grandmaster, Senior, Equity, Junior Analyst) reward proven analytical accuracy.
  2. *Social Paper Trading*:
     - Portfolios remain private by default (`is_public = False`).
     - Users can explicitly opt-in to public leaderboard participation with a custom nickname.
     - Public view renders transparent asset allocation (holdings weight) and immutable execution diary (past trades) without exposing private user identity or sensitive credentials.

## 2026-10-27 — Quantitative Financial Forensics, Conglomerate Graphs & Extended Leaders

- **Status:** Accepted and implemented on `feature/market-intelligence-analytics`
- **Context:** Retail investors in Vietnam struggle with corporate governance transparency (hidden subsidiaries, cross-holdings, accounting earnings manipulation).
- **Decision:**
  1. *Extended Prominent Leaders*: Scaled from 8 to 22 business leaders across 8 key sectors, dynamically valuing listed equity portfolios against real-time market quotes.
  2. *Conglomerate Ecosystem Graphs*: Hardened relational models for Vietnam's 6 largest corporate groups (Vingroup, Masan, Hòa Phát, FPT, Sovico, SSI/PAN) mapping tier-1 and tier-2 entities, parent-subsidiary equity stakes, and capital flows.
  3. *Quantitative Forensics*: Implemented Altman Z-Score for emerging market manufacturing/non-manufacturing, coupled with 4 automated red flags (low cash-to-net-income quality, abnormal receivables surge, inventory turnover degradation, working capital liquidity stress).
  4. *DCA Simulator & Daily Digest*: Monthly dollar-cost averaging backtester against 12M bank deposits and automated 15h30 market close summary digest.

## 2026-10-26 — Resilient auth session and rate-limit fallbacks on serverless/free cloud deployments

- **Status:** Accepted and implemented
- **Context:** On free-tier cloud environments like Render without a paid Redis add-on, Redis is unavailable (`redis: unavailable`). This previously caused:
  1. Frontend to fail-closed on all auth routes with `503 AUTH_NOT_CONFIGURED` because `AUTH_SESSION_REDIS_URL` was mandatory in `authConfigured()`.
  2. Backend `AuthRateLimiter` to throw `503 Authentication protection is temporarily unavailable` on auth endpoints when Redis threw connection errors.
  3. Google OAuth to fail if `AUTH_GOOGLE_REDIRECT_URI` differed slightly between backend and frontend or was omitted.
- **Decision:**
  1. Frontend `user-auth.ts`: Make `AUTH_SESSION_REDIS_URL` optional. Retain the AES-256-GCM encryption model with `AUTH_SESSION_ENCRYPTION_KEY`, and provide an in-memory session and pre-auth store fallback when Redis is absent or unreachable. Redis remains the preferred distributed store when configured (e.g., Upstash).
  2. Frontend `route.ts`: Implement `getGoogleRedirectUri(request)` to automatically derive the redirect URI from the incoming request host when not explicitly configured, and pass `redirect_uri` in the `/google/exchange` BFF payload.
  3. Backend `AuthRateLimiter`: Implement a thread-safe in-memory process-local fixed-window limiter fallback with warnings when Redis encounters errors, matching `ProviderGuard`'s resilience pattern.
  4. Backend `auth.py`: Accept `redirect_uri` dynamically from the trusted BFF payload (`GoogleExchangeRequest`) with `settings.auth_google_redirect_uri` as fallback.
  5. Synchronize all environment variables in `render.yaml` and provide explicit Google Cloud Console setup documentation in `docs/deploy.md`.
- **Consequences:** Google and email authentication work reliably on standalone cloud web services without failing closed on missing Redis, while maintaining security invariants (AES-256-GCM encrypted cookies, strict CSRF validation, rate limiting, and exact Google OIDC claim verification).

## 2026-10-25 â€” Direct FastAPI news ingestion cycle and 90-day retention on web deploy

- **Status:** Accepted and implemented
- **Context:** On single-instance container hosts and Render free-tier deployments, standalone Celery
  workers and Celery Beat schedulers are not running. Relying exclusively on Celery Beat left news
  un-ingested on deploy, while generic discovery feeds could bring in off-topic articles (e.g. lifestyle,
  sports) or stale records older than 90 days.
- **Decision:**
  1. Purged test/off-topic articles from cloud PostgreSQL.
  2. Refined crawler configurations (`VietstockCrawler`, `CafeFCrawler`, etc.) to focus exclusively on
     Vietnamese securities, stock market indices, and listed corporate finance feeds, applying strict
     market and ticker terminology guards.
  3. Extracted `process_ingestion_job` in `news_ingestion_worker.py` and implemented `run_direct_ingestion_cycle`
     which executes `cleanup_old_news(retention_days=90, dry_run=False, confirm=True)` and ingests discovered
     market articles directly into PostgreSQL without requiring Celery or Redis.
  4. Registered an async background loop in FastAPI `lifespan` (`main.py`) that executes immediately upon
     deployment startup (2s post-boot) and repeats every 15 minutes.
  5. Configured `psycopg_pool.ConnectionPool` with `check=ConnectionPool.check_connection`, `max_idle=120.0`,
     and `max_lifetime=1800.0` to cleanly recycle serverless PostgreSQL SSL connections.
- **Consequences:** News ingestion and 90-day retention work autonomously upon every web service deployment
  and during continuous operation regardless of whether Celery Beat is deployed. Public news feeds only
  contain relevant Vietnamese stock and corporate market news with sentiment analysis.

## 2026-10-13 â€” Bounded VCI event calendar for the evaluation adapter

- **Status:** Accepted and implemented
- **Context:** Vnstock exposes VCI corporate events per symbol, but the adapter returned an empty
  calendar. Scanning all 30 VN30 members plus the quote/index calls exceeded the 20-request guest
  minute budget and made first-load results depend on call order.
- **Decision:** Build the local Home/Events calendar from published VCI milestones for the eight
  highest-interest symbols in the current snapshot. Limit event fetches to six concurrent calls,
  retain only the nearest milestone per source event within the next 30 Vietnam-market days, cache
  the normalized calendar for 30 minutes, and serve the last observed calendar after refresh failure.
  Use the paged VCI event endpoint through the adapter's owned request boundary, with an explicit
  timeout, instead of consuming the shared Vnstock guest quota needed by quotes and indices. Label
  the scope as partial; do not synthesize missing dates or claim full-market coverage.
- **Consequences:** The Home calendar is populated from real provider observations without exhausting
  the guest request budget. Coverage follows the current high-interest snapshot and is intentionally
  incomplete; a licensed full-market corporate-actions feed remains the production path.
- **Refines:** â€œVnstock is a source-delayed evaluation adapterâ€ below.

## 2026-10-13 â€” Complete-only public news feed

- **Status:** Accepted and implemented
- **Context:** Partial and metadata-only records were presented beside full articles with a warning,
  which made the public feed inconsistent and looked like broken content.
- **Decision:** Publish only current revisions with `complete` extraction. Persist incomplete source
  observations and immutable revisions for operations, but set their article visibility to
  `withdrawn`; allow a later complete revision to republish the same canonical article. Translate
  machine event identifiers at the presentation boundary and keep source-explicit ticker candidates
  visually distinct from reviewed security-master mentions.
- **Consequences:** Metadata-only sources remain operational inputs but no longer contribute public
  cards or detail pages. Existing incomplete rows are recoverable rather than hard-deleted, while
  the public API, pagination, homepage, and portfolio news consumers see complete articles only.

## 2026-10-13 â€” Fixed local frontend port and VCI valuation reads

- **Status:** Accepted and implemented.
- **Context:** Ad-hoc frontend containers did not survive normal Compose lifecycle and made the
  Google callback origin inconsistent. KBS financial-ratio calls also share a 20-request-per-minute
  guest quota with other KBS operations, so a 15-row table could exhaust that quota before every
  visible stock received P/E and P/B.
- **Decision:** Enable a repository-owned `frontend-dev` Compose profile by default for local work,
  bind it only to loopback port 3000, and keep its dependencies and `.next` cache in named volumes.
  Use VCI's company ratio summary for the latest quarterly TTM P/E/P/B enrichment, retain the
  one-hour per-symbol cache and last-observed fallback, and fetch only the currently visible 15-row
  page. Keep unavailable ratios explicit rather than manufacturing values.
- **Consequences:** A normal local `docker compose up` consistently provides HMR and the configured
  Google callback at `http://localhost:3000`. The Market and Portfolio tables can fill one visible
  page without competing with KBS quote quota; newly visited pages load on demand, and a genuinely
  absent upstream ratio is shown as unavailable instead of as zero.
- **Refines:** â€œVnstock is a source-delayed evaluation adapterâ€ and â€œRedis-backed jobs and container
  delivery baselineâ€ below.

## 2026-10-13 â€” News ingestion is part of application readiness

- **Status:** Accepted and implemented.
- **Context:** Compose defined a news worker and Beat, but a selective local startup could run the
  public API/UI without either service, leaving the news database stale even though the application
  appeared healthy. Scheduler restarts and rolling deployment overlap also require explicit
  idempotency rather than operational timing assumptions.
- **Decision:** Keep one independent Beat scheduler and the dedicated concurrent news worker. Make
  both health-checked dependencies of the API and public Nginx services in the shared local/deployment
  Compose topology. Beat queues all six sources shortly after startup and every five minutes;
  staging and production explicitly default `NEWS_INGESTION_ENABLED` to true while retaining the
  environment kill switch. Canonicalize and de-duplicate discovery URLs before creating hourly
  unique job keys, then retain the PostgreSQL unique article key on source plus canonical URL.
- **Consequences:** Starting the public Compose application starts and waits for ingestion without a
  separate crawl command. Duplicate startup/scheduled deliveries are harmless and later observations
  update revision history instead of inserting another article. Deployments can still intentionally
  pause ingestion, and source policy/redistribution approval remains an independent production gate.
- **Refines:** â€œRedis-backed jobs and container delivery baselineâ€ and â€œDurable stock-news ingestion
  and activation gateâ€ below.

## 2026-10-11 â€” Automatic single-file Allure presentation

- **Status:** Accepted and implemented.
- **Context:** `allure-pytest` correctly produced Allure JSON, but raw result files are not a
  developer-readable report. Requiring a separate manual `allure serve` step meant a feature run did
  not leave an immediately viewable result artifact.
- **Decision:** Keep Python `allure-pytest` as the test adapter and source-result format. After every
  feature suite, whether pytest passes or fails, invoke the exact locked official Allure Commandline
  package to generate `allure-report/index.html` with `--single-file`. Keep both generated result and
  report directories ignored. Continue prohibiting legacy `pytest-html`, JUnit, coverage XML, and
  coverage Markdown artifacts.
- **Consequences:** Every completed feature-suite invocation leaves one directly openable Allure HTML
  file plus its machine-readable JSON. Local setup now requires Java and the frontend npm development
  dependencies; the runner fails visibly if presentation generation is unavailable.
- **Refines:** â€œAllure-only local backend test artifactsâ€ below; Allure remains the only report
  system, but its official HTML presentation is now retained locally.

## 2026-10-11 â€” Allure-only local backend test artifacts

- **Status:** Refined by â€œAutomatic single-file Allure presentationâ€ above.
- **Context:** Repository-local HTML/JUnit/coverage files created noisy generated trees and forced
  developers to inspect several report formats. The requested standard is the Python Allure adapter.
- **Decision:** Pin `allure-pytest` in both the uv development lock and pip development requirements.
  Feature runs keep branch coverage in the terminal and write only Allure JSON under
  `test-results/<feature>/<level>/allure-results/`. Do not retain generated pytest HTML, JUnit,
  coverage XML, or coverage Markdown in the repository workspace. Use the separately installed
  Allure CLI only to serve a temporary presentation when needed.
- **Consequences:** One machine-readable result format covers local test-case inspection, and old
  HTML artifacts are removed. Developers need the Allure CLI to view the interactive report, while
  test execution itself needs only the Python dependency.
- **Supersedes:** The local report formats in â€œFeature-level test evidence and local reportsâ€; its
  per-feature registration, unit/integration separation, and branch-coverage requirements remain.

## 2026-10-11 â€” Automatic observed-price fills and session-aware freshness

- **Status:** Accepted and implemented as the current educational simulation model.
- **Context:** The product is a beginner practice environment, so a persistent waiting/limit-order
  workflow obscured portfolio learning and implied exchange behavior that the provider cannot model.
  Market dates also need to distinguish the current calendar day from the latest valid Vietnamese
  trading session.
- **Decision:** Keep durable orders and immutable fills for audit/idempotency, but automatically fill
  every accepted simulated buy or sell in full at the authoritative latest observed price whenever
  provider freshness is accepted. Closed-session practice uses the latest valid completed-session
  snapshot; no weekend or holiday candle is fabricated. Remove status/cancellation controls from the
  learner UI and disclose that real orders may wait, partially fill, or not fill. Enrich P/E and P/B
  only for the currently visible market page, capped at 15 symbols with three concurrent detail calls
  and provider caching. Require market-data work to follow `.agents/rules/market-data-freshness.md`.
- **Consequences:** Learners get immediate position and cash feedback without mistaking the simulator
  for an exchange. Existing order tables and cancellation API remain compatible with legacy records,
  while dashboard reads convert eligible legacy pending/open orders. Price staleness still fails
  closed, and fundamentals enrichment cannot fan out across the full market universe.
- **Supersedes:** â€œDurable day-valid LO paper ordersâ€ below. Its persistence, locking, provenance,
  privacy, and immutable-fill decisions remain valid.

## 2026-10-11 â€” Durable day-valid LO paper orders

- **Status:** Superseded by automatic observed-price fills; retained as migration history.
- **Context:** The immediate-fill slice could not represent a successful placement that had not yet
  matched, reserve cash or shares across concurrent orders, cancel waiting orders, or expose one
  consistent workflow from the market board, stock detail, and owned positions.
- **Decision:** Persist LO orders separately from immutable fills. A buy matches at the fresh observed
  market price only when it is at or below the limit; a sell matches only at or above the limit, and
  matching is disabled outside an open session. Pending/open orders reserve limit cash plus modeled
  fee or owned shares under the existing portfolio row lock. Dashboard reads and a 30-second open-page
  refresh re-evaluate orders; cancellation and day expiry release unfilled reservations. Keep partial
  fills, exchange holiday calendars, ATO/ATC, settlement, and broker connectivity out of scope.
- **Consequences:** Placement and execution are now distinct durable events, and concurrent orders
  cannot reuse reserved capacity. Matching is still an educational observed-price model, not an
  exchange order book; an order is re-evaluated when the private dashboard is read rather than by a
  continuously running exchange engine.
- **Supersedes:** The immediate-fill lifecycle in â€œPrivate immediate-fill paper trading for
  beginnersâ€; its account, fee/tax, privacy, provenance, and immutable-fill decisions remain valid.

## 2026-10-08 â€” Private immediate-fill paper trading for beginners

- **Status:** Accepted and implemented as an educational simulation.
- **Context:** Beginners need a safe way to practice buying, holding, reviewing performance, and
  selling without real money. The current provider contract supplies observed prices and daily
  candles but not an exchange order book, broker account, settlement engine, or active buy/sell-side
  classifications.
- **Decision:** Give each authenticated user one private 100-million-VND account. Simulated market
  orders fill immediately at the latest observed canonical price and persist immutable source/time/
  delay metadata. Serialize cash and holding mutations with a PostgreSQL row lock, require a
  per-account idempotency key, use weighted-average cost including a disclosed 0.15% modeled fee,
  and record a separate 0.1% modeled sell tax. Protect browser access through the existing
  CSRF-checked BFF plus verified active bearer session. Derive only observable risk notices and show
  null/partial valuation when a price is unavailable; do not invent active buy/sell counts, future
  news, broker matching, or personalized advice.
- **Consequences:** Users can practice and retain an auditable ledger without exposing portfolio data
  to public caches or logs. The experience is not exchange-identical: partial fills, limit/ATO/ATC
  orders, settlement, dividends, splits, margin, short sales, deposits, and broker connectivity need
  separately specified future work. Public operation still requires approved market-data rights.

## 2026-10-07 â€” Vnstock is a source-delayed evaluation adapter

- **Status:** Accepted for local/private evaluation; public redistribution remains gated.
- **Context:** The beginner experience needs real quote breadth, industry classification, and
  multi-session OHLCV that the current TCBS integration does not provide. Vnstock exposes a unified
  Python client over multiple upstream sources, but its package access is not an exchange-data
  redistribution license.
- **Decision:** Add Vnstock behind the existing canonical provider port, use KBS for reference/quotes/
  OHLCV plus financial ratios and VCI for industry labels, keep its optional key server-side, cache
  snapshots/candles, and identify all results as source-delayed and partial. Load P/E, P/B, EPS, and
  ROE lazily for detail reads with a bounded one-hour per-symbol cache; the portfolio may enrich only
  its current 15-row page through bounded detail calls, while watchlist and WebSocket snapshots stay
  on the lightweight quote path. If the entire KBS board is reset before a
  new session, use one VCI price-board batch for the latest completed close and preceding reference;
  do not fan out historical calls or turn the new reference into a synthetic 0% move. Normalize the
  library's quota `SystemExit` as a provider failure so it cannot cancel an ASGI request. Once any
  current-session match exists, retain unmatched symbols at their current reference as unchanged so
  market breadth and sector membership do not collapse during the opening auction. Preserve an
  upstream indicative auction price while leaving not-yet-executed open/high/low/volume/value at
  zero for the UI to label as unavailable; do not synthesize trades. Use live quote timestamps as
  market time and a one-minute default snapshot refresh, while stock detail merges the bounded
  WebSocket quote stream. Derived
  foreign value and sector strength
  must be labeled as estimates/relative indicators rather than official net flow.
- **Consequences:** Local Home, Market, and stock charts can use real source data without coupling the
  frontend to Vnstock, and detail pages expose current provider fundamentals without multiplying
  requests across the market universe. A failed ratio request leaves quote/chart data available with
  null fundamentals. Public/commercial deployment remains blocked until Vnstock and each relevant
  upstream owner confirm display, cache, retention, and redistribution rights in writing.

## 2026-10-06 â€” Bounded Docker container logs

- **Status:** Accepted and implemented.
- **Context:** Docker's `json-file` driver is unbounded unless the daemon or container declares
  rotation, so a repeated application failure can exhaust host storage.
- **Decision:** Apply a shared Compose logging policy to every service with `max-size=10m` and
  `max-file=3`. Keep the policy in the deployment artifact rather than relying on mutable host-wide
  daemon configuration.
- **Consequences:** Each recreated InvestIQ container retains approximately 30 MB of Docker logs.
  Existing containers must be recreated before the new policy applies; unrelated host containers
  remain governed by their own configuration or the daemon default.

## 2026-10-06 â€” Credential-gated TCBS adapter and path-addressable market tabs

- **Status:** Accepted and implemented behind an activation gate.
- **Context:** Market UI and contracts existed only against a fixture, and query-only tabs made the
  selected workspace less explicit across reloads and shared links. TCBS iFlash now documents REST
  quote/security APIs plus a pipe-delimited WebSocket, but token issuance requires API key + Smart OTP,
  lasts at most eight hours, and has no documented refresh token.
- **Decision:** Add TCBS as an infrastructure adapter behind the existing canonical provider port.
  Keep credentials server-only, reuse tokens only in memory, accept either a current access token or
  API key plus one-time OTP, and fail closed when renewal is required. Use REST as snapshot/resync truth,
  one official index stream with text heartbeat, bounded retry/circuit/reconnect, and partial responses
  for unsupported data classes. Make `/market/<tab>` canonical, preserving `/market?tab=...` only as a
  compatibility redirect that retains filters.
- **Consequences:** Supplying an API key alone cannot provide unattended operation; an operator must
  rotate the access token or OTP before expiry. TCBS mode provides live quotes/index context but does
  not fabricate daily candles, events, people or fundamentals. Public activation remains gated by
  field-level display/cache/redistribution rights and live-session validation.

## 2026-10-04 â€” Canonical licensed market data and explainable popularity

- **Status:** Foundation implemented; licensed production adapters pending.
- **Context:** The home and market pages need replaceable realtime/delayed providers, reliable
  freshness, popular-stock ranking, events and public businessperson data without coupling UI to a
  vendor or misrepresenting financial/person data.
- **Decision:** Put licensed provider SDKs behind canonical market-data adapters and expose only
  InvestIQ REST/WebSocket contracts. Stamp every value with source, market/received time, delay and
  freshness; reconcile stream gaps with REST snapshots. Rank popular stocks from privacy-safe
  InvestIQ engagement plus normalized market activity and show human-readable reason codes. Treat
  matched volume as two-sided; show active buy/sell only when the provider defines it. For people,
  minimize public professional/holding fields and label the computed metric â€œestimated listed-equity
  value,â€ never total net worth.
- **Consequences:** Production launch is gated by field-level storage/display/redistribution rights.
  A provider can be replaced per data class without changing domain/UI contracts, but failover may
  occur only between semantically compatible feeds. Engagement needs retention and anti-abuse
  controls; people imagery and holdings need source dates and usage rights. The full specification is
  `docs/plan/home-market-pages.md`.
- **Refines:** â€œEvidence-based market community as the next product phaseâ€ below. The MVP baseline
  remains licensed EOD/delayed data, while the canonical transport may accept realtime data earlier
  when rights and budget are approved; a professional tick-by-tick board remains deferred.

## 2026-10-04 â€” Evidence-based market community as the next product phase

- **Status:** Accepted as roadmap; not implemented.
- **Context:** Authentication and stock-news aggregation provide a base for market and community
  features, but copying a broad market platform feature-for-feature would create a costly data and
  tooling race without a clear InvestIQ advantage.
- **Decision:** Build the next phase around licensed EOD/delayed market context, private watchlists,
  moderated community content, and structured investment theses with evidence, horizon, invalidation,
  disclosure, immutable updates, publication-time market snapshots, and outcome-based reputation.
  Add source-linked AI critique after these foundations. Defer realtime tick data, copy trading,
  broker connectivity, private signal rooms, and generic buy/sell AI until after public beta.
- **Consequences:** Market-data licensing and field semantics gate implementation. Reputation must
  account for benchmark, horizon, sample size, bias and manipulation. Community scope requires
  privacy, moderation, abuse controls, auditability and retention from its first release. The
  detailed roadmap is `docs/plan/community-market-roadmap.md`.

## 2026-10-04 â€” Numbered news browsing and archive recovery

- **Status:** Accepted and implemented.
- **Context:** Users need direct access to ten-item pages and three months of publisher-dated news.
- **Decision:** Keep the signed cursor contract for API clients, add bounded numbered offsets and
  filtered counts for UI navigation, and cache public list payloads in Redis for 30 seconds using a
  version key invalidated after committed article writes. Backfill Vietstock's public date-filtered
  archive one page per task, checkpoint the next page in PostgreSQL, and let Beat resume stalled runs.
  Activate StockBiz from its public RSS as a metadata-only source. Supply HNX's missing GlobalSign
  intermediate to the HNX HTTP client while retaining certificate and hostname verification.
- **Consequences:** Numbered pages can shift as new articles arrive. UI cache may display data up to
  30 seconds old. Archive coverage depends on what the publisher exposes; verified publication dates
  and the 90-day retention cutoff still govern stored articles.

## 2026-10-02 â€” Authentication email feedback

- **Status:** Accepted and implemented
- **Context:** Duplicate registrations left users waiting for an OTP that was never sent; password
  recovery did not explain unknown addresses or Google-only accounts.
- **Decision:** Reject registered emails at registration with 409, return 404 for unknown recovery
  addresses, and return 409 with Google sign-in guidance for Google-only accounts. Keep a 5/hour
  per-email/per-IP recovery limit and add a 10/hour per-IP limit.
- **Consequences:** This gives users actionable recovery guidance but reveals account existence and
  sign-in provider to someone who knows an email address. The user explicitly chose that behavior;
  the additional IP limit reduces, but does not eliminate, enumeration risk.

## 2026-10-02 â€” Automatic user sessions and OTP email presentation

- **Status:** Accepted and implemented
- **Context:** Users should not need to opt into persistent login, and authentication emails need
  clear copy plus a prominent, readable OTP in both rich and plain-text email clients.
- **Decision:** Remove remembered-email storage and persistent-session choices from the UI and BFF.
  Create every user session with the configured absolute lifetime (30 days by default), an
  HttpOnly browser cookie, encrypted server-side credentials, and automatic rotating refresh tokens.
  Send OTP and account notices with inline-styled HTML and a plain-text alternative.
- **Consequences:** Browser storage never retains login email or refresh credentials. Sessions still
  expire at the backend absolute limit and can be revoked at logout; new sessions use the existing
  refresh replay protections. Mail clients that do not support HTML receive the same OTP in text.

## 2026-10-02 â€” SMTP egress for authentication notifications

- **Status:** Accepted and implemented
- **Context:** The Compose backend network is internal-only, so the authentication email worker
  could not resolve or connect to its external SMTP provider. OTP delivery failed before SMTP
  authentication.
- **Decision:** Keep backend services on the internal network and attach only
  `celery-notifications` to a separate outbound network for SMTP delivery.
- **Consequences:** Authentication email delivery can reach its configured provider while the API,
  general Celery worker, Beat, database, and Redis retain their existing network isolation.

## 2026-09-30 â€” Metadata-only expansion through publisher RSS feeds

- **Status:** Accepted and implemented
- **Context:** The news product needed more reputable sources, while publisher RSS terms and official
  disclosure feeds do not imply permission to republish full article bodies.
- **Decision:** Add HNX, VnEconomy, and VnExpress through bounded, allowlisted RSS discovery. Store and
  display only metadata, images/attachments explicitly linked by the source, and the canonical source
  link. Filter VnExpress's broad business feed to securities topics and exclude non-equity HNX feed
  entries. Keep the global ingestion activation gate off by default.
- **Consequences:** The product has five technically active adapters without treating RSS access as
  full-text rights. Detail pages for the three new sources direct readers to the publisher; six
  researched sources remain pending or blocked.

## 2026-09-29 â€” News persistence protection scope

- **Status:** Accepted and implemented
- **Context:** The news feature request mentioned `db reply`; clarification explicitly selected
  periodic backups only.
- **Decision:** Use one primary PostgreSQL database and independent periodic `pg_dump` backups with
  checksum validation and an isolated restore procedure. Do not add a database replica.
- **Consequences:** The implementation provides no database failover or point-in-time recovery.
  A six-hour scheduler is available, while production storage, tiered retention and alerting remain
  deployment configuration. A PostgreSQL 17 restore drill was completed on 29/09/2026.

## 2026-09-29 â€” Durable stock-news ingestion and activation gate

- **Status:** Accepted
- **Context:** Redis/Celery delivery can lose queued messages, source rights differ, and article
  updates must retain history.
- **Decision:** Store discovery/fetch jobs and leases in PostgreSQL, dispatch them to Celery after
  commit, and recover pending/expired jobs every minute. Persist immutable article revisions and
  source-specific content-access policies. Ship Vietstock/CafeF adapters but keep ingestion off by
  default until source policy and security-master data are approved.
- **Consequences:** Redis is transport rather than the only job record. Operators must explicitly
  activate ingestion and maintain source policy; seven researched sources remain pending/blocked.

## 2026-09-29 â€” Source-explicit tickers and bounded market-impact analysis

- **Status:** Accepted and implemented
- **Context:** Live articles contain qualified and contextual tickers that are absent from the small
  reviewed security master. The first rule baseline also returned neutral or mixed too often and did
  not explain likely stock-market impact.
- **Decision:** Persist publisher-explicit ticker candidates separately from verified security
  mentions. Display them as source-mentioned codes. Public symbol-scoped news reads may match an
  exact qualified or bare publisher candidate in addition to a verified relation, but candidates
  remain visually distinct and do not become security-master mentions.
  Sentiment rules use weighted financial events, sentence evidence, a stated impact scope and an
  explicit short-term horizon. Confidence remains null until calibration. Analyzer version changes
  replace current analysis without creating an article-content revision.
- **Consequences:** Cards and symbol detail pages can use explicit publisher tickers while preserving
  master-data trust and avoiding free-text symbol inference. Market-impact
  text is an explainable content assessment, carries a non-advice notice, and is not a price forecast.

## 2026-09-26 â€” Feature-level test evidence and local reports

- **Status:** Superseded for local artifact formats by the Allure-only decision above.
- **Context:** Test pass counts alone do not show which feature lines and branches were exercised,
  and developers need one repeatable location for unit and integration evidence.
- **Decision:** Every feature carries meaningful unit and integration tests. Backend features are
  registered in a standard runner that emits separate branch-aware JUnit, Markdown, XML, and HTML
  reports beneath ignored `test-results/<feature>/<level>/` directories. CI measures the full
  backend with pytest-cov, while local reports stay uncommitted.
- **Consequences:** Feature coverage is comparable and easy to inspect without adding generated
  artifacts to Git. Coverage remains diagnostic evidence and does not replace behavior-focused
  assertions or required boundary/failure cases.

## 2026-09-26 â€” Local runtime log viewer with restricted Docker access

- **Status:** Accepted
- **Context:** Developers need one chronological UI for useful API, application, warning, and error
  logs across runtime containers without mixing in build output or repetitive health checks.
- **Decision:** Run a pinned Dozzle viewer on a loopback-only host port and restrict its Docker API
  access through a private socket proxy to GET/HEAD container metadata, events, info, and log
  endpoints. Label only user-relevant runtime services for display. Emit sanitized structured HTTP
  fields from FastAPI/Celery and Nginx, and keep viewer actions, shell, MCP, and analytics off.
- **Consequences:** Local developers get merged searchable logs with container/time metadata and
  structured request context. Remote access requires an explicit authenticated proxy or SSH tunnel;
  the Docker socket proxy remains a privileged infrastructure boundary and must never be published.

## 2026-09-26 â€” Redis-backed jobs and container delivery baseline

- **Status:** Accepted
- **Context:** InvestIQ needs asynchronous and scheduled Celery work but does not need Kafka,
  RabbitMQ, or another independently operated message platform.
- **Decision:** Use Redis for application cache, Celery broker, and Celery results with separate
  logical databases. Run frontend, backend, PostgreSQL, Redis, Celery worker, Celery Beat, and Nginx
  in Compose. Build service-local images, publish immutable tags to GHCR, and deploy them with
  environment-specific self-hosted GitHub Actions runners.
- **Consequences:** Tasks must be idempotent under at-least-once delivery; only one Beat scheduler
  runs per environment. Nginx is the sole public container. Adding a distinct broker/event platform
  requires a new decision. Production approval and secrets live in GitHub environments.

## 2026-09-26 â€” On-demand, project-specific rule modules

- **Status:** Accepted
- **Context:** The initial rules were generic and did not cover InvestIQ's financial, ML, messaging,
  worker, privacy, observability, resilience, or supply-chain risks.
- **Decision:** Keep a short always-read general rule and route agents to task-specific modules from
  `AGENTS.md`. Adapt relevant concepts in project-specific wording after reviewing
  `khasky/awesome-agents-md` at commit `f4feb8dafe5ed7a33bfda07b76e0ca08e481771b`; do not import
  unrelated modules or depend on the external repository at runtime.
- **Consequences:** Agents load only matching rules. Adding or renaming a module must update the root
  routing table, and rule content must follow the actual FastAPI, Next.js, ML, and finance boundaries.

## 2026-09-26 â€” Monorepo boundaries and synchronized structure documentation

- **Status:** Accepted
- **Context:** InvestIQ requires separate backend, frontend, ML, CI/CD, and infrastructure areas,
  and path changes can leave agent memory and operational configuration stale.
- **Decision:** Use `backend/`, `frontend/`, `infra/`, and `.github/workflows/` as top-level
  boundaries. Treat structure documentation and all path consumers as part of every structural
  change, governed by `.agents/rules/project-structure.md`.
- **Consequences:** Agents must search for and update stale path references in the same change;
  `.agents/memory/architecture.md` is the canonical architectural overview.

## Template

### YYYY-MM-DD â€” Decision title

- **Status:** Proposed | Accepted | Superseded
- **Context:** What constraint or problem required a decision?
- **Decision:** What was chosen?
- **Consequences:** What trade-offs and follow-up work result?
- **Supersedes:** Link or heading, if applicable.

## 2026-09-26 â€” Repository-local agent guidance

- **Status:** Accepted
- **Context:** Agents need stable project context and task-specific operating rules.
- **Decision:** Store memory, rules, skills, roles, and workflows under `.agents/`, with
  `AGENTS.md` as the repository entry point.
- **Consequences:** Agents must keep durable memory current and avoid duplicating guidance.

## 2026-09-30 â€” Freshness-first news ingestion and protected operations

- **Status:** Accepted
- **Context:** Multi-source crawling must not retain stale or unverifiable articles, and provider
  instability must not produce request storms. Operators also need controlled source and retention
  actions before the general user-authentication scaffold is complete.
- **Decision:** Require a publisher timestamp and reject articles older than a configurable 72-hour
  ingestion window. Serve at most the configurable 90-day retention window. Coordinate per-domain
  fixed-window budgets and circuit state through Redis with a local fallback. Protect news operations
  with a dedicated bearer token, optimistic row versions, explicit destructive confirmation, and an
  audit table. Keep browser-side mutation controls disabled until real admin sessions exist.
- **Consequences:** Undated publisher pages are skipped rather than guessed. Cleanup can be previewed
  safely, but production deletion still requires an operator choice and target-environment review.
  The static operations token is transitional and must be replaced by role-based admin identity in a
  separately scoped RBAC migration.

## 2026-09-30 â€” Server-mediated Admin News workspace

- **Status:** Accepted
- **Context:** Operators need browser controls now, but exposing the FastAPI operations token to
  client JavaScript would turn an operational secret into a public credential, and the broader user
  identity/RBAC module is not implemented yet.
- **Decision:** Authenticate the Admin workspace with a dedicated server-side password and an
  HMAC-signed, HttpOnly, SameSite-strict, eight-hour cookie. Execute mutations through Next.js server
  actions and keep `NEWS_ADMIN_TOKEN` only in the Next.js server environment. Require the backend
  token independently, retain audit records, optimistic concurrency, dry-run cleanup, and explicit
  `DELETE` confirmation.
- **Consequences:** The browser never receives the operations bearer token and missing secrets keep
  the UI closed. This is suitable for the current controlled Admin workspace, but should be replaced
  by named admin identities, RBAC, and centralized login throttling in a separately scoped RBAC
  migration.

## 2026-10-01 â€” Server-held end-user authentication credentials

- **Status:** Accepted
- **Context:** Email/password and Google authentication need durable sessions without exposing JWT
  or refresh credentials to browser JavaScript, while registration and recovery emails must survive
  process restarts.
- **Decision:** Use a Next.js BFF with opaque HttpOnly browser cookies and AES-GCM encrypted auth
  state in Redis database 3. FastAPI issues short-lived HS256 JWTs and rotating, hashed refresh
  tokens backed by PostgreSQL sessions. Store OTPs as keyed digests, deliver encrypted email jobs
  through a dedicated Celery notification queue, and keep end-user auth feature-flagged and separate
  from Admin News authentication.
- **Consequences:** Enabling auth requires independent BFF, JWT, OTP, payload, session, SMTP, and
  optional Google credentials. Redis is required for browser auth state and abuse controls; auth
  fails closed when dependencies or secrets are unavailable. Admin access still needs a future RBAC
  migration.

### 2026-10-01 â€” Role-checked account administration

- **Status:** Accepted and implemented
- **Context:** Admins need account search and controlled role/status management without treating the shared Admin News credential as user identity.
- **Decision:** Protect account APIs with the BFF server secret and a verified active user session; authorize from the current database role. Audit user changes with actor, target, request ID, requested fields, and outcome. Prevent self changes and last-active-admin removal, and revoke sessions atomically when disabling an account.
- **Consequences:** The account page requires both the Admin workspace session and a separate authenticated InvestIQ admin account session. Account APIs fail closed when auth or Redis rate-limit protection is unavailable.

## 2026-10-26 â€” Git Branching Invariants, PR Promotion Hierarchy, and Remote Synchronization

- **Status:** Accepted
- **Context:** Commits directly to `main` or uncontrolled branch diverging caused `dev` to fall behind `main`, risking regression and uncoordinated deployments. Commits remaining local-only risked work loss and delayed CI validation.
- **Decision:** Codify `.agents/rules/git.md` requiring: (1) `dev` must always be ahead of or equal to `main` (`dev >= main`); (2) All PRs must target `dev` before promotion to `main`; (3) 100% green CI/CD gate before merging; (4) Standard branch naming (`feature/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`) and task isolation; (5) Immediate remote synchronization (`git push`) after every commit.
- **Consequences:** Merged/fast-forwarded `dev` to match `main`. All agents and contributors strictly adhere to the `dev`-first integration hierarchy and immediate remote pushes.

## 2026-10-26 â€” Secure Web Deployment & Attack Mitigation Skill

- **Status:** Accepted
- **Context:** Production web deployments risk inadvertent leakage of sensitive data (API keys, stack traces, source maps) and vulnerability to web attacks (OWASP Top 10, SSRF, DoS, broken access control).
- **Decision:** Introduce `.agents/skills/secure-deployment/SKILL.md` grounded in proven industry gold standards from high-starred open-source repositories: `OWASP/CheatSheetSeries` (33k+â˜…), `gitleaks/gitleaks` (30k+â˜…), `trufflesecurity/trufflehog` (28k+â˜…), and `shieldfy/API-Security-Checklist` (23k+â˜…).
- **Consequences:** Deployment plans and PRs must satisfy the pre-deploy audit, secret scanning, source map disabling, HTTP security headers (CSP, HSTS, X-Content-Type-Options), rate limiting, non-root container isolation, and post-deploy live probe checklist.
