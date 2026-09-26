# Backend Rules

Apply to code under `backend/app/` together with the more specific data, security, messaging,
jobs, observability, or resilience rule when relevant.

## Layer boundaries

- `domain/` contains plain Python enterprise rules. It must not import FastAPI, persistence,
  Redis, Celery, HTTP clients, or ML framework implementations.
- `application/` coordinates use cases through domain repository/service ports and application
  interfaces. It owns orchestration, not transport or database details.
- `infrastructure/` implements ports for persistence, cache, messaging, external providers, ML,
  security, and configuration. Infrastructure types do not leak into domain entities.
- `api/`, `middleware/`, `workers/`, and `main.py` are delivery and composition boundaries.
  They translate input/output and invoke application use cases.
- Keep request schemas, domain types, and database models separate once their shapes or ownership
  differ. Mapping happens explicitly at the boundary.

## FastAPI and use cases

- Validate and normalize all external input with strict schemas before invoking a use case.
- Resolve authenticated identity from verified server-side context, never request bodies or params.
- Enforce resource-level authorization in the use case or a called policy, not only middleware.
- Use dependency injection for database sessions, repositories, settings, and external clients;
  do not construct them inside business logic.
- Domain/application errors carry domain meaning. One API error handler maps them to HTTP responses.
- Async handlers must not perform blocking filesystem, CPU, model-training, or synchronous network
  work. Move it to a worker/thread boundary or use an async adapter.
- Bound concurrency and collection sizes; never fan out over user-sized input without a limit.

## Consistency and failures

- One use case defines one intentional transaction boundary. Enqueue Celery work only after the
  database transaction commits; pass stable identifiers rather than mutable domain objects.
- Make externally retryable writes idempotent with a stable key or unique database constraint.
- Classify expected operational failures separately from programmer errors; do not catch-all and
  continue from state whose invariants may be broken.
- Put provider-specific retries, timeouts, and response parsing inside the adapter, following
  `resilience.md`; application logic receives a stable project-owned interface.
