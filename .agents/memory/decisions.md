# Architecture Decision Log

Record durable decisions in reverse chronological order. Do not record routine implementation
details.

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
