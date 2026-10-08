# Project Memory

## Identity

- Name: InvestIQ
- Repository: `C:\investiq`
- Application type: FastAPI and Next.js monorepo
- Status: Runnable operational baseline with a six-source stock-news module and
  feature-flagged end-user authentication; most other finance and ML modules remain placeholders.

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

## Local development

- Authentication is implemented behind `AUTH_ENABLED=false` by default. It provides email/Google
  login, 90-second registration and password-reset OTPs, server-held JWT/refresh credentials, and
  automatic persistent sessions with rotating refresh tokens. Email addresses are not remembered
  in browser storage. Configure the blank auth entries in `.env`
  using the ignored local guide `docs/tutorial/auth-keys.md` before enabling it.

- Copy `.env.example` to `.env`, replace placeholder secrets, then use `docker compose up --build
  --wait` for the complete stack.
- Use development servers for interactive code work and do not run the frontend production build
  during agent sessions.
- Keep `frontend/package-lock.json` synchronized with `package.json` and backend requirement pins
  synchronized with the Docker image.
- Use `DEVELOPMENT_GUIDE.md` for Docker/port commands and `backend/tests/run_feature_tests.py` for
  per-feature unit, integration, and branch-coverage reports.
- Follow `.agents/rules/project-structure.md` for every path or boundary change.

## Admin account management

Implemented `/admin/users` with backend role checks, stable search/filter pagination, account role/status updates, active-session revocation on disable, Redis rate limits, and audit details. The Admin News shared password remains a separate gate and does not authorize the account API. See `docs/plan/admin-user-management.md`.
