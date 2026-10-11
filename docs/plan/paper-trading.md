# Beginner Paper Trading

## Outcome and scope

InvestIQ gives each authenticated user one private VND paper-trading account. The account is an
educational simulation only: it never connects to a broker, never reserves real cash, and never
submits an exchange order. It supports automatically filled simulated buys and sells, current valuation, an
estimated daily equity curve, order and immutable fill history, beginner risk notices, observed
market movers, and existing positive news.

The simulation starts with 100,000,000 VND. Every accepted practice transaction fills in full at the
latest authoritative observed price when provider freshness is acceptable. Outside real market hours,
the latest valid completed-session snapshot is used; the system does not invent weekend or holiday
candles. The UI explicitly explains that real exchange orders can wait, partially fill, or not fill.
Every fill records
the provider, market timestamp,
received timestamp, delay class, price, quantity, modeled fee, modeled sell tax, and idempotency key.
The UI must always display that source/freshness context.

The portfolio uses the same advanced market columns as the Market workspace as its stock picker.
Every row offers a simulated buy action, symbols with an available owned quantity additionally offer
a sell action, and either action opens the same observed-price-and-quantity dialog before the order is
sent. P/E and P/B are enriched only for the visible 15-row page with bounded concurrency. Stock detail uses the
same dialog. Owned positions are managed in
a separate table showing quantity, average cost, observed price/value, daily move, unrealized result,
portfolio weight, price history, and buy-more/sell controls.

## Financial rules

- Currency is VND. Money uses `NUMERIC`/`Decimal` and API decimal strings; no authoritative
  calculation uses binary floating point.
- The modeled broker fee is 0.15% of gross consideration on buys and sells. This is a disclosed
  educational assumption, not a quote from a broker.
- The modeled personal sale tax is 0.1% of gross sale consideration. It is stored separately from
  the simulated broker fee so the assumption can be changed prospectively without rewriting history.
- Buy cost basis includes the modeled buy fee. Holdings use weighted-average cost.
- Realized profit/loss is net sale proceeds minus the allocated weighted-average cost basis.
- Unrealized profit/loss is current observed market value minus remaining cost basis. Total
  profit/loss is current cash plus market value minus starting cash.
- Missing, zero, unknown, or stale prices cannot execute. Delayed quote provenance remains visibly
  labeled; it is not presented as exchange-grade realtime.
- A user may hold at most 20 distinct symbols in this slice. Order quantity is an integer from 1 to
  1,000,000 shares. Short selling, margin, cash deposits/withdrawals, dividends, splits, settlement
  delay, ATO/ATC orders, and partial fills are out of scope.
- PostgreSQL row locks serialize order creation, cash/share validation, and fills. Durable order rows
  remain the audit/idempotency boundary even though accepted practice orders normally fill immediately.

## API and security

- `GET /api/v1/paper-portfolio` returns the owned account, holdings, bounded recent orders/trades,
  estimated equity curve, observed opportunities, risk notices, assumptions, and market metadata.
- `POST /api/v1/paper-portfolio/orders` requires an `Idempotency-Key` and returns the durable order,
  an optional fill, and the resulting dashboard.
- `DELETE /api/v1/paper-portfolio/orders/{order_id}` remains a compatibility path for legacy
  pending/open records; the current learner UI does not create or manage waiting orders.
- Both routes require the server-only BFF secret and a verified active bearer session. User identity
  is taken only from that session. Responses are private and `no-store`.
- The browser calls the same-origin `/portfolio-api` BFF, which applies existing CSRF checks to
  writes and keeps access/refresh credentials out of browser JavaScript.
- Portfolio composition and trade history are sensitive financial data. They are excluded from logs,
  shared caches, analytics, and public endpoints. User deletion cascades through all paper-trading
  rows; backups expire through the existing backup retention policy.

## Beginner insights

Risk notices are deterministic observations, not personalized financial advice. The first slice can
flag a quote that is stale, a daily fall of at least 3%, three consecutive falling daily closes, or
a single holding above 40% of total account value. It never issues a guaranteed buy/sell instruction.
The opportunity area ranks observed daily gainers with matched volume and displays existing positive
news from the last day when symbol tagging is available. Active buy/sell counts and future-good-news
predictions remain unavailable until a licensed feed or validated model supplies those facts.

## Delivery and rollout

1. Apply migrations through `0013_paper_orders` as a dedicated release step.
2. Deploy backend and frontend together because the BFF and API contract are introduced together.
3. Keep `MARKET_DATA_MODE=disabled` in production until display/cache/redistribution rights are
   approved. With market data disabled, orders fail explicitly and no simulated fill is written.
4. Smoke-test login, first account creation, automatic buy/sell fills, idempotent retry, insufficient
   available cash/shares, partial/full position sales, refresh persistence,
   unauthorized access, and mobile layout.
5. Roll back application images if needed. The additive tables can remain safely unused; do not
   drop user financial history during rollback.

## Follow-up roadmap

### Phase 2 — More exchange-specific order behavior

Add an exchange holiday calendar, lot/odd-lot rules, partial fills, price bands, settlement cash,
corporate actions, and broker-specific fee profiles only after the
chosen licensed provider supplies the needed timestamps, order-book fields, and exchange semantics.
Keep corrections append-only and migrate existing immediate fills without rewriting history.

### Phase 3 — Better learning and review

Add goal/risk onboarding, a transaction journal, benchmark comparison, allocation and drawdown
lessons, diversification explanations, weekly review, and user-controlled account reset/export.
Reset must preserve an auditable archived season or require explicit destructive confirmation;
export/deletion must follow fresh-authentication and privacy rules.

### Phase 4 — Evidence-backed news and model assistance

Aggregate recent positive/negative analyzed articles per owned symbol, show source-linked evidence,
and notify on observed threshold changes. A future model may add a timestamped horizon, version,
confidence calibration, and limitations only after out-of-sample evaluation. Until then, InvestIQ
must not label content sentiment as a price forecast or emit prescriptive buy/sell instructions.

## Acceptance criteria

- Concurrent simulated orders cannot overspend cash or sell more than the owned quantity.
- Retrying one idempotency key cannot create a second fill; reusing it for a different order fails.
- All money and quantity invariants are enforced both in application code and PostgreSQL constraints.
- The dashboard handles anonymous, loading, empty, stale, error, and populated states accessibly.
- The advanced stock table exposes buy on every row and sell only for owned available quantities,
  blocks an invalid sale at the shared validation boundary, and keeps a distinct owned-position management
  table without bypassing order confirmation.
- Unit tests cover calculations and order decisions. API/repository integration tests cover auth,
  ownership, migration, idempotency, and transaction behavior. Frontend component tests cover the
  primary buy/sell journey and financial summaries.

