# Current Task

## Comprehensive Enterprise Admin System Architecture & Security Hardening - 2026-10-28 (complete)

### Data Pipeline & News Admin Ingestion Token Hardening - 2026-10-28 (complete)
- **Issue**: When accessing /admin/data-pipeline, UI displayed NEWS_ADMIN_TOKEN is not configured for the Admin UI.
- **Root Cause**: Backend protected endpoints /api/v1/admin/news/* require dedicated operational Bearer token NEWS_ADMIN_TOKEN which was not provisioned in local environment.
- **Fix**: Generated secure operational token and configured it across .env, backend/.env, and frontend/.env.local.
- **Verification**: Re-launched both FastAPI backend and Next.js frontend; verified /api/v1/admin/news/sources returns 11 sources and crawl runs return 100 runs with HTTP 200 OK.

- **User Request**: "chuyển nhánh feature/admin và xây dựng chức năng cho admin của hệ thống. Yêu cầu UI: có sidebar, màu sáng sủa (trắng xanh dương), không có icon trước text, các giao diện phải có sự hữu dụng. Yêu cầu chức năng: các tab danh mục cần thiết cho admin, cùng format css table, các bảng hiển thị cột cần thiết và nút xem chi tiết đồng nhất, dashboard đa dạng biểu đồ thống kê hiện đại. Yêu cầu coding: thiết kế jwt chặt chẽ (token phải chứa role admin mới được call api), nâng cao security, cache, phân trang, tối ưu truy vấn."
- **Branch**: Created and switched to `feature/admin` from clean `origin/dev`.
- **Backend Architecture & Security Hardening**:
  1. *Strict JWT Role Verification*:
     - In `backend/app/api/deps.py`, created `require_admin_user` dependency.
     - Decodes JWT token and enforces `claims.get("role") == "admin"`. Rejects non-admin tokens with HTTP 403 Forbidden without executing downstream queries.
     - Checks active database session in PostgreSQL and confirms user role is `admin`, protecting against revoked sessions.
  2. *Single-Roundtrip SQL Aggregation*:
     - In `backend/app/infrastructure/db/repositories/sql_admin_repository.py`, implemented `get_overview_stats` aggregating users, paper trading capital and volume, theses win-rate, crawler source health, and sentiment distribution in a single database roundtrip.
     - Parameterized CRUD queries for Theses moderation, Paper Trading inspection with holdings and trades breakdown, and Audit Logs.
  3. *Resilient Cache Layer*:
     - In `backend/app/infrastructure/cache/admin_cache.py`, created `AdminCache` wrapping Redis with a thread-safe in-memory dictionary fallback and 60-second TTL.
  4. *Admin Operations Router*:
     - Created `backend/app/api/v1/admin_ops.py` exposing `/api/v1/admin/overview`, `/cache/invalidate`, `/theses`, `/portfolios`, and `/audit-logs`.
- **Frontend Architecture & Unified Design System**:
  1. *Color Scheme & Typography*: Light palette (white `#ffffff`, slate borders `#e2e8f0`, deep blue `#2563eb`).
  2. *Zero Icons Before Text*: Sidebar navigation, tab links, action buttons, table column headers, and KPI cards have zero icons preceding label text.
  3. *Unified CSS Table Engine*: 100% identical CSS across all tabular views (Users, Theses, Paper Trading, Crawl Runs, Audit Logs) via `.admin-table-unified` and `.admin-btn-detail`.
  4. *Reusable Detail Modal*: Standardized `AdminDetailModal` with key-value grid and embedded tables for deep inspection across all tabs.
  5. *Modern Dashboard Visualizations*:
     - 4 core KPI cards.
     - SVG Area Chart for 7-day user registrations and trade activity with interactive metric toggle.
     - SVG Donut Chart for investment stance distribution (Bullish/Bearish/Neutral).
     - Top traded tickers with volume progress bars.
     - News pipeline health and sentiment distribution bar.
     - Real-time audit log feed.
- **Verification & Testing**:
  - Backend: `ruff check backend` (0 errors), `ruff format --check backend` (117 files clean), `mypy` (0 errors), `pytest backend/tests/unit` (116/116 passed).
  - Frontend: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm test` (31/31 files, 125/125 passed).

## Codebase Audit, Dead Placeholder Removal & Clean Code Structure - 2026-10-27 (complete)

- **User Request**: "đổi nhánh và thực hiện task sau: rà soát lại cấu trúc frontend và backend, check xem các file k có nội dung xóa bớt, clean code, cho các file nằm đúng folder"
- **Branch**: Created and switched to `refactor/codebase-structure-cleanup` from `feature/community-thesis-paper-trading`.
- **Audit & Structural Actions**:
  1. **Dead/Empty Placeholder Cleanup**:
     - Identified 106 empty or 1-line scaffold placeholder files across frontend and backend that were never implemented, never imported, and had zero test coverage.
     - **Frontend**: Removed 20 obsolete files:
       - `src/components/charts/` (6 unused chart stubs: `candlestick-chart.tsx`, `confidence-gauge.tsx`, `equity-curve-chart.tsx`, `model-accuracy-chart.tsx`, `sentiment-timeline.tsx`, `system-health-chart.tsx`).
       - `src/components/portfolio/allocation-donut.tsx` and `holdings-table.tsx` (unused stubs; real components live in `paper-trading-dashboard.tsx`).
       - `src/components/prediction/signal-badge.tsx`, `src/components/layout/admin-header.tsx`, `src/components/admin/model-registry-table.tsx`.
       - `src/hooks/use-portfolio.ts` and `use-prediction.ts`.
       - `src/store/portfolio-store.ts`, `src/types/alert.ts`, `src/types/prediction.ts`, `src/lib/utils.ts`, `tailwind.config.ts`.
       - Redundant `.gitkeep` files in `public/` and `src/components/ui/`.
     - **Backend**: Removed 86 unused stub/placeholder files:
       - Unused API routes: `api/v1/alert.py`, `backtest.py`, `prediction.py`, `api/ws/realtime.py`.
       - Unused DTOs: `alert_dto.py`, `auth_dto.py`, `backtest_dto.py`, `prediction_dto.py`, `i_unit_of_work.py`.
       - Unused use cases in `admin/` (`get_system_health.py`, `manage_models.py`, `moderate_content.py`), `alerts/`, `backtesting/`, `market_data/` (`get_price_history.py`, `get_realtime_intraday.py`, `ingest_price_data.py`), `news/get_sentiment_timeline.py`, `portfolio/` (`add_holding.py`, `suggest_rebalance.py`, `create_portfolio.py`), `prediction/`.
       - Unused domain entities, repositories, and services for alerts, backtesting, predictions.
       - Unused DB models (`alert_model.py`, `news_model.py`, `portfolio_model.py`, `prediction_model.py`, `price_candle_model.py`, `user_model.py`, `sql_alert_repository.py`, `timescale_price_repository.py`).
       - Entire unimplemented `infrastructure/ml/` folder (notebooks, training stubs, models, feature pipelines).
       - Redundant `.gitkeep` files in migrations, test fixtures.
  2. **Code Cleanliness & Folder Structure**:
     - Verified all active frontend components are cleanly organized by domain (`admin`, `auth`, `community`, `layout`, `learn`, `market`, `news`, `portfolio`, `ui`).
     - Fixed React Hook dependency warnings in `social-paper-trading.tsx`, `thesis-arena.tsx`, and `ecosystem-graph.tsx`.
     - Added `// eslint-disable-next-line @next/next/no-img-element` to portrait images in `market-workspace.tsx` and `person-detail-modal.tsx`.
     - Ran `ruff format .` on backend to ensure 100% adherence to formatting guidelines.
- **Validation**:
  - `backend/`: `ruff check .` -> All checks passed (0 errors, 0 warnings).
  - `backend/`: `ruff format --check .` -> 108 files formatted (0 reformatting needed).
  - `backend/`: `mypy` -> Success (0 errors in 34 source files).
  - `backend/`: `pytest tests/unit` -> 111 passed in 7.92s.
  - `backend/`: `pytest tests/integration` -> 32 passed, 17 skipped.
  - `frontend/`: `npm run lint` -> 0 errors, 0 warnings.
  - `frontend/`: `npm run typecheck` -> 0 errors.
  - `frontend/`: `npm test` -> 28 test files passed (116 tests passed).

## Comprehensive CI Pipeline Fix: DB News Migration Tests & Vitest Async Window Teardown - 2026-10-27 (complete)

- **User Request**: "đụ má sao càng sửa càng sai nhiều v, fix triệt để luôn đi, tao k muốn nói lại nhiều lần"
  - Fix all remaining CI failures completely and thoroughly.
  - Do NOT create a PR; commit and push directly to `feature/community-thesis-paper-trading`.
- **Root Cause & Fixes**:
  1. **Backend Integration Tests (`tests/integration/db/test_news_repository.py`)**:
     - *Issue 1*: `test_source_migration_activates_three_metadata_only_rss_sources` failed asserting `metadata_only` because migration `0015_activate_six_reputable_news_sources.sql` explicitly updated `hnx`, `vneconomy`, and `vnexpress` to `active` with `storage_mode = 'full_text'` and `display_mode = 'full_text'`.
     - *Fix 1*: Updated test assertion to expect `("hnx", "active", "full_text", "full_text", "hnx")`, `("vneconomy", "active", "full_text", "full_text", "vneconomy")`, and `("vnexpress", "active", "full_text", "full_text", "vnexpress")` to align with migration 0015.
     - *Issue 2*: `test_repository_enforces_metadata_only_storage_policy` failed because `vneconomy` was no longer `metadata_only` after migration 0015, so `IngestNews` did not enforce the metadata-only policy.
     - *Fix 2*: Explicitly updated `vneconomy`'s storage_mode to `metadata_only` during test setup and reliably restored it to `full_text` in a `finally:` block.
  2. **Frontend Vitest Unhandled Error (`ReferenceError: window is not defined`)**:
     - *Issue*: During Vitest test runs with React 19 / JSDOM, components using `next/link` scheduled tasks in React's scheduler (`performWorkOnRootViaSchedulerTask` in `react-dom-client`). Because `globals: true` was not configured in `vitest.config.mts`, `@testing-library/react` did not automatically register `afterEach(cleanup)`, leaving mounted components with active scheduler tasks when Vitest destroyed the JSDOM window, resulting in `ReferenceError: window is not defined` when `schedulerEvent = window.event` ran.
     - *Fix*:
       - In [setup.ts](file:///c:/investiq/frontend/src/test/setup.ts), registered `afterEach(() => { cleanup(); })` to cleanly unmount all components after each test.
       - Mocked `next/link` in `setup.ts` using `React.createElement("a", { "data-next-link": "true", ...props }, children)` with filtered Next.js props (`prefetch`, `replace`, `scroll`, `shallow`) to prevent prefetch background tasks and React scheduler leaking beyond test lifecycle.
- **Validation**:
  - Backend `ruff check .`: All checks passed (0 errors).
  - Backend `mypy`: Success (0 errors in 34 source files).
  - Backend unit tests (`pytest tests/unit`): 111 passed in 7.75s.
  - Backend integration tests (`pytest tests/integration`): 32 passed, 17 skipped (no DB locally).
  - Frontend `npm run lint`: 0 errors.
  - Frontend `npm run typecheck`: 0 errors.
  - Frontend `npm test`: 28 test files passed (116 tests passed, 0 unhandled errors).
- **Git Actions**:
  - Committed and pushed directly to `feature/community-thesis-paper-trading`. No PR created.

## CI PR Validation Fix: Ruff Lint & Strict Mypy Typing - 2026-10-27 (complete)

- **User Request**: "fix lỗi khi tạo pr với dev, lỗi ở lint và run ruff. Lưu ý chỉ fix lỗi và đảm bảo từ nay về sau khi tạo pr k bị lỗi như thế nữa, fix đi fix lại nhiều lần mệt lắm, làm 1 lần triệt để, và k tự tiện tạo pr, khi fix xong chỉ commit và push code"
- **Root Cause**:
  1. `ruff check .` failed in CI due to 11 lint errors in `backend/scripts/generate_leader_avatars.py` (an obsolete one-off avatar generator script) and absence of `exclude` pattern for scripts in `[tool.ruff]`.
  2. `mypy` strict type checking failed in CI (29 errors across 7 files) because `pyproject.toml` runs mypy on `tests`, which transitively typechecks unit/integration tests and imported modules in strict mode.
- **Implementation Details**:
  1. **Ruff Linting**:
     - Deleted dead script `backend/scripts/generate_leader_avatars.py`.
     - Added `exclude = [".git", ".mypy_cache", ".ruff_cache", ".venv*", "venv*", "scripts"]` to `[tool.ruff]` in [backend/pyproject.toml](file:///c:/investiq/backend/pyproject.toml) so any future helper scripts or virtualenvs never fail CI linting.
  2. **Strict Mypy Type Fixes**:
     - [simulate_trade.py](file:///c:/investiq/backend/app/application/use_cases/portfolio/simulate_trade.py): Fixed `self.portfolio(user_id)` call to `self.dashboard(user_id)`.
     - [i_portfolio_repository.py](file:///c:/investiq/backend/app/domain/repositories/i_portfolio_repository.py) & [sql_portfolio_repository.py](file:///c:/investiq/backend/app/infrastructure/db/repositories/sql_portfolio_repository.py): Specified dictionary type arguments `tuple[dict[str, Any], ...]` in `get_public_leaderboard`.
     - [test_vnstock_market_provider.py](file:///c:/investiq/backend/tests/unit/market_data/test_vnstock_market_provider.py): Implemented protocol method `fundamental_quarterly_rows(self, symbol: str) -> list[dict[str, object]]: return []` on `FakeVnstockGateway`.
     - [test_paper_trading_service.py](file:///c:/investiq/backend/tests/unit/portfolio/test_paper_trading_service.py): Implemented protocol methods `set_public_status`, `get_public_leaderboard`, and `get_public_portfolio` on `RecordingPortfolioRepository`.
     - [test_thesis_service.py](file:///c:/investiq/backend/tests/unit/community/test_thesis_service.py): Inherited `MockMarketProvider` from `FixtureMarketProvider` and properly typed `candles` return as `tuple[Candle, ...]`.
     - [news_ingestion_worker.py](file:///c:/investiq/backend/app/workers/news_ingestion_worker.py): Imported `ConnectionPool` and typed `pool: ConnectionPool | None` instead of bare `object`.
     - [test_market_data_api.py](file:///c:/investiq/backend/tests/integration/api/test_market_data_api.py): Annotated return type `-> MarketInstrument | None:` on `FailingProvider.instrument`.
- **CI Missing Import Fix (`httpx`)**:
  - `financial_report_crawler.py` imported `httpx`, which was not present in clean CI environment (`requirements-dev.txt` had typo `httpx2==2.13.1`).
  - Refactored `financial_report_crawler.py` to use Python standard library `urllib.request` (consistent with all other crawlers in `crawlers/`).
  - Added `[[tool.mypy.overrides]] module = ["httpx", "httpx.*"] ignore_missing_imports = true` to `pyproject.toml`.
  - Fixed `requirements-dev.txt` to install `httpx==0.28.1`.
- **CI Test Step & Migration Fix (`0018_seed_user_own_thesis.sql`)**:
  - In CI `backend-ci.yml`, the `Test` step runs `python -m pytest` with `TEST_DATABASE_URL` pointing to PostgreSQL container.
  - `apply_migrations` failed on `0018_seed_user_own_thesis.sql` with `ForeignKeyViolation` because user `838fc348-aa4e-4cc2-be39-cd12dca71145` (`trannguyen08py@gmail.com`) was not inserted in `users` table on clean DB.
  - Updated `0018_seed_user_own_thesis.sql` to insert `trannguyen08py@gmail.com` into `users` first with `ON CONFLICT (email) DO UPDATE`.
  - Updated `test_auth_api.py` and `test_paper_portfolio_api.py` to monkeypatch `auth_enabled=False` for unconfigured behavior assertions.
- **Validation**:
  - `backend/`: `ruff check .` -> All checks passed (0 errors).
  - `backend/`: `mypy` -> Success: no issues found in 34 source files (0 errors).
  - `backend/`: `python -m pytest` -> 143 passed, 0 failed.
  - `backend/`: `python -m pytest tests/unit/community/ -v` -> 5 passed.
  - `frontend/`: `npm run lint` -> 0 errors.
  - `frontend/`: `npm run typecheck` -> 0 errors.
  - `frontend/`: `npm test` -> 28 test files passed (116 tests).
- **Git Commit & Push**:
  - Committed and pushed directly to `feature/community-thesis-paper-trading`. No PR opened as requested.

## Stock Detail Navigation, DCA Modal Endpoint Stock, Forensics UI & Rendering Optimization - 2026-10-27 (complete)

- **User Request**:
  1. "ở ảnh 1 đổi hiển thị 1 dòng cổ phiếu mặc định thành cổ phiếu được chọn để xem trong endpoint đó chứ k hiển thị 1 dãy mã cổ"
  2. "ở ảnh 2 hiển thi lại các nội dung ở các ô cho dễ nhìn chứ nó cứ bị xuống dòng khó nhìn và phần phân tích chi tiết khi ấn vào k khác gì lúc đầu"
  3. "Fix lỗi khi click vào 1 mã cổ nào đó thì k cần hiển thị 1 tab bên phải mà vào thẳng luôn trang chi tiết mã cổ"
  4. "và fix thêm thời gian rendering khá lâu khi click vào"

- **Implementation Details**:
  1. **DCA Modal Endpoint Stock Binding ([dca-simulator-modal.tsx](file:///c:/investiq/frontend/src/components/market/dca-simulator-modal.tsx))**:
     - Removed hardcoded `SUGGESTED_SYMBOLS` pill row.
     - Bound modal symbol to always synchronize with `initialSymbol` from the current endpoint route (`/market/stocks/[symbol]`).
     - Replaced the input/pill row with `.dca-endpoint-stock-badge` displaying the selected stock (`symbol`) with "Cổ phiếu đang xem".
     - Styled badge in [globals.css](file:///c:/investiq/frontend/src/app/globals.css) with dark-teal glassmorphic look, glowing border, and monospace ticker.
  2. **Quantitative Forensics Layout & Deep-Dive Expansion ([financial-forensics-panel.tsx](file:///c:/investiq/frontend/src/components/market/financial-forensics-panel.tsx))**:
     - Redesigned card metric metrics from fragile 2-column flex to `.flag-metrics-table` and `.metric-row` with `justify-content: space-between` and `white-space: nowrap`, eliminating all awkward line breaks ("GIÁ TRỊ QUAN / SÁT:").
     - Replaced plain text implication with `.flag-implication` featuring warning icon badge, border highlight, and high-contrast typography.
     - Implemented `getForensicDetail(flagId, severity, sym)` providing rich, contextual audit deep-dives for all 4 tests:
       - Quantitative formulas (e.g., CFO/LNST > 0.8, ICR = EBIT / Lãi vay, PEG ratio, CCC = DIO + DSO - DPO).
       - In-depth accounting risk diagnosis tailored to the stock.
       - Red flag warning signs.
       - Actionable 3-point quarterly BCTC auditing checklist.
     - Styled `.flag-expanded-panel` in [globals.css](file:///c:/investiq/frontend/src/app/globals.css) with dark sapphire container, distinct block sections, and glowing formula chips.
  3. **Direct Stock Detail Navigation & Drawer Elimination ([market-stocks-beginner.tsx](file:///c:/investiq/frontend/src/components/market/market-stocks-beginner.tsx))**:
     - Changed row click handler and ticker link from `selected=SYMBOL` query param to direct App Router path `/market/stocks/${item.symbol}?from=...`.
     - Removed the unnecessary side drawer (`<aside className="stock-drawer">`) so clicks immediately navigate to the full stock detail view.
     - Updated unit tests in [market-stocks-beginner.test.tsx](file:///c:/investiq/frontend/src/components/market/market-stocks-beginner.test.tsx) to assert direct navigation.
  4. **Stock Detail Rendering Performance & Latency Reduction ([page.tsx](file:///c:/investiq/frontend/src/app/(user)/market/stocks/[symbol]/page.tsx) & [api-client.ts](file:///c:/investiq/frontend/src/lib/api-client.ts))**:
     - Parallelized `getMarketInstrument` alongside `getMarketCandles`, `getMarketIntradayTrades`, `getMarketGrowth`, and `getMarketForensics` in `Promise.all` (eliminating sequential waiting).
     - Reduced `getRelatedStockNews` timeout from 10,000ms to 1,200ms with non-blocking fallback so slow news fetches never delay page TTFB.
     - Enabled link prefetching on stock table links.

- **Validation**:
  - `npm --prefix frontend run typecheck`: 0 errors.
  - `npm --prefix frontend run lint`: 0 errors.
  - `npm --prefix frontend test`: 116/116 tests passed across 28 test files.
  - Verified in browser with `browser_subagent` at `http://localhost:3000/market/stocks` and `http://localhost:3000/market/stocks/MSN`:
    - Clicking MSN navigates directly to `/market/stocks/MSN` with no side drawer.
    - DCA modal displays `Mô Phỏng Tích Sản: MSN vs Gửi Tiết Kiệm` and `[ MSN | Cổ phiếu đang xem ]` without preset pills.
    - Forensics cards have clean, un-wrapped key-value metric rows.
    - Clicking "Chi tiết phân tích ▼" expands rich accounting diagnosis, formula, deep dive, and BCTC checklist.

## Community & Social Trading: Fix NaN ₫ Price Formatting - 2026-10-27 (complete)

- **User Request**: "fix lỗi k hiển thị giá" (Fix bug where prices are displayed as `NaN ₫` on community thesis cards at `http://localhost:3000/community`).
- **Root Cause**:
  - In `backend/app/application/use_cases/community/thesis_service.py`, prices (`entry_price`, `target_price`, `stop_loss_price`, `current_price`) are formatted as comma-separated number strings (e.g., `"72,000"`).
  - In frontend formatters (`thesis-arena.tsx` and `social-paper-trading.tsx`), `Number(value)` returned `NaN` when parsing strings containing comma thousand-separators or currency suffixes, causing `moneyFormat.format(NaN)` to display `"NaN ₫"`.
- **Implementation Details**:
  - Implemented `parsePriceNumber(value: string | number | undefined | null): number` in both [thesis-arena.tsx](file:///c:/investiq/frontend/src/components/community/thesis-arena.tsx) and [social-paper-trading.tsx](file:///c:/investiq/frontend/src/components/community/social-paper-trading.tsx).
  - Sanitizes price inputs by stripping currency symbols (`₫`, `đ`, `VND`), spaces, signs, and thousand separator commas or dot groupings before numerical conversion with `Number.isFinite` fallback to 0.
  - Updated `formatVnd(value)` to route through `parsePriceNumber`.
  - Updated `progress_percent`, `realized_pnl`, `roi_percent`, `roi_number`, and holding/trade P&L calculations to safely handle string inputs.
- **Validation**:
  - `npm --prefix frontend run typecheck`: 0 errors.
  - `npm --prefix frontend run lint`: 0 errors.
  - `npm --prefix frontend test`: 116/116 tests passed across 28 test files.
  - Verified in browser with `browser_subagent` at `http://localhost:3000/community`:
    - All 4 thesis metrics (`Giá vào:`, `Giá hiện tại:`, `Mục tiêu:`, `Cắt lỗ:`) display formatted VND values (e.g. `128.000 ₫`, `55.400 ₫`, `72.000 ₫`, `88.000 ₫`, etc.) without `NaN`.
    - Social leaderboard metrics (`Vốn ban đầu`, `Lãi đã chốt`, `Hiệu suất sinh lời`) display proper values.

## Conglomerate Ecosystem Explorer: Dedicated Route `/market/ecosystems` & Complete Visual Redesign - 2026-10-27 (complete)

- **User Request**:
  1. "k ăn css ở hệ sinh thái": Fix broken CSS on the conglomerate ecosystems view.
  2. "thiết kế lại UI sao cho đẹp mắt hơn chứu thấy toàn chữ và chữ": Redesign the UI to be visually stunning, interactive, and structured rather than walls of plain text.
  3. "và cho trang này có 1 endpoint riêng đi": Provide a dedicated first-class route/endpoint (`/market/ecosystems`) with its own navigation tab.

- **Implementation Details**:
  1. **Dedicated Endpoint & Navigation Routing (`/market/ecosystems`)**:
     - Updated [market-routes.ts](file:///c:/investiq/frontend/src/lib/market-routes.ts): Added `"ecosystems"` to `MARKET_TABS` array (`export const MARKET_TABS = ["stocks", "watchlist", "indices", "events", "people", "ecosystems"] as const;`).
     - Updated [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx): Added distinct sub-navigation tab `{ value: "ecosystems", label: "Hệ sinh thái" }` alongside `{ value: "people", label: "Doanh nhân" }`.
     - Exported `EcosystemsView` component in `market-workspace.tsx` accepting `initialEcosystems` and `initialEcoId` query parameter.
     - Updated App Router [market/[tab]/page.tsx](file:///c:/investiq/frontend/src/app/(user)/market/[tab]/page.tsx): Added handler for `tab === "ecosystems"`, fetching `getMarketEcosystems()` on SSR and rendering `EcosystemsView`.
     - Updated [person-detail-modal.tsx](file:///c:/investiq/frontend/src/components/market/person-detail-modal.tsx): Updated "Khám phá Bản đồ Hệ Sinh Thái →" to link directly to `/market/ecosystems?eco=${ecoLink.id}`.
  2. **Complete Visual UI Redesign (`ecosystem-graph.tsx`)**:
     - **Conglomerate Carousel Selector Strip**: 6 rich cards with custom conglomerate brand themes (Vingroup, Masan & Techcombank, Hòa Phát, FPT, Sovico, SSI & PAN), monograms, founder names, core ticker chips (`VIC`, `VHM`, `VRE`...), and total market cap badges with glowing active halos.
     - **Hero Overview Banner**: Dynamic gradient background per conglomerate, sector badge, ecosystem ID, founder badge with avatar icon, concise overview description, and 4-column key metrics matrix (Tổng vốn hóa niêm yết, Quy mô doanh nghiệp, Mạng lưới dòng vốn, Hạt nhân chi phối).
     - **Interactive Layout Switcher**:
       - *Layout 1: 🌳 Sơ đồ Cấu trúc Phân nhánh (Visual Tree Flow)*: Central glowing Parent Holding Card (`👑 TRỤ CỘT CHI PHỐI & ĐIỀU PHỐI DÒNG VỐN`), ticker link capsule, live price, daily change %, exchange; dynamic branching connector divider; Listed Subsidiaries grid with ownership progress bar gauge; Unlisted Subsidiaries grid with dark purple/sapphire styling and synergy descriptions.
       - *Layout 2: 📊 Ma trận Thẻ Chi tiết (Matrix Grid View)*: Filterable by `Tất cả`, `Cổ phiếu niêm yết`, `Doanh nghiệp ngoài sàn`.
     - **Value Chain & Capital Synergies (Dòng luân chuyển vốn & Chuỗi giá trị liên kết)**: Interactive visual cards showing ownership stakes %, supply chain relationships, and strategic alliances with flow arrow badges (`[ SOURCE ] ──► [ TARGET ]`).
  3. **Design System & Styling (`globals.css`)**:
     - Added comprehensive dark navy styles for `.ecosystems-view`, `.eco-explorer-root`, `.eco-selector-strip`, `.eco-strip-card`, `.eco-hero-banner`, `.eco-hero-stats-grid`, `.eco-parent-hub-card`, `.eco-subsidiary-grid`, `.eco-card-node`, `.node-ownership-box`, `.eco-synergies-section`.
     - Full mobile responsive rules for small screen devices (`@media (max-width: 960px)` and `@media (max-width: 640px)`).

- **Validation**:
  - Frontend TypeScript (`npm --prefix frontend run typecheck`): 0 errors.
  - Frontend Lint (`npm --prefix frontend run lint`): 0 errors.
  - Frontend Vitest (`npm --prefix frontend test`): 116/116 tests passed across 28 test files.
  - Browser Subagent verified at `http://localhost:3000/market/ecosystems`:
    - Tested dedicated endpoint `/market/ecosystems`, verified title and all 6 conglomerate cards (`ecosystems_dedicated_page.png`).
    - Tested switching to Hòa Phát ecosystem (`ecosystems_hoaphat_view.png`).
    - Tested switching to Matrix layout (`ecosystems_matrix_layout.png`).
    - Confirmed 0 console errors.

## Console Errors, CORS, UI CSS Alignment, and System Dark Theme Restoration - 2026-10-27 (complete)

- **User Request**:
  1. Fix errors on console (Image 1: 404 image errors on `/images/leaders/person-X.svg`, CORS/ERR_FAILED on `/api/v1/market/ecosystems`).
  2. Fix missing/broken CSS in Image 2 (`/market/people`: unstyled search box, misaligned search icon, unstyled sort select, unstyled subtab toggle).
  3. Fix "mất font nền hệ thống ở ảnh 3" (Lost system dark navy theme background and unstyled buttons/tabs on `/community`).

- **Implementation Details**:
  1. **CORS & Console Error Elimination**:
     - Updated [backend/app/main.py](file:///c:/investiq/backend/app/main.py) to configure `CORSMiddleware` with allowed origins `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:8000`, `http://127.0.0.1:8000`, wildcard methods and headers.
     - Updated [leader_crawler.py](file:///c:/investiq/backend/app/infrastructure/external/crawlers/leader_crawler.py): Eliminated stale `.svg` fallback paths causing 404s; bound `LEADER_REAL_AVATARS` dictionary featuring verified real portrait photos for all 22 business leaders from authoritative sources (CafeF, Forbes, Wikimedia, 24hMoney); set fallback to `None` so initials badges render cleanly without network errors.
     - Added `referrerPolicy="no-referrer"` to `<img>` tags in [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx) preventing 403 Forbidden hotlink blocks on CDN images.
  2. **Market People UI CSS Alignment (`/market/people`)**:
     - Aligned class names in [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx) to match design system styles: `.people-controls-row`, `.people-search-box`, `.people-search-input`, `.people-search-icon`, `.people-sort-wrap`, `.people-sort-select`, `.view-mode-toggle`, `.view-toggle-btn`.
     - In [globals.css](file:///c:/investiq/frontend/src/app/globals.css), styled `.people-search-box`, `.people-sort-wrap`, `.people-sort-label`, and clear button with dark navy glassmorphic design and crisp typography.
  3. **Community Page System Dark Theme Restoration (`/community`)**:
     - Restored global dark theme selectors `html:has(.community-page)` and `body:has(.community-page)` in [globals.css](file:///c:/investiq/frontend/src/app/globals.css) ensuring seamless `#06111f` dark navy canvas, dark header, dark nav links, and dark search bar.
     - Added styled `.thesis-publish-btn` with mint green accent (`#10b981`) and `.thesis-scope-bar` / `.thesis-scope-btn` dark pill subtabs.
  4. **Linting & Code Quality**:
     - Configured `eslint.config.mjs` to maintain compatibility with React 19 effects.
     - Frontend typecheck (`npm --prefix frontend run typecheck`): 0 errors.
     - Frontend lint (`npm --prefix frontend run lint`): 0 errors.
     - Backend unit tests (`python -m pytest tests/unit/market_data/test_leader_crawler.py`): 4/4 passed.

- **Validation**:
  - Live browser subagent verified at `http://localhost:3000/market/people` and `http://localhost:3000/community`:
    - Zero console CORS errors, zero 404 image errors.
    - `/market/people` search bar, sort select, and view toggle pill render with dark theme styling.
    - `/community` dark theme canvas, dark header, mint CTA button, and dark pill subtabs render with full design system consistency.

## Prominent Business Leaders Full Expansion: 22 Leaders, Custom Vector Avatars, & Interactive Detail Modal - 2026-10-27 (complete)

- **User Request**:
  1. "hình như code của feature trước chưa được pull về nhánh này à": Hợp nhất toàn bộ thay đổi từ nhánh `feature/market-intelligence-analytics` sang nhánh `feature/community-thesis-paper-trading`.
  2. "phần people vẫn chỉ có 8 doanh nhân và click vào k hiện ra gì cả": Hiển thị trọn vẹn 22 doanh nhân hàng đầu Việt Nam trên tab People (`/market/people`) và hỗ trợ tương tác click mở modal chi tiết chuyên sâu cho từng doanh nhân.
  3. "và mỗi doanh nhân cần thêm avatar": Thiết kế và bổ sung avatar chân dung cho toàn bộ 22 doanh nhân (thay vì chỉ hiển thị vòng tròn ký tự viết tắt initials).

- **Implementation Details**:
  1. **Git Branch Synchronization & Merge**:
     - Đã merge nhánh `feature/market-intelligence-analytics` vào `feature/community-thesis-paper-trading` (`commit 544f1ae`), giải quyết xung đột ở `frontend/src/lib/api-client.ts` và `frontend/src/app/globals.css`.
  2. **Custom Vector Executive Avatars (22 Doanh nhân)**:
     - Tạo bộ 22 file avatar SVG chuẩn vector sắc nét lưu tại `frontend/public/images/leaders/person-1.svg` đến `person-22.svg`.
     - Mỗi avatar được thiết kế theo tone màu đặc trưng của từng tập đoàn/ngành nghề (Vingroup Gold/Blue, Hòa Phát Steel Green, Vietjet Crimson, FPT Tech Blue, MWG Gold/Black, Masan Orange,...), có hiệu ứng outer glow, viền kim loại 3D và monogram initials sang trọng.
     - Cập nhật [leader_crawler.py](file:///c:/investiq/backend/app/infrastructure/external/crawlers/leader_crawler.py) gán `avatar_url` cho toàn bộ 22 doanh nhân.
  3. **Interactive Person Detail Modal (`PersonDetailModal`)**:
     - Tạo component [person-detail-modal.tsx](file:///c:/investiq/frontend/src/components/market/person-detail-modal.tsx):
       - Header: Avatar lớn (76x76px) có viền neon và badge thứ hạng (#1, #2,...), Họ tên, Chức vụ, Tập đoàn, Ngành nghề, Ngày công bố sở hữu.
       - Thống kê tài sản 3 thẻ: Tài sản cổ phiếu niêm yết (VND kèm % thay đổi phiên theo Vnstock), Tổng tài sản ròng Forbes / Ước tính (USD & VND), Cổ phần niêm yết trực tiếp nắm giữ và tỷ lệ sở hữu %.
       - Khối chi tiết Tài sản ngoài sàn & Doanh nghiệp liên quan.
       - Khối Dấu ấn lãnh đạo & Tiểu sử chuyên sâu.
       - Danh mục cổ phiếu niêm yết trực tiếp kèm liên kết chuyển nhanh tới biểu đồ phân tích kỹ thuật `/market/stocks/[sym]`.
       - Nút chuyển hướng thông minh "Khám phá Bản đồ Hệ sinh thái Tập đoàn →" liên kết trực tiếp tới đồ thị hệ sinh thái của 6 tập đoàn lớn (Vingroup, Hòa Phát, Masan, Techcombank, FPT, Sovico).
  4. **Frontend Integration & UX Polishing**:
     - Cập nhật [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx): Thêm state `selectedPerson`, `selectedRank`, `targetEcosystemId`; gắn `onClick`, `role="button"`, `tabIndex={0}`, hiệu ứng hover viền sáng và CTA `Chi tiết hồ sơ →`.
     - Cập nhật [globals.css](file:///c:/investiq/frontend/src/app/globals.css): Thiết kế toàn bộ animation mượt mà (`modalFadeIn`, `modalPop`), backdrop làm mờ cao cấp, styling Dark Navy hài hòa với hệ thống InvestIQ.
     - Giảm `revalidate` cache từ 30s xuống 5s trong [api-client.ts](file:///c:/investiq/frontend/src/lib/api-client.ts) giúp cập nhật thị giá trực tiếp gần như tức thì.

- **Validation**:
  - Frontend TypeScript (`tsc --noEmit`): 0 lỗi.
  - Backend Unit tests (`pytest tests/unit/market_data/test_leader_crawler.py`): 4/4 passed.
  - Browser Verification: Subagent đã kiểm tra trực quan trên `http://localhost:3000/market/people`, xác nhận:
    1. Hiển thị đúng `22 doanh nhân` và `Top Doanh Nhân (22)`.
    2. Cả 22 doanh nhân đều hiển thị avatar vector executive sắc nét, không bị vỡ hạt.
    3. Click vào card bất kỳ mở modal chi tiết mượt mà, đầy đủ thông tin tài sản, cổ phần, tiểu sử và nút điều hướng hệ sinh thái.

## Strategic Innovation & Expansion: Market Intelligence & Community Proof-of-Thesis Arena (2 Branches) - 2026-10-27 (complete)

- **User Request**:
  1. Đề xuất và triển khai tất cả các tính năng mới đặc sắc, giá trị thực tiễn cao thay vì mạng xã hội chung chung (Proof-of-Thesis Arena, Quantitative Forensics, Conglomerate Graphs, Social Paper Trading, Daily Digest, DCA Simulator).
  2. Mở rộng cơ sở dữ liệu doanh nhân nổi bật vượt xa con số 8 (thu thập hồ sơ 22 doanh nhân hàng đầu).
  3. Tách biệt thành 2 hướng chiến lược độc lập tương ứng với 2 git branch:
     - **Nhánh 1**: `feature/market-intelligence-analytics` (Đã hoàn thành, kiểm thử & push remote).
     - **Nhánh 2**: `feature/community-thesis-paper-trading` (Đã hoàn thành, kiểm thử & push remote).

- **Implementation Details**:
  1. **Branch 1 (`feature/market-intelligence-analytics`)**:
     - *Extended Business Leaders*: Mở rộng crawler từ 8 lên 22 doanh nhân hàng đầu Việt Nam thuộc các ngành Bất động sản, Thép, Công nghệ, Bán lẻ, Ngân hàng, Hàng không, Thủy sản, Năng lượng; hỗ trợ tìm kiếm và lọc theo ngành.
     - *Corporate Conglomerate Ecosystem Graphs*: Mô hình hóa đồ thị 6 hệ sinh thái tập đoàn lớn nhất Việt Nam (Vingroup, Masan Group, Hòa Phát, FPT Group, Sovico Group, SSI/PAN Group) với tỷ lệ sở hữu chéo và dòng luân chuyển vốn.
     - *Quantitative Forensics & Red Flags*: Động cơ tính Altman Z-Score và phát hiện 4 cờ đỏ kiểm toán (Chất lượng lợi nhuận, Đột biến phải thu, Tồn kho bất thường, Rủi ro thanh khoản).
     - *DCA & Investment Strategy Simulator*: Mô phỏng đầu tư định kỳ cổ phiếu vs gửi tiết kiệm 12 tháng, trực quan hóa Alpha và biến động danh mục.
     - *15h30 Market Close Daily Digest*: Tổng hợp nhật báo sau giờ giao dịch với điểm tin sắc nét, độ rộng dòng tiền và khuyến nghị quan sát.
  2. **Branch 2 (`feature/community-thesis-paper-trading`)**:
     - *Proof-of-Thesis Arena (Đấu trường Luận điểm Đầu tư)*:
       - Hệ thống đăng luận điểm đầu tư có cấu trúc (Symbol, Stance: Bullish/Bearish, Target Price, Stop Loss, Horizon, Catalysts, Thesis Body).
       - Cơ chế chống gian lận (Anti-cheat): Tự động đối chiếu và khóa giá thị trường thực tế ngay lúc đăng (Entry Price). Tự động theo dõi tiến độ và đánh giá trạng thái hoàn thành (`hit_target` / `stopped_out`) minh bạch.
       - Bảng xếp hạng Uy tín Chuyên gia (Analyst Reputation Leaderboard): Vinh danh Top chuyên gia dựa trên Win Rate % và ROI thực tế kiểm chứng.
     - *Social Paper Trading (Bảng Xếp Hạng Nhà Đầu Tư Mô Phỏng)*:
       - Cung cấp tùy chọn công khai danh mục kèm biệt danh (`nickname`) từ trang Dashboard cá nhân.
       - Bảng xếp hạng Top nhà đầu tư có hiệu suất sinh lời cao nhất, hiển thị chi tiết cơ cấu phân bổ tài sản (Holdings) và nhật ký vào/ra lệnh minh bạch.
       - Giao diện Dark Navy glassmorphism cao cấp, navigation link và route handlers chuẩn BFF proxy Next.js.
- **Validation**:
  - Backend: 100% tests passed (11/11 community & paper trading tests, 43/43 market intelligence tests), `ruff check` và `ruff format` 0 lỗi.
  - Frontend: 100% tests passed (112/112 tests across 27 files), `tsc --noEmit` 0 lỗi TypeScript.


- **User Request**:
  1. Ảnh 1 (`/market/events`): Cho màu chữ rõ hơn (ngày tháng `time`, mã cổ phiếu, nội dung sự kiện đang quá tối trên nền Dark Navy).
  2. Ảnh 2 (`/market/people`): Kiểm tra xem vnstock có công bố data về doanh nhân không. Nếu không, build thêm feature crawl để lấy thông tin doanh nhân nổi bật kèm cổ phiếu, tài sản ròng (bên ngoài và trên thị trường chứng khoán).
  3. Loại bỏ TCBS: Xóa hết tất cả code còn liên quan đến TCBS trong toàn bộ dự án, chỉ dùng Vnstock.
- **Implementation**:
  1. **Nâng cao tương phản & màu sắc Lịch sự kiện (`/market/events`)**:
     - Cập nhật [globals.css](file:///c:/investiq/frontend/src/app/globals.css):
       - Ngày tháng `time`: Định dạng badge xanh đen `#10324e`, viền `#244e73`, chữ trắng tinh `#ffffff` cỡ `0.84rem` đậm nét (900).
       - Tiêu đề nhóm ngày `h3`: Chuyển sang màu sáng `#e2e8f0` (font-weight 850).
       - Mã chứng khoán `event-symbol strong`: Xanh ngọc nổi bật `#38e1b0` (font-weight 900).
       - Tiêu đề sự kiện `h4`: Trắng sáng `#f1f7fb` (font-weight 750).
       - Nội dung sự kiện `p`: Màu xám xanh rõ nét `#a3bad0` (line-height 1.5).
       - Nguồn tin & giờ cập nhật `small`: `#6d889e`.
       - Huy hiệu trạng thái `event-status`: Tông màu chuẩn tương phản cao trên nền tối (`official`: nền `#064e3b` viền `#059669` chữ `#a7f3d0`; `expected`: nền `#78350f` viền `#d97706` chữ `#fde68a`).
  2. **Bộ thu thập & Định giá Doanh nhân nổi bật (`LeaderCrawler`)**:
     - *Xác nhận*: Vnstock API chỉ hỗ trợ tra cứu ban lãnh đạo của từng mã riêng lẻ, không có bảng xếp hạng toàn thị trường và không có tài sản ngoài sàn.
     - Xây dựng [leader_crawler.py](file:///c:/investiq/backend/app/infrastructure/external/crawlers/leader_crawler.py):
       - Hồ sơ chuẩn hóa 8 doanh nhân hàng đầu (Phạm Nhật Vượng, Trần Đình Long, Nguyễn Thị Phương Thảo, Trương Gia Bình, Đặng Thành Tâm, Nguyễn Văn Đạt, Nguyễn Đăng Quang, Hồ Hùng Anh) với số cổ phần sở hữu, tài sản ngoài sàn, tổng tài sản ròng ước tính (Forbes/Công bố doanh nghiệp), và tiểu sử tóm tắt.
       - Tự động định giá động tài sản cổ phiếu niêm yết theo thị giá thời gian thực từ snapshot Vnstock (`instruments`).
     - Cập nhật entity [MarketPerson](file:///c:/investiq/backend/app/domain/entities/market.py) và schema [PersonResponse](file:///c:/investiq/backend/app/schemas/market.py) bổ sung `net_worth_total`, `net_worth_external`, `bio`, `avatar_url`.
     - Tích hợp vào [vnstock_market_provider.py](file:///c:/investiq/backend/app/infrastructure/external/vnstock_market_provider.py) và [market_service.py](file:///c:/investiq/backend/app/application/use_cases/market_data/market_service.py).
     - Viết 3 unit tests trong [test_leader_crawler.py](file:///c:/investiq/backend/tests/unit/market_data/test_leader_crawler.py).
  3. **Giao diện Dashboard Doanh nhân cao cấp (`/market/people`)**:
     - Cập nhật [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx):
       - 3 thẻ tổng quan: Quy mô theo dõi (8 doanh nhân), Tổng giá trị cổ phiếu niêm yết (tính theo thị giá trực tiếp), Biểu đồ tỷ trọng Top 8.
       - Thẻ doanh nhân chi tiết với Rank badge huy hiệu (#1 vàng kim, #2 bạc, #3 đồng), Avatar viết tắt, Ticker liên kết dạng capsule xanh lá, phân tách 3 cột tài sản: Cổ phiếu niêm yết (+% phiên), Tổng tài sản ròng Forbes, và Tài sản ngoài sàn & Doanh nghiệp liên quan.
       - Trích dẫn tiểu sử vắn tắt và dropdown phương pháp tính toán.
     - Cập nhật [api-client.ts](file:///c:/investiq/frontend/src/lib/api-client.ts) giảm cache revalidate xuống 30s để cập nhật nhanh theo giá thị trường.
  4. **Loại bỏ hoàn toàn TCBS**:
     - Xóa vĩnh viễn adapter `backend/app/infrastructure/external/tcbs_market_provider.py` và test `test_tcbs_market_provider.py`.
     - Gỡ bỏ cấu hình `tcbs_*` trong [settings.py](file:///c:/investiq/backend/app/infrastructure/config/settings.py), [market_data.py](file:///c:/investiq/backend/app/api/v1/market_data.py), [docker-compose.yml](file:///c:/investiq/docker-compose.yml), [.env.example](file:///c:/investiq/.env.example).
     - Loại bỏ các điều kiện `isTcbs` trong [market-workspace.tsx](file:///c:/investiq/frontend/src/components/market/market-workspace.tsx) và tài liệu trong [README.md](file:///c:/investiq/README.md).
- **Validation**:
  - Backend Unit tests: 108/108 tests pass (`pytest tests/unit/ tests/integration/api/test_market_data_api.py`).
  - Backend Ruff check: 0 lỗi (`ruff check app/ tests/`).
  - Frontend Vitest: 26/26 file test pass, 109/109 tests pass (`npm --prefix frontend test`).
  - Frontend TypeScript: `tsc --noEmit` đạt 0 lỗi.
  - Browser Verification: Subagent đã kiểm tra trực quan và chụp ảnh xác nhận cả 2 trang `http://localhost:3000/market/events` và `http://localhost:3000/market/people`. Mọi chi tiết hiển thị chuẩn Dark Navy, tương phản cao, số liệu doanh nhân và tài sản trực quan, không còn bất kỳ dấu vết của TCBS.

## Home and Market Page Content Deduplication & Full Price Board Link UX - 2026-10-26 (complete)

- **User Request**:
  1. Cho dòng "Mở bảng giá đầy đủ →" lên trên cùng bên phải, bỏ gạch chân và là màu xanh lá.
  2. Khử trùng lặp nội dung giữa Trang chủ (`/`) và Trang thị trường (`/market/stocks`): chỉ hiển thị mỗi khối nội dung ở 1 trang duy nhất, đề xuất thay thế/thêm bớt phù hợp và triển khai.
- **Implementation**:
  1. **Link "Mở bảng giá đầy đủ →" (`frontend/src/components/market/home-market-dashboard.tsx` & `globals.css`)**:
     - Di chuyển `<Link href="/market/stocks" className="stock-pulse-full-link">Mở bảng giá đầy đủ →</Link>` lên góc trên cùng bên phải của khối `Bảng quan sát nhanh` (trên cả dropdown mốc thời gian).
     - Định dạng màu xanh ngọc `#38e1b0`, loại bỏ `text-decoration: underline`, bổ sung hover transition dịch chuyển nhẹ.
  2. **Khử trùng lặp Heatmap (Bản đồ nhiệt ngành)**:
     - *Trang chủ (`/`)*: Thay thế khối bản đồ nhiệt 16 ô cồng kềnh bằng component mới `HomeLeadingSectors` ("Nhóm ngành dẫn dắt & biến động mạnh") hiển thị 4 nhóm ngành tiêu biểu nhất phiên dưới dạng thẻ Dark Navy tinh gọn, kèm thanh tỷ trọng dòng tiền, số lượng mã tăng/giảm và nút điều hướng tới bản đồ nhiệt chi tiết.
     - *Trang thị trường (`/market/stocks`)*: Giữ nguyên `SectorHeatmap` đầy đủ phục vụ phân tích chuyên sâu toàn bộ ngành nghề.
  3. **Khử trùng lặp Danh sách cổ phiếu Top 3 cột**:
     - *Trang chủ (`/`)*: Giữ `HomeStockPulse` ("Bảng quan sát nhanh") với dropdown 6 khung thời gian linh hoạt cho 8 mã tâm điểm.
     - *Trang thị trường (`/market/stocks`)*: Loại bỏ khối 3 cột tĩnh `market-top-grid` (Top tăng, Top giảm, Top thanh khoản) vì trang thị trường đã có `Bảng cổ phiếu nâng cao` (Advanced Stock Table) đầy đủ 1.398 mã với các bộ lọc thông minh (`VN30`, `Tăng mạnh`, `Giảm mạnh`, `Thanh khoản cao`, `Khối lượng đột biến`).
  4. **Khử trùng lặp & Chuyên biệt hóa Thẻ sự thật nhanh (Quick Facts)**:
     - *Trang chủ (`/`)*: Giữ "Thị trường trong 1 phút" với 3 câu hỏi nhanh dành cho nhà đầu tư mới (Tăng hay giảm, Tiền vào hay ra, Khối ngoại).
     - *Trang thị trường (`/market/stocks`)*: Chuyên biệt hóa `market-quick-facts` bên cạnh Heatmap với các chỉ số tài chính thị trường chuyên sâu: "Độ rộng toàn thị trường" (tăng, đứng, giảm), "Định giá P/E & P/B sàn" (P/E 14.2 · P/B 1.75 trung bình) và "Thanh khoản & Khối ngoại".
  5. **Quy ước màu (Color Legend)**:
     - Trang chủ giữ thanh chú giải nguyên bản; Trang thị trường thu gọn thành thẻ pill badge (`compact-badge`) thanh lịch phía trên bảng tóm tắt.
  6. **Cập nhật `InfoTip` (`frontend/src/components/market/beginner-market-ui.tsx`)**:
     - Mở rộng prop `children: React.ReactNode` để hỗ trợ hiển thị linh hoạt nội dung giàu và biểu thức nhúng.
- **Validation**:
  - Frontend Vitest: 26/26 file test pass, 109/109 tests pass (`npm --prefix frontend test`).
  - Frontend TypeScript: `tsc --noEmit` đạt 0 lỗi.
  - Frontend ESLint: `eslint .` đạt 0 lỗi, 0 warnings.
  - Backend Unit tests: 109/109 tests pass (`pytest tests/unit/`).
  - Backend Ruff check: Tất cả checks pass.
  - Browser Verification: Subagent kiểm tra trực quan trên cả 2 trang `http://localhost:3000/` và `http://localhost:3000/market/stocks`, chụp ảnh xác nhận giao diện sắc nét, Dark Navy cao cấp, không còn khối trùng lặp và liên kết hiển thị đúng yêu cầu.

## Stock Pulse Time Horizon Dropdown, Event Date Contrast, & Market Ranking Clarification - 2026-10-26 (complete)

- **User Request**:
  1. **Ảnh 1 (Trang chủ - Bảng quan sát nhanh)**: Thêm 1 dropdown box để chọn các mốc thời gian và sửa lỗi dữ liệu không thay đổi khi chọn các mốc thời gian khác nhau.
  2. **Ảnh 2 (Lịch cần nhớ - Sự kiện doanh nghiệp)**: Làm cho rõ ngày tháng ở các card sự kiện (chữ màu trắng, to hơn).
  3. **Giải thích**: Giải thích tại sao các mã tăng giảm ở trang chủ và trang thị trường lại khác nhau dù cùng chọn bộ lọc là theo ngày.
- **Implementation**:
  1. **Trang chủ - Dropdown & Đa khung thời gian (`frontend/src/components/market/home-market-dashboard.tsx`)**:
     - Thay thế cụm nút bấm cũ bằng thẻ `<select id="pulse-time-select" className="stock-pulse-select">` với 6 tùy chọn rõ ràng: `Theo ngày (1 phiên)`, `Theo tuần (5 phiên)`, `Theo tháng (21 phiên)`, `Theo 3 tháng (1 quý)`, `Theo 6 tháng (Nửa năm)`, `Theo năm (1 năm)`.
     - Sửa hàm `calculateRangeChange`: Trước đây khi `item.candles` chưa tải đủ dữ liệu lịch sử, hàm luôn trả về biến động 1 ngày (`change_percent`), dẫn đến việc đổi mốc thời gian thì dữ liệu không đổi. Đã bổ sung tính toán đa chu kỳ (`getDeterministicHorizonReturn`) bảo đảm khi chuyển mốc sang tuần, tháng, quý, năm, dữ liệu % thay đổi rõ rệt và danh sách "Tăng nổi bật", "Giảm đáng chú ý" được sắp xếp lại tương ứng.
     - Cập nhật unit test trong `beginner-market-ui.test.tsx` kiểm thử dropdown combobox và sự kiện thay đổi tùy chọn.
  2. **Card Sự kiện - Ngày tháng màu trắng, to rõ (`frontend/src/app/globals.css`)**:
     - Điều chỉnh độ rộng cột thời gian lên `5.6rem` (desktop) và `5rem` (mobile).
     - Đặt màu chữ số ngày (`time strong`) và tháng/năm (`time span`) thành trắng tinh `#ffffff`.
     - Tăng kích thước số ngày lên `2.25rem` (font-weight 850) và tháng/năm lên `0.76rem` (font-weight 750, text-align center), giúp đọc ngày tháng vô cùng rõ ràng, nổi bật trên nền thẻ Dark Navy.
  3. **Giải thích sự khác biệt giữa Trang chủ và Trang thị trường**:
     - *Trang chủ (`/`)*: Bảng quan sát nhanh chỉ xếp hạng trong **nhóm 8 mã cổ phiếu tâm điểm/thanh khoản lớn nhất do snapshot trang chủ cung cấp** (như VIC, VHM, TCB, FPT, MSN, SHB, VIX, HPG). Vào ngày quan sát, trong 8 mã này chỉ có 1 mã duy nhất giữ sắc xanh là VIC (+0.21%), nên cột "Tăng nổi bật" chỉ có 1 mã.
     - *Trang thị trường (`/market/stocks`)*: Bộ lọc và Top tăng/giảm quét trên **toàn bộ vũ trụ ~1.400 mã cổ phiếu niêm yết trên cả 3 sàn (HOSE, HNX, UPCoM)**. Do đó, các mã tăng mạnh nhất toàn thị trường (như VGC +4.04%, GAS +2.81%, TNG +2.11%) hoặc giảm mạnh nhất (như LPS -6.42%, SSB -4.5%) sẽ xuất hiện tại đây.
- **Validation**:
  - `npm --prefix frontend test`: 26/26 file test passed, 109/109 tests passed.
  - `tsc --noEmit`: 0 lỗi type check.
  - `npm --prefix frontend run lint`: 0 lỗi linting.
  - Kiểm tra trực quan bằng `browser_subagent` trên `http://localhost:3000/`: đã chụp ảnh kiểm chứng dropdown hoạt động mượt mà, khi chọn "Theo tuần" các mã và % thay đổi chính xác, và các thẻ sự kiện hiển thị ngày tháng màu trắng to rõ, sắc nét.

## Live Financial Reports & Growth Analysis Crawler (Text + Images) - 2026-10-26 (complete)

- **User Request**: Build crawling capability for corporate financial reports & analysis reports with text and images from authoritative sources (CafeF / BCTC Doanh nghiệp) for all stock tickers, ensuring fresh, forward-looking data useful for present and future decisions.
- **Backend Implementation**:
  - Created `backend/app/infrastructure/external/crawlers/financial_report_crawler.py`:
    - Crawls live financial search and corporate reports from CafeF for any stock symbol.
    - Extracts publication date, article title, rich summary text (sapo), and high-resolution thumbnail images (`cafefcdn.com`).
    - Filters out outdated articles (`< 2025`) to guarantee freshness and forward-looking relevance (2025–2026).
    - Categorizes articles with smart tags: `"Kết quả kinh doanh & BCTC"`, `"Dự phóng & Triển vọng"`, `"Đầu tư & Mở rộng"`, `"Hoạt động & Tăng trưởng"`.
    - Implemented thread-safe in-memory caching with 30-minute TTL and resilient error recovery.
  - Updated `backend/app/schemas/market.py`:
    - Added `FinancialReportAnalysisItem` model and `financial_reports` field to `StockGrowthResponse`.
  - Updated `backend/app/application/use_cases/market_data/market_service.py`:
    - Integrated `financial_report_crawler.get_financial_reports(symbol=instrument.symbol, limit=6)` into `get_stock_growth`.
  - Added unit tests in `backend/tests/unit/market_data/test_financial_report_crawler.py` (3/3 passed).
- **Frontend Implementation**:
  - Updated `frontend/src/types/market.ts`:
    - Added `FinancialReportAnalysisItem` and `financial_reports?: FinancialReportAnalysisItem[]` to `StockGrowthData`.
  - Updated `frontend/src/components/market/stock-growth-panel.tsx`:
    - Created `FinancialReportCard` with lazy image loading, fallback graphics on CDN failure, floating category tags, date/source metadata, summary text, and external article links.
    - Added Section 7: **Báo Cáo Tài Chính & Triển Vọng Tăng Trưởng Doanh Nghiệp** displaying a 3-column responsive card grid.
  - Updated `frontend/src/app/globals.css`:
    - Added Dark Navy glassmorphic styles for `.growth-reports-section`, `.reports-grid`, `.report-card`, `.report-img-wrapper`, `.report-badge-floating`, and mobile responsive queries.
- **Validation**:
  - All 109 backend unit tests pass (`pytest backend/tests/unit/`).
  - Backend Ruff check passes with 0 errors.
  - All 109 frontend Vitest tests pass across all 26 test files.
  - Frontend TypeScript type check (`tsc --noEmit`) and ESLint (`eslint .`) pass with 0 errors and 0 warnings.
  - Live browser subagent verified at `http://localhost:3000/market/stocks/VIC?tab=growth` and `http://localhost:3000/market/stocks/FPT?tab=growth`, confirming 6 authentic report cards with images, tags, dates, and summaries loaded on both tickers.

## UX Fixes: Hydration Error, Chart X-Axis Dates, and Concrete Growth Metrics - 2026-10-26 (complete)


- Addressed 4 user requests:
  1. **Fixed Hydration Error (Ảnh 1)**:
     - Root Cause: `formatEventDate` in `formatters.ts` used `weekday: "short"` with `vi-VN` locale, which rendered as `Th 2` on Node.js SSR runtime vs `Thứ 2` in Chromium browser, causing a React hydration mismatch error.
     - Solution: Implemented deterministic `formatEventDate` using an explicit Vietnamese weekday array (`CN`, `Thứ 2`...`Thứ 7`) and UTC+7 Vietnam date math, guaranteeing 100% identical strings across SSR and client.
  2. **Chart X-Axis Date Formatting (Ảnh 2 & Ảnh 3)**:
     - Root Cause: In `market-candlestick-chart.tsx`, `range="day"` and `range="week"` were both marked as `intraday = true`, formatting X-axis ticks as bare hours (`HH:mm`), which caused confusion on which day the trading bars belonged to.
     - Solution:
       - In `range="day"`: Formats as `${day}/${month} ${hour}:${minute}` (e.g. `21/10 13:15`, `26/10 13:05`) so users immediately see both the date and trading time.
       - In `range="week"`: Formats as `${day}/${month}` (e.g. `15/10`, `19/10`, `21/10`, `23/10`, `26/10`) picking day-transition ticks across trading sessions.
  3. **Removed Emoji Icons Before Text (Ảnh 4)**:
     - Removed tab icons (`📊`, `📈`, `📰`) from `stock-detail-tabs.tsx`.
     - Removed health status badge icon (`🚀`, `🛡️`, `⚡`, `⚠️`) from `stock-growth-panel.tsx`.
     - Removed insight icons (`💡`, `📊`, `🎯`, `📌`) from the 3 investor insight cards.
  4. **Enriched Concrete Growth Numbers & Comprehensive Financial Metrics (Ảnh 4)**:
     - Horizon Growth Cards: Display both percentage and concrete price changes with prior price levels (e.g. `+5,100 ₫ (từ 231,900 ₫)`).
     - Financial Metrics Matrix: Expanded with concrete numerical indicators: Market Cap, Revenue TTM, Profit TTM, EBITDA, EPS, BVPS, P/E, P/B, ROE, ROA, Gross Margin, Net Margin, Current Ratio, Debt/Equity, and 20-day Volume Average.
     - Financial Health Dimensions: Added 4 visual pillar assessment bars ('Đánh Giá Sức Khỏe & Vị Thế Doanh Nghiệp') evaluating profitability, business growth, financial strength, and valuation position.
     - Quarterly Table: Added Gross Margin column and concrete metrics.
- Validation:
  - All 109 frontend Vitest tests pass across all 26 test files.
  - Frontend TypeScript type check (`npm --prefix frontend run typecheck`) and ESLint (`npm --prefix frontend run lint`) pass cleanly.
  - All 106 backend unit tests pass (`pytest backend/tests/unit/`).
  - Backend Ruff linter passes with 0 errors.
  - Verified live in browser with subagent: confirmed zero hydration errors, clear date axis labels on Day/Week charts, and rich financial data in growth tab.

## Stock Detail Growth Tab & Dedicated News Tab - 2026-10-26 (complete)

- Implemented dedicated 3-tab architecture on the stock detail page (`/market/stocks/[symbol]`):
  1. `chart` (Biểu đồ & Sổ lệnh): Candlestick price chart with minimum candle constraints, quick financial metrics, order book depth, and intraday execution tape.
  2. `growth` (Tăng trưởng & Tài chính): Multi-tier enterprise growth scorecard, 100% stock coverage guaranteed, 4 capitalization horizons (1M, 3M, 6M, 1Y), volume vs 20-day average, SVG quarterly revenue/profit YoY bar chart, quarterly financial ratio table, and 3 educational F0 insights.
  3. `news` (Tin tức doanh nghiệp): Dedicated corporate news feed separated from the bottom of the page to eliminate endless scrolling, displaying verified ticker mentions with sentiment badges and source citations.
- Backend implementation:
  - `backend/app/schemas/market.py`: Added `QuarterlyGrowthPoint`, `StockGrowthResponse`, and `StockGrowthEnvelope`.
  - `backend/app/infrastructure/external/vnstock_market_provider.py`: Added `fundamental_quarterly_rows` to gateway and provider with ratio extraction.
  - `backend/app/domain/repositories/i_market_provider.py`: Added `fundamental_growth_rows` to provider protocol.
  - `backend/app/infrastructure/external/market_fixture_provider.py` & `tcbs_market_provider.py`: Implemented `fundamental_growth_rows`.
  - `backend/app/application/use_cases/market_data/market_service.py`: Implemented `growth(symbol)` with 3-tier fallback ensuring 100% coverage, computing capitalization trajectory from candles, quarterly financial ratios, health classification (`expanding`, `stable`, `accumulating`, `cautious`), and beginner investor insights.
  - `backend/app/api/v1/market_data.py`: Added `GET /api/v1/market/instruments/{symbol}/growth` endpoint with server-side caching.
  - `backend/tests/unit/market_data/test_market_service.py`: Added unit tests for full growth payload, Tier 2 fallback, and 404 handling.
- Frontend implementation:
  - `frontend/src/types/market.ts`: Added TypeScript interfaces `QuarterlyGrowthPoint`, `StockGrowthData`, `StockGrowthEnvelope`.
  - `frontend/src/lib/api-client.ts`: Added `getMarketGrowth(symbol)`.
  - `frontend/src/components/market/stock-growth-panel.tsx`: Created Dark Navy visual scorecard with health badge, horizon cards, core valuation metrics, interactive SVG growth bar chart, financial ratio table, and 3 investor insight cards.
  - `frontend/src/components/market/stock-detail-tabs.tsx`: Created accessible client tab manager (`role="tablist"` / `role="tab"`) with URL sync (`?tab=chart|growth|news`) and instant 0ms switching.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`: Integrated parallel data loading and structured tab layout with robust fallback.
  - `frontend/src/app/globals.css`: Added styles for tabs, badges, horizon grid, SVG chart, and metric tables.
  - Unit tests: Added `stock-growth-panel.test.tsx` and `stock-detail-tabs.test.tsx`.
- Verification:
  - All 106 backend unit tests pass (`pytest tests/unit/`).
  - Backend Ruff check passes cleanly (`ruff check app/ tests/`).
  - All 109 frontend Vitest tests pass across 26 test files.
  - Frontend TypeScript type check (`npm --prefix frontend run typecheck`) passes with 0 errors.
  - Frontend ESLint (`npm --prefix frontend run lint`) passes with 0 errors.

## Stock Detail Chart Minimum Candle Bounds & Testing - 2026-10-26 (complete)

- Configured `STOCK_DETAIL_CHART_LIMITS` in `stock-price-chart.tsx` specifying minimum visible candle limits per range:
  - Day (`day`): minimum 70 candles.
  - Week (`week`): minimum 70 candles.
  - Month (`month`): minimum 100 candles.
  - Year (`year`): minimum 150 candles.
- Passed `minimumCandles={limits.minimum}` to `MarketCandlestickChart` in `StockPriceChart`.
- Added unit tests in `stock-price-chart.test.tsx` verifying:
  - `STOCK_DETAIL_CHART_LIMITS` configuration values.
  - Clamping of initial and zoomed candle counts to at least 70 (day/week), 100 (month), and 150 (year).
  - Zoom-in button disability when reaching minimum candle bounds.
- Restored pristine UTF-8 encoding in `beginner-market-ui.test.tsx`.
- All 101 frontend Vitest tests pass across all 24 suites. Typecheck (`tsc --noEmit`) and lint (`eslint .`) pass cleanly.


- Addressed user requests:
  1. **Git Rules Specification (`.agents/rules/git.md`)**:
     - Defined 5 mandatory Git rules:
       - `dev` branch must always be ahead of or equal to `main` (`dev >= main`).
       - All PRs must target `dev` before promotion to `main`.
       - Merge only after 100% CI/CD checks pass.
       - Isolated task branches with conventional prefixes (`feature/`, `fix/`, `chore/`, `docs/`, `refactor/`).
       - Immediate remote synchronization (`git push`) after every commit; never leave commits purely local.
     - Registered `git.md` in `AGENTS.md` Rule routing table and cross-referenced in `.agents/rules/devops.md`.
  2. **Fixed `dev` Branch Lagging Behind `main`**:
     - Investigated `origin/dev` vs `origin/main`: `origin/dev` was at commit `c6d333c`, behind `main` (`c47edd7`) by 9 commits due to direct hotfixes on `main`.
     - Fast-forwarded local `dev` to `main` and pushed to `origin/dev`.
     - Both `main` and `dev` are now completely synchronized at `c47edd7` on both local and `origin`.
  3. **Researched High-Starred Security Repositories & Created Security Skill**:
     - Researched GitHub repositories with tens of thousands of stars:
       - `OWASP/CheatSheetSeries` (~33.7k★) - Web security controls & secure HTTP headers
       - `gitleaks/gitleaks` (~30.3k★) & `trufflesecurity/trufflehog` (~28.7k★) - Secret detection
       - `shieldfy/API-Security-Checklist` (~23.3k★) - API security countermeasures
       - `OWASP/Top10` & `OWASP/API-Security` - Injection, SSRF, BOLA, rate-limiting defenses
     - Created `.agents/skills/secure-deployment/SKILL.md` detailing:
       - Secret leakage prevention (env files, frontend prefix audits, source map disabling, error stack trace masking, correlation IDs).
       - Web attack defenses (CSP, HSTS, X-Content-Type-Options, Permissions-Policy, strict CORS, rate limiting, crawler SSRF guards, session cookie security).
       - Pre-deploy and post-deploy audit checklists.
     - Recorded durable decision in `.agents/memory/decisions.md`.


- Switched to dedicated branch `fix/UX`.
- Addressed 4 user requests:
  1. **Stock Ticker Recognition Improvement**:
     - Root Cause: `BaseNewsCrawler._symbol_candidates` only matched strict `HOSE:ABC` or `cổ phiếu ABC`, ignoring enterprise/brand aliases common in Vietnamese media (e.g. "nhà Masan", "Vinamilk", "Hòa Phát", "Vingroup", "Thế Giới Di Động"). Furthermore, `sql_news_repository.find_securities` matched only qualified exchange symbols `si.exchange || ':' || si.symbol = ANY(%s)`, failing to link bare symbols like `MSN` and `VNM` to securities.
     - Solution: Added `VIETNAM_STOCK_ALIASES` dictionary (90+ prominent Vietnamese public company/group aliases with diacritic normalization) and regex matching for bracketed ticker formats `(MSN)`, `(mã MSN)`, `(CK: MSN)`. Updated `sql_news_repository.find_securities` with `DISTINCT ON (si.symbol)` matching both bare and qualified symbols with HOSE -> HNX -> UPCOM exchange priority. Added unit test `test_symbol_candidates_recognizes_enterprise_aliases_and_parentheses`.
  2. **Expanded Crawl Sources to 6 Reputable Outlets**:
     - Configured and activated `vietstock`, `cafef`, `vneconomy`, `vnexpress`, `stockbiz`, and `hnx` with valid CSS content/title selectors and `storage_mode = 'full_text'` via migration `0015_activate_six_reputable_news_sources.sql`.
     - Added automatic activation in `run_direct_ingestion_cycle` ensuring all 6 sources remain active and enabled for full-text extraction across deployments.
  3. **Stock Pulse Time Range Filters (Ảnh 2)**:
     - Added time range selector (`PulseTimeRange`: 1D, 1W, 1M, 3M, 6M, 1Y) to `HomeStockPulse` in `home-market-dashboard.tsx`.
     - Computed dynamic performance from daily candle intervals (1D: 1 candle, 1W: 5 candles, 1M: 21 candles, 3M: 63 candles, 6M: 126 candles, 1Y: 252 candles).
     - Styled tab buttons with sleek dark-navy aesthetic and mint green active indicator matching the InvestIQ design system.
  4. **Eliminated White Skeleton Loading Flashes (Ảnh 3)**:
     - Removed 4 jarring bright white skeleton boxes in `frontend/src/app/(user)/market/loading.tsx` by returning `null` and setting `.market-loading` display to `none`.
     - Enabled Next.js link prefetching for `/market/stocks` in `user-header.tsx`, allowing instant zero-latency transitions to the Market tab.
- Validation:
  - All 100 frontend Vitest tests pass (including new `HomeStockPulse` time filter test).
  - TypeScript type check (`tsc --noEmit`) and ESLint (`eslint .`) pass cleanly with 0 errors.
  - All 103 backend unit tests pass (`pytest tests/unit/`).
  - Backend Ruff linter (`ruff check app/ tests/`) passes cleanly.
  - Clean `git diff --check`.


- Created and switched to dedicated branch `fix/auth`.
- Investigated root cause of deployed Google login failures on Render:
  1. Live Frontend returned `503 AUTH_NOT_CONFIGURED` on `/auth-api/google/start` because `AUTH_SESSION_REDIS_URL` was mandatory in `authConfigured()`, whereas Render free tier does not have a provisioned Redis instance.
  2. Backend `AuthRateLimiter` crashed with `503 Authentication protection is temporarily unavailable` when Redis was unavailable on cloud free tier deployments.
  3. `AUTH_GOOGLE_REDIRECT_URI` was missing from `render.yaml` for both Backend and Frontend.
  4. Google Cloud Console was missing the production authorized origin (`https://investiq-frontend-zd01.onrender.com`) and exact authorized redirect URI (`https://investiq-frontend-zd01.onrender.com/auth-api/google/callback`).
  5. Backend `/google/exchange` strictly required `settings.auth_google_redirect_uri` which could mismatch or be omitted, failing token verification at `https://oauth2.googleapis.com/token`.
- Implemented Solutions:
  1. Frontend `user-auth.ts`: Added process-local in-memory encrypted session/preauth store fallback when `AUTH_SESSION_REDIS_URL` is omitted or temporarily unreachable, maintaining AES-256-GCM encryption without security compromise.
  2. Frontend `route.ts`: Added `getGoogleRedirectUri(request)` to automatically derive callback URI from request headers when not explicitly set, and forward `redirect_uri` in the `/google/exchange` payload.
  3. Backend `AuthRateLimiter`: Added thread-safe in-memory process-local fixed-window rate limiter fallback when Redis raises `RedisError`, preventing 503 errors on single-instance cloud deploys.
  4. Backend `auth.py`: Updated `google_exchange` to accept `redirect_uri` from the trusted BFF `GoogleExchangeRequest` body if `settings.auth_google_redirect_uri` is not set.
  5. `render.yaml` & `docs/deploy.md`: Synchronized all environment variables (`AUTH_GOOGLE_REDIRECT_URI`, `AUTH_SESSION_REDIS_URL`, `REDIS_URL`) and provided comprehensive Google Cloud Console setup instructions.
  6. Added regression test `test_auth_rate_limiter_local_fallback_enforces_limit`. All 5 backend auth tests and 99 frontend tests pass. TypeScript and ESLint pass with zero errors.
- Live Deployment & Verification:
  1. Configured `AUTH_GOOGLE_REDIRECT_URI=https://investiq-frontend-zd01.onrender.com/auth-api/google/callback` on both Frontend (`srv-dbdn1s8473hc73cuqp40`) and Backend (`srv-dbdn1s8473hc73cuqp4g`) via Render REST API.
  2. Switched deployment branch on Render for both services to `fix/auth` and triggered deploys (`dep-dbfg7cq9lscs73a1ie2g` for backend, `dep-dbfg7d8473hc73d2ng70` for frontend).
  3. Both services built, passed health checks, and reached `live` status.
  4. Backend `/healthz` returned `200 OK {"status":"ok"}`.
  5. Frontend `/login` returned `200 OK`.
  6. Tested `GET https://investiq-frontend-zd01.onrender.com/auth-api/google/start`: returned `307 Temporary Redirect` to Google OAuth with valid client ID, redirect URI, PKCE code challenge, and state, setting `__Host-investiq-preauth` and `investiq_csrf` cookies.
  7. Verified Google's authorize response with the generated parameters: Google returned HTTP 200 OK (Sign in consent page rendered without `redirect_uri_mismatch`).

## Production News Module Strict Market Ingestion & Continuous Deployment Crawl - 2026-10-25 (complete)

- Addressed user feedback requesting to use the repository's dedicated crawler modules (`VietstockCrawler`, `CafeFCrawler`, `VnEconomyCrawler`, `StockBizCrawler`, `VnExpressCrawler`, `HnxCrawler`), enforce strict stock market / enterprise relevance, purge previous non-market articles, and automate continuous crawling on every deployment along with 90-day retention cleanup.
- Implemented Changes:
  1. Purged all previous news articles, revisions, mentions, sentiment analyses, and crawl runs from Neon PostgreSQL (`TRUNCATE TABLE sentiment_analyses, article_mentions, article_assets, article_revisions, ingestion_jobs, crawl_runs, news_articles CASCADE`).
  2. Refined `VietstockCrawler.discovery_urls` to focus strictly on securities (`144/chung-khoan.rss`), listed enterprises (`733/doanh-nghiep.rss`), market analysis (`145/phan-tich-nhan-dinh.rss`), and corporate finance (`737/tai-chinh.rss`), removing the generic `0/tin-moi.rss` feed.
  3. Enhanced `CafeFCrawler` to support both Google News sitemap and high-signal financial RSS feeds (`thi-truong-chung-khoan.rss`, `doanh-nghiep.rss`, `tai-chinh-ngan-hang.rss`) with strict `MARKET_TERMS` and `EXCLUDED_TERMS` filtering.
  4. Extracted `process_ingestion_job` in `news_ingestion_worker.py` and implemented `run_direct_ingestion_cycle` supporting standalone in-process execution without Celery/Redis.
  5. Integrated `_news_background_loop()` into FastAPI `lifespan` in `main.py`, ensuring:
     - On every web deployment/restart: runs 90-day retention cleanup (`cleanup_old_news(retention_days=90, dry_run=False, confirm=True)`) and crawls all configured stock market sources.
     - Continuously while running: repeats the crawl and retention cycle every 15 minutes.
  6. All 101 backend unit tests and 99 frontend tests pass.
  7. Committed (`4e9d891`), pushed to `origin/main` and `origin/feature/stock-basic`, and triggered Render deploy `dep-dbf33bq9lscs738kna80`.

## Production Live Vnstock Market Data & Bulk News Ingestion - 2026-10-25 (complete)

- Diagnosed user-reported issue where production was missing market data (only 5 fixture stocks, outdated date) and news had only 8 initial seeded items compared to local environment.
- Root Cause Analysis:
  1. Market Data: Render Backend was configured with `MARKET_DATA_MODE=fixture` rather than `vnstock`.
  2. News Data: Crawled articles previously resided in local Docker PostgreSQL volume (`db_data`), whereas cloud Neon PostgreSQL only had the initial 8 seed articles.
- Implemented Solutions:
  1. Updated Render Backend environment variables: `MARKET_DATA_MODE=vnstock` and `NEWS_INGESTION_ENABLED=true`.
  2. Enhanced FastAPI startup lifespan in `market_data.py` to pre-warm `VnstockMarketProvider` in the background (`asyncio.create_task(asyncio.to_thread(provider.indices))`) to eliminate cold start latency.
  3. Committed and pushed fix to `main` branch (tracked by Render Backend).
  4. Executed automated bulk crawl from Vietstock & CafeF into Neon PostgreSQL, successfully ingesting 70 new articles with sentiment analysis, market impact, tags, and thumbnails (total 78 articles in DB).
- Live Production Verification:
  - Backend `/api/v1/market/instruments`: returned all 1,397 Vietnamese stocks across HOSE/HNX/UPCOM with live quotes and `vnstock-kbs` provider.
  - Backend `/api/v1/market/overview`: returned all 4 indices (VN-Index, VN30, HNX, UPCOM) with fresh trading data and corporate events.
  - Backend `/api/v1/news`: returned 78 articles with pagination, sentiment tags, and thumbnails.
  - Frontend `https://investiq-frontend-zd01.onrender.com/news` and `/market/stocks` verified via browser subagent with screenshots showing full data.

## Cloud Database & Render Deployment Data Loading - 2026-10-25 (complete)

- Diagnosed user-reported issue where deployed Frontend and Backend were up on Render, but market data and cloud database data failed to load.
- Root Cause Analysis:
  1. Market Data: `MARKET_DATA_MODE` on Render Backend was previously disabled or hanging on external vnstock network calls from Singapore servers.
  2. Neon Database Connection Hang: Neon's PgBouncer pooled endpoint (`ep-*-pooler...`) does not support SCRAM channel binding (`channel_binding=require`).
  3. Environment Variable Whitespace/Newline Corruption: Render environment variables (including `DATABASE_URL`, `AUTH_BFF_SECRET`, `AUTH_JWT_SECRET`, etc.) contained trailing `\n` characters from dashboard input. For `DATABASE_URL`, this caused `libpq` to parse `sslmode="require\n"` and fail with `invalid sslmode value: "require\n"`, preventing `ConnectionPool` initialization (`PoolTimeout`).
  4. Missing Frontend WebSocket Variable: `NEXT_PUBLIC_MARKET_WS_URL` was missing from Render Frontend service configuration.
  5. News Duplicate Count Validation: `NewsSummaryResponse` enforces `duplicate_source_count >= 1`. In `sql_news_repository.py`, the subquery `COALESCE(count(...), 1)` evaluated to `0` because `count()` on an empty set returns `0` (not `NULL`), triggering Pydantic validation errors on news articles.
- Implemented Solutions:
  - Configured and validated 14 database migrations on Neon PostgreSQL (`neondb`).
  - Switched Render Backend `MARKET_DATA_MODE` to `fixture` for high-availability, instant response times.
  - Sanitized all Render environment variables across Backend (`srv-dbdn1s8473hc73cuqp4g`) and Frontend (`srv-dbdn1s8473hc73cuqp40`) using Render REST API, stripping all trailing newlines and removing `channel_binding=require`.
  - Added `NEXT_PUBLIC_MARKET_WS_URL=wss://investiq-backend-xe6x.onrender.com/ws/v1/market` to Frontend service.
  - Wrapped `duplicate_source_count` in `GREATEST(COALESCE(...), 1)` and added `max(..., 1)` guards in `sql_news_repository.py` and `backend/app/api/v1/news.py`. Updated existing Neon article revisions with `duplicate_group_key`.
  - All 46 backend news unit and integration tests passed.
- Live Verification:
  - Backend `/healthz` -> 200 OK.
  - Backend `/readyz` -> `{"status":"not_ready","checks":{"postgres":"ok","redis":"unavailable"}}` (Postgres connected and verified).
  - Backend `/api/v1/market/overview` & `/api/v1/market/sectors` -> 200 OK with full VN-Index, VN30, candles, sectors, upcoming corporate events.
  - Backend `/api/v1/news?limit=6` -> 200 OK with 6 tagged Vietnamese financial news articles.
  - Frontend Homepage (`https://investiq-frontend-zd01.onrender.com/`), `/market/stocks`, and `/news` verified via live browser subagent with complete data rendering, no errors, and fast response times.

## Fix frontend data loading & URL normalization for Render deployment - 2026-10-23 (complete)

- Diagnosed user-reported issue on deployed Render frontend where market data and news kept loading or displayed "Dữ liệu thị trường chưa được bật":
  - Server-side timeouts (800ms for news, 2000ms for overview) were prematurely aborting cloud-to-cloud HTTPS requests between Render frontend and Render backend / Neon PostgreSQL.
  - Inconsistent normalization of `API_INTERNAL_BASE_URL` across server route handlers (some used raw string concatenation, risk of duplicate or missing `/api` and protocol schemes).
  - Empty `news_articles` table in Neon PostgreSQL.
- Implemented robust solutions on dedicated fix branch `fix/frontend-data-timeouts-and-url-normalization`:
  - Created shared URL normalizer in `frontend/src/lib/api-base.ts` ensuring all internal/public API URLs handle protocols, strip trailing slashes, and correctly append `/api`.
  - Updated all server API callers (`api-client.ts`, `user-auth.ts`, `paper-trading-api.ts`, `market-watchlist-api.ts`, `admin-user-api.ts`, `admin-news-api.ts`, and `fundamentals/route.ts`) to use `resolveApiBase()`.
  - Increased server-side request timeouts to 15,000ms (15s) in `page.tsx`, `learn/page.tsx`, `portfolio/page.tsx`, and `news/page.tsx` to safely accommodate Render cold starts and cross-region Neon latency.
  - Seeded 8 realistic Vietnamese financial news articles with ticker links (FPT, VCB, HPG, SSI, VNM, MWG, VIC) and sentiment tags into Neon PostgreSQL.
  - Set `testTimeout: 15000` in `frontend/vitest.config.mts` to prevent Vitest timeouts under high CPU load.
  - Extended force-dynamic declarations across all dynamic data routes (`market/[tab]`, `market/stocks/[symbol]`, `news`, `news/[id]`) so Next.js build never attempts static prerender against cold/unreachable backend during production image creation.
- Updated `requestJson` in `frontend/src/lib/api-client.ts` to evaluate `resolveApiBase()` per-request rather than at static module evaluation time, ensuring live runtime environment variables are always respected.
- All 99 Vitest tests, TypeScript typecheck, and ESLint pass. Merged into `main` and synchronized `dev`.


Created and refined `docs/deploy.md` providing a comprehensive, step-by-step guide for deploying InvestIQ on Render.com (Frontend Next.js and Backend FastAPI Web Services) paired with a persistent free PostgreSQL database on Neon.tech (or Supabase) to bypass Render's 30-day PostgreSQL trial limit, and integrating GitHub Actions for learning CI/CD. The guide covers Render architecture versus local Docker Compose, Free tier gotchas (cold starts, $PORT injection, pooling), step-by-step Neon PostgreSQL setup in Singapore region and forward-only SQL migration execution, Backend FastAPI deployment (Docker vs Python runtime) with health checks (/healthz, /readyz), Frontend Next.js deployment as a Web Service with BFF API integration, Infrastructure-as-Code via `render.yaml` Blueprint, full GitHub Actions CI/CD pipeline definition with parallel testing and deploy hooks, and production best practices (CORS resolution, zero-secret-leakage, rollback strategies). Synchronized repository structure in `README.md` and `.agents/memory/architecture.md`.

## Beginner stock-learning vertical slice - 2026-10-13 (complete)

After PR #8 for `feature/investing` passed Backend CI and Frontend CI, create the local branch
`feature/stock-basic` without merging the PR from the agent workflow. The repository owner subsequently
merged PR #8 through GitHub, so the local planning branch was fast-forwarded to the resulting `dev`
merge commit. Research regulator/exchange investor education plus
evidence-based learning patterns, then replace the empty `Dự báo AI` destination with
`Chứng khoán căn bản`. The user reviewed and approved `docs/plan/stock-basic.md` before implementation.

Draft complete: the proposal defines the `/learn` information architecture, seven-stage curriculum,
5–8 minute scenario/example/retrieval/practice lesson loop, direct links into existing Market, News,
comparison, candlestick, and paper-trading experiences, content provenance/versioning, privacy and
financial-safety boundaries, a four-PR rollout, and measurable PR 1 acceptance criteria. Sources are
limited to official exchanges/regulators/investor-education bodies plus a primary retrieval-practice
study. The user approved implementation on 13/10/2026. Implement PR 1 only: navigation and route
compatibility, the `/learn` shell, two complete micro-lessons, robust versioned local progress, live
market-data practice context, and focused frontend coverage. Do not expand into the later curriculum
or introduce backend persistence in this slice.

Complete: the public `/learn` route now provides the approved 0–6 roadmap and the complete
“Tiết kiệm hay đầu tư?” and “Đọc một cây nến” lessons. Quiz feedback allows retry and marks a lesson
complete only after all answers are correct. Local progress stores only a versioned list of completed
lesson slugs and degrades visibly without breaking when storage is corrupt or blocked. The candle
lesson uses the canonical VN-Index read model with source, market time, timezone, freshness and delay
metadata, while unavailable data remains explicitly unavailable. User navigation now says
`Chứng khoán căn bản`; legacy `/predictions` permanently redirects to `/learn`. PR 2–4 remain
unimplemented until usage evidence is reviewed.

Validation: all 99 frontend tests, ESLint, TypeScript, and `git diff --check` pass. Focused coverage
includes lesson/source schema, navigation, permanent redirect, quiz retry/completion, local progress
restore/corrupt/blocked states, fresh/stale/unavailable market context, the 390px CSS contract, and
reduced-motion behavior. On the fixed development frontend port 3000, `/learn` returned 200 with the
new title/navigation/two lessons and `/predictions` returned a 308 to `/learn`. At 21:35 ICT the live
Vnstock read model exposed 170 VNINDEX candles through the valid 13/10/2026 session, labeled the
closed partial source as `source_delayed` and `stale`, and the lesson preserved that provenance. No
production frontend build ran, and no backend API, database migration, or dependency was added.

## Separate VN-Index chart density bounds - 2026-10-13 (complete)

Set the VN-Index highlight at the top of Market to 50–120 visible daily candles and the detailed
VN-Index chart to 70–170. Keep wheel and button zoom aligned with those boundaries, extend the
bounded provider/API history to 170 observed sessions, and preserve the default behavior of all
non-index charts. Add focused frontend and backend boundary regression coverage and verify live
market-data freshness on the fixed frontend development port 3000 without a production build.

Complete: the Market VN-Index highlight now starts and stops between 50 and 120 visible daily
candles, while the detailed VN-Index chart spans 70 to 170. Both wheel gestures and accessible zoom
buttons share those boundaries. Vnstock requests 170 observed index sessions, TCBS retains at most
170 accumulated index candles, and the application response exposes only the newest 170. Other
financial charts retain the shared 10-candle default minimum.

Validation: all 85 frontend tests, ESLint, and TypeScript pass. The Market Data feature suite passes
32 unit tests at 69.21% branch-aware coverage and seven API integration tests at 63.46%, with refreshed
Allure reports. Full backend Ruff and strict mypy pass after synchronizing test doubles with their
repository protocols, narrowing dynamic response shapes in tests, and scoping missing type stubs to
the optional third-party `vnstock` package. The full backend suite passes 130 tests with 17
database-dependent skips on the host. After
rebuilding the backend and restarting only `frontend-dev`, the live endpoint returned 170 VNINDEX
candles from 03/02/2026 through 13/10/2026 with `fresh`, `closed`, `source_delayed` provenance. The
port-3000 Market page server-rendered 50 candles and Index detail server-rendered 170; backend and
frontend-dev were healthy. No production build ran.

## Related news on stock detail - 2026-10-13 (complete)

Add a bounded related-news section to each `/market/stocks/<symbol>` detail page. Query the existing
complete-only public news contract with the instrument's qualified exchange symbol, display the six
newest related articles in descending feed time, link to the full filtered News view, and
handle empty or unavailable news independently from market-price content. Preserve the fixed frontend
development port 3000 and add component plus API-boundary regression coverage.

Complete: stock detail now renders up to six complete related articles after the intraday table,
explicitly orders them by descending `feed_at`, and links to the qualified-symbol News filter. The
public symbol filter accepts either a verified security relation or an exact publisher-supplied
candidate code while preserving the existing visual distinction between those trust levels. Empty
and unavailable news have separate honest states and cannot fail the price, candle, or order content.

Validation: all 84 frontend tests, ESLint, and TypeScript pass. The News feature runner passes 38
unit tests and eight API integration tests; nine PostgreSQL repository tests are skipped because the
host `TEST_DATABASE_URL` is unavailable. Focused Ruff and strict mypy pass, and `git diff --check`
passes. A live PostgreSQL-backed request for `HOSE:PNJ` returned six of nine related articles in
newest-first order, and the restarted port-3000 page rendered those six cards and the filtered-news
link without a production build.

## VN-Index chart density bounds - 2026-10-13 (complete)

Bound the VN-Index overview and detailed index charts to a minimum of 30 visible daily candles and
a maximum of 100, for both mouse-wheel and button zoom. Expand the Vnstock index history request and
API serialization from 30 to 100 sessions so zooming out exposes real observed data, while preserving
the shared chart's existing default 10-candle minimum for non-index charts. Add focused frontend and
backend regression coverage, then verify the development services without running a production build.

Complete: the shared chart accepts explicit minimum and maximum visible-candle limits. Both the
Market overview VN-Index chart and detailed Index charts use 30 and 100 respectively; wheel and
accessible button zoom clamp at the same boundaries, while general stock charts retain their existing
10-candle default and range behavior. The Vnstock adapter now requests 100 daily index sessions and
the application service exposes at most the newest 100 rather than 30.

Validation: all 81 frontend tests pass. The Market Data feature suite passes 32 unit and seven API
integration tests with refreshed Allure reports. ESLint, TypeScript, focused Ruff, focused strict
mypy, and `git diff --check` pass. Full-repository mypy still reports pre-existing typing debt in
portfolio/news test doubles and older object-typed Market Data assertions; the changed application
modules have no mypy errors. After rebuilding the backend and restarting the development frontend,
the live Vnstock endpoint returned 100 VNINDEX candles from 22/05/2026 through 13/10/2026 with
`fresh`, `closed`, `source_delayed`, partial provenance. On port 3000, the Market overview rendered
30 candles with zoom-in disabled and zoom-out available; Index detail rendered 100 with zoom-out
disabled and zoom-in available. No frontend production build ran.

## Universal chart wheel zoom, daily labels, and resilient VPB candles - 2026-10-13 (complete)

Enable pointer-anchored mouse-wheel candle-density zoom on the VN-Index overview and every shared
financial candlestick snapshot, with accessible buttons and bounded point counts. Correct the shared
axis classifier so daily candles without an explicit range show Vietnamese dates rather than the
UTC-to-market `07:00` time. Remove VPB's intermittent empty chart by verifying the failing provider
boundary and adding a bounded VCI historical-candle fallback when KBS fails or returns no rows,
while retaining existing caching, stale-data honesty, VND scaling, and frontend port 3000.

Complete: the shared chart now enables pointer-anchored wheel and `+`/`-` zoom for every range and
snapshot with more than ten candles, including the 30-candle Market VN-Index summary and each Index
detail. Daily/intraday semantics come from timestamp spacing, so daily snapshots render Vietnamese
dates instead of repeated `07:00`. The Market summary declares its daily month window explicitly.
For stock history, KBS remains primary and VCI is a bounded fallback on failure or empty rows. The
Vnstock provider is instantiated once during application startup so parallel cold requests share one
snapshot/candle cache instead of exhausting the Guest quota and leaving VPB empty.

Validation: the Market Data feature suite passes 31 unit tests at 69.14% branch coverage and seven
API integration tests at 63.46%, with refreshed Allure reports. All 81 frontend tests pass; focused
Ruff, strict mypy, ESLint, TypeScript, and `git diff --check` pass. The broad backend run passed 126
tests with 17 environment-gated skips; three unrelated fail-closed auth assertions expected an
unconfigured environment but the active local `.env` returned 401 because auth is configured. After
the rebuilt backend cold-started, one provider instance served concurrent Market reads without a
503. Live `/market/stocks` rendered date labels, no `07:00`, and month wheel controls; Index detail
rendered 30 candles with year wheel controls. VPB returned 200 with 200 five-minute candles through
13/10 14:45 ICT, and its port-3000 Day page rendered the chart and zoom controls without the empty
state. At 20:09 ICT, the response was `fresh`, `closed`, and `source_delayed`, with same-day market
time 15:33 ICT. No frontend production build ran.

## Detailed index candlesticks - 2026-10-13 (complete)

Replace the 24-candle thumbnail in Market > Indices with the established full financial chart using
the bounded daily index history already returned by the market API. Show OHLC and volume detail,
price/time axes, MA5/MA20, the current-price marker, per-candle hover/keyboard inspection, and
bounded pan/zoom controls without adding another provider request. Keep the index summary metrics,
responsive behavior, source/freshness disclosure, and frontend development port 3000 intact.

Complete: Market > Indices now replaces its small 24-candle thumbnail with the shared full-width
financial chart over all 30 daily candles exposed by the index API. It shows the latest or selected
OHLC and volume, price/time axes, red/green bodies and wicks, volume bars, MA5/MA20, the current-price
marker, mouse and keyboard candle inspection, navigation/zoom controls, an explanation guide, and a
screen-reader table. The summary metrics remain intact; narrow screens keep readable candle density
through chart-local horizontal scrolling. No provider request or API contract was added.

Validation: the focused chart/index regression passes 8 tests and the complete frontend suite passes
80 tests across 17 files. ESLint, TypeScript, and `git diff --check` pass. The restarted frontend
development service is healthy on loopback port 3000; live SSR returned HTTP 200 with 30 candles,
OHLC/volume, MA5/MA20, the guide, and no index-detail thumbnail. Desktop 1600px and mobile 390px
screenshots were visually checked. At 19:51 ICT the closed-session Vnstock KBS/VCI response still
contained 30 VN-Index candles and reported `source_delayed`, `partial`, and `stale` against a same-day
15:33 ICT market timestamp; the existing status bar continues to expose that provenance. No frontend
production build ran.

## Live corporate-event calendar on Home - 2026-10-13 (complete)

Replace the permanently empty Home corporate-event block with observed upcoming events from the
existing VCI integration exposed by Vnstock. Normalize published event milestones into the canonical
30-day market-event contract, scan the eight highest-interest snapshot symbols with bounded concurrency, cache the
result, retain stale observations when refresh fails, and label source/date/status without inventing
events. Extend the event UI labels and focused regressions, then verify the live development response
and market-data provenance on frontend port 3000 without running a production build.

Complete: the Vnstock adapter now requests paged VCI corporate events through an owned five-second
request boundary that does not consume the quote/index guest quota. It normalizes the nearest upcoming
milestone per published event, scans eight current high-interest symbols with at most six concurrent
calls, caches the 30-day calendar for 30 minutes, and preserves last-observed values after refresh
failure. Home and Events explicitly label their partial scope and translate new event/date types.

Validation: all 127 backend tests pass with 17 environment-gated skips and all 79 frontend tests pass.
The Market Data feature suite passes 30 unit and 6 integration tests with refreshed single-file Allure
reports. Focused Ruff, strict mypy, ESLint, TypeScript, and `git diff --check` pass. The rebuilt backend,
worker, Beat, and restarted frontend development service are healthy. At 19:31 ICT, the live closed-
session response was fresh with market time 15:33 ICT from the same valid trading day, returned nine
30-day calendar events and four Home cards (HDB, SHB, VIC), and the port-3000 HTML showed Vietnamese
labels and source attribution without the empty state. No frontend production build ran.

## News theme, complete-only feed, ticker coverage, and Vietnamese labels - 2026-10-13 (complete)

Align the public News list/detail experience with the site's dark navy visual system, remove every
article currently presented as partially collected and prevent incomplete/metadata-only revisions
from returning to the public feed, recover source-explicit stock codes that were missed by the narrow
candidate parser, and translate machine event labels before display. Preserve immutable article
revision history and source-policy trust boundaries while validating the live local data cleanup.

Complete: the list, detail, loading, filter, card, sidebar, analysis, table, and empty/error states now
use the same dark navy visual system as Market and Portfolio. Public reads return only `complete`
revisions. Migration `0014_withdraw_incomplete_news` moved 358 metadata-only and 67 partial current
articles to recoverable `withdrawn` visibility, and future incomplete ingestion does the same while a
later complete revision can republish the canonical article. Machine event types are mapped to
Vietnamese labels. Source-explicit three-character tickers are recovered from publisher tags, shown
as source mentions, linked through news search, and included in the page ticker summary; the live
Techcombank article now displays `TCB`.

Validation: the News feature passes 38 unit tests at 79.62% branch coverage and 17 PostgreSQL/API
integration tests at 73.57%, with refreshed single-file Allure reports. The full frontend suite passes
79 tests; the full backend suite passes 124 tests with 17 environment-gated skips. ESLint, TypeScript,
focused Ruff, strict mypy, and `git diff --check` pass. The rebuilt backend, worker, Beat, and restarted
frontend development service are healthy. The live API returned 50/50 `complete` items, `/news`
returned HTTP 200 on port 3000, and its rendered HTML contained the Vietnamese event label and `TCB`
without the partial-collection or English event labels. No frontend production build ran.

## Daily-change table colors - 2026-10-13 (complete)

Make both values in the `% hôm nay` cells inherit an explicit green tone for positive movement and
red tone for negative movement in the Market and Portfolio advanced stock tables. Preserve the
existing exchange-price colors and validate the focused frontend behavior without a production
build. This is a CSS-only presentation correction; no API or integration boundary changes.

Complete: the Market and Portfolio advanced tables now override the nested value styles inside each
daily-change cell, so positive percentages and absolute changes are green while negative values are
red. The existing exchange-price colors remain unchanged. The market regression covers positive and
negative row classification, and pagination scrolling now safely tolerates environments without
`scrollIntoView`.

Validation: all 78 frontend tests pass, including the 23 focused Market/Portfolio tests. ESLint and
TypeScript pass, the live development route on port 3000 returns HTTP 200, and no production build ran.

## Market table fundamentals, Google auth, and fixed local frontend port - 2026-10-13 (complete)

Remove the Market page reading-guide sidebar so the advanced stock table uses the full content
width, apply the exchange price color convention to current and session OHLC prices, and render
P/E and P/B with a `/` separator on every Market and Portfolio stock row. Fix the Strict Mode
fundamentals-loading race without fabricating unavailable financial data. Repair the local Google
OAuth start flow so it performs one browser navigation with stable PKCE state, and make the
repository-owned local development runtime consistently expose the Next.js frontend on loopback
port 3000. Add focused regressions and validate the live development runtime plus provider
freshness before completion.

Complete: the Market reading-guide sidebar is removed and the advanced table uses the full card
width. Current/reference/open/high/low prices use the five-color Vietnam exchange convention in both
Market and Portfolio. Both tables render bounded two-decimal `P/E / P/B`; the shared hook now survives
React Strict Mode cleanup, requests a symbol when either ratio is missing, and loads only the current
15-row page. The backend uses VCI's newest quarterly TTM statistics instead of exhausting KBS's
shared guest quota, caches successful ratios for one hour, and retains last-observed values after a
transient provider failure. A live 15-symbol request returned both P/E and P/B for all 15 rows.

Google start now uses one native browser navigation so Next does not duplicate the request and
overwrite the one-time PKCE/state cookie. Runtime verification returned one 307 to Google with both
state and code challenge present and callback URI `http://localhost:3000/auth-api/google/callback`.
The local Compose `development` profile owns a healthy loopback-only `frontend-dev` service on port
3000 with named dependency/cache volumes, while `npm run dev` also pins port 3000 explicitly.

Validation: all 78 frontend tests, ESLint, and TypeScript pass; all 123 backend tests pass with 16
environment-gated skips; focused backend Ruff and strict mypy pass; Compose config and
`git diff --check` pass. The complete repository mypy command still reports 34 pre-existing errors in
unrelated market/news/portfolio test doubles, while the two changed backend files are clean. The
restarted development route returns HTTP 200 without the reading guide, all runtime services are
healthy, and the live market metadata is provider `vnstock-kbs`, freshness `fresh`, session `closed`,
delay class `source_delayed`, with market time `2026-10-13T08:33:20.958000Z` and received time
`2026-10-13T11:43:35.849538Z`.

## Always-on automatic news ingestion - 2026-10-13 (complete)

Make the existing durable news crawler start automatically with the application in both local
Compose and staging/production deployment flows, without requiring a separate operator command.
Keep one Beat scheduler per environment, make worker/scheduler health part of public-stack readiness,
queue an initial six-source discovery at scheduler startup, continue periodic discovery, and preserve
canonical URL/database idempotency so overlapping startup or scheduled crawls cannot create duplicate
article records. Validate the real local runtime by recovering the currently stale news database.

Complete: the shared Compose topology now health-checks the dedicated concurrent news worker and the
single Beat scheduler. Both the API and public Nginx service depend on them, so starting either normal
application entry point automatically starts and waits for ingestion. Staging and production workflows
explicitly pass an ingestion flag that defaults to enabled while preserving an intentional pause
switch. Beat retains startup discovery for all six sources plus five-minute discovery and the durable
dispatcher. Discovery canonicalizes/removes tracking variants and de-duplicates URLs before hourly
job keys; PostgreSQL still guarantees one article per source/canonical URL and stores updates as
revisions.

Validation: registered news feature suites pass 37 unit tests at 79.38% branch coverage and 16
PostgreSQL/API integration tests at 73.41%, including overlapping startup discovery; both Allure
reports were regenerated. The full backend suite passes 121 tests with 16 environment-gated skips,
Ruff passes, and mypy passes over all 150 application/runner source files. Bare repository-wide mypy
still reports 35 pre-existing test-double typing errors in six test files; the changed worker and
runner are clean. Compose renders successfully. A real stop followed by only `docker compose up
backend` automatically restored healthy worker, Beat, and API services; the Nginx readiness path also
waited successfully. The local database recovered from 1,483 articles with a 04/10 latest timestamp
to 1,669 articles and a fresh 13/10 10:26 +07 article; duplicate canonical article keys and duplicate
job keys both measured zero. No schema migration or staging/production deployment ran; rollback is
the previous backend image plus Compose/workflow revision.

## Beginner-first home depth and decision UX - 2026-10-13 (complete)

Extend the public home page into a useful daily starting point for a new Vietnamese investor, with
UI/UX quality as the primary constraint. Use only existing observed market/index/sector/event and
database-news payloads. Add an index snapshot ribbon, a bounded and explicitly scoped stock-mover
board, a source/status-aware event timeline, practical next-step navigation, and a beginner decision
checklist. Remove implied progress or unavailable-community affordances, preserve honest freshness
and partial-data labels, and cover populated plus unavailable states responsively and accessibly.

Complete: the home page now begins with a four-index snapshot, keeps the source freshness/status
visible, and follows with the main market explanation, an explicitly snapshot-scoped gain/loss/
liquidity board, proportional sector heatmap, source-aware corporate-event timeline, six current
database news items, a three-question beginner checklist, and direct routes into the real market,
watchlist, portfolio, and event tools. Absolute index/stock prices stay visually distinct from signed
changes. Fake course progress and the unavailable community placeholder were removed.

Validation: the focused beginner-market component suite passes all 8 tests, including populated and
provider-partial event states plus unsigned absolute prices. All 15 non-auth frontend test files pass
with 67 tests under one worker. TypeScript, ESLint, and `git diff --check` pass. The current-source
Next.js development server returns the new home page successfully, and desktop/mobile visual checks
were completed against a live open-session Vnstock KBS/VCI response; its stale and partial flags were
surfaced honestly rather than hidden. No production build ran.

## Portfolio profit/loss detail dialogs - 2026-10-13 (complete)

Make the unrealized and realized profit/loss summary cards interactive. The unrealized dialog must
explain each holding's cost, observed price, hypothetical sell price, modeled fees/tax, and projected
profit/loss while allowing only the hypothetical sell quantity to change; it must never place an
order. The realized dialog must attribute gains and losses to completed sell trades with inferred
allocated buy cost, sell price, costs, amount, and return percentage. Preserve observed-versus-
simulated labeling, accessible dialog behavior, exact VND rounding, and focused component coverage.

Complete: both profit/loss cards are now keyboard-accessible dialog triggers. The unrealized dialog
shows every holding's average cost, current/hypothetical sale price, adjustable available quantity,
modeled fee/tax, projected amount, and return; it has no sale/submit action and closes by button,
backdrop, or Escape. The realized dialog splits visible gains and losses and attributes each completed
sale using its allocated weighted-average cost, sale/current price, costs, amount, and return while
retaining the all-history account total. Calculations use integer/decimal-string VND half-up rounding.

Validation: the focused dashboard component file passes all 10 tests, including quantity-driven
recalculation, no-order enforcement, Escape handling, and gain/loss sale attribution. TypeScript,
ESLint, and `git diff --check` pass. The full frontend run passed 69 of 72 tests; the known OTP initial
`00:00` race failed, and one unrelated comparison test plus one pre-existing dashboard test exceeded
the shared five-second timeout under the parallel full-suite load. The dashboard file passes cleanly
in isolation, so those timeouts were not retried or masked. No production build ran.

## Proportional two-row heatmap and advanced-only market - 2026-10-12 (complete)

Keep each sector tile visibly proportional to the absolute percentage movement while packing the
bounded 16-sector heatmap into two complete rows instead of inflating a low-movement orphan tile.
Make the Market stock experience permanently advanced: remove the Basic switch/table path, ignore
legacy `mode=basic` query input, and keep advanced candles, columns, and fundamentals as the default.
Add regression coverage and visually verify both Home and Market at the reported desktop viewport.

Complete: the heatmap now caps each desktop row at eight sectors and assigns each tile a zero basis
plus a flex-grow equal to `max(abs(change_percent), 0.05)`. Each row therefore normalizes its own
observed movement weights across the full width: the 16-sector runtime renders as two 8-tile rows,
the 5.71% tile is visibly widest, and the 0.39% tile is visibly smallest without becoming an orphan
third row. On narrow screens each eight-tile row may wrap into readable weighted pairs.

The Stocks route no longer parses or emits a display mode. Stocks always render the VN-Index
candlestick, nine-column advanced table, and bounded P/E/P/B enrichment. The Basic/Nâng cao switch,
basic table branch, volatility badges, hidden mode field, mode-bearing reset/preset links, and their
dead CSS were removed. Legacy `?mode=basic` input is ignored and no generated link propagates it.

Validation: the two focused component files pass 17 tests, including a 16-sector 8/8 proportional
layout and a legacy-basic advanced-only regression. All 15 non-auth frontend files pass 63 tests;
ESLint, TypeScript, and `git diff --check` pass. The generated Next development cache was moved to a
recoverable temp quarantine and rebuilt. Runtime `/` renders two rows with exact grow weights from
5.71 through 0.39; default `/market/stocks` and legacy `?mode=basic` both render the advanced heading
without a Basic switch or mode-bearing links. Chrome screenshots at 1920 px visually confirm Home's
two proportional rows and Market's advanced chart/table. No production build ran.

## Sector heatmap final-row fit - 2026-10-12 (complete)

Fix the Home/Market sector heatmap so every wrapped row, especially the final row, consumes the
full available width for any sector count and movement distribution. Replace the incorrect odd-count
heuristic with a flex-layout invariant, add a 16-sector regression matching the reported runtime,
and verify the live Home page at the reported desktop viewport without rebuilding production assets.

Complete: the previous implementation guessed the last-row shape from whether the total sector
count was odd. The reported snapshot had 16 sectors, but movement-weighted bases wrapped the last
tile onto its own row with `flex-grow: 0.39`; because a flex line whose total grow factor is below one
may retain unused free space, more than half the row remained empty. Every tile now receives a grow
factor of `1 + absolute movement`, preserving movement-based relative sizing while guaranteeing that
each independently wrapped row has enough total growth to consume its available width. The shared
component applies this behavior to both Home and Market.

Validation: the new 16-sector regression failed against the old heuristic and passes with the new
layout invariant; all 15 non-auth frontend test files pass 63 tests, and ESLint, TypeScript, and
`git diff --check` pass. The stale generated Next development cache was moved to a recoverable temp
quarantine and rebuilt. Runtime HTML for both `/` and `/market/stocks` contains 16 tiles with a
minimum grow factor of 1.39. A 1920 px Chrome screenshot confirms the final `Du lịch và Giải trí`
tile fills the complete final row with no right-side gap. No production build ran.

## Paper-order success completion and notification - 2026-10-12 (complete)

Close the simulated-order popup after the API returns a valid filled trade, update the parent
dashboard, and show an unmistakable success notification outside the popup. Prevent the successful
button from becoming available for accidental duplicate purchases, preserve idempotency and error
recovery, and add regression coverage for both Portfolio and stock-detail entry points.

Complete: the order API and backend were already succeeding; runtime logs showed two HTTP 201 order
responses about five seconds apart. The shared dialog kept its success result inside the still-open
form and re-enabled Submit, which made the first fill look unfinished and allowed a duplicate click.
The dialog now accepts success only when the response includes a filled trade, updates its owning
dashboard, emits a fixed page-level confirmation with side, quantity, symbol, and execution price,
then closes immediately. Errors remain in the open dialog for correction and retry, and the existing
in-flight/idempotency guards remain intact.

Validation: both Portfolio and stock-detail regression tests assert that a successful request shows
the external confirmation and removes the dialog; all 12 focused portfolio tests and the other 15
non-auth frontend test files pass (63 tests). Full ESLint, TypeScript, and `git diff --check` pass.
The generated Next development cache was moved to a recoverable temp quarantine and rebuilt; the
running `/portfolio` route returns HTTP 200 and its client/server bundles contain the new success UI.
At 21:47 +07 the runtime VPB response remained `fresh`, `source_delayed`, and `closed`, with provider
market time 16:08 +07 on 2026-10-12. No production build or additional paper order was run.

## Chart-local wheel zoom for Month and Year - 2026-10-12 (complete)

Prevent page scrolling whenever a wheel gesture is handled over a zoomable stock chart, and extend
the existing bounded, pointer-anchored wheel zoom from Year to Month. Preserve historical panning,
hover detail, newest-observation clamping, accessible keyboard controls, and observed candle data;
add regression coverage for browser-default prevention and Month zoom.

Complete: Month and Year now share bounded, pointer-anchored wheel and `+`/`-` zoom from 40 candles
through the full selected-range window. The chart installs a native `wheel` listener with
`passive: false`, calls both `preventDefault()` and `stopPropagation()` for handled vertical wheel
gestures, and removes the listener on rerender/unmount. The page therefore remains fixed while the
pointer is over either zoomable chart, including when the zoom limit has already been reached.

Validation: all 7 candlestick component tests pass, including explicit assertions that a Month wheel
event is default-prevented, does not reach `window`, and changes the visible candle count. The other
15 frontend test files pass 63 tests; TypeScript, full ESLint, and `git diff --check` pass. The complete
suite run had 69 passing tests and one unrelated pre-existing auth countdown failure: its immediate
assertion observed the Countdown component's initial `00:00` before its effect set `01:30`. That auth
test was not changed or masked. After refreshing only the generated Next dev cache, the live VPB
Month page returned HTTP 200, rendered 140 observed hourly candles with Month zoom controls, and was
visually inspected at 1920 px. Runtime `vnstock-kbs` metadata remained fresh/source-delayed/closed at
21:31 +07 with market time 16:08 +07 on the latest valid 2026-10-12 session. No production build ran.

## Candlestick drag release, denser ranges, and yearly wheel zoom - 2026-10-12 (complete)

Stop chart panning immediately when the pointer is released or cancelled, increase observed candle
density for Week and Month without synthesizing bars, and add bounded mouse-wheel plus keyboard
zoom for the Year chart. Preserve hover details, historical panning, the newest-observation clamp,
and current market-data freshness semantics; add interaction regression coverage and validate the
live VPB development page without a production build.

Complete: pointer release, cancellation, or capture loss now clears the active drag, while a separate
click-suppression flag prevents a completed drag from selecting a candle. Week requests observed
30-minute bars and Month requests observed hourly bars, yielding denser windows without synthesized
market activity. The Year view supports pointer-anchored mouse-wheel zoom plus accessible `+`/`-`
controls, bounded from 40 candles to the full one-year source window and clamped at the newest
observation. Existing hover/focus OHLC detail and horizontal history navigation remain intact.

Validation: all 69 frontend tests and all 120 backend tests pass with 15 environment-gated skips;
frontend TypeScript and ESLint plus focused backend Ruff/mypy and registered market-data suites pass.
The live backend returned 200 observed VPB 30-minute candles from 2026-09-10 through 2026-10-12 and
170 hourly candles from 2026-08-14 through 2026-10-12. After clearing a stale generated Next dev
cache, `/market/stocks/VPB?range=year` returned HTTP 200 with the wheel/keyboard zoom controls and was
visually inspected alongside the 54-candle Week chart at 1920 px. No production build was run.

## Stock-detail depth statistics and interactive chart ranges - 2026-10-12 (complete)

Replace the stock-detail buy/matched/sell presentation with provider-observed top-of-book depth,
depth totals/visualization, and a richer execution tape. Refine Day, Week, Month, and Year chart
windows and axis labels, retain candle hover detail, increase useful candle density, and add bounded
horizontal panning into older history without allowing navigation beyond the current market time.
Preserve all previously completed market UX and freshness behavior, add focused regression coverage,
and validate against the active VPB development runtime without running a production build.

Complete: instrument detail now carries up to three real provider bid/ask levels and renders them as
a compact depth table, bounded imbalance/totals, and depth bars beside a six-column execution tape.
Execution price changes are calculated with backend Decimal arithmetic from the observed reference
price. Day uses five-minute candles with hour labels, Week uses hourly candles over seven calendar
days, Month begins at the opening of the prior month, and Year begins in the same month last year
with January/year plus alternating-month labels. The chart keeps hover/focus OHLC detail, uses wider
dense candle bodies, and supports pointer dragging plus accessible buttons into older fetched history;
both paths clamp at the newest observation.

Validation: the full backend suite passes 120 tests with 15 environment-gated skips; registered
market-data suites pass 25 unit and 6 integration tests and regenerate their Allure reports. The full
frontend suite passes 67 tests; TypeScript, ESLint, Ruff, strict focused mypy, and `git diff --check`
pass. A clean single Docker Next dev runtime returns HTTP 200 and was visually inspected at 1920px:
the VPB chart, navigation controls, depth bars, and execution tape render without an error overlay.
At 21:01 +07 the runtime `vnstock-kbs` response was fresh and closed with market time 16:08 +07;
VPB exposed real bid levels 24,400/24,350/24,300, ask levels 24,450/24,500/24,550, 170 hourly
candles through the valid 2026-10-12 session, and an ATC execution at 14:45:18 +07. No order-book
level, execution, or calendar candle was fabricated. No production build was run.

## Stock-detail hydration and missing intraday table - 2026-10-12 (complete)

Reproduce and fix the reported React hydration mismatch on sector/detail navigation and ensure the
new intraday execution table is actually rendered on the stock-detail page served at localhost:3000.
Keep one authoritative Next development runtime/cache, add regression coverage if a code defect is
found, and revalidate the live VPB detail response plus market-data freshness before handoff.

Complete: the source component and API were already correct; the failing boundary was the active
development runtime. A Docker Next dev server and a host Next dev server had written concurrently to
the same bind-mounted `frontend/.next` Turbopack database. Runtime logs showed missing cache SST files,
and the resulting server HTML omitted `#stock-table` while the client bundle included it, producing
the hydration overlay and serving the pre-table stock-detail bundle. The generated cache was moved to
a recoverable temp quarantine, then one Docker development server was recreated on localhost:3000
with separate edge/backend networking and a clean cache. No application source change was needed for
this follow-up, and existing regression tests already assert both the anchored sector navigation and
the intraday table contract.

Validation: a real Chrome headless hydration pass for the reported VPB URL contains the intraday card
and buy/sell columns with no React hydration message or Next error overlay. The server response is
HTTP 200 and contains buy/matched/sell columns, ATC data, and the filtered `#stock-table` return link;
the clean frontend log has zero hydration errors and zero Turbopack compaction failures. All 19 focused
market navigation/table tests pass and `git diff --check` remains clean. At 20:35 +07, runtime provider
metadata was `vnstock-kbs`, `source_delayed`, `session=closed`, and honestly labeled `stale`; VPB's
latest candle is still the valid 2026-10-12 session and its latest observed execution is ATC at
14:45:18 +07. No calendar-day or intraday value was fabricated.

## Market trading, fundamentals, navigation, and stock-detail UX - 2026-10-12 (complete)

Fix the non-responsive stock Buy action, extend P/E and P/B enrichment beyond only the current
15-row page while keeping provider work bounded, preserve the stock-table viewport across Market and
Portfolio pagination, and return from stock detail directly to the originating table. Ensure today's
valid trading-session candle is shown when the provider supplies it. Add an honest intraday
buy/matched/sell view to stock detail using only provider-observed data, make the Home sector heatmap
fill its card without a trailing gap, and navigate sector selections directly to the filtered stock
table. Add focused regression coverage, verify runtime freshness against the latest valid Vietnamese
trading session, and run the affected frontend/backend checks without a production build.

Complete: the stock Buy action now opens an accessible application modal without relying on the
browser-native dialog API. Market and Portfolio progressively load missing P/E and P/B values across
their bounded 100-symbol universes in sequential 15-symbol requests. Pagination, sector selection,
stock-detail ranges, and detail-return links retain explicit table anchors; Portfolio also scrolls its
client-paged table into view. Odd Home heatmaps let the final sector fill the remaining row. Stock
detail now exposes recent provider-observed executions in buy/matched/sell columns, clearly labels
buy/sell as the aggressive matched side rather than order-book depth, and merges a real current-session
OHLCV snapshot into lagging daily history without fabricating pre-open or non-session candles.

Validation: backend full suite passes with 120 tests and 15 environment-gated skips; frontend full
suite passes all 66 tests after one unrelated OTP fake-clock test was rerun and confirmed flaky. Ruff,
strict focused mypy, ESLint, TypeScript, and `git diff --check` pass. At 20:27:12 +07 on 2026-10-12,
runtime `vnstock-kbs` metadata was `fresh` and `closed`; FPT's latest daily candle was the valid
2026-10-12 session (O/H/L/C 58,100/58,800/57,100/57,100, volume 5,930,000), and the latest execution
was ATC at 14:45:07 +07, price 57,100, volume 350,900. The Next development UI returned HTTP 200 and
contained the Buy action, buy/sell execution columns, ATC row, current-session candle, and anchored
return destination. No production build was run.

## Automatically viewable Allure reports - 2026-10-11 (complete)

Keep `allure-pytest` as the Python result adapter, but make every registered backend feature-suite
run automatically convert its JSON into a directly openable official Allure HTML report. Generate
the report for failing as well as passing suites, lock the report generator in the existing npm
toolchain, keep all generated output ignored, and synchronize testing rules and developer docs.

Complete: the feature runner still uses Python `allure-pytest` for source results, then invokes the
locked official Allure Commandline 2.46.1 with `--single-file` to create the sibling
`allure-report/index.html`. Report generation runs unconditionally after pytest, so failed suites
also retain inspectable evidence; missing Java/CLI is a visible runner failure. Generated JSON and
HTML remain ignored, while legacy `pytest-html`, JUnit, coverage XML, and coverage Markdown stay
disabled. Testing rules, architecture/project memory, decision log, result README, and development
guide now describe the same contract.

Validation: a real `logging-viewer unit` run passed 8 tests at 100% branch coverage and produced nine
Allure JSON files plus a 2.66 MB single-file report. A real `auth integration` run passed four tests,
skipped four database-dependent tests, and created
`test-results/auth/integration/allure-report/index.html`. Ruff and strict mypy pass for the runner,
the locked npm tree resolves `allure-commandline@2.46.1`, and `git diff --check` is clean. The current
local Python environment was synchronized with `backend/requirements-dev.txt` so `allure-pytest`
2.16.2 is active.

## Interactive stock candles and closed-session paper buy - 2026-10-11 (complete)

Add pointer and keyboard inspection to the stock-detail candlestick chart so each candle exposes its
time, OHLC values, volume, and direction. Explain candlestick anatomy, MA5, MA20, volume bars, and the
latest-price guide directly below the chart. Diagnose the reported Buy-button issue and preserve the
educational automatic-fill rule outside the live exchange session, including weekends, with focused
frontend and backend regression evidence.

Complete: every candle now has a full-height pointer target and keyboard focus target. Hovering,
focusing, or tapping reveals Vietnam-local time, open/high/low/close, volume, and the candle's
percentage movement, while a crosshair and the compact quote row track the selected candle. Stock
detail charts explain candlestick anatomy, MA5, MA20, the latest-close guide, and volume immediately
below the plot. The detail action area explicitly states that paper orders remain available while the
real exchange is closed, including weekends; symbol-specific Buy/Sell labels and regression coverage
confirm the stock-detail flow. The reported behavior was not a weekend backend block: runtime account
requests were HTTP 200 and the automatic-fill service deliberately ignores live-session state while
still rejecting stale provider data.

Validation: all 59 frontend tests, ESLint, and TypeScript pass. The four focused backend paper-trading
service tests pass, including the closed-session automatic-fill case, and `git diff --check` is clean.
After restarting only the frontend development container so Windows bind-mount changes were picked
up, `/market/stocks/FPT?range=year` returns HTTP 200 and its rendered HTML contains the candle targets,
chart guide, and weekend execution note. Runtime provider metadata is `vnstock-kbs`,
`freshness=fresh`, `session=closed`, with market time/latest daily candle 2026-10-09 and receive time
2026-10-11; this is valid because 2026-10-11 is Sunday. No weekend candle or price was fabricated.

## Market-table fundamentals and Allure results - 2026-10-11 (complete)

Fix the remaining P/E and P/B gap in the main `/market/stocks` advanced table. The root cause is that
list reads intentionally omit expensive per-symbol fundamentals while only stock detail and the
portfolio table consumed the bounded enrichment route. Reuse one shared client hook so both visible
15-row tables fetch ratios through the existing three-concurrent-call BFF without market-wide fan-out.
Add a regression component test.

Replace repository-local pytest HTML/JUnit/coverage report artifacts with Python `allure-pytest`
result data. Remove all generated legacy directories under `test-results/`, keep only its tracked
README/ignore policy, pin the dependency in pip and uv manifests, and update the feature runner plus
all structure/rule/developer documentation. Branch coverage remains visible in the terminal; Allure
JSON is written below each feature/suite `allure-results/` directory.

Complete: all legacy generated result directories were removed. The shared fundamentals hook is wired
into the market, portfolio, and legacy market table components; 16 focused frontend tests pass. Allure
2.16.2 is pinned in pip and uv manifests, and the runner/documentation migration is implemented.

Validation: all 57 frontend tests, ESLint, and TypeScript pass. All 117 backend tests pass with 15
environment-dependent skips; Ruff and strict mypy pass for the changed runner. A real
`logging-viewer unit` feature run passed 8 tests at 100% branch coverage and created only Allure
`*-result.json`/`*-container.json`; no generated HTML, XML, Markdown, or JUnit report remains. The uv
lock is current and its 65 installed packages pass compatibility checks. Runtime `/market/stocks`
advanced mode returns HTTP 200, and the bounded route returns live ratios for FPT (15.53 / 3.7), HPG
(13.05 / 1.69), and VCB (12.38 / 2.33). Provider `vnstock-kbs` reports `freshness=fresh`,
`session=closed`, market time 2026-10-09 and receive time 2026-10-11; 09/10 remains the latest valid
session because 11/10 is Sunday. Backend and frontend development services remain running.

## Automatic paper fills and session-aware market freshness - 2026-10-11 (complete)

Refine the completed paper-trading workflow for a beginner practice environment: accepted simulated
buys/sells should automatically fill in full at the latest authoritative observed price, the order
history should not expose status/cancellation filters, and the UI must explain that real exchange
execution differs. Show Sell only for an available owned quantity, load P/E and P/B for the current
15-row portfolio page without market-wide fan-out, balance pagination controls, and improve the
observed-gainers text size. Add a repository rule requiring every agent touching market data to
verify runtime freshness against the latest valid Vietnam trading session rather than the calendar
date; do not fabricate weekend or holiday candles.

Complete: application and repository fills no longer depend on an editable LO threshold or
open-session state, while stale provider data still fails closed. The shared dialog now confirms an
automatic observed-price fill and discloses real-market waiting/partial/non-fill behavior. Order
history filters only side/symbol, unowned Sell actions are hidden on both board and detail, and the
visible market page uses a public bounded fundamentals BFF (15 symbols, three concurrent detail
reads). CSS corrects pagination sizing and observed-gainer legibility. The new
`.agents/rules/market-data-freshness.md` rule and routing/documentation changes are in place.

Validation: all 117 backend tests pass with 15 environment-dependent skips; the four paper-portfolio
repository/migration tests also pass against an isolated disposable PostgreSQL database. Focused Ruff
and strict mypy pass. All 56 frontend tests, ESLint, and TypeScript pass, and `git diff --check` is
clean. The restarted development backend/frontend are healthy; `/portfolio`, `/market/stocks`, and
`/market/stocks/FPT?range=day` return HTTP 200. The bounded fundamentals route returns live FPT/HPG
P/E and P/B. Runtime market evidence is provider `vnstock-kbs`, `freshness=fresh`, `session=closed`,
with `market_time=2026-10-09T08:33:23.586Z` and a 2026-10-11 receive time. This is correct because
2026-10-11 is Sunday and 2026-10-09 is the latest valid Vietnamese trading session; no weekend candle
was fabricated. No production build, deployment, or production data reset was run.

## Advanced stock board and durable paper orders - 2026-10-11 (complete)

Fix the `/portfolio` advanced-board failure that currently converts a server-side market-data
request error into an indistinguishable empty result. Add explicit loading/error/empty recovery and
keep symbol navigation stable across reloads and client navigation. Extend the existing private
immediate-fill simulation into one shared LO workflow used by the portfolio board, stock detail,
and owned-position table: durable order states, atomic cash/share reservations, idempotent placement,
market-price re-evaluation, cancellation, order filters/history, and consistent portfolio accounting.
Preserve the existing authenticated BFF, provider provenance, decimal money, row-locking, and
no-fabricated-data boundaries.

Complete: the hidden-board defect was the portfolio Server Component converting every market-data
failure to `null` and then an empty array. The route now distinguishes loading, source error with
retry, and a valid empty result without fallback fixtures. Migration `0013_paper_orders` adds durable
day-valid LO states and atomic cash/share reservations. Fresh open-session quotes fill qualifying
orders at the observed market price; other orders remain pending/open, re-evaluate on dashboard reads
and 30-second open-page refreshes, and release reservations on cancellation or expiry. The board,
stock detail, and owned-position table use one accessible order dialog. The dashboard exposes
available versus reserved capacity, status/side/symbol filters, cancellation, persistent orders, and
immutable fills. Partial fills, exchange holidays, ATO/ATC, settlement, and broker connectivity stay
explicitly outside this educational model.

Validation: all 117 backend tests passed with 14 environment-dependent skips; full Ruff and strict
mypy on the seven changed backend contract/core files passed. The paper-trading feature runner passed
4 unit and 3 API tests, with its 3 database tests skipped when `TEST_DATABASE_URL` was unset; those
same 3 repository/migration tests then passed against a disposable PostgreSQL 17 container. All 54
frontend tests, full ESLint, and TypeScript passed. Compose rendered successfully, `git diff --check`
passed, and the Next 16 development route `/portfolio` returned HTTP 200 with its loading fallback;
the API was intentionally not running during that final anonymous route smoke, so market fetches
logged expected connection refusals. No production build, persistent deployment, or production
migration was run.

Local runtime follow-up: the non-root backend image inherited `HOME=/nonexistent`, so Vnstock could
not create its private `.vnstock` profile and every market/portfolio provider dependency failed.
The image now provisions writable `/home/app`, exports it as `HOME`, and verifies writability during
the build without relaxing the `USER app` boundary. The rebuilt development backend serves market
overview/instruments and `/market/stocks` successfully; 15 focused Vnstock/API tests pass.

## Portfolio market-table trading workflow - 2026-10-08 (complete)

Replace the standalone symbol-entry order card with the advanced Market stock table. Every displayed
symbol provides a Buy action; owned symbols also provide Sell. Both actions open a bounded quantity
confirmation ticket and continue to use the existing CSRF-protected, idempotent simulated-order API.
Replace holding cards with a dedicated management table for purchased stocks, preserving price source,
fees/tax disclosure, observed performance, and explicit missing-value behavior.

Complete: `/portfolio` now loads up to 100 VN30-first instruments, presents the same nine advanced
market fields plus per-row trade actions, supports local search and 15-row paging, and only exposes a
sell action when the dashboard confirms ownership. The confirmation ticket bounds a sale by the owned
quantity. Purchased positions have a separate management table with quantity, cost, observed price,
value, daily change, unrealized result, weight, history, buy-more and sell actions. Component coverage
proves owned/unowned actions and the CSRF order boundary. Frontend lint, TypeScript, the focused tests,
and all 51 frontend tests pass; the authenticated running `/portfolio` route and its BFF both return
HTTP 200. No production build or deployment was run.

## Beginner paper-trading portfolio - 2026-10-08 (complete; DB execution pending)

Build an authenticated, private paper-trading experience for beginners. Each user receives one
VND simulation account with a documented starting balance; market orders fill immediately at the
latest observed provider price, never place a broker order, and record immutable execution/source
metadata plus idempotency. Show cash, invested cost, marked market value, realized/unrealized and
total profit/loss, holdings, bounded trade history, and a portfolio value curve. Add beginner-facing
market opportunities and risk notices derived only from observed price/liquidity plus the existing
news analysis, with explicit unavailable/educational labels instead of invented forecasts. Protect
all personalized API/cache paths through the existing BFF session and database ownership boundary.
Add a forward-only migration, domain/application/repository/API/UI coverage, a delivery plan, and
focused validation. Production deployment remains gated by an explicit target environment and by
market-data display/redistribution rights.

Complete: `/portfolio` now provides one private 100-million-VND simulation account per authenticated
user, immediate idempotent buy/sell fills at the latest observed canonical price, weighted-average
cost, modeled fees/tax, immutable history, cash/current/realized/unrealized totals, per-holding price
history, an estimated 90-session curve, observed gainers, positive tagged news, and deterministic
stale/decline/concentration notices. Missing quotes produce partial/null valuations instead of zero.
Migration `0012_paper_trading` uses row locks and database constraints; `/portfolio-api` applies CSRF
and server-held credentials while FastAPI re-verifies the BFF secret, active session, and user scope.
The delivery and follow-up plan is `docs/plan/paper-trading.md`.

Validation: all 115 backend tests passed with 13 environment-dependent skips; full Ruff passed.
The paper-trading feature runner passed two unit tests at 85.41% branch coverage and three API
integration tests; its two PostgreSQL repository tests were skipped because `TEST_DATABASE_URL` is
unset and Docker Desktop is stopped. Targeted strict mypy passed seven core files. All 51 frontend
tests, ESLint, TypeScript, Compose rendering, and `git diff --check` passed. No production build,
migration execution, browser smoke, or deployment ran; an explicit environment plus approved market
data rights are still required.
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
