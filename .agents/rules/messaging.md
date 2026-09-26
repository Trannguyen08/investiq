# Celery Task Delivery and WebSocket Rules

InvestIQ does not use Kafka, RabbitMQ, or a separate event-streaming/message-bus platform. Redis is
the approved Celery broker and result backend as well as the application cache. Introducing another
broker or event platform requires an architecture decision and an explicit operational need.

## Celery delivery

- Assume at-least-once task delivery. Tasks that write state must be idempotent through a stable task
  key, database constraint, state transition, or compare-and-set operation.
- Enqueue tasks only after the related database transaction commits. Pass stable identifiers and
  small JSON payloads; workers reload authoritative state instead of receiving mutable objects.
- Use project-owned, versionable task names. Treat task payload changes as contracts during rolling
  deployments and keep producers compatible with currently running workers.
- Retry only transient failures with bounded exponential backoff and jitter. Invalid input and
  business-rule rejection fail without retry; record a sanitized reason for operators.
- Set explicit soft/hard time limits for non-trivial tasks. Long-running ML training needs its own
  queue and concurrency policy before implementation, even when Redis remains the broker.
- Celery Beat must have one active scheduler per environment. Scheduled jobs are safe to overlap or
  protect themselves with a distributed lock whose lease exceeds the expected critical section.
- Monitor task age, runtime, retry/failure counts, worker availability, and Redis memory. Never log
  credentials, tokens, raw financial profiles, or unbounded payloads.

## WebSockets

- WebSockets distribute ephemeral updates, not durable truth. Reconnects resync authoritative state
  through the API and clients tolerate duplicate or missed updates.
- Authenticate the connection and authorize every subscription using server-owned identity. A
  client-provided user or portfolio ID is never proof of access.
- Use bounded payloads, heartbeat/idle timeouts, connection limits, and backpressure. Slow consumers
  are disconnected rather than allowed to grow unbounded buffers.
- Version messages, include a stable type and timestamp, and propagate a bounded correlation ID.
