# Database and Migration Rules

Apply to models, repositories, migrations, seeds, PostgreSQL/TimescaleDB queries, and transaction
boundaries.

## Connections and transactions

- Create one bounded process-level pool from typed configuration; do not create a client per request.
- Size all API/worker/migration pools together below the database connection limit with headroom.
- Use the application unit of work for multi-row invariants and keep transactions short.
- Never perform network calls, queue publishing, or email inside a database transaction.
- Choose locking deliberately for concurrent portfolio/alert updates: optimistic version checks or
  ordered row locks. Do not use read-then-write as a mutex.

## Schema and queries

- Express invariants with `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys, and precise types.
- Store money as `NUMERIC` or integer minor units and quantities with explicit decimal precision;
  never use `FLOAT` for portfolio value, price, cost basis, or return calculations.
- Store instants as timezone-aware UTC timestamps. Keep exchange timezone/session as separate metadata.
- Price candles need a uniqueness rule over provider/instrument/interval/timestamp and queries must
  define adjustment, ordering, and interval semantics.
- Select explicit columns, parameterize every value, bound every collection query, and eliminate N+1.
- Index measured filter/sort/join patterns. For time-series queries, verify plans and chunk/time-range
  pruning on representative volume before claiming performance.
- Declare every foreign key deletion action. User-data deletion must also follow `privacy.md`.

## Migrations and data operations

- Migrations are committed, forward-only, and never edited after application to a shared environment.
- Use expand/contract for destructive changes: add compatible shape, backfill in throttled batches,
  switch readers/writers, then remove the old shape in a later release.
- Run migrations as a dedicated release step, not on API startup or first request.
- Before destructive or bulk production changes, confirm a tested backup/restore path and monitor
  locks, replication lag, pool saturation, and runtime.
- Seeds are idempotent and environment-safe. Backfills checkpoint progress and tolerate restart.
