# Current Task

## Market branch integration with dev — 2026-10-08 (complete)

Merged `origin/dev` into `feature/market` and resolved the sole content conflict by preserving both
branches' completed task history. Updated Market test assertions to narrow generic service payloads
for strict mypy and removed one obsolete ignore. The first GitHub run then exposed an uptime-dependent
TCBS initialization defect: a newly started host could treat an empty security master as fresh and
skip its initial load. The adapter now requires cached securities before applying the refresh TTL,
with a deterministic low-monotonic-time regression test. Ruff and strict mypy pass; the full backend
suite passes 110 tests with 11 database tests skipped locally, all 48 frontend tests plus ESLint and
TypeScript pass, and the Compose model validates. GitHub Actions owns the PostgreSQL-backed tests and
container builds because the local Docker Desktop engine is unavailable.

## Comparison metric legibility - 2026-10-08 (complete)

Fix the stock-comparison dialog's cramped metric layout: each label/value pair must occupy a clearly
separated metric tile, numeric values and headline price/change must be visually prominent, and the
two-column layout must remain readable inside each of the three side-by-side stock cards. Add a
component regression assertion for the semantic metric grouping and re-run frontend validation.

Complete: the collision came from placing two flex-row label/value pairs inside each narrow grid row.
Each metric is now an independent two-row tile with a label above a larger tabular value; odd final
metrics span the card width, while headline price/change use a separate high-contrast summary panel.
The regression test asserts seven distinct metric groups per compared stock. All 48 frontend tests,
ESLint, TypeScript, and `git diff --check` passed; no production build or deployment ran.

## Market filter controls and comparison dialog - 2026-10-08 (complete)

Refine the Market stock-table controls from user feedback: place one advanced-filter button directly
beside the sort-direction field, remove browser-saved views, remove the separator above the four
overview presets, and make each preset's threshold visually explicit. Replace row checkboxes and the
inline comparison block with an accessible modal that accepts up to three symbols, loads canonical
detail/candle data through server-owned API calls, presents charts, market/fundamental metrics and an
observed-data status, allows symbols to be removed/replaced, and labels AI development outlook as
unavailable until a validated prediction model exists. Preserve shareable URL state and explicit
missing-data semantics, then add interaction coverage and browser validation.

Complete: advanced filters now open from one button immediately after the sort-direction control;
browser-saved views and row comparison checkboxes were removed. The preset cards no longer have a
heading separator and emphasize their numeric thresholds. A focus-trapped, Escape-dismissible dialog
selects, removes, and replaces up to three symbols, persists loaded selections in `compare=`, and shows
90-session charts, market/fundamental metrics, observed session status, and an honest unavailable AI
state. Both the base and two-symbol comparison development routes returned HTTP 200. All 48 frontend
tests, ESLint, TypeScript, and `git diff --check` passed; no production build or deployment ran.

## Home and Market decision-support UX - 2026-10-08 (complete)

Extend the existing beginner-first Home and Market experience with features that are useful on the
currently available, source-delayed data and do not fabricate licensed history or corporate events.
Add URL-addressable whole-universe stock screening with practical presets, browser-saved filter
views (subsequently removed by the comparison-dialog refinement above), a bounded side-by-side comparison flow, clearer trading-session context, and a Home daily
focus block derived only from observed breadth, sector, event, and database-backed news data. Keep
pagination counts consistent with filters, preserve explicit unavailable states, add backend/API and
frontend interaction coverage, and validate the running development routes without a production
build.

Complete: the Market screener now applies bounded daily-change, matched-value, market-cap,
volume-versus-20-day, and VN30 conditions to the provider's complete snapshot before cursor
pagination. Its validated URL state powers practical presets, up to six browser-local named views,
and a bounded three-stock comparison; controls that the current source cannot support are hidden with
an explicit explanation. Home adds an observed-data-only “Nên xem gì tiếp theo?” block and the shared
status bar explains open/closed session context. Mobile header flex sizing was tightened while the
stock table retains its no-horizontal-scroll card layout. Live Home and three filtered Market routes
returned HTTP 200, the screener API enforced its constraints, and desktop/mobile Chromium screenshots
were reviewed. All 110 backend tests passed with 11 database skips; registered market-data reports
passed 22 unit tests at 67.35% branch coverage and six integration tests at 62.05%; all 46 frontend
tests, ESLint, TypeScript, Ruff, and `git diff --check` passed. Targeted mypy remains blocked by the
existing `vnstock` missing-stub/obsolete-ignore error reached through the API composition import; no
production build or deployment ran.

## Market stock table fit and volatility colors - 2026-10-08 (complete)

Remove horizontal scrolling from the Market stock table by fitting both basic and advanced columns
inside their enclosing card, with a compact card layout on narrow screens instead of an oversized
minimum-width table. Keep every value readable or deliberately truncated with context, and map the
requested volatility levels to Low red, Medium yellow, and High green. Add component coverage and
measure table `clientWidth` versus `scrollWidth` on the running basic and advanced routes.

Complete: basic and advanced tables now use fixed, explicit column proportions inside a clipped
wrapper; long company text wraps or truncates within its own cell. Below 760 px, each row becomes a
two-column labeled card while retaining the semantic table and headers for assistive technology.
Volatility badges map Low to red, Medium to yellow, and High to green. Chromium measurements at
desktop show both modes at `clientWidth = scrollWidth = 992 px`; the narrow layout reports
`clientWidth = scrollWidth = 471 px` and no document-width overflow. The route returns HTTP 200,
ESLint and TypeScript pass, and all 44 frontend tests pass.

## Stock-detail trailing empty space regression - 2026-10-08 (complete)

Remove the large unused dark area after the stock-detail source footer. The regression was introduced
by the detail-only viewport `min-height` added during the metric-panel follow-up; preserve the scoped
dark page background and compact footer, then verify the document ends immediately after its content
at desktop and narrow widths.

The first hypothesis was wrong: removing the detail `min-height` did not change the reported scroll
region. Browser layout measurement showed visible content ending at 1,152 px and `body.scrollHeight`
at 1,200 px, but `documentElement.scrollHeight` at 2,990 px. The overflowing element is the chart's
2048-px-tall `table.sr-only`; CSS table layout ignores the generic one-pixel hidden-element height.
Move the accessible table inside a normal clipped wrapper, preserve its table semantics for screen
readers, add regression coverage, and re-measure the running page before completion.

Complete: the accessible OHLCV table now sits inside the normal one-pixel clipped wrapper instead of
carrying `sr-only` on the table itself. Chromium measurement on the running VCB route reduced
`documentElement.scrollHeight` from 2,990 px to 1,200 px, equal to `body.scrollHeight`; visible
content ends at 1,152 px, leaving only the intentional 48 px combined page/shell padding. The table
remains exposed to assistive technology. The targeted regression test, full 42-test frontend suite,
ESLint, TypeScript, the HTTP route smoke check, and `git diff --check` pass.

## Stock-detail metric panel and live quote completeness - 2026-10-08 (complete)

Make the stock-detail right column one enclosing panel with the same visual height as the chart,
place the individual metric cards and plain-language definitions inside it, and remove the trailing
empty dark area below the detail content. Reproduce current Vnstock price/volume/value fields for VCB
during the live session, fix confirmed normalization or refresh defects without fabricating trades,
add regression/component coverage, and validate the running VCB detail route.

Root cause confirmed: before HOSE's opening auction completed, KBS and VCI exposed an indicative
VCB price but no executed OHLC, volume, or value; the adapter then incorrectly copied that price
into all three OHLC fields, and its five-minute snapshot cache kept the pre-match state visible.
The adapter now preserves zero/unavailable execution fields, derives market time from live quote
timestamps, and refreshes snapshots every minute by default. The stock header and metric panel merge
WebSocket snapshots, pre-match zeros render as explicit unavailable states, and the right column is
one equal-height enclosing panel whose compact cards explain every metric. At 09:17 the running API
returned VCB 57,000; open 57,000; high 57,100; low 56,900; volume 37,500; value 2.13748 billion VND;
fresh market time 09:17:17. Targeted Ruff, ESLint, TypeScript, nine provider tests, and four component
tests pass; the live stock-detail route returns HTTP 200 with the new panel and explanations.

## Complete sector universe instead of a 100-stock sample - 2026-10-08 (complete)

Fix Home and Market sector counts/moves that currently aggregate only the 100-row instrument summary
sample. Add one bounded server-side sector aggregate over the provider's full instrument snapshot,
keep the stock table independently paginated, update both pages to consume the aggregate, and add
backend/API/frontend regression coverage proving the Banking count is not truncated by list paging.

Root cause confirmed: Home and Market requested an instrument summary with `limit=100` and grouped
that page client-side. With zero pre-open liquidity, symbol tie-breaking made the sample especially
unrepresentative. Added `/api/v1/market/sectors`, a bounded server-side aggregate over the complete
provider snapshot, and switched both heatmaps plus Market breadth/liquidity/foreign-flow and sector
strength to it while leaving the stock table cursor-paginated. The 09:00 smoke exposed an adjacent
provider defect: as soon as some stocks matched, zero-close unmatched stocks were dropped. They now
remain at reference price as unchanged for the current session. Live validation reports 1,399
instruments across 19 sectors and 28 Banking members; the Banking filter returns 28 rows with 15 on
page one. Full validation passed 108 backend tests with 11 database skips and 41 frontend tests;
Ruff, targeted strict mypy, ESLint, and TypeScript passed. No production build or deployment ran.

## Pre-open market snapshot showing zero movement - 2026-10-08 (complete)

Reproduce and fix the local Home dashboard state where every sector reports 0%, breadth reports no
gainers or losers, and market-data requests can stall during an upstream refresh. Verify the raw KBS
quote fields before changing normalization, preserve honest freshness/source labels, add regression
coverage for the confirmed pre-open payload shape, and validate the running frontend against the
corrected backend.

Root cause confirmed from the 08:44 KBS board: all live OHLC/volume fields were reset to zero for the
new session while `reference_price` had advanced to the prior close. The adapter incorrectly used
that reference as both current and comparison prices, manufacturing 0% everywhere. A fully reset
board now uses one VCI batch whose new reference is the latest completed close and whose match
reference is the preceding session reference; zero rows are no longer promoted to synthetic quotes.
FPT was cross-checked at 59,700 versus 60,400 (-1.16%) against its daily candles. Vnstock quota
`SystemExit` is also normalized to a provider failure instead of escaping through ASGI. The live API
now reports VN-Index -0.32% and non-zero exchange breadth, and the running Home HTML contains varied
positive and negative sector percentages. PostgreSQL, Redis, and Docker Desktop remain stopped, so
database-backed Home news correctly remains unavailable in this host runtime. Validation: all 105
backend tests passed with 11 database skips, all 40 frontend tests passed, Ruff, strict mypy, ESLint,
TypeScript, and `git diff --check` passed; Home and FPT detail returned HTTP 200 with FPT P/E 15.53
and P/B 3.7. No production build or deployment was run.

## Sector navigation, stock fundamentals, daily news, and data timestamp - 2026-10-08 (complete)

Extend the public Home and Market experience so sector heatmap area is proportional to the absolute
daily percentage move, each sector tile links to its filtered Market stock view, stock-detail metrics
sit beside the candlestick chart, P/E and P/B are populated from the active market source when
available, Home highlights current-day articles already stored in PostgreSQL, and users can see one
clear last-data-update timestamp. Preserve source/freshness disclosure and explicit unavailable
states. Add focused backend and frontend tests, then run affected lint, type, and test checks.

Implemented shared clickable Home/Market sector heatmaps whose relative area follows absolute weighted
daily movement, URL-addressable `sector` filtering, a two-column stock-detail chart/metrics layout,
and lazy one-hour KBS fundamental caching for Vnstock P/E, P/B, EPS, and ROE. Home now requests four
database-backed articles from the latest 24 hours and highlights the newest, while Market status
shows one explicit latest-data timestamp. Real smoke checks returned HTTP 200 for Home, a sector link
(`Y tế`) and FPT detail, with FPT P/E 15.53 and P/B 3.7. Local PostgreSQL did not respond, so the Home
news smoke exercised the honest empty state; the database-backed UI path has component coverage.
Validation: full backend suite passed 103 tests with 11 database skips; registered market-data reports
passed 17 unit tests at 65.58% branch coverage and four integration tests at 61.28%; Ruff and targeted
strict mypy passed; all 40 frontend tests, ESLint, TypeScript, Compose rendering, and `git diff --check`
passed. The first uncached Vnstock snapshot took about 127 seconds; subsequent smoke pages returned in
2-5 seconds. No production build or deployment was run.

## Market contrast and non-blocking navigation - 2026-10-07 (complete)

Fix the reproduced Market readability and navigation defects. Heatmap labels currently inherit the
same red/green tone as their saturated tile backgrounds, reducing contrast. Route transitions can
remain in Next.js "Rendering" while an expired Vnstock snapshot performs a synchronous full-market
refresh; visible market links also create avoidable server-route prefetch load. Make cached reads
stale-while-refresh after the initial snapshot, disable expensive prefetch where appropriate, retain
URL-addressable state, add regression coverage, and verify click navigation plus WCAG-oriented color
contrast in the running development app.

Implemented stronger dark-theme borders and muted text, white high-weight heatmap labels on deeper
red/green/yellow tiles, clearer gain/loss numerics, and visible keyboard focus for stock rows. Market
links no longer prefetch expensive server routes, stock-row selection remains URL-addressable, and
local WebSockets now connect directly to the backend. Vnstock snapshots use stale-while-refresh after
their first load with a five-minute refresh default; optional Home news is fetched concurrently with
an 800 ms ceiling so an unavailable local PostgreSQL database cannot hold navigation for 30 seconds.
The backend was restarted from the repository root so the root `.env` selects Vnstock, and both dev
servers remain running. Browser click smoke tests measured the five Market routes at 135-440 ms and
Market-to-Home at about 1.05 seconds; stock-row selection opened `selected=MSN`. Computed heatmap text
is near-white at weight 950. Frontend ESLint and TypeScript passed, all 36 frontend tests passed,
19 focused backend market tests passed, and `git diff --check` reported no whitespace errors.

## Beginner-first Home/Market and Vnstock evaluation - 2026-10-07 (complete)

Redesign Home and Market around plain-language decisions for new investors: one-sentence market
summary, sentiment, breadth/liquidity/foreign-flow explanations, learning path, daily terminology,
translated news context, community entry points, sector heatmap/flow, simplified stock table, fixed
five-color legend, inline glossary, and an explicit Basic/Advanced mode. Integrate Vnstock behind the
existing canonical backend provider boundary for real historical OHLCV and source-delayed in-session
data without exposing its key to the browser or claiming exchange-grade realtime. Preserve current
TCBS/fixture modes and existing public contracts where possible; label unavailable/derived fields
instead of fabricating market reasons. Add focused backend/provider and frontend interaction tests,
then run lint, type checking, feature tests, and development-server smoke checks.

Implemented a cached `vnstock` provider using KBS reference/quote/OHLCV data and VCI sectors, with
source-delayed/partial metadata, VND normalization, daily and five-minute candles, stale fallback,
server-only optional key configuration, and pinned package hashes. Redesigned Home and Stocks for
beginners with plain-language conclusions, line charts, an explicitly estimated sentiment gauge,
breadth/liquidity/foreign explanations, learning/glossary/news/community scaffolds, sector heatmap,
relative sector strength, basic/advanced URL state, 15-row VN30-first paging, simplified/advanced
tables, a stock drawer with 90-session chart, inline definitions, five-color legend, and disclaimers.
No unsupported news reasons or community posts are fabricated. Local `.env` now selects Vnstock.
Validation: backend Ruff passed; full backend suite passed 100 tests with 11 database skips; focused
Vnstock/service tests passed 4 tests; registered market-data suites passed 14 unit and 4 integration
tests with branch coverage; frontend ESLint and TypeScript passed; 32 frontend tests passed;
real localhost smoke checks returned HTTP 200 for overview, FPT 30-day candles, Home and Stocks, with
provider `vnstock-kbs`, 4 indices, 1,399 instruments, and VN30 members first. No deployment occurred.

## Stale backend market compatibility - 2026-10-07 (complete; data restart pending)

Fix the reproduced local mismatch where the pre-change backend returns 422 for `sort=vn30` and an
empty index collection, causing `/market/stocks` to crash and the Home candlestick section to vanish.
Limit compatibility behavior to the verified 422 contract mismatch, normalize missing additive fields,
and keep the Home chart shell visible with an explicit waiting state until real index candles arrive.

Reproduction confirmed the running legacy backend returned HTTP 422 only for `sort=vn30`, accepted
`sort=matched_value` with 15 rows, returned an empty index collection, and returned no candle series.
The server-side API client now retries only that verified 422 mismatch with the legacy supported sort
and normalizes missing additive pagination/VN30 fields; other failures still surface. Home always
renders the candlestick panel and identifies the wait for VN-Index instead of silently removing it.
Direct localhost smoke checks now return HTTP 200 for `/` and `/market/stocks`, include the Home chart
shell, and contain no 422 runtime error. Frontend ESLint and TypeScript passed; all 30 Vitest tests
passed, including the legacy-contract regression; `git diff --check` passed. Real candles still require
restarting the backend with the implemented provider and a fresh Smart OTP because the retained old
process reports no indices or candles.

## Shared red/green candlestick charts - 2026-10-07 (complete; runtime restart pending)

Replace the Home breadth bar visualization and stock-detail line chart with one accessible financial
candlestick renderer: red/green OHLC bodies and wicks, aligned volume, current-price marker, MA5/MA20,
time/price axes, textual data alternative, and honest empty states. Retain the existing dark navy
theme and provider limitations. Accumulate real five-minute VN-Index candles from TCBS index stream
updates in process; never manufacture missing history.

Implemented one shared SVG financial chart on Home and stock detail: bounded red/green OHLC candles,
wicks, aligned directional volume, grid/axes, latest-price marker, MA5/MA20, responsive horizontal
scrolling, and a semantic table alternative. Home now uses VN-Index instead of the former breadth bar
chart, while the breadth summary remains. TCBS index ticks accumulate into bounded five-minute candles
and flow through REST/WebSocket contracts; missing pre-process history stays an explicit empty state.
Removed the superseded breadth-chart component and synchronized README/project/architecture facts.
Validation: backend Ruff and targeted strict mypy passed; full backend suite passed 97 tests with 11
database-dependent skips. Registered market-data feature reports passed 11 unit tests at 65.22%
branch-aware coverage and four integration tests at 61.43%. Frontend ESLint, TypeScript, and all 29
Vitest tests passed; Next.js HMR compiled Home and stock detail; `git diff --check` passed. The old
backend process still needs a fresh Smart OTP restart before live candles can be smoke-tested.

## Dark market workspace, VN30-first paging, and stock detail - 2026-10-07 (implementation complete; runtime restart pending)

Extend the live market experience with a dark navy Home/Market visual system, a 15-row VN30-first
stock table with bidirectional pagination, centered financial columns and stronger gain/loss colors,
an aggregate whole-market chart on Home, and a path-addressable stock detail screen with accessible
range controls and provider-explicit chart availability. Preserve server-only TCBS credentials and
do not fabricate multi-session history that iFlash OpenAPI does not expose.

Implemented the vertical slice across TCBS normalization, canonical contracts, API pagination, Home,
Market, and `/market/stocks/<symbol>`. Board 2 identifies VN30 membership; documented intraday trades
are aggregated into five-minute Day candles; Week/Month/Year states disclose the absent multi-session
OHLC feed. Added focused provider/service/API/component regression coverage and synchronized README,
project, and architecture memory. Validation: backend Ruff and targeted strict mypy passed; the full
backend suite passed 96 tests with 11 database-dependent skips; frontend ESLint, TypeScript, and all
28 Vitest tests passed; `git diff --check` passed before the final documentation update. The Next.js
dev server compiles Home, Stocks, and FPT detail routes. Its existing backend process intentionally
remains on the pre-change code because the previous Smart OTP is expired and the live access token is
process-local; restart and final real-data smoke testing require a newly generated Smart OTP.

## TCBS live market activation and redistribution review - 2026-10-07 (complete)

Validate the configured TCBS iFlash credentials against read-only live market endpoints, correct
provider mappings and UI behavior needed for real snapshots, and document whether public hosting
on Render/Vercel is permitted. No deployment or trading operation is authorized; public hosting
remains blocked unless TCBS grants explicit redistribution/display rights.

Implemented real-data corrections: paginated/filtered the common-stock master, retained closed-session
trading dates, requested an immediate upstream index snapshot, serialized the single OTP exchange
across concurrent startup consumers, excluded VN30 double counting from breadth, aligned public cache
headers with settings, merged live snapshots into home cards, and marked unsupported/estimated TCBS
fields honestly in the UI. The configured key reached the official token endpoint, which returned
`203033 Invalid OTP` for the first expired codes. A newly generated Smart OTP subsequently returned
HTTP 200 with a non-empty JWT, and the same in-memory token returned an HTTP 200 FPT quote snapshot
for trading date 07/10/2026. No token or credential was printed or persisted by the verification.
Public TCBS docs were reviewed without finding an explicit third-party redistribution grant. Render
fits the current long-running topology technically; Vercel WebSockets are public beta and bounded by
Function duration, so Vercel is suitable for the frontend unless the backend is redesigned. No deploy
was performed. Validation: backend Ruff and strict targeted mypy passed; full backend suite passed
93 tests with 11 database-dependent skips; frontend ESLint, TypeScript, and all 25 Vitest tests passed.

## Bounded Docker container logs — 2026-10-06 (complete)

Applied one shared Compose `json-file` logging policy to all ten InvestIQ services with 10 MB files
and three retained files, limiting Docker-managed log storage to approximately 30 MB per container.
Documented that the policy takes effect on container recreation and does not alter unrelated host
containers. Compose rendering confirms every service receives the driver and both rotation options;
live recreation was not attempted because Docker Desktop was not running in the current environment.

## TCBS market adapter and canonical market routes — 2026-10-06 (complete)

Implemented a production-shaped TCBS iFlash adapter behind the canonical market provider port:
validated secret configuration, bounded/retried REST calls, circuit breaking, in-memory token reuse,
normalized stock/index snapshots, one shared upstream index stream, downstream quote snapshots,
stale fallback, safe failure classification, and credential-free contract tests. The frontend now
uses canonical `/market/stocks`, `/market/watchlist`, `/market/indices`, `/market/events`, and
`/market/people` routes; `/market?tab=...` redirects compatibly while preserving URL filters. Runtime,
Compose networking, documentation, project memory, and decision records are synchronized. TCBS
requires Smart OTP to exchange an API key and documents no refresh token, so the runtime accepts a
pre-issued access token or an API key plus one-time OTP and reuses the token without logging it.
Validation: backend Ruff passed; the full backend suite passed with 90 tests and 11 database skips;
the isolated market-data suites passed 6 unit and 2 integration tests; targeted strict mypy passed;
frontend ESLint, TypeScript, and all 23 Vitest tests passed; Compose config and `git diff --check`
passed. Live TCBS validation remains pending until credentials and provider entitlements are issued.

## Market-data API credential tutorial — 2026-10-04 (complete)

Added the local guide `docs/tutorial/market-data-api-keys.md`. It ranks Vnstock Community, TCBS
iFlash OpenAPI, FinLens, DNSE, SSI and FiinGroup by coverage, update mode, onboarding effort and
initial cost; documents credential acquisition and safe environment-variable handling; separates
free software/access from redistribution rights; and provides a staged provider-evaluation path for
the existing fail-closed market provider port. No credential, dependency, runtime configuration or
market adapter was added or enabled.

## Home and market pages implementation — 2026-10-04 (complete)

Implemented the approved `docs/plan/home-market-pages.md` local vertical slice. Added canonical
market domain/provider contracts, deterministic fixture data with an explicit non-production label,
strict public market APIs, bounded Redis caching, versioned WebSocket snapshots, migration
`0011_market_foundation`, user-owned watchlists with BFF/session/ownership enforcement, and the
responsive home plus Stocks, Watchlist, Indices, Events and People tabs. Added search/sort/filter,
candlestick visuals, freshness/source status, grouped event dates, businessperson methodology, and
mobile/accessibility states. Local `.env` enables the fixture while `.env.example` and Compose fail
closed by default. Applied the migration locally, rebuilt/restarted the backend, and confirmed API,
all pages, and WebSocket snapshot delivery. Ruff, frontend ESLint, TypeScript and `git diff --check`
pass. No automated tests or frontend production build were run. Licensed provider credentials,
redistribution approval, live ingestion/reconciliation/failover, licensed history backfill, and
traffic-derived production popularity remain external provider-gated work.

## Detailed home and market pages plan — 2026-10-04 (complete)

Added `docs/plan/home-market-pages.md`, an implementation-ready specification for the public home
page and `/market` tabs: Stocks, Watchlist, Indices, Events and People. It defines UX and navigation,
accurate financial terminology, privacy-safe/explainable popularity, field-level tables, provider
selection and failover, canonical data/schema, REST/WebSocket contracts, cache/freshness budgets,
resilience, privacy, observability, delivery backlog, 12-week timeline and acceptance criteria.
Official documentation for FiinGroup, SSI, DNSE and VSDC is linked; production access remains gated
by storage/display/redistribution rights. Synced the parent roadmap, plan index, root README,
project/architecture memory and decision log. No application code, migration or runtime changed.
## News crawl backend CI repair — 2026-10-08 (complete)

Reproduced pull request #5's Backend CI failure with the workflow's strict mypy command. Updated
the news repository and crawler HTTP test doubles to satisfy their expanded type contracts. Strict
mypy, Ruff, 21 focused news tests, the full backend suite (82 passed, 11 database tests skipped
without `TEST_DATABASE_URL`), and Compose model validation pass. Docker image validation remains
assigned to GitHub Actions because the local Docker Desktop engine is unavailable.

## Community and market product roadmap — 2026-10-04 (complete)

Added `docs/plan/community-market-roadmap.md` as the accepted direction after auth and news. The
roadmap positions InvestIQ as an evidence-based investment community instead of a FireAnt clone. It
covers licensed EOD/delayed market data, market context, private watchlists, community moderation,
structured and versioned theses, outcome-based contextual reputation, source-linked AI critique,
privacy/security constraints, a prioritized backlog, success metrics, risks, decision gates, and a
12-week differentiated MVP / 28-week public-beta timeline. Linked it from the plan index and root
README, and synchronized project/architecture memory. No application code or runtime was changed.

## News crawl completion — 2026-10-04 (complete)

Implemented numbered 10-item news pages, partial accent-insensitive search with trigram index,
30-second versioned Redis list caching, StockBiz metadata-only RSS ingestion, and Vietstock
90-day archive scanning with PostgreSQL page checkpoints and Beat recovery. Local migrations
0007–0010 were applied locally. The 90-day Vietstock archive scan completed and its PostgreSQL
checkpoint is marked complete; persisted fetch jobs continue automatically at the provider rate limit.
The local database includes articles back to 2026-07-07, within the 90-day filter. HNX TLS verification
now uses the publisher's missing GlobalSign intermediate locally; live feed discovery and ingest
succeeded. A transient CafeF provider failure was recovered with a new successful ingestion job.
Backend Ruff, mypy, and 44 focused tests passed; frontend lint and typecheck passed. The development
news page and numbered page 2 return HTTP 200; the API demonstrated Redis MISS then HIT. Docker
backend, worker, and Beat remain running for queued historical fetches.

## Latest follow-up - Automatic news crawling, 2026-10-02

Implemented startup discovery for the five configured news sources when the single Celery Beat
scheduler starts, in addition to the existing five-minute schedule. Ingestion now defaults to
enabled in application settings, Compose, and `.env.example`; operators can pause it with
`NEWS_INGESTION_ENABLED=false`. Updated README, architecture memory, project memory, and the news
implementation report. No deployment or tests were run.

## Latest follow-up — News feed population, 2026-10-02

Investigated the empty news feed. The active local database initially had configured sources but
zero articles, revisions, crawl runs, or ingestion jobs. `/news` and `/api/v1/news` are public.
Using the existing ingestion pipeline, a bounded manual crawl stored 41 published articles with
revisions: 3 CafeF, 15 Vietstock, 15 VnEconomy, and 8 VnExpress. One CafeF fetch failed. HNX could
not be crawled because its TLS certificate chain failed verification; verification stayed enabled.
The API returns 20 items on its first page with `freshness=fresh`, and guest `/news` returns HTTP
Ingestion was disabled at the time of this earlier follow-up. The temporary worker was removed and the normal worker restarted.

# Latest follow-up — auth account feedback and validation, 2026-10-02

Complete: duplicate registration now returns 409 before issuing an OTP, including a concurrent
duplicate caught at verification. Password recovery returns actionable 404 for unknown/inactive
email and 409 for Google-only accounts; the UI directs Google users to Google sign-in. Added a
10/hour per-IP recovery limit alongside the existing 5/hour per-email/per-IP limit. The auth plan
and decision log record the account-enumeration tradeoff requested by the user.
The OTP screen explains how to check Spam and mark the message “Not spam”. Authentication emails
now include RFC 5322 Date and Message-ID headers.

Validation: backend auth feature run passed 19 unit and 8 API/PostgreSQL integration tests on an
isolated temporary PostgreSQL 17 container; Ruff and strict mypy passed. Frontend ESLint,
TypeScript, and all 18 Vitest tests passed. E2E was not run per user instruction. No actual OTP
email was sent. Gmail SMTP had previously accepted a job, but inbox placement cannot be established
without recipient-side “Show original” headers; SPF/DKIM/DMARC results and Gmail spam feedback are
still needed to attribute the spam placement.

## Latest follow-up — password-change success notice, 2026-10-02

Complete: successful password recovery redirects to the login form with a success status message
explaining that the password was updated and the user can sign in with the new password. The login
page passes the URL status into the client form without a client-side search-param dependency.
Frontend ESLint, TypeScript, and 5 auth component tests passed.

## Latest follow-up — password-recovery OTP alignment, 2026-10-02

Complete: registration and password-reset OTP email messages use the same tested HTML/text
presentation. OTP lifetime is fixed at 90 seconds for both flows. The forgot-password UI now receives
the server lifetime, shows a 90-second countdown, disables confirmation after expiry, and allows a
new code to be requested; OTP confirmation uses the primary blue button style. Frontend lint,
typecheck, and 4 auth component tests passed; 2 focused backend tests passed. Backend/frontend images
were rebuilt and backend, notification worker, frontend, and Nginx restarted; the services are
healthy and `/forgot-password` returns HTTP 200.

## Latest follow-up — auth screen visual refresh, 2026-10-02

Complete: login and registration now use a larger centered brand mark and centered heading; the
“Tài khoản” eyebrow was removed. Password visibility is controlled by accessible eye icons, and
the Google button has a recognizable multicolor G icon. Frontend ESLint and TypeScript checks pass.
Rebuilt and recreated `investiq-frontend-1` from `investiq-frontend:local`; it is healthy, and both
`/login` and `/register` return HTTP 200 from the updated container.

## Latest follow-up — OTP email presentation and automatic sessions, 2026-10-02

Complete: OTP, password-reset, registration-success, and password-changed emails now include a
styled inline HTML version and a matching plain-text version; OTP is prominent and the Vietnamese
copy explains the 90-second limit and privacy guidance. Removed email persistence and session-choice
checkboxes from login/registration; all new email, OTP, and Google sessions use the configured
`AUTH_SESSION_DAYS` lifetime (30 days by default) with persistent HttpOnly cookies and automatic
server-side refresh-token rotation. Updated API/BFF schemas, docs, project memory, and decision log.

Frontend ESLint, TypeScript, and backend Python compilation passed. Ruff was unavailable in the host
environment, and automated tests were not run. No production build or container recreation was run.

## Latest follow-up — OTP email egress fix, 2026-10-02

Root cause: Compose attached `celery-notifications` only to `backend`, which is `internal: true`.
This prevented DNS and outbound TCP to `smtp.gmail.com`; SMTP credentials and STARTTLS settings
were configured. Added a dedicated non-internal `mail-egress` network for the notification worker
while leaving other backend services isolated. README, architecture memory, and the decision log
now describe this network boundary. Compose validation passed; the notification service was
recreated, resolved Gmail, completed STARTTLS on port 587, and authenticated successfully without
sending a message. The supplied `EMAIL_USE_TLS`/`EMAIL_USE_SSL` variables are not consumed; the
equivalent active application setting is `AUTH_SMTP_STARTTLS=true` with port 587.

Follow-up diagnosis: three historical email jobs (two registration OTPs and one registration
success message) ended as `failed` with `gaierror`, matching the old DNS/egress failure; all were
created before/at the original network fix. The current worker is attached to both `backend` and
`mail-egress`; current DNS resolution, TCP connection, STARTTLS, and SMTP authentication succeed.
The next registration attempt arrived through the backend and created an OTP job that completed as
`sent` in 4.4 seconds. The challenge expired 90 seconds after creation while checking it. Backend
`/healthz` and frontend root both return HTTP 200, and all Compose services are up/healthy where
health checks are configured. SMTP accepted the OTP message; inbox delivery is outside SMTP's
acceptance signal. The user reports it did not arrive, so mailbox placement/address spelling remain
the relevant checks; a resend will create a fresh 90-second challenge.

## Latest follow-up — local auth and notification fixes, 2026-10-02

The local Docker stack is running at `http://localhost:8080`. Earlier follow-ups fixed migration
setup, Google callback redirects, and logout CSRF origin validation. Current registration report
was traced to the BFF CSRF gate: Nginx logged `/auth-api/register` as 403 and no backend request.
`getOrCreatePreAuth` now refreshes the readable CSRF cookie from the active Redis-backed pre-auth
record whenever it returns that record, preventing stale double-submit cookie state. Auth fetches
explicitly use same-origin credentials. The shared global success toast now anchors bottom-right,
including on mobile; inline form errors remain adjacent to their fields/form for accessibility.
Frontend lint passed, its container rebuilt and reported healthy, and `/register` plus
`/auth-api/csrf` returned HTTP 200.

## Latest task — 2026-10-01 authentication implementation

Complete: implemented `docs/plan/auth.md` across PostgreSQL/FastAPI, a Next.js BFF/UI, Redis-backed
browser sessions, durable authentication email delivery, Google OIDC, registration OTP, password
recovery, header account menu/logout, and separate remember-email/persistent-login choices. JWT and
refresh credentials stay encrypted in server-side Redis state; refresh tokens are rotated and stored
only as hashes in PostgreSQL. Existing Admin News authentication remains separate.

Authentication is fail-closed and defaults to `AUTH_ENABLED=false`. Blank key/provider entries were
added to the ignored local `.env` and tracked `.env.example`. The ignored local
`docs/tutorial/auth-keys.md` explains key generation plus Google OAuth and SMTP setup.

Local direct validation later enabled auth after replacing an undersized OTP key and generating the
previously missing local PostgreSQL, Redis, and application secrets. An isolated Docker project
applied migrations 0001-0005 and passed browser-bound BFF flows for registration/OTP, persistent
opaque HttpOnly sessions, refresh, logout/login, password reset, old-password rejection, old-session
revocation, direct-backend rejection, and Google OIDC start with state/nonce/PKCE. The notification
worker stayed off, so no real email was sent; the isolated containers and volumes were removed.

Validation: backend Ruff and strict mypy passed; full backend suite passed 61 tests with 8 existing
environment-dependent skips. Auth feature suites passed 4 unit tests and 1 API integration test; the
PostgreSQL repository integration test was skipped because `TEST_DATABASE_URL`/Docker was
unavailable. Frontend lint, typecheck, and 11 tests passed. `docker compose config --quiet` passed
with required placeholder environment values. No production build or deployment was run.

## Status

Complete: the authenticated Admin News dashboard is wired to protected operations, and a controlled
five-source crawl populated the isolated development database. No staging or production data was
changed.

## Objective

Keep crawled news current, make source operations controllable and observable, improve data quality
and analysis, expose operational controls through an authenticated Admin UI, and populate the active
development runtime with recent articles while preserving bounded durable workers.

## Confirmed constraints

- Periodic database backups only; no PostgreSQL replica.
- Preserve FastAPI/Next.js/PostgreSQL/Celery/Redis and Clean Architecture boundaries.
- Public crawler inputs are allowlisted and bounded; live websites are not called from CI tests.
- Vietstock exposes RSS feeds. CafeF robots currently allows crawling and advertises sitemap/news
  sitemap endpoints; full-text republication rights still require product/legal approval.
- HNX, VnEconomy, and VnExpress expose public RSS routes. The new adapters are metadata-only and keep
  attribution plus canonical links; ingestion remains globally disabled by default.
- Six other candidate sources remain profiled until a public ingestion route and policy are confirmed.
- No standalone logo asset exists; implement a local accessible InvestIQ SVG mark based on the
  visible blue/green wordmark direction.
- Default proposed policy is to reject articles older than 72 hours at ingestion and retain served
  articles for 90 days. Cleanup must support dry-run and no real database deletion will run until
  the user confirms both the retention period and target environment.

## Acceptance conditions

- Migration/repository support idempotent revisions, symbols, sentiment, and durable jobs.
- All five adapters parse deterministic fixtures and discover only allowlisted URLs.
- Public list/detail/source/security APIs use explicit schemas and stable cursor pagination.
- Celery work is bounded/idempotent and scheduled only when ingestion is enabled.
- News UI/header are responsive and handle empty/error/partial states.
- Backup/restore scripts are safe, configurable, checksum-aware, and dry-run capable.
- News unit/integration suites are registered and relevant checks pass, or exact limitations are reported.

## Completion evidence

- Admin workspace: `/admin-login` issues an HMAC-signed HttpOnly session; `/admin/data-pipeline`
  manages source pause/resume, manual crawl, the latest 100 crawl runs, retention dry-run, and
  confirmed deletion. The operations token remains server-only. Unauthenticated backend/UI smoke
  checks return 401/redirect, while an authenticated browser flow renders the dashboard.
- Development crawl: 87 current articles were stored (Vietstock 25, CafeF 5, HNX 24, VnEconomy 25,
  VnExpress 8). Their publisher times span 27–30 September 2026, all 87 fetch jobs succeeded, one
  explicitly stale HNX item was cancelled, and no fetch job failed. A CafeF regression was fixed so
  timezone-naive metadata is interpreted as Vietnam time rather than UTC.
- Retention: a 90-day dry-run matched zero rows in the development database, so no article deletion
  was performed.
- Final validation: Ruff passes, mypy passes over 146 source files, and all 63 backend tests pass on
  an isolated PostgreSQL 17 container. The news workflow passes 34 unit and 14 integration tests.
  Frontend ESLint, TypeScript, and 8 Vitest tests pass. The temporary test container was removed.

- Freshness hardening: explicitly stale discovery entries are filtered before article fetch; the
  worker rejects undated, stale, or future-dated articles before persistence. Public lists default
  to seven days and public detail/list access is capped by the configured retention window.
- Operations: protected source status, manual crawl, crawl-run telemetry, and retention endpoints
  fail closed without a dedicated token and write audit records. Retention is dry-run by default and
  destructive execution requires explicit confirmation.
- Resilience and quality: Redis-coordinated per-domain request budgets/circuit state have a bounded
  local fallback; exact normalized headlines receive cross-source counts; rule analysis now emits
  topics and event types surfaced by the API/UI.
- Final validation: all 61 backend tests pass on a fresh isolated PostgreSQL 17 instance; Ruff and
  mypy pass. The feature workflow passes 33 news unit and 13 news integration tests with generated
  reports. Frontend ESLint, TypeScript, and all four Vitest tests pass. Compose configuration validates
  with required test secrets. The temporary PostgreSQL containers were removed.

- Five-source expansion: HNX official/issuer RSS, VnEconomy Chứng khoán RSS, and filtered VnExpress
  Kinh doanh RSS are registered in Celery and seeded as active metadata-only sources. Live smoke
  discovery/fetch succeeded for two current URLs per new source.
- Expansion validation: 25 news unit tests and 9 PostgreSQL/API integration tests pass; the full
  backend has 49 passing tests. Ruff passes, and mypy passes over 141 source files. The isolated
  PostgreSQL 17 test container was removed after validation.

- Earlier two-source baseline: Ruff and mypy passed with 33 backend tests; the news feature had
  14 unit and 6 PostgreSQL/API integration tests with generated local reports.
- Frontend: ESLint, TypeScript, and 4 Vitest tests pass.
- Operations: Compose validation and shell syntax pass; PostgreSQL 17 backup/isolated restore drill
  succeeds.
- Report: `docs/plan/news-implementation-report.md` lists source research, delivered behavior,
  activation requirements, and remaining pre-production gaps.
- Preview validation: controlled live backfill stored 50 Vietstock and 10 CafeF articles with full
  content blocks; demo rows were removed. The list returns 30 items per page and the detail view adds
  extracted key passages before the full article body. One short dynamic-table article is correctly
  marked partial.
- Analysis follow-up: cards show sentiment followed by at most three verified or publisher-explicit
  tickers and an overflow count. Detail headings are smaller, and the analysis panel now provides a
  weighted position, sentence evidence, scope, short-term market impact, and mentioned tickers.
  Preview reanalysis found 63 ticker references across 25/60 articles and reduced neutral labels from
  21 to 9. At that follow-up milestone, 39 backend tests, Ruff, mypy over 138 files, frontend
  lint/typecheck, and 4 Vitest tests passed.
- Log-viewer follow-up: corrected the Dozzle v11 `visibleKeys` profile shape that crashed the browser
  during state hydration. A clean Chrome session renders the viewer and both labeled preview
  containers on port 9999; all 7 logging unit tests and 5 request-logging integration tests pass.
- Preview observability follow-up: replaced the host Uvicorn preview process with the labeled
  `investiq-preview-api` container on the same host port 8001. It retains the existing preview
  PostgreSQL/Redis data, emits structured request logs, and is visible beside those containers in
  Dozzle. The frontend list and API list/detail smoke checks return HTTP 200.
- Structured-log display follow-up: the Dozzle v11 profile now stores field visibility in its
  per-image-command map format. API rows prioritize status, route, duration, content, explanation,
  and request ID while hiding five duplicate fields. Runtime DOM validation confirms the selected
  fields render in order for `investiq-preview-api` and the hidden fields are absent.
- Frontend CI follow-up: anchored the generic Python `lib/` and `lib64/` ignore patterns to the
  repository root so `frontend/src/lib` is included in Git. The previously missing typed news API
  client and its tests now reach clean CI checkouts; frontend lint, typecheck, and all four Vitest
  tests pass locally.

## Latest task — Admin account management (2026-10-01)

Complete: implemented role-protected account search, filters, pagination, role/status changes, self/last-admin protections, session revocation on disable, shared Redis rate limiting, and audit details. Added migration 0006, account-management documentation, backend/frontend coverage, and updated README. Validation: Ruff, targeted strict mypy, frontend ESLint/typecheck, 14 frontend tests, and 13 backend unit tests passed. Backend integration API tests passed; 2 PostgreSQL repository tests skipped because `TEST_DATABASE_URL` was unavailable. No deployment performed.

## Latest task — Local Google login startup issue (2026-10-02)

Complete: the Google callback first reached FastAPI before local migrations were applied; the new PostgreSQL volume lacked auth tables and account persistence returned HTTP 500 (`AUTH_FAILED`). Applied migrations 0001–0006 without deleting the volume. A later browser screenshot showed Google login succeeded but the BFF redirected to invalid `0.0.0.0:3000` because it derived callback redirects from the incoming request URL. The callback now derives success/error redirect origins from `AUTH_GOOGLE_REDIRECT_URI`. A subsequent logout attempt returned 403 because CSRF validation compared the browser origin with the proxy's internal request URL; it now validates against the configured public auth origin. Rebuilt the frontend and verified a same-origin CSRF logout request returns HTTP 204, `/login` returns HTTP 200, and all Compose services are healthy. README documents applying migrations before UI/API use. Full browser retries remain user driven.

## News search and feed follow-up - 2026-10-02

Implemented automatic URL-backed news filters (search debounce, immediate select/input changes), reduced the feed page size to 10, added PostgreSQL accent-insensitive substring matching alongside full-text search, and constrained article thumbnails to prevent tall source images stretching a single result card. Frontend ESLint and TypeScript checks passed.

Not completed: numbered/previous-page pagination, query cache, expanded crawler integrations, and three-month historical ingestion. The API currently exposes signed forward cursors; ingestion rejects articles older than the configured 72-hour freshness window. FireAnt's crawler module is a placeholder, so its pending source cannot safely be activated. No database crawl/backfill was run.
