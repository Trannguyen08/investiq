# Financial Domain Rules

Apply to portfolios, holdings, prices, returns, risk, signals, predictions, backtests, and alerts.

- Represent monetary values and quantities with explicit decimal precision and currency/unit. Define
  rounding per operation and round at the required boundary, not after every intermediate step.
- Distinguish observed market data, derived analytics, simulated trades, model predictions, and actual
  user-entered transactions in types, storage, API payloads, logs, and UI labels.
- Every price carries instrument identity, provider/source, event timestamp, received timestamp,
  currency, interval, and adjustment status. Never silently combine differently adjusted series.
- Portfolio calculations define treatment of cash, fees, taxes, dividends, splits, currency conversion,
  missing prices, market closure, and stale quotes before results are shown as performance.
- Keep auditable transaction/holding history. Corrections append or version records with actor/reason;
  do not silently rewrite financial history.
- Backtests prevent look-ahead and survivorship bias, use data available at decision time, include
  transaction costs/slippage, and separate in-sample selection from out-of-sample evaluation.
- Risk, sentiment, signal, confidence, and return fields have documented scales, direction, units,
  horizons, and null semantics. Never infer meaning from an unlabeled number.
- Predictions and rebalance suggestions disclose timestamp, horizon, model/data version, uncertainty,
  and limitations. UI/API copy must not imply guaranteed profit or personalized regulated advice.
- Alert evaluation is idempotent and records the observed value, rule version, trigger time, and delivery
  state so retries cannot send duplicate notifications without an auditable reason.
- Authorization and privacy checks apply to every portfolio-derived result, export, cache key, event,
  WebSocket subscription, and admin view.
