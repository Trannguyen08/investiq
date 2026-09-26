# Caching and Redis Rules

- Add a cache only for a measured access pattern with an explicit freshness requirement.
- For every entry define source of truth, key shape, scope, TTL, invalidation event, fallback, and
  acceptable staleness before implementation.
- Cache-aside is the default: read, load on miss, store with TTL; successful writes invalidate
  affected keys after the source-of-truth commit rather than racing to update copies.
- Namespace and version keys by environment and schema. Include user/tenant, market, symbol,
  interval, currency, and adjustment mode whenever those dimensions change the value.
- Portfolio, alert, auth, entitlement, and personalized prediction values must never use shared keys.
  Do not cache raw tokens, passwords, or unredacted personal data.
- Historical market data and real-time quotes have different freshness contracts and key families;
  do not let a long historical TTL make a live quote appear current.
- Every entry has a bounded TTL as a safety net. Add jitter or single-flight locking for expensive
  rebuilds and never enumerate the Redis keyspace from application code.
- Batch/pipeline per-item Redis operations and bound value size. In-process caches remain small,
  bounded, safe to lose, and never assumed coherent across replicas.
- Treat Redis failure as expected: name whether each path degrades to the database/provider, serves
  a labeled stale value, or fails fast. Retries must follow `resilience.md`.
- Emit hit, miss, error, latency, served-age, and invalidation-lag metrics per bounded key family.
