# Observability and Runtime Configuration Rules

- Validate all required environment configuration at process startup and expose a typed settings
  object. Do not scatter raw environment reads or silently default production-critical values.
- Expose liveness that checks only the process and readiness that reports dependency status without
  leaking credentials or internals. A broken critical dependency makes readiness fail.
- Write structured logs to stdout. Central redaction removes secrets and personal financial data.
- Assign or accept a request/correlation ID and propagate it through HTTP, WebSockets, messages,
  workers, provider calls, logs, errors, and traces.
- Emit request rate, error count, and latency histograms per route template plus process, database
  pool, Redis, Celery, WebSocket, provider, and model-inference signals.
- Metric labels are bounded. Never label with user IDs, account IDs, request IDs, raw URLs, symbols
  from an unbounded universe, or error messages.
- Trace across process boundaries by propagating standard trace context into provider calls and messages.
- Define an SLO before a paging alert. Alerts act on user-visible symptoms or exhaustion and link to
  a runbook with impact and first actions.
- Sample high-volume success telemetry when needed, but do not sample errors or security audit events.
  Set retention by data class and follow `privacy.md`.
- Graceful shutdown stops new work, drains in-flight requests/jobs under a deadline, flushes telemetry,
  and closes pools/consumers. Force exit when the deadline expires rather than hanging indefinitely.
- Performance or capacity claims require before/after measurements; inspect utilization, saturation,
  queue depth, pool waits, and errors before changing code.
