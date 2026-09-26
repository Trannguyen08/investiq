# DevOps, CI/CD, and Deployment Rules

Apply to `.github/workflows/`, Docker/Compose, `infra/`, release scripts, and runtime definitions.

## CI/CD security

- CI paths mirror service ownership: backend changes run Python lint/type/test checks; frontend
  changes run TypeScript lint/type/test checks; contract and infrastructure changes run both affected sides.
- Pin third-party GitHub Actions to full commit SHAs with the readable release in a comment.
- Set workflow permissions read-only by default and elevate only the job that needs a specific write.
- Never execute untrusted fork code in a job holding secrets or write tokens. Treat PR titles,
  branches, commit messages, issue text, and workflow expressions as attacker-controlled input.
- Prefer short-lived cloud credentials through OIDC. Never echo secrets or upload them in artifacts.
- Install dependencies from committed lockfiles in frozen mode; review lockfile and image changes.
- Lint workflow definitions and scan source, dependencies, images, and artifacts at proportional gates.

## Images and runtime

- Build reproducible multi-stage images from pinned supported bases; keep build tools, source, dev
  dependencies, env files, and secrets out of runtime images.
- Run workloads as non-root with least privilege, a read-only filesystem where practical, explicit
  writable mounts, resource limits, and no host container/orchestrator socket.
- Keep environment differences in injected validated configuration, not separate code branches.
- Health checks distinguish liveness from readiness and do not expose secrets or internal traces.
- Shell scripts use strict mode, quoted variables, argument arrays, reliable temporary cleanup,
  meaningful exit codes, and a dry-run mode before destructive/provisioning behavior.

## Releases

- Build an artifact once, attest/version it, and promote the same artifact across environments.
- Separate deploy from release with controlled flags/traffic when risk warrants it. Flags have owner,
  safe default, removal condition, and consistent evaluation within a request.
- Every deployment has a tested rollback or roll-forward plan and explicit health/error/latency gates.
- Rolling releases keep old/new application versions compatible with the same schemas and messages.
- Run database migrations as a dedicated release phase using expand/contract ordering.
- Staging may deploy from `develop`; production requires a versioned release and protected approval.
- Do not run the Next.js production build during interactive agent sessions; use development HMR.
