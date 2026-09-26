# Performance and Capacity Rules

- Measure a representative workload before optimizing and record before/after latency, throughput,
  memory, CPU, query count, or render metrics. An unmeasured rewrite is not a performance fix.
- Set budgets for critical paths: API and inference p95/p99 latency, worker lag, WebSocket update delay,
  chart render size, memory, and provider/database capacity.
- Fix algorithmic complexity and N+1 network/database/cache calls before micro-optimizing syntax.
- Batch round-trips, stream large inputs/exports, paginate queries, and bound every list, buffer, queue,
  cache, concurrency pool, and in-memory dataframe.
- Time-series reads specify symbol set, time range, interval, ordering, and maximum points. Use database
  aggregation/downsampling rather than transferring raw high-frequency history to the browser.
- Keep model training, heavy feature computation, backtests, and bulk ingestion off request handlers.
  Run them in resource-isolated workers with progress and cancellation/timeout behavior.
- Match concurrency to the bottleneck: async/batching for I/O, bounded worker processes for CPU/GPU.
  More parallelism is harmful when database/provider pools are already saturated.
- Frontend performance work checks server/client bundle boundaries, duplicate fetches, rerenders, table
  virtualization, chart point count, layout shift, and WebSocket update batching.
- Caches require the invalidation and observability rules in `caching.md`; do not cache a cheap value
  when coherence costs more than recomputation.
- Leave a repeatable benchmark or load-test command for claimed budgets and compare p95/p99, not averages.
- Do not weaken password hashing, constant-time checks, validation, rate limits, or retry backoff for speed.
