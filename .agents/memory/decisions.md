# Architecture Decision Log

Record durable decisions in reverse chronological order. Do not record routine implementation
details.

## 2026-10-07 — Vnstock is a source-delayed evaluation adapter

- **Status:** Accepted for local/private evaluation; public redistribution remains gated.
- **Context:** The beginner experience needs real quote breadth, industry classification, and
  multi-session OHLCV that the current TCBS integration does not provide. Vnstock exposes a unified
  Python client over multiple upstream sources, but its package access is not an exchange-data
  redistribution license.
- **Decision:** Add Vnstock behind the existing canonical provider port, use KBS for reference/quotes/
  OHLCV and VCI for industry labels, keep its optional key server-side, cache snapshots/candles, and
  identify all results as source-delayed and partial. Derived foreign value and sector strength must
  be labeled as estimates/relative indicators rather than official net flow.
- **Consequences:** Local Home, Market, and stock charts can use real source data without coupling the
  frontend to Vnstock. Public/commercial deployment remains blocked until Vnstock and each relevant
  upstream owner confirm display, cache, retention, and redistribution rights in writing.

## 2026-10-06 — Bounded Docker container logs

- **Status:** Accepted and implemented.
- **Context:** Docker's `json-file` driver is unbounded unless the daemon or container declares
  rotation, so a repeated application failure can exhaust host storage.
- **Decision:** Apply a shared Compose logging policy to every service with `max-size=10m` and
  `max-file=3`. Keep the policy in the deployment artifact rather than relying on mutable host-wide
  daemon configuration.
- **Consequences:** Each recreated InvestIQ container retains approximately 30 MB of Docker logs.
  Existing containers must be recreated before the new policy applies; unrelated host containers
  remain governed by their own configuration or the daemon default.

## 2026-10-06 — Credential-gated TCBS adapter and path-addressable market tabs

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

## 2026-10-04 — Canonical licensed market data and explainable popularity

- **Status:** Foundation implemented; licensed production adapters pending.
- **Context:** The home and market pages need replaceable realtime/delayed providers, reliable
  freshness, popular-stock ranking, events and public businessperson data without coupling UI to a
  vendor or misrepresenting financial/person data.
- **Decision:** Put licensed provider SDKs behind canonical market-data adapters and expose only
  InvestIQ REST/WebSocket contracts. Stamp every value with source, market/received time, delay and
  freshness; reconcile stream gaps with REST snapshots. Rank popular stocks from privacy-safe
  InvestIQ engagement plus normalized market activity and show human-readable reason codes. Treat
  matched volume as two-sided; show active buy/sell only when the provider defines it. For people,
  minimize public professional/holding fields and label the computed metric “estimated listed-equity
  value,” never total net worth.
- **Consequences:** Production launch is gated by field-level storage/display/redistribution rights.
  A provider can be replaced per data class without changing domain/UI contracts, but failover may
  occur only between semantically compatible feeds. Engagement needs retention and anti-abuse
  controls; people imagery and holdings need source dates and usage rights. The full specification is
  `docs/plan/home-market-pages.md`.
- **Refines:** “Evidence-based market community as the next product phase” below. The MVP baseline
  remains licensed EOD/delayed data, while the canonical transport may accept realtime data earlier
  when rights and budget are approved; a professional tick-by-tick board remains deferred.

## 2026-10-04 — Evidence-based market community as the next product phase

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

## 2026-10-04 — Numbered news browsing and archive recovery

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

## 2026-10-02 — Authentication email feedback

- **Status:** Accepted and implemented
- **Context:** Duplicate registrations left users waiting for an OTP that was never sent; password
  recovery did not explain unknown addresses or Google-only accounts.
- **Decision:** Reject registered emails at registration with 409, return 404 for unknown recovery
  addresses, and return 409 with Google sign-in guidance for Google-only accounts. Keep a 5/hour
  per-email/per-IP recovery limit and add a 10/hour per-IP limit.
- **Consequences:** This gives users actionable recovery guidance but reveals account existence and
  sign-in provider to someone who knows an email address. The user explicitly chose that behavior;
  the additional IP limit reduces, but does not eliminate, enumeration risk.

## 2026-10-02 — Automatic user sessions and OTP email presentation

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

## 2026-10-02 — SMTP egress for authentication notifications

- **Status:** Accepted and implemented
- **Context:** The Compose backend network is internal-only, so the authentication email worker
  could not resolve or connect to its external SMTP provider. OTP delivery failed before SMTP
  authentication.
- **Decision:** Keep backend services on the internal network and attach only
  `celery-notifications` to a separate outbound network for SMTP delivery.
- **Consequences:** Authentication email delivery can reach its configured provider while the API,
  general Celery worker, Beat, database, and Redis retain their existing network isolation.

## 2026-09-30 — Metadata-only expansion through publisher RSS feeds

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

## 2026-09-29 — News persistence protection scope

- **Status:** Accepted and implemented
- **Context:** The news feature request mentioned `db reply`; clarification explicitly selected
  periodic backups only.
- **Decision:** Use one primary PostgreSQL database and independent periodic `pg_dump` backups with
  checksum validation and an isolated restore procedure. Do not add a database replica.
- **Consequences:** The implementation provides no database failover or point-in-time recovery.
  A six-hour scheduler is available, while production storage, tiered retention and alerting remain
  deployment configuration. A PostgreSQL 17 restore drill was completed on 29/09/2026.

## 2026-09-29 — Durable stock-news ingestion and activation gate

- **Status:** Accepted
- **Context:** Redis/Celery delivery can lose queued messages, source rights differ, and article
  updates must retain history.
- **Decision:** Store discovery/fetch jobs and leases in PostgreSQL, dispatch them to Celery after
  commit, and recover pending/expired jobs every minute. Persist immutable article revisions and
  source-specific content-access policies. Ship Vietstock/CafeF adapters but keep ingestion off by
  default until source policy and security-master data are approved.
- **Consequences:** Redis is transport rather than the only job record. Operators must explicitly
  activate ingestion and maintain source policy; seven researched sources remain pending/blocked.

## 2026-09-29 — Source-explicit tickers and bounded market-impact analysis

- **Status:** Accepted and implemented
- **Context:** Live articles contain qualified and contextual tickers that are absent from the small
  reviewed security master. The first rule baseline also returned neutral or mixed too often and did
  not explain likely stock-market impact.
- **Decision:** Persist publisher-explicit ticker candidates separately from verified security
  mentions. Display them as source-mentioned codes without enabling verified-symbol filtering.
  Sentiment rules use weighted financial events, sentence evidence, a stated impact scope and an
  explicit short-term horizon. Confidence remains null until calibration. Analyzer version changes
  replace current analysis without creating an article-content revision.
- **Consequences:** Cards can show useful tickers while preserving master-data trust. Market-impact
  text is an explainable content assessment, carries a non-advice notice, and is not a price forecast.

## 2026-09-26 — Feature-level test evidence and local reports

- **Status:** Accepted
- **Context:** Test pass counts alone do not show which feature lines and branches were exercised,
  and developers need one repeatable location for unit and integration evidence.
- **Decision:** Every feature carries meaningful unit and integration tests. Backend features are
  registered in a standard runner that emits separate branch-aware JUnit, Markdown, XML, and HTML
  reports beneath ignored `test-results/<feature>/<level>/` directories. CI measures the full
  backend with pytest-cov, while local reports stay uncommitted.
- **Consequences:** Feature coverage is comparable and easy to inspect without adding generated
  artifacts to Git. Coverage remains diagnostic evidence and does not replace behavior-focused
  assertions or required boundary/failure cases.

## 2026-09-26 — Local runtime log viewer with restricted Docker access

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

## 2026-09-26 — Redis-backed jobs and container delivery baseline

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

## 2026-09-26 — On-demand, project-specific rule modules

- **Status:** Accepted
- **Context:** The initial rules were generic and did not cover InvestIQ's financial, ML, messaging,
  worker, privacy, observability, resilience, or supply-chain risks.
- **Decision:** Keep a short always-read general rule and route agents to task-specific modules from
  `AGENTS.md`. Adapt relevant concepts in project-specific wording after reviewing
  `khasky/awesome-agents-md` at commit `f4feb8dafe5ed7a33bfda07b76e0ca08e481771b`; do not import
  unrelated modules or depend on the external repository at runtime.
- **Consequences:** Agents load only matching rules. Adding or renaming a module must update the root
  routing table, and rule content must follow the actual FastAPI, Next.js, ML, and finance boundaries.

## 2026-09-26 — Monorepo boundaries and synchronized structure documentation

- **Status:** Accepted
- **Context:** InvestIQ requires separate backend, frontend, ML, CI/CD, and infrastructure areas,
  and path changes can leave agent memory and operational configuration stale.
- **Decision:** Use `backend/`, `frontend/`, `infra/`, and `.github/workflows/` as top-level
  boundaries. Treat structure documentation and all path consumers as part of every structural
  change, governed by `.agents/rules/project-structure.md`.
- **Consequences:** Agents must search for and update stale path references in the same change;
  `.agents/memory/architecture.md` is the canonical architectural overview.

## Template

### YYYY-MM-DD — Decision title

- **Status:** Proposed | Accepted | Superseded
- **Context:** What constraint or problem required a decision?
- **Decision:** What was chosen?
- **Consequences:** What trade-offs and follow-up work result?
- **Supersedes:** Link or heading, if applicable.

## 2026-09-26 — Repository-local agent guidance

- **Status:** Accepted
- **Context:** Agents need stable project context and task-specific operating rules.
- **Decision:** Store memory, rules, skills, roles, and workflows under `.agents/`, with
  `AGENTS.md` as the repository entry point.
- **Consequences:** Agents must keep durable memory current and avoid duplicating guidance.

## 2026-09-30 — Freshness-first news ingestion and protected operations

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

## 2026-09-30 — Server-mediated Admin News workspace

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

## 2026-10-01 — Server-held end-user authentication credentials

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

### 2026-10-01 — Role-checked account administration

- **Status:** Accepted and implemented
- **Context:** Admins need account search and controlled role/status management without treating the shared Admin News credential as user identity.
- **Decision:** Protect account APIs with the BFF server secret and a verified active user session; authorize from the current database role. Audit user changes with actor, target, request ID, requested fields, and outcome. Prevent self changes and last-active-admin removal, and revoke sessions atomically when disabling an account.
- **Consequences:** The account page requires both the Admin workspace session and a separate authenticated InvestIQ admin account session. Account APIs fail closed when auth or Redis rate-limit protection is unavailable.
