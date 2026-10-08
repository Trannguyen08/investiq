# InvestIQ

InvestIQ is a FastAPI and Next.js monorepo for an investment intelligence platform. The operational
baseline is runnable; most finance and ML feature modules remain intentional placeholders.

## Runtime architecture

| Service | Responsibility | Exposure |
| --- | --- | --- |
| `nginx` | Public reverse proxy for the UI, API, and WebSockets | Host port `HTTP_PORT` |
| `frontend` | Next.js standalone server | Internal port 3000 |
| `backend` | FastAPI application and health endpoints | Internal port 8000 |
| `db` | PostgreSQL persistence | Internal only |
| `redis` | Cache plus Celery broker/result backend | Internal only |
| `celery-worker` | Asynchronous task execution | Internal only |
| `celery-notifications` | Isolated OTP and authentication email delivery | Internal services plus outbound SMTP |
| `celery-beat` | Scheduled task dispatch | Internal only |
| `docker-socket-proxy` | Endpoint-restricted Docker log access | Internal only |
| `log-viewer` | Dozzle runtime log viewer | Loopback port `LOG_VIEWER_PORT` |

Kafka, RabbitMQ, and other standalone message buses are not part of the architecture. Celery uses
Redis databases 1 and 2 for delivery/results; application caching uses Redis database 0.

## Local Docker startup

1. Copy `.env.example` to `.env` and replace every `replace-with-...` value. Passwords used in the
   generated connection URLs must be URL-safe.
2. Start the complete stack:

   ```sh
   docker compose up --build --wait
   ```

3. Apply the database migrations before using the UI or API:

   ```sh
   docker compose run --rm backend python -m app.infrastructure.db.base
   ```

4. Open `http://localhost:8080` (or the configured `HTTP_PORT`). The API smoke endpoint is
   `http://localhost:8080/api/v1/status`.
5. Open `http://localhost:9999` (or the configured `LOG_VIEWER_PORT`) for runtime logs. The port is
   bound to `127.0.0.1` only. The viewer includes every application runtime container while
   excluding image-build output, its own viewer/proxy logs, and routine health request entries.
6. Stop containers with `docker compose down`. Add `--volumes` only when intentionally deleting the
   local PostgreSQL and Redis data.

Liveness is available at `/healthz` inside the backend container; `/readyz` verifies PostgreSQL and
Redis without returning connection details.

## Stock news MVP

Apply database migrations as a dedicated step before opening the news routes:

```sh
docker compose run --rm backend python -m app.infrastructure.db.base
```

The public pages are `/news` and `/news/<article-id>`. Celery Beat queues an initial crawl of the
six configured sources whenever the scheduler starts, then discovers new stories every five
minutes. `NEWS_INGESTION_ENABLED` defaults to `true`; set it to `false` to pause automatic crawling.
Before production ingestion, approve each source's storage/display policy and import a reviewed
UTF-8 security master CSV with columns `exchange,symbol,issuer_name,valid_from`:

```sh
docker compose run --rm backend python -m app.infrastructure.db.import_securities \
  --file /data/securities.csv --source reviewed-master --dry-run
```

The container must be given a read-only mount for that CSV before running the import. Remove
`--dry-run` only after reviewing validation output. See the
[implementation report](docs/plan/news-implementation-report.md) for source status, test evidence,
backup commands, and remaining activation gates.

FastAPI/Celery and Nginx emit sanitized JSON fields for `code`, `api_url`, `log_content`,
`logged_at`, `container`, `problem`, and `request_id`. The viewer parses these fields, highlights
warnings/errors, supports level/text filtering, and merges selected containers chronologically.
Application code must not log request bodies, credentials, tokens, cookies, or personal financial
data. Access beyond the Docker host should use an SSH tunnel or an authenticated TLS reverse proxy;
do not change the viewer bind address to a public interface without adding authentication.

## CI/CD

- `backend-ci.yml` runs Ruff, mypy, pytest, builds the backend image, and validates Compose.
- `frontend-ci.yml` runs ESLint, TypeScript, and Vitest checks, then builds the production image.
- A push to `develop` publishes immutable `staging-<commit>` images to GHCR and deploys staging.
- A `v*` tag publishes versioned images and deploys production. Manual dispatch builds the selected
  commit with a `manual-<commit>` tag.

Deployment jobs require dedicated Linux self-hosted runners labelled `investiq-staging` and
`investiq-production`. Configure GitHub environments with secrets `POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, and `SECRET_KEY`; optional variables include `HTTP_PORT`, `LOG_VIEWER_PORT`,
`LOG_LEVEL`, `POSTGRES_DB`, and `POSTGRES_USER`. Protect the `production` environment with required
reviewers. A rollback deploys a previous immutable backend/frontend tag with the same Compose file;
database migrations must include their own compatibility and rollback plan once migrations are
introduced.

News ingestion accepts publisher-dated articles within `NEWS_INGESTION_MAX_AGE_HOURS` (2160, or 90
days, by default). Public feeds are limited to `NEWS_RETENTION_DAYS` (90 by default). Vietstock archive
backfill scans one page at a time and checkpoints progress in PostgreSQL; Beat resumes interrupted runs.
Start a local 90-day backfill after migrations with:

```powershell
docker compose exec -T celery-worker python -c "from datetime import UTC, datetime, timedelta; from app.workers.news_ingestion_worker import backfill_news; today=datetime.now(UTC); backfill_news.apply_async(args=(1,(today-timedelta(days=90)).date().isoformat(),today.date().isoformat()),queue='news-ingestion')"
```

The public news API supports numbered pages and accent-insensitive partial search. A 30-second Redis
read cache is invalidated after successful ingestion. The news worker joins a dedicated outbound
network for publisher requests. Provider requests use a Redis-coordinated per-domain rate limit and
circuit breaker. The protected news operations endpoints
under `/api/v1/admin/news` remain disabled until `NEWS_ADMIN_TOKEN` is configured; retention deletion
also requires an explicit non-dry-run request with `confirm=true`.

The Admin News workspace is available at `/admin-login`. It also requires `ADMIN_UI_PASSWORD` and
an independent `ADMIN_SESSION_SECRET` of at least 32 random characters. The browser receives only a
signed, HttpOnly, eight-hour session cookie; `NEWS_ADMIN_TOKEN` stays on the Next.js server and is
never exposed to client code. From `/admin/data-pipeline`, an authenticated operator can pause or
resume sources, queue manual crawls, inspect the latest 100 crawl runs, preview retention cleanup,
and confirm deletion by entering `DELETE`. Leave all three Admin variables unset to keep these
operations fail-closed.

The `/admin/users` account-management page requires both the Admin workspace session above and a
signed-in InvestIQ account with the `admin` role. The backend also requires the server-only BFF
secret; the Admin News password does not grant account-management permission. Grant the first admin
role to a verified account through a controlled database operation, then apply the PostgreSQL
migrations before using the page. See
the [account-management plan](docs/plan/admin-user-management.md) for supported filters, controls,
audit behavior, and access checks.

## Project layout

```text
investiq/
|-- backend/              # FastAPI runtime, Clean Architecture modules, workers, Dockerfile
|-- frontend/             # Next.js app and Dockerfile
|-- docs/plan/            # Feature plans, data designs, and API/UI specifications
|-- infra/
|   |-- log-viewer/       # Default local runtime-log viewer profile
|   |-- nginx/            # Reverse-proxy configuration
|   `-- scripts/          # Operational scripts
|-- .github/workflows/    # Backend/frontend CI and staging/production delivery
|-- .agents/              # Agent memory, rules, skills, roles, and workflows
|-- docker-compose.yml    # Ten-service local/deployment topology with local log viewer
`-- .env.example          # Non-secret configuration template
```

The canonical architectural overview is `.agents/memory/architecture.md`. Every structural change
must update that overview and all configuration or documentation that references affected paths.

See [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md) for Docker lifecycle commands, the complete port
table, backend quality checks, and per-feature coverage reports.

See [`docs/plan/`](docs/plan/README.md) for the feature specifications. The
[authentication plan](docs/plan/auth.md) covers email/Google login, OTP, server-held JWT/refresh
credentials, and automatic session refresh. The implementation is available behind
the fail-closed `AUTH_ENABLED` flag; configure the blank auth entries in `.env` before enabling it.
The
[Vietnamese stock-market news plan](docs/plan/vietnam-stock-news.md) now has an implemented,
tested six-source MVP; the [implementation report](docs/plan/news-implementation-report.md)
records research evidence, validation results, activation gates, and remaining source limitations.
The next product phase is defined in the
[market and investment-community roadmap](docs/plan/community-market-roadmap.md): licensed market
data, private watchlists, structured evidence-backed theses, outcome-based reputation, moderation,
and source-linked AI assistance. It targets a differentiated MVP in 12 weeks and public beta in 28
weeks; implementation has not started.
