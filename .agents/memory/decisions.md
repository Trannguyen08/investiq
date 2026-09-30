# Architecture Decision Log

Record durable decisions in reverse chronological order. Do not record routine implementation
details.

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
  The static operations token is transitional and must be replaced by role-based admin identity when
  the authentication module is implemented.

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
  by named admin identities, RBAC, and centralized login throttling when the authentication module
  is delivered.
