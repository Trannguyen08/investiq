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
|   |-- log-viewer/           # Default local runtime-log viewer profile
|   |-- nginx/nginx.conf      # Public reverse proxy and structured access logs
|   `-- scripts/              # Operational scripts
|-- .github/workflows/        # Service CI and staging/production delivery
|-- test-results/             # Ignored local JUnit and feature coverage reports
|-- DEVELOPMENT_GUIDE.md      # Docker, ports, and feature-test command reference
`-- docker-compose.yml        # Nine-service topology
```

## Runtime topology

- Nginx is the only publicly bound application service. It routes `/` to Next.js, `/api/` to
  FastAPI, and `/ws/` to the backend with WebSocket upgrade headers.
- Dozzle is published separately on a loopback-only host port for local runtime log inspection. It
  can read only labeled service logs through an internal endpoint-restricted Docker socket proxy;
  container actions, exec/shell access, MCP, and non-GET Docker operations are disabled.
- Backend and frontend images are built from service-local Dockerfiles. Deployment overrides their
  Compose image names with immutable GHCR tags.
- PostgreSQL and Redis are private to the Compose network and persist in named volumes.
- Redis database 0 is reserved for application caching, database 1 is the Celery broker, and database
  2 is the Celery result backend. No Kafka, RabbitMQ, or generic event bus is present.
- Celery worker and Beat reuse the backend image. Each environment must run only one Beat scheduler.
- FastAPI, Celery, and Nginx produce sanitized structured runtime fields. Health access logs and
  image-build output are excluded from the viewer to limit operational noise.

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
- Backend feature tests are registered in `backend/tests/run_feature_tests.py`; generated JUnit and
  branch-coverage reports are written by feature and test level under ignored `test-results/` paths.

## Structure maintenance

This file is the canonical architectural overview. Every path or boundary change updates this file
and all affected references in the same task, following `.agents/rules/project-structure.md`.
