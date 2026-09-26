---
name: deployment
description: Prepare, validate, or execute a controlled application deployment with explicit environment, migration, observability, and rollback checks. Use for release and deployment work.
---

# Deployment

Read `../../rules/devops.md`, `../../rules/security.md`, and any provider-specific repository
documentation. Confirm the target environment and release artifact before any external mutation.

Prepare a deployment plan covering prerequisites, configuration changes, database migrations,
compatibility, health checks, monitoring, and rollback. Validate the artifact through the repository's
CI or documented release process; do not run the interactive-session-prohibited production build.

Before executing, ensure required authorization exists and that secrets stay in the approved secret
store. During rollout, watch defined health and business signals. Stop or roll back when explicit
failure thresholds are met. Record the deployed version, migrations, verification, and outcome.
