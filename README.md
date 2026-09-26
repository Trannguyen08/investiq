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
| `celery-beat` | Scheduled task dispatch | Internal only |

Kafka, RabbitMQ, and other standalone message buses are not part of the architecture. Celery uses
Redis databases 1 and 2 for delivery/results; application caching uses Redis database 0.

## Local Docker startup

1. Copy `.env.example` to `.env` and replace every `replace-with-...` value. Passwords used in the
   generated connection URLs must be URL-safe.
2. Start the complete stack:

   ```sh
   docker compose up --build --wait
   ```

3. Open `http://localhost:8080` (or the configured `HTTP_PORT`). The API smoke endpoint is
   `http://localhost:8080/api/v1/status`.
4. Stop containers with `docker compose down`. Add `--volumes` only when intentionally deleting the
   local PostgreSQL and Redis data.

Liveness is available at `/healthz` inside the backend container; `/readyz` verifies PostgreSQL and
Redis without returning connection details.

## CI/CD

- `backend-ci.yml` runs Ruff, mypy, pytest, builds the backend image, and validates Compose.
- `frontend-ci.yml` runs ESLint and TypeScript checks, then builds the production image.
- A push to `develop` publishes immutable `staging-<commit>` images to GHCR and deploys staging.
- A `v*` tag publishes versioned images and deploys production. Manual dispatch builds the selected
  commit with a `manual-<commit>` tag.

Deployment jobs require dedicated Linux self-hosted runners labelled `investiq-staging` and
`investiq-production`. Configure GitHub environments with secrets `POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, and `SECRET_KEY`; optional variables are `HTTP_PORT`, `POSTGRES_DB`, and
`POSTGRES_USER`. Protect the `production` environment with required reviewers. A rollback deploys a
previous immutable backend/frontend tag with the same Compose file; database migrations must include
their own compatibility and rollback plan once migrations are introduced.

## Project layout

```text
investiq/
|-- backend/              # FastAPI runtime, Clean Architecture modules, workers, Dockerfile
|-- frontend/             # Next.js app and Dockerfile
|-- infra/
|   |-- nginx/            # Reverse-proxy configuration
|   `-- scripts/          # Operational scripts
|-- .github/workflows/    # Backend/frontend CI and staging/production delivery
|-- .agents/              # Agent memory, rules, skills, roles, and workflows
|-- docker-compose.yml    # Seven-service local/deployment topology
`-- .env.example          # Non-secret configuration template
```

The canonical architectural overview is `.agents/memory/architecture.md`. Every structural change
must update that overview and all configuration or documentation that references affected paths.
