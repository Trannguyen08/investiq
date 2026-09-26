# Repository Agent Guide

This file is the entry point for every agent working in this repository.

## Required reading

Before changing code:

1. Read `.agents/memory/project.md`, `.agents/memory/architecture.md`, and
   `.agents/memory/current-task.md`.
2. Read `.agents/memory/decisions.md` before changing architecture or established
   conventions.
3. Load only the files in `.agents/rules/` that apply to the task. Always load
   `.agents/rules/general.md`.
4. Read `.agents/rules/project-structure.md` whenever adding, removing, moving, or
   renaming files, directories, modules, services, or architectural boundaries.
5. Use the matching skill or workflow in `.agents/skills/` and
   `.agents/workflows/` when the task fits its description.

More-specific `AGENTS.md` files, if added later, override this file for their subtree.

## Project conventions

- This repository is a monorepo: FastAPI lives in `backend/`, Next.js lives in
  `frontend/`, and deployment support lives in `infra/` and `.github/workflows/`.
- Prefer TypeScript (`.ts` and `.tsx`) for new code.
- Co-locate component-specific styles with the component when practical.
- Preserve user changes and keep edits focused on the requested task.
- Never commit secrets, credentials, local environment files, or generated build output.

## Rule routing

Always read `.agents/rules/general.md`, then load only the modules matching the task:

| Task area | Required rule |
| --- | --- |
| Paths, modules, service boundaries | `project-structure.md` |
| FastAPI, use cases, workers, adapters | `backend.md` |
| HTTP/WebSocket contracts, OpenAPI | `api.md` |
| Next.js, components, charts, client state | `frontend.md` |
| Schema, queries, migrations, time-series data | `database.md` |
| Redis or application caching | `caching.md` |
| Authentication, authorization, crypto, validation | `security.md` |
| Automated tests and test infrastructure | `testing.md` |
| Containers, CI/CD, releases, shell scripts | `devops.md` |
| Packages, versions, lockfiles | `dependencies.md` |
| Redis-backed Celery task delivery and WebSockets | `messaging.md` |
| Celery, scheduled work, backfills | `jobs.md` |
| Logs, metrics, tracing, health checks | `observability.md` |
| External calls, timeouts, retries, fallbacks | `resilience.md` |
| Personal or financial user data | `privacy.md` |
| Model training, inference, features, artifacts | `machine-learning.md` |
| Money, portfolios, holdings, signals, backtests | `finance-domain.md` |
| Latency, throughput, memory, large datasets | `performance.md` |

If a task spans multiple areas, read every applicable module. Do not load unrelated modules.

## Structure synchronization

Project structure is a maintained contract. Whenever a task changes a path or architectural
boundary, update every repository file that describes or depends on that structure in the same
change. This includes `README.md`, `.agents/memory/project.md`,
`.agents/memory/architecture.md`, applicable `AGENTS.md` files, imports, scripts, CI workflows,
Docker configuration, and tests. Search for stale references before considering the task done.
Follow `.agents/rules/project-structure.md`; do not wait for a separate documentation request.

## Development commands

Use the package manager indicated by the lockfile.

| Command | Purpose |
| --- | --- |
| `npm --prefix frontend run dev` | Run Next.js in development mode with HMR, once configured. |
| `npm --prefix frontend run lint` | Run frontend lint checks, once configured. |
| Backend commands | Run from `backend/` using scripts defined by `pyproject.toml`. |
| `npm --prefix frontend run build` | Production build; do not run during an interactive agent session. |

Always use the development server while iterating. Running a production build can replace
`.next` with production assets and disrupt HMR. Restart the development server instead.
When dependencies change, update the lockfile and restart the development server.

## Memory maintenance

- Update `.agents/memory/current-task.md` when starting, pausing, handing off, or
  completing substantial work.
- Record durable architectural choices in `.agents/memory/decisions.md`.
- Update `project.md` or `architecture.md` only when verified project facts change.
- Do not store transient logs, speculation, or secrets in memory files.

## Definition of done

- The requested behavior is implemented with focused changes.
- Relevant linting and tests pass, or limitations are reported clearly.
- Documentation and agent memory are updated when behavior or decisions changed.
- No unrelated files, generated artifacts, or secrets are introduced.
