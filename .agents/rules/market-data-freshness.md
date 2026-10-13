# Market Data Freshness Rules

Apply this rule whenever work reads, changes, tests, or presents market quotes, candles,
indices, fundamentals, portfolio valuation, or simulated execution prices.

## Required freshness check

- At the start of the task and again before handoff, determine the current time in
  `Asia/Ho_Chi_Minh`, the Vietnamese market session state, and the latest valid trading
  session. A calendar date is not automatically a trading date.
- Inspect the running provider response and record at least `market_time`, `received_at`,
  `freshness`, `session`, provider, and delay class. Do not infer freshness from page copy
  or fixture timestamps alone.
- During an open session, the observed data age must remain within the configured provider
  refresh contract plus a small operational margin. Prefer the runtime refresh setting
  (for example `VNSTOCK_REFRESH_SECONDS`) over a duplicated hard-coded interval.
- During a closed session, weekend, or exchange holiday, data from the latest valid trading
  session is expected. Never fabricate a candle or relabel an old session as today merely
  to make the date look current.

## Refresh and failure behavior

- When the runtime snapshot is older than the latest valid trading session, revalidate or
  refresh the narrowest relevant provider/cache path before changing UI data. Restart a
  development provider only when needed; do not flush an entire Redis database or cache
  namespace.
- Keep refresh fan-out bounded. Batch or page expensive per-symbol calls and retain the
  provider's documented caching behavior.
- If a trustworthy fresh value is unavailable, expose the stale/unavailable state and its
  timestamp. Do not substitute generated, guessed, or silently cached values.
- Price-dependent writes, including simulated trades, must use an authoritative observed
  price whose provider freshness is accepted by the application contract.

## Tests and handoff

- Tests involving sessions or age thresholds must use a fixed clock and explicit timezone.
- Before declaring market-data work complete, verify the live development response after
  any necessary restart and report why its timestamp is current (or why the previous
  trading day is correct).
- Never store credentials, provider tokens, or raw secret-bearing runtime output in agent
  memory or task notes.
