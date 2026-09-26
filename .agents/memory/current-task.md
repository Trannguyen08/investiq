# Current Task

## Status

Implementation and full local container smoke validation complete.

## Objective

Provide a runnable Docker topology and GitHub CI/CD for frontend, backend, PostgreSQL, Redis, Celery
worker, Celery Beat, and Nginx while removing Kafka and other standalone message-bus assumptions.

## Completed

- Added the seven-service Compose topology, health checks, persistent data volumes, private networks,
  Nginx routing, environment template, and service-local Dockerfiles.
- Implemented minimal FastAPI health/status endpoints, Redis-backed Celery configuration, and a
  buildable Next.js shell so container builds have real entry points.
- Added backend/frontend CI plus GHCR publishing and staging/production deployment workflows.
- Namespaced service CI concurrency by caller workflow so standalone `develop` CI and reusable
  staging verification cannot cancel one another.
- Removed Kafka producer/consumer files and the unused event-publisher interface; removed RabbitMQ
  and ActiveMQ ignore entries; rewrote messaging guidance around Redis-backed Celery and WebSockets.
- Synchronized README, architecture/project memory, dependencies, and operational guidance.
- Built both service images and smoke-tested all seven containers through Nginx using an isolated
  Compose project. PostgreSQL, Redis, backend readiness, frontend HTTP, Celery worker ping, Celery
  Beat startup, and Nginx configuration all passed.

## Next step

Implement product modules incrementally. Before the first schema deployment, add reviewed Alembic
migrations and a backwards-compatible migration step to the deployment workflow.
