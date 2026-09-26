# Architecture Decision Log

Record durable decisions in reverse chronological order. Do not record routine implementation
details.

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
