# Frontend and UI Rules

Apply to the Next.js App Router application under `frontend/src/`.

## Rendering and data

- Prefer Server Components. Add `use client` only at the smallest boundary requiring browser APIs,
  event handlers, local state, effects, or client-only libraries.
- Keep server-only configuration and privileged API calls out of client modules. Anything bundled
  for the browser is public, including `NEXT_PUBLIC_*` values.
- Route all HTTP calls through `lib/api-client.ts` and real-time connections through
  `lib/websocket-client.ts`; do not scatter auth, retry, or error parsing across components.
- Middleware and admin layouts improve navigation but are not authorization. The backend must
  independently enforce every protected operation.
- Treat URL state as the source of truth for shareable filters, selected symbols, date ranges,
  tabs, and pagination. Avoid mirrored state synchronized by effects.
- Real-time views expose connection and last-update state, deduplicate event IDs, clean up
  subscriptions, reconnect with bounded backoff, and never present stale prices as live.

## Components and financial presentation

- Use existing design tokens and shared UI primitives before adding variants or dependencies.
- Format currency, percentages, dates, and compact numbers with `Intl`; never use a JavaScript
  binary float for authoritative financial calculations.
- Tables align numeric columns and use tabular numerals. Charts include units, timezone, source,
  loading/empty/error states, keyboard-accessible controls, and a textual/table alternative.
- Predictions and signals display model/version timestamp, horizon, confidence semantics, and a
  clear distinction from observed market data; never imply guaranteed returns.
- Bound or virtualize large tables and downsample chart data based on measured rendering cost.

## Interaction and accessibility

- Use semantic controls: buttons for actions, links for navigation, labeled inputs, and visible
  `:focus-visible` states. Icon-only buttons require accessible names.
- Target at least 44x44 CSS pixels for touch controls and meet WCAG contrast (4.5:1 body text,
  3:1 large text and UI components). Test dark mode independently when present.
- Dialogs trap focus, close with Escape, and return focus. Inline errors connect with
  `aria-describedby`; toasts are not the sole error channel.
- Every page handles loading, empty, partial, error, unauthorized, and stale-data states.
- Verify keyboard flow, responsive layouts, long content, reduced motion, and primary user journeys.
