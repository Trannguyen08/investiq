# Project Memory

## Identity

- Name: InvestIQ
- Repository: `C:\investiq`
- Application type: FastAPI and Next.js monorepo
- Status: Runnable operational baseline with a hardened, tested five-source stock-news module; most
  other finance and ML modules remain placeholders.

## Confirmed stack

- Backend: Python 3.13 container, FastAPI, Uvicorn, and Clean Architecture modules under `backend/`.
- Frontend: Node.js 24 container, Next.js 16, React 19, and TypeScript under `frontend/`.
- Persistence: PostgreSQL 17.
- Cache and jobs: Redis 8 for cache plus Celery broker/result storage; Celery worker and Beat.
- Edge: Nginx is the public application entry point; the runtime log viewer is separately published
  on a loopback-only host port.
- Operations: Docker Compose, GHCR images, GitHub Actions CI, and self-hosted deployment runners.
- Messaging constraint: no Kafka, RabbitMQ, or separate event-streaming/message-bus platform.
- Observability: a localhost-only Dozzle viewer reads labeled runtime logs through an
  endpoint-restricted, GET-only Docker socket proxy. Actions, shell access, MCP, and build logs are
  disabled.

## Goals

- Implemented MVP: Vietnamese stock-market news aggregation for Vietstock, CafeF, HNX, VnEconomy,
  and VnExpress with article history, stock-symbol identification, rule sentiment, public list/detail
  pages, freshness/retention policy, exact-title cross-source grouping, topic/event classification,
  provider rate limiting/circuit breaking, protected operational APIs, and an authenticated Admin
  workspace for source status, manual crawl, crawl-run history, and retention cleanup. HNX,
  VnEconomy, and VnExpress are metadata-only sources.
- User confirmed periodic database backups only; no database replica in this feature scope.
- Feature plans live in `docs/plan/`; see `docs/plan/vietnam-stock-news.md` and its database/API/UI
  companion documents. `docs/plan/news-implementation-report.md` records implemented behavior,
  validation, activation gates, and the six sources that remain pending/blocked. No deployment
  has been performed and live ingestion is disabled by default.

## Local development

- Copy `.env.example` to `.env`, replace placeholder secrets, then use `docker compose up --build
  --wait` for the complete stack.
- Use development servers for interactive code work and do not run the frontend production build
  during agent sessions.
- Keep `frontend/package-lock.json` synchronized with `package.json` and backend requirement pins
  synchronized with the Docker image.
- Use `DEVELOPMENT_GUIDE.md` for Docker/port commands and `backend/tests/run_feature_tests.py` for
  per-feature unit, integration, and branch-coverage reports.
- Follow `.agents/rules/project-structure.md` for every path or boundary change.
