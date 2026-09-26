# Resilience and External Integration Rules

Apply to market/news providers, notification services, HTTP/RPC clients, brokers, caches, and other
cross-process dependencies.

- Every external call has explicit connect/read/total timeouts and bounded response/body size.
- Retry only transient timeouts, connection failures, `429` honoring `Retry-After`, and selected `5xx`.
  Never retry validation/auth `4xx`; cap attempts and total time with exponential backoff plus jitter.
- Retrying a state-changing call requires an idempotency key. Broker redelivery and HTTP retries have
  separate budgets so they do not multiply unnoticed.
- Use a circuit breaker for persistently failing dependencies and name the behavior when it opens:
  safe stale data, degraded feature, queued work, or fast explicit failure.
- Propagate the caller's remaining deadline; a downstream call cannot outlive the user request/job budget.
- Isolate each dependency with its own bounded pool/concurrency limit so one slow provider cannot
  exhaust all application capacity.
- Bound every queue and buffer and define backpressure, throttle, drop, or rejection behavior.
- Load shedding protects the service under aggregate overload; per-user/tenant rate limits enforce fairness.
- Cross-service workflows use local transactions plus durable messages/compensation rather than a
  distributed transaction or chained calls hidden inside one request.
- Provider adapters normalize errors and record safe provider request IDs, status, latency, retry count,
  circuit state, and freshness. Never leak provider internals directly to clients.
- Test timeout, retry exhaustion, duplicate delivery, open-circuit, stale fallback, and recovery paths.
