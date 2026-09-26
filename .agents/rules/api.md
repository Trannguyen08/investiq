# API and Contract Rules

Apply to FastAPI HTTP/WebSocket surfaces and the frontend client consuming them.

## Contract ownership

- FastAPI response/request schemas and the exported OpenAPI document are the source of truth.
  Do not maintain competing handwritten frontend DTOs once client generation is configured.
- Contract change, OpenAPI regeneration, client/type regeneration, and consumer fixes belong in
  the same change. Never hand-edit generated clients.
- Use versioned route trees. Additive compatible changes stay in the current version; removing,
  renaming, changing a type, or tightening accepted input requires a new version or migration plan.
- Serialize through explicit response models so database fields, hashes, flags, and internal IDs
  cannot leak accidentally.

## HTTP behavior

- Model resources with nouns and standard method/status semantics; never return `200` for an error.
- Use one error envelope across the API: stable `code`, safe `message`, and `request_id`, with
  field details only for actionable validation errors. Never expose traces or provider internals.
- Validate path, query, header, and body values strictly; reject unknown write fields and empty PATCH.
- Use opaque cursor pagination with stable ordering for growing collections and time-series data.
- Use idempotency keys for retryable unsafe operations such as portfolio mutations and alert creation.
- Use optimistic concurrency (`version`/ETag) where parallel edits could overwrite portfolio state.
- Work that outlives the request returns `202` plus an operation identifier/status resource.
- A `429` includes `Retry-After`; authenticated or personalized responses default to `no-store`.

## Financial data representation

- Send timestamps as ISO 8601 UTC with a `Z`/offset; document market timezone separately.
- Never serialize money or high-precision quantities through binary floating point. Use decimal
  strings or documented integer minor units, always with currency/unit metadata.
- Define units and ranges for percentages, confidence, sentiment, risk, and price adjustments.
- WebSocket/event payloads are versioned objects with an event ID, type, timestamp, and data object.

Update OpenAPI/contract tests whenever a public shape, status, auth scope, or error code changes.
