# Background Job and Worker Rules

Apply to Celery workers, scheduled jobs, ingestion, sentiment analysis, training, alerts, and backfills.

- Worker entry points are thin delivery adapters that validate a versioned job payload and invoke an
  application use case; do not duplicate business rules in tasks.
- Every job is safe to retry. Use stable job/idempotency IDs and checkpoint long work in bounded batches.
- Set hard execution and queue-wait deadlines, maximum attempts, exponential backoff with jitter,
  and terminal failure handling. Do not retry validation or permanent business failures.
- Single-run scheduled work uses one scheduler or a shared lease with expiry and fencing. Define
  whether overlapping or missed runs skip, queue, catch up, or replace previous work.
- Schedule in UTC unless exchange/local-calendar semantics explicitly require a timezone-aware schedule.
- Separate queues and concurrency limits for ingestion, notifications, model training, and alert
  evaluation so expensive ML work cannot starve latency-sensitive tasks.
- Backfills and bulk ingestion throttle against provider limits, database locks/replication lag, broker
  pressure, and storage capacity; announce and observe them like deployments.
- Training writes artifacts to a temporary/versioned location and registers them atomically only after
  validation succeeds. Failed jobs cannot expose partial artifacts as current models.
- Emit job ID, type, attempt, correlation ID, duration, batch progress, and safe failure category.
  Alert on last-success age and stuck/oldest jobs, not only explicit failures.
- Shutdown stops accepting new work, finishes or safely requeues in-flight jobs within a deadline,
  then closes broker, database, cache, and telemetry connections.
