# Architecture Memory

## Current state

The monorepo has a runnable container and delivery baseline. FastAPI health/status endpoints, the
Next.js shell, Celery configuration, Docker Compose, Nginx, and CI/CD are implemented. Most product,
data, and ML modules remain placeholders and must not be described as implemented features.

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
|-- infra/
|   |-- nginx/nginx.conf      # Public reverse proxy
|   `-- scripts/              # Operational scripts
|-- .github/workflows/        # Service CI and staging/production delivery
`-- docker-compose.yml        # Seven-service topology
```

## Runtime topology

- Nginx is the only published service. It routes `/` to Next.js, `/api/` to FastAPI, and `/ws/` to
  the backend with WebSocket upgrade headers.
- Backend and frontend images are built from service-local Dockerfiles. Deployment overrides their
  Compose image names with immutable GHCR tags.
- PostgreSQL and Redis are private to the Compose network and persist in named volumes.
- Redis database 0 is reserved for application caching, database 1 is the Celery broker, and database
  2 is the Celery result backend. No Kafka, RabbitMQ, or generic event bus is present.
- Celery worker and Beat reuse the backend image. Each environment must run only one Beat scheduler.

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

## Structure maintenance

This file is the canonical architectural overview. Every path or boundary change updates this file
and all affected references in the same task, following `.agents/rules/project-structure.md`.
