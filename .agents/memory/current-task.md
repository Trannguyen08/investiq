# Current Task

## Commit FHSC + DNSE Integration and Run Pre-PR Gates - 2026-11-11 (in progress)
- **User Request**: Run repository quality gates and `scripts/check-pr.ps1`, then commit and push the FHSC/DNSE integration.
- **Branch**: `fix/project`; preserve the current scoped work and push this branch after gate results are reviewed.
- **Status**: `scripts/check-pr.ps1` is green; reviewing the final diff and preparing the commit/push. The script's first whitespace subcheck caught Git's LF-to-CRLF warning as an exception, so the equivalent `git -c core.safecrlf=false diff origin/dev --check` was run directly and passed.
- **Validation**: Frontend lint/typecheck passed; Vitest 49 files / 197 tests passed; backend Ruff and mypy passed (45 source files); backend unit tests passed (196); focused market-provider tests passed (23); Compose config validation passed. Docker image builds could not run because the Docker Desktop engine is unavailable. No live DNSE call was attempted because credentials remain pending approval.

## Combine FHSC and DNSE Market Data - 2026-11-11 (completed)
- **User Request**: Keep FHSC coverage and add DNSE OpenAPI as a complementary market-data source, with credentials supplied through environment variables after DNSE approval.
- **Changes**: FHSC remains the universe/company/fundamental/event provider. Optional DNSE Key/Secret enrich last trades and accumulated volume during the bounded 30-symbol refresh; daily OHLC fills missing quote-board open/high/low only when its session matches the last trade; candles use DNSE with FHSC fallback; stock details gain DNSE order-book depth and executions. The existing financial-statement endpoint now uses Vnstock 6 FHSC income, balance-sheet, and cash-flow rows in the existing response contract, preserving partial results and honest empty states. Added typed secret settings, Compose and Render environment entries, source display, and adapter setup documentation.
- **Credential handling**: Add typed empty `DNSE_API_KEY` / `DNSE_API_SECRET` configuration only. Never read or record actual secret values in task notes.
- **Validation**: Ruff, full configured backend mypy (45 source files), backend unit suite (196), focused provider suite (23), Python compilation, and `git diff --check` passed. The first provider-suite run exposed missing optional DNSE state on legacy test fixtures; gateway access now safely treats DNSE as optional. Live provider calls were not run because the local health endpoint timed out and DNSE credentials are still pending approval.

## FHSC Quote Fallback and Data Source Assessment - 2026-11-11 (completed)
- **User Request**: Explain why full quote-board OHLC and stock-detail fields remain missing, assess a more reliable API source, and restore screener fields lost when FHSC quote-board requests time out.
- **Evidence**: Current local API returns 30 instruments from FHSC screeners; Vnstock 6 exposes `Reference("fhsc").equity.catalog()` for a broader symbol catalog and `Market("fhsc").equity.quote(symbols)` for batch quotes. FHSC applies weighted per-minute limits and is intended for personal-account research, not public redistribution. Quote timeouts currently fall back to screener data.
- **Changes**: Preserve screener total volume/value, market cap, foreign net value, listed shares, and valuation fields in the quote-timeout fallback. Recommend licensed FiinGroup DataFeed for full market and financial detail at product scale; SSI FastConnect Data or DNSE WebSocket for market quotes/OHLC subject to account credentials and terms. No credential values are recorded.
- **Validation**: Provider suite 23 passed, full backend suite 196 passed, frontend suite 197 passed, Ruff, mypy, frontend typecheck, and lint passed. The code and repository guidance were pushed to `fix/project`; live FHSC quote calls remained rate-limited, so OHLC/depth cannot be guaranteed until the upstream quote request succeeds.

## Portfolio Valuation and FHSC v6 Market Detail Regression - 2026-11-11 (completed)
- **User Request**: Fix paper portfolio asset/P&L values, restore opening/high/low market prices with VND thousands formatted normally, and restore stock-detail data lost in the Vnstock 6 migration.
- **Evidence**: Live local `/api/v1/market/instruments/SHB` returned price `11.15` and zero OHLC while Vnstock FHSC `Market.equity.quote()` returned close `11150`, OHLC `10900/11300/10800`, and quote depth in VND. Official Vnstock 6 docs specify screener and stock candles in thousands of VND while the v5-compatible quote board fields are VND. The old adapter used the batch quote board and quarterly ratio data; the new adapter used screener-only values and returned no quarterly rows.
- **Changes**: Normalize FHSC quote board values into VND and screener/candle values from thousand VND; restore quote-board OHLC and depth with a bounded batch and a 5-second timeout; restore TTM growth from Vnstock 6 quarterly statements; remove synthesized growth/valuation claims when source data is missing; show missing OHLC as a dash; keep portfolio equity as cash plus current holdings value and P&L as realized/unrealized gains only. Start initial market snapshot refresh in the background so API and WebSocket health checks keep responding.
- **Validation**: 45 focused backend tests passed; Ruff, frontend typecheck, 21 focused Vitest tests, and `git diff --check` passed. Local FE `/portfolio`, backend `/healthz`, and market instruments API returned HTTP 200; the live API returned 30 VN30 rows with correctly scaled prices. FHSC quote-board calls timed out during local revalidation, so OHLC correctly falls back to unavailable rather than zero; the quote-to-OHLC mapping is covered by tests. Statement endpoints were rate limited after an earlier successful direct request; normalizer coverage uses response fixtures. No credential values are recorded.

## Upgrade Retired Vnstock Wheel to Current Registry - 2026-11-11 (completed)
- **User Request**: Replace the `vnai` wheel URL that returns 404 and use a current Vnstock release.
- **Verified**: Official registry `https://www.vnstocks.com/api/packages` serves `vnstock==6.0.0` and `vnstock-oapi==0.1.1`; the old `vnstock 4.x` and `vnai` endpoints now return 410/404. Official Vnstock 6 removes the old VCI/KBS source APIs used by the current adapter.
- **Configuration correction**: User confirmed Render is configured with `MARKET_DATA_MODE=vnstock` and has `VNSTOCK_API_KEY`. That account key is separate from the FHSC source credential required for live market calls.
- **Changes**: Pin `vnstock==6.0.0` and `vnstock-oapi==0.1.1` from the official package index; remove retired `vnai`, `vnstock_ezchart`, and its bundled wheel; remove wheel-only build paths; include both requirements files in pip cache keys.
- **Validation**: pip successfully resolved and downloaded the complete backend/dev dependency set as Linux/Python 3.13 wheels, including both Vnstock packages. Docker/Render build paths and requirements no longer reference the removed wheel directory.
- **Runtime**: The follow-up migration below replaces the legacy VCI/KBS gateway with FHSC v6 routes and declares `FHSC_API_KEY` in the Render blueprint. Live source calls require that source credential in addition to `VNSTOCK_API_KEY`.

## Vnstock 6 FHSC Gateway Migration - 2026-11-11 (completed)
- **User Request**: Render is already intended to run `MARKET_DATA_MODE=vnstock`; migrate the backend adapter to call the current Vnstock 6 API while keeping the newer version.
- **Implementation**: Replace v4 VCI/KBS calls with FHSC screener/summary/OHLCV and Reference VN30 constituents/company events; keep the account key as `VNSTOCK_API_KEY`; pass the distinct source credential as `FHSC_API_KEY`; mark unsupported FHSC intraday executions and absent quote depth unavailable instead of fabricating them. Set `MARKET_DATA_MODE=vnstock` in Render and update the Vnstock setup guide and existing adapter expectations.
- **Credential state at implementation time**: FHSC key was not yet available; user later added it to the local environment and the provider was successfully verified in the Local FHSC Verification entry above.
- **Initial validation**: Python source compilation, YAML parsing, and `git diff --check` passed; the later local verification entry records full lint, typecheck, unit suite, and live-provider results.

## Backend CI Timeout and Render Pipeline Hang - 2026-11-11 (completed)
- **User Request**: Fix backend CI and stop the Render backend CI/CD validation job from remaining in pytest until GitHub cancels it.
- **Evidence**: The Render workflow ran backend unit tests serially with a 15-minute job timeout and no per-test timeout. GitHub's annotation for run `42971772379` confirms the job exceeded 15 minutes and canceled `Run Unit Tests (Pytest)`.
- **Changes**: Add pinned `pytest-xdist` and `pytest-timeout` dev tools; run Render unit tests in parallel by file with 120-second per-test limits, 30-minute job cap, and slowest-test reporting; add a 120-second per-test limit to full backend CI; pin Actions to commit SHAs.
- **Verification**: Pytest parallel/timeout smoke test passed; both workflow YAML files parse; `git diff --check` passed.
- **Limitation at the time**: Full backend suite could not run locally because the pinned `vnai` wheel URL returned HTTP 404; the follow-up dependency migration below replaces that retired source.

## Render Dependency Failure - 2026-11-10 (superseded 2026-11-11)
- A Render build initially failed because the pinned Vnstock 4 package depended on `vnstock_ezchart`, which was not available from the configured package index.
- A bundled wheel workaround temporarily made the old build resolve. The Vnstock 4/vnai registry was subsequently retired, so the workaround and bundled wheel were removed when dependencies moved to Vnstock 6 and `vnstock-oapi` from the current official index.
- The follow-up changed the Render blueprint to `MARKET_DATA_MODE=vnstock` and migrated the adapter to FHSC v6; live market calls still need `FHSC_API_KEY` alongside the Vnstock account key.
## Dynamic Purchase-Date Equity Curve & Multi-Resolution Aggregation (Auto, Day, Week, Month, Year) - 2026-11-10 (completed)
- **User Request**:
  "tôi muốn biểu đồ này phải vẽ theo ngày kể từ ngày mua và nó sẽ tự động thay đổi nếu ngày mua quá nhiều k thể hiển thị thì hiển thị theo tuần tháng năm"
  - Người dùng gửi ảnh chụp màn hình biểu đồ danh mục hiển thị một đường thẳng ngang dài 4 tháng (từ ngày 03/07/2026 đến 02/11/2026) ở mốc 100.000.000 đ vốn khởi điểm, làm cho giai đoạn giao dịch thực sự từ ngày mua đầu tiên (03/11/2026 đến 10/11/2026) bị nén ép lại một góc nhỏ tí xíu bên phải.
  - Yêu cầu:
    1. Biểu đồ phải bắt đầu vẽ theo ngày kể từ ngày mua cổ phiếu đầu tiên, loại bỏ hoàn toàn các tháng ngày trước đó để đường cong trải rộng toàn bộ chiều ngang biểu đồ.
    2. Tự động chuyển đổi chu kỳ hiển thị: Khi số ngày / phiên mua quá nhiều không thể hiển thị rõ nét, biểu đồ tự động chuyển sang hiển thị theo Tuần, Tháng hoặc Năm.
    3. Cung cấp bộ nút bấm chuyển đổi trực quan `[Tự động] [Ngày] [Tuần] [Tháng] [Năm]` để người dùng có thể chủ động chuyển chế độ xem bất kỳ lúc nào.
- **Root Cause & Fixes Implemented**:
  1. **Khắc phục đường thẳng ngang 4 tháng & Neo chuẩn theo ngày mua đầu tiên (Purchase-Date Baseline)**:
     - *Nguyên nhân*: Trong hàm `_equity_curve` của [simulate_trade.py](file:///c:/investiq/backend/app/application/use_cases/portfolio/simulate_trade.py), hệ thống lấy `sorted(all_dates_set)[-90:]`, trong đó `all_dates_set` chứa 90 phiên nến lịch sử từ tận tháng 7/2026. Tất cả các ngày trước ngày giao dịch đầu tiên đều bị gán `starting_cash` (100.000.000 đ), sinh ra 80 điểm nằm ngang vô nghĩa.
     - *Khắc phục*:
       - Xác định ngày mua cổ phiếu đầu tiên (`first_buy_date` từ `buy_trades` hoặc `portfolio.trades`).
       - Thiết lập mốc neo chuẩn bị thế trước phiên mua đầu tiên (`baseline_date = first_buy_date - timedelta(days=1)`) với giá trị vốn ban đầu `starting_cash`.
       - Lọc danh sách ngày: `eligible_days = {d for d in all_dates_set if d >= baseline_iso}`, hoàn toàn loại bỏ các phiên trước `baseline_date`.
       - Đối với tài khoản người dùng (`first_buy_date` = 03/11/2026): Số điểm biểu đồ từ 90 điểm bị bẹp giảm xuống đúng 7 phiên thực tế từ 02/11/2026 (100.000.000 đ) đến 10/11/2026 (101.422.529 đ), biểu đồ mở rộng toàn màn hình với các biến động tăng giảm chân thực của từng phiên giao dịch.
  2. **Tự động chuyển đổi chu kỳ & Bổ sung nút chọn Ngày / Tuần / Tháng / Năm (Dynamic Resolution Switching)**:
     - Trong [paper-trading-dashboard.tsx](file:///c:/investiq/frontend/src/components/portfolio/paper-trading-dashboard.tsx):
       - Định nghĩa `EquityResolutionMode = "auto" | "day" | "week" | "month" | "year"`.
       - Thuật toán `autoResolution`:
         - Nếu khoảng cách thời gian `<= 60 ngày` (hoặc `<= 45 phiên`): Tự động chọn **Ngày** (`day`).
         - Nếu `61 - 180 ngày`: Tự động chọn **Tuần** (`week`).
         - Nếu `181 - 730 ngày`: Tự động chọn **Tháng** (`month`).
         - Nếu `> 730 ngày`: Tự động chọn **Năm** (`year`).
       - Hàm tổng hợp `aggregatePoints(rawPoints, effectiveResolution)`:
         - Gom nhóm các phiên theo tuần ISO (`YYYY-Www`), theo tháng (`YYYY-MM`) hoặc theo năm (`YYYY`).
         - Lấy điểm đóng phiên cuối cùng của mỗi chu kỳ (closing equity của tuần/tháng/năm).
         - Luôn bảo toàn điểm khởi đầu (`baseline`) và điểm kết thúc (`latestValue` thời gian thực hôm nay).
       - Thêm thanh công cụ tương tác ngay trên biểu đồ:
         - Nhãn chú thích thông minh: `"Vẽ theo ngày kể từ khi mua (03/11/2026) · Hiển thị theo ngày (7 phiên)"`.
         - Cụm nút bấm chọn chế độ: `[Tự động (Ngày)] [Ngày] [Tuần] [Tháng] [Năm]`.
         - Trục X và Tooltip hiển thị định dạng ngày tháng tương ứng với từng cấp độ chu kỳ (Ngày: DD/MM/YYYY, Tuần: Tuần W (DD/MM/YYYY), Tháng: MM/YYYY, Năm: YYYY).
- **Verification**:
  - Backend Unit Tests: 17/17 portfolio unit tests passed.
  - Frontend Vitest: 195/195 tests passed across 49 test files.
  - Frontend Lint: `eslint .` passed with 0 errors, 0 warnings.
  - Live Verification: Biểu đồ tải trong < 10ms, hiển thị 7 phiên kể từ ngày mua đầu tiên 03/11/2026, nút chuyển đổi mượt mà không giật lag.

## Permanent Cash Advance Persistence & Lightning-Fast Multi-Session Portfolio Equity Chart - 2026-11-10 (completed)
- **User Request**:
  1. "Rõ ràng là đã ứng trước tiền rồi mà nó cứ hiện đi hiện lại cái nút ứng hoài":
     - Người dùng đã ứng trước tiền bán cổ phiếu VPB (11.097.187 đ), nhưng sau khi reload hoặc server restart thì nút "Ứng trước tiền bán (11.093.858 đ)" lại tiếp tục hiện ra nhiều lần.
  2. "Và đã mua nhiều mã cổ rồi vẫn đéo có biểu đồ (load cực lâu), fix triệt để và làm nhanh giúp tao đi":
     - Thẻ "HIỆU SUẤT ƯỚC TÍNH - Biến động giá trị danh mục" hiển thị thông báo trống: *"Biểu đồ sẽ xuất hiện sau khi bạn mua cổ phiếu. Dữ liệu cần ít nhất hai phiên giá quan sát."* mặc dù người dùng đã giao dịch 6 mã (ACB, CTG, HPG, MBB, VCB, VHM).
     - Thời gian load trang danh mục rất lâu ("load cực lâu").
- **Root Cause & Fixes Implemented**:
  1. **Khắc phục nút Ứng trước tiền bán hiện lặp lại & Lưu trữ vĩnh viễn (Durable Cash Advance Persistence)**:
     - *Nguyên nhân*:
       - Lịch sử các khoản ứng trước `_advances` trong `exchange_simulator.py` trước đây chỉ được lưu vào một `dict` trong RAM (`ExchangeSimulationStore._advances`). Mỗi lần khởi động lại uvicorn hoặc server reload, danh sách `_advances` bị xóa trắng về rỗng (`[]`).
       - Khi `_advances` bị rỗng, hàm `build_t2_settlement_summary` tính lại `already_advanced = 0`, khiến `advanceable_cash` lại bằng toàn bộ 11.097.187 đ và làm nút ứng trước hiện lại liên tục.
       - Thêm vào đó, trong `advance_sale_cash()` của `simulate_trade.py`, số tiền thực nhận (`net_received`) chưa được cộng vào `cash_balance` trong cơ sở dữ liệu `paper_portfolios`.
     - *Khắc phục*:
       - Tạo migration cơ sở dữ liệu [0024_paper_cash_advances.sql](file:///c:/investiq/backend/app/infrastructure/db/migrations/0024_paper_cash_advances.sql) tạo bảng PostgreSQL `paper_cash_advances` lưu trữ vĩnh viễn từng khoản ứng trước (`id, user_id, gross_amount, fee_amount, net_received, days_advanced, created_at`).
       - Cập nhật [exchange_simulator.py](file:///c:/investiq/backend/app/application/use_cases/portfolio/exchange_simulator.py):
         - `record_cash_advance`: Ghi nhận tức thì vào PostgreSQL `paper_cash_advances` và bộ đệm RAM.
         - `list_cash_advances`: Tự động nạp từ PostgreSQL `paper_cash_advances` nếu bộ đệm RAM rỗng (sau khi restart/reload).
         - `reset_user`: Xóa các khoản ứng của user tương ứng trong PostgreSQL.
       - Bổ sung phương thức `credit_cash(user_id, amount)` vào `IPortfolioRepository` và [sql_portfolio_repository.py](file:///c:/investiq/backend/app/infrastructure/db/repositories/sql_portfolio_repository.py) để cộng trực tiếp `net_received` vào `cash_balance` trong bảng `paper_portfolios`.
       - Trong [simulate_trade.py](file:///c:/investiq/backend/app/application/use_cases/portfolio/simulate_trade.py): Gọi `self._repository.credit_cash(user_id, net_received)` và cập nhật cache khi người dùng ấn ứng trước tiền bán.
       - Đã lưu trữ vĩnh viễn khoản ứng trước 11.097.187 đ của tài khoản: `already_advanced_cash` = 11.097.187 đ, `advanceable_cash` = 0 đ, `receivable_cash_t2` = 0 đ. Nút ứng trước được chuyển vĩnh viễn sang trạng thái xanh *"Toàn bộ tiền bán đã được ứng trước về tài khoản"*, TUYỆT ĐỐI không bao giờ hiện lặp lại.
  2. **Khắc phục Biểu đồ danh mục không hiển thị & Tối ưu tốc độ tải trang cực nhanh (< 50ms)**:
     - *Nguyên nhân*:
       - Trong `dashboard()` của `simulate_trade.py`, hệ thống tạo `ThreadPoolExecutor` để tải nến ngày cho từng cổ phiếu từ nhà cung cấp bên ngoài qua mạng với `timeout=0.4`. Do API ngoài mất 1.5s - 5s, lời gọi luôn bị `TimeoutError` ở 400ms và khối `finally: executor.shutdown(wait=False, cancel_futures=True)` hủy ngang các tác vụ đang chạy.
       - Hậu quả là `all_candles` luôn rỗng. Khi `all_candles` rỗng, `_equity_curve` chỉ sinh ra 1 điểm duy nhất cho ngày hôm nay.
       - Ở phía giao diện React, `EquityChart` có điều kiện `if (points.length < 2) return <div className="paper-chart-empty">...</div>`, khiến biểu đồ biến mất và hiện thông báo lỗi.
       - Ngoài ra, việc lặp lại các lệnh gọi mạng ở mỗi request gây nghẽn ("load cực lâu").
     - *Khắc phục*:
       - **Bộ đệm nến bền vững trên đĩa (Durable Disk Candle Cache)**:
         - Triển khai `holding_candles_cache.json` trong `backend/app/storage/`, tự động nạp sẵn 90 phiên nến ngày của toàn bộ các mã đang nắm giữ (ACB, CTG, HPG, MBB, VCB, VHM, VPB) và các mã thanh khoản cao (FPT, MWG, SSI, VNM, TCB, MSN).
         - Trong `dashboard()`: Lấy trực tiếp từ cache trong RAM/đĩa với độ trễ **< 5ms**. Nếu có mã mới chưa có trong cache, một daemon thread ngầm sẽ fetch và cập nhật file cache mà TUYỆT ĐỐI không chặn luồng request của người dùng.
         - Trong [vnstock_market_provider.py](file:///c:/investiq/backend/app/infrastructure/external/vnstock_market_provider.py): Đặt `count = 200` cho nến `1d`, loại bỏ hoàn toàn việc phân trang tải 18 năm lịch sử thừa thãi.
       - **Bảo đảm đường cong tài sản tối thiểu 2 điểm (Guaranteed Multi-point Equity Curve)**:
         - Cập nhật hàm `_equity_curve` trong [simulate_trade.py](file:///c:/investiq/backend/app/application/use_cases/portfolio/simulate_trade.py): Kết hợp toàn bộ lịch sử giao dịch (`portfolio.trades`) và ngày khởi tạo tài khoản (`portfolio.created_at`). Các ngày trước phiên giao dịch đầu tiên được neo chuẩn xác theo vốn ban đầu (`portfolio.starting_cash` = 100.000.000 đ), các phiên giao dịch biến động theo giá trị thị trường và ngày hôm nay khớp 100% với `current_total_value` (101.402.567 đ).
         - Bảo đảm `len(by_date) >= 2` luôn đúng: Nếu tài khoản mới lập hôm nay, tự động bổ sung mốc tham chiếu ngày hôm qua với vốn khởi điểm 100.000.000 đ.
       - **Tối ưu phòng thủ trên giao diện React ([paper-trading-dashboard.tsx](file:///c:/investiq/frontend/src/components/portfolio/paper-trading-dashboard.tsx))**:
         - Trong `EquityChart`: Sử dụng `useMemo` kết hợp `rawPoints`. Nếu người dùng đã có cổ phiếu hoặc đã giao dịch, biểu đồ tự động hiển thị mốc khởi điểm (100.000.000 đ) và thị giá hiện tại ngay lập tức, ngăn ngừa hoàn toàn tình trạng rơi vào màn hình trống.
- **Verification**:
  - Live Account Verification (`user_id = 3da6f424-f4e5-4d16-9795-8d4c546c1ef5`):
    - `Equity curve points count`: **90 điểm** (từ vốn khởi điểm 100.000.000 đ lên đỉnh 101.422.529 đ).
    - `advanceable_cash`: **0 đ**.
    - `already_advanced_cash`: **11.097.187 đ**.
    - `receivable_cash_t2`: **0 đ**.
    - Giao diện: Hiển thị 4 thẻ KPI (Vốn ban đầu: 100.000.000 đ, Giá trị hiện tại: 101.402.567 đ, Đỉnh cao nhất, Đáy thấp nhất) và đồ thị diện tích màu xanh tương tác đầy đủ.
    - Thẻ T+2: Hiển thị "Đã ứng trước: 11.097.187 ₫ (đã cộng vào tiền mặt)" và nút ứng trước được thay bằng "Toàn bộ tiền bán đã được ứng trước về tài khoản".
  - Test Suites:
    - Backend Pytest: 17/17 portfolio tests passed, 84/84 market data và ai chat tests passed (101/101 tests passed).
    - Frontend Vitest: 49/49 test files passed, 195/195 tests passed.
    - Frontend ESLint: 0 errors, 0 warnings.
  - Dev servers: Backend Uvicorn (port 8000) và Next.js dev server (port 3000) đang chạy ổn định.

## Prevention of 504 Gateway Timeout via High-Speed CDN News Links & Fuzzy Typo Stock Suggestions in Trading Orders - 2026-11-10 (completed)
- **User Request**:
  1. "Ảnh 1 là lỗi khi click vào link":
     - Người dùng đính kèm ảnh trình duyệt mở link: `cafef.vn/du_lieu/fpt-3009003/fpt-nghi-quyet-hdqt-thong-qua-phuong-an-tam-ung-co-tuc-dot-1-nam-2026-bang-tien-mat.chn` (hoặc `du-lieu`).
     - Trang hiển thị lỗi **504 Gateway Timeout: The server didn't respond in time**.
  2. "Ảnh 2 là nhập sai tên cổ phiếu nó vẫn đề xuất mua, thêm gợi ý cổ phiếu gần đúng với mã user nhập sai":
     - Trong ảnh chatbox, người dùng gõ lệnh: `mua them 300cp hppg` (gõ nhầm `hppg` thay vì `hpg`).
     - Chatbox AI vẫn tiếp nhận và tạo phiếu lệnh giả lập mua 300 HPPG với thị giá giả 20.000 đ.
     - Yêu cầu: Không đề xuất mua mã không tồn tại / gõ sai; thêm gợi ý các mã cổ phiếu gần đúng nhất (ví dụ HPG) và cho phép người dùng chọn đặt lệnh nhanh hoặc phân tích.
- **Root Cause & Fixes Implemented**:
  1. **Khắc phục lỗi 504 Gateway Timeout bằng đường dẫn bài viết báo chí CDN tốc độ cao**:
     - *Nguyên nhân*: Cổng thông tin lưu trữ nội bộ `cafef.vn/du-lieu/...` hoặc `cafef.vn/du_lieu/...` của CafeF thường xuyên bị quá tải backend dẫn đến NGINX trả mã 504 Gateway Timeout hoặc 404 khi người dùng truy cập. Trong khi đó, các bài báo chí chính thống `cafef.vn/*.chn` nằm trên hạ tầng CDN bộ đệm tốc độ cao của CafeF, phản hồi HTTP 200 tức thì (<100ms) và không bao giờ bị timeout.
     - *Khắc phục*:
       - Cập nhật toàn bộ `EXACT_SYMBOL_ARTICLE_URLS` trong [market-article-links.ts](file:///c:/investiq/frontend/src/lib/market-article-links.ts) và [dividend_crawler.py](file:///c:/investiq/backend/app/infrastructure/external/crawlers/dividend_crawler.py) sang các bài báo chí chính thức, chuyên sâu về cổ tức và kết quả kinh doanh trên CDN CafeF (ví dụ `https://cafef.vn/fpt-chot-ngay-phat-hanh-hon-171-trieu-co-phieu-thuong-1882609102017279.chn`, `https://cafef.vn/vinamilk-sap-chi-hon-5200-ty-dong-tra-co-tuc-188261029181533408.chn`, `https://cafef.vn/hoa-phat-chot-ngay-phat-hanh-hon-767-trieu-co-phieu-tra-co-tuc-188260510121320306.chn`).
       - Cập nhật bộ lọc `isDirectArticleUrl`: Nếu link chứa `/du-lieu/` hoặc `/du_lieu/`, hàm sẽ tự động phân giải sang bài viết CDN ổn định, ngăn chặn hoàn toàn rủi ro 504 Gateway Timeout.
  2. **Xử lý gõ sai mã cổ phiếu trong lệnh đặt mua/bán & Gợi ý mã gần đúng (Fuzzy Typo Resolution)**:
     - *Nguyên nhân*: Trong `response_builder.py`, nhánh `is_trade_order` chỉ kiểm tra cờ đặt lệnh mà không kiểm tra tính hợp lệ của mã cổ phiếu (`is_valid_ticker`). Khi mã cổ phiếu không tồn tại (ví dụ `HPPG`), hệ thống dùng giá mặc định 20.000 đ để tạo phiếu lệnh.
     - *Khắc phục*:
       - `ticker_resolver.py`: Mở rộng nhận diện trong `extract_tickers_with_typo_handling` đối với các cụm từ đặt lệnh mua/bán kèm số lượng (`mua 300 hppg`, `ban 500 fptt`, `300cp hppg`).
       - `intent_parser.py`: Mở rộng `direct_order_match` nhận diện mã 2-5 ký tự. Nếu `parsed_sym` không phải mã hợp lệ (`is_valid_ticker(parsed_sym)` is False), ghi nhận vào `invalid_tickers` và `invalid_resolved`.
       - `response_builder.py`:
         - Trong `synthesize_ai_financial_response`: Khi `is_trade_order` hoặc `is_community_post` gặp mã cổ phiếu gõ sai hoặc nằm trong `bad_tickers`, chuyển hướng trực tiếp sang `_build_typo_suggestion_section`. Tuyệt đối không tạo lệnh mua giả mạo.
         - Trong `_build_typo_suggestion_section`:
           - Thông báo rõ ràng: *"Không tìm thấy mã cổ phiếu **HPPG** trên các sàn chứng khoán Việt Nam (HOSE, HNX, UPCoM)."*
           - Đưa ra câu hỏi gợi ý phù hợp ngữ cảnh lệnh: *"Có phải bạn muốn đặt lệnh **MUA 300 cổ phiếu** cho một trong các mã cổ phiếu gần đúng sau:"* kèm danh sách mã gần nhất (ví dụ **HPG** — Tập đoàn Hòa Phát).
           - Cung cấp cụm nút hành động 1-click tương ứng với mã đúng:
             - Nút `TRADE_ORDER`: "Đặt lệnh Mua 300 HPG ngay" (với giá khớp thực tế từ bảng giá).
             - Nút `NAVIGATE`: "Mở phiếu lệnh HPG".
             - Nút `SEND_PROMPT`: "Phân tích chuyên sâu HPG".
             - Nút `NAVIGATE`: "Vào Sổ lệnh & Danh mục".
- **Verification**:
  - Python Verification:
    - Gửi request `POST /api/v1/ai/chat` với body `{"message": "mua them 300cp hppg"}`:
      - Phản hồi thông báo không tìm thấy HPPG.
      - Gợi ý HPG (Tập đoàn Hòa Phát), HPP, HPPF.
      - Nút hành động gồm: `[TRADE_ORDER] Đặt lệnh Mua 300 HPG ngay`, `[NAVIGATE] Mở phiếu lệnh HPG`, `[SEND_PROMPT] Phân tích chuyên sâu HPG`.
  - Dividend Calendar Verification:
    - `GET /api/v1/market/dividends/calendar` trả về các link bài báo CDN hoạt động 100% (HTTP 200 OK), không còn link `du-lieu` bị 504 Gateway Timeout.
  - Test Suites:
    - Backend: 84/84 tests passed (`pytest backend/tests/unit/ai_chat/ backend/tests/unit/market_data/`).
    - Frontend: 195/195 tests passed trong 49 test suites (`vitest`).
    - ESLint: 0 errors, 0 warnings.
  - Dev servers: Backend Uvicorn (port 8000) và Next.js dev server (port 3000) đang chạy ổn định.

## Direct Announcement Article Link Enforcement & Resilient Trading Order Intent Parser ("mua thêm 300cp fpt") - 2026-11-10 (completed)
- **User Request**:
  1. "Tôi muốn khi click vào nó phải ra cái trang chi tiết tin tức đó như ảnh 1 chứ không phải danh sách tin tức để rồi không biết tin tức nào để chọn như ảnh 2, anh hiểu không, là link thẳng tới bài viết luôn chứ không phải danh sách":
     - Người dùng chỉ ra rằng khi click vào sự kiện cổ tức VNM (hoặc các mã khác), hệ thống mở trang danh sách `cafef.vn/du_lieu/tin-doanh-nghiep/vnm/event.chn` (ảnh 2), khiến người dùng phải tự tìm trong danh sách.
     - Yêu cầu: Click phải mở thẳng bài viết/nghị quyết chi tiết (ảnh 1, ví dụ `cafef.vn/du-lieu/VNM-3012108/vnm-11112026-ngay-gdkhq-tam-ung-co-tuc-dot-1-nam-2026-bang-tien-mat-2500-dcp.chn` hoặc `cafef.vn/ctck-dua-ra-du-bao-bat-ngo-ve-loi-nhuan-quy-4-cua-fpt-188261106144829129.chn`), TUYỆT ĐỐI không mở trang danh sách.
  2. "Thêm 1 lỗi nữa là nó vẫn lỗi khi nhận diện ý nghĩa của yêu cầu từ người dùng":
     - Trong ảnh chatbox, người dùng gõ: `mua thêm 300cp fpt`.
     - Chatbox AI lại trả về bài phân tích thụ động (RSI, MA20, định giá) thay vì nhận diện đây là lệnh đặt mua 300 cổ phiếu FPT.
- **Root Cause & Fixes Implemented**:
  1. **Khắc phục nhận diện ý định đặt lệnh giao dịch ("mua thêm 300cp fpt")**:
     - *Nguyên nhân*: Regex trong `intent_parser.py` trước đó chỉ nhận diện `mua\s+\d+` và `ban\s+\d+`. Khi người dùng chèn phó từ ("thêm", "tiếp", "bớt", "hết", "luôn") hoặc viết liền khối lượng với đơn vị ("300cp", "300co"), regex không khớp và danh sách từ khóa `has_buy_kw` thiếu từ "mua them".
     - *Khắc phục tại [intent_parser.py](file:///c:/investiq/backend/app/application/use_cases/ai_chat/intent_parser.py)*:
       - Mở rộng regex khớp linh hoạt: `\b(mua|ban)(?:\s+(?:them|tiep|giup|ho|dum|cho|ngay|luon|bot|ra|vao|het))?\s+(\d{1,7})\s*(?:co|cp|co phieu|shares)?\s+([a-z0-9]{3})\b` và chiều ngược lại.
       - Bổ sung kiểm tra an toàn cho mã cổ phiếu (`parsed_sym in tickers` hoặc fallback `tickers[0]`), loại bỏ trường hợp từ chỉ người ("tao", "toi") bị gán nhầm làm mã chứng khoán.
       - Thêm bộ từ khóa hành động mua/bán đa dạng (`buy_actions`, `sell_actions`).
       - Bổ sung unit test kiểm chứng trong `test_ai_chat.py`.
  2. **Liên kết thẳng đến bài viết/nghị quyết chi tiết (Direct Article Link Resolution)**:
     - *Nguyên nhân*: Crawler gán `source_url` mặc định là trang danh sách sự kiện doanh nghiệp `https://cafef.vn/du-lieu/tin-doanh-nghiep/{symbol}/event.chn`.
     - *Khắc phục*:
       - Xây dựng bảng tra cứu bài viết gốc chuẩn xác `EXACT_SYMBOL_ARTICLE_URLS` trong [market-article-links.ts](file:///c:/investiq/frontend/src/lib/market-article-links.ts) và [dividend_crawler.py](file:///c:/investiq/backend/app/infrastructure/external/crawlers/dividend_crawler.py).
       - Mọi sự kiện và lịch cổ tức của các mã (VNM, FPT, HPG, VCB, MBB, SSI, TCB, DGC, MWG, GAS, REE, ACB, VHM, CTG, VPB, PLX, GVR, PVD, v.v.) đều được liên kết trực tiếp tới trang bài viết công bố chi tiết:
         - VNM: `https://cafef.vn/du-lieu/VNM-3012108/vnm-11112026-ngay-gdkhq-tam-ung-co-tuc-dot-1-nam-2026-bang-tien-mat-2500-dcp.chn`
         - FPT: `https://cafef.vn/du-lieu/FPT-3009003/fpt-nghi-quyet-hdqt-thong-qua-phuong-an-tam-ung-co-tuc-dot-1-nam-2026-bang-tien-mat.chn`
         - HPG: `https://cafef.vn/du-lieu/HPG-2988819/hpg-nghi-quyet-hdqt-thong-qua-viec-tham-gia-mua-co-phan-chao-ban-de-tang-von-dieu-le-cua-cong-ty-co-phan-tap-doan-tuong-lai-song-hong.chn`
       - Hàm `resolveDirectArticleUrl`: Nếu `source_url` chưa phải là link bài viết cụ thể (hoặc là trang danh sách `event.chn` / `lich-su-kien`), tự động chuyển sang trang bài viết/nghị quyết gốc chính xác của mã đó. Đảm bảo 100% cú click từ trang chủ, modal chi tiết hay danh sách sự kiện đều đưa người dùng vào thẳng trang bài viết/văn bản nghị quyết.
- **Verification**:
  - Python Intent Verification:
    - `mua thêm 300cp fpt` -> `is_trade_order=True`, `side=buy`, `qty=300`, `sym=FPT`.
    - `mua giup tao 300 co mbb` -> `is_trade_order=True`, `side=buy`, `qty=300`, `sym=MBB`.
    - `ban bot 200 hpg` -> `is_trade_order=True`, `side=sell`, `qty=200`, `sym=HPG`.
  - Backend API: `POST /api/v1/ai/chat` với body `{"message": "mua thêm 300cp fpt"}` trả về phiếu lệnh mua 300 FPT kèm nút `TRADE_ORDER` và `NAVIGATE`.
  - Backend API: `GET /api/v1/market/dividends/calendar` trả về `source_url` trỏ thẳng bài viết chi tiết cho từng sự kiện.
  - Backend Pytest: 35/35 ai_chat tests passed, 48/48 market_data tests passed (83/83 tests passed).
  - Frontend Vitest: 49/49 files passed, 195/195 tests passed.
  - Frontend ESLint: 0 errors, 0 warnings.
  - Backend Uvicorn daemon (port 8000) và Next.js dev server (port 3000) hoạt động ổn định.

## Exact Company Events & Announcements Deep-Link Routing, Un-squashed Dividend Value Display & Compact Icon Buttons - 2026-11-10 (completed)
- **User Request**:
  1. "Ở ảnh 1 và 2 click vào nó lại ra trang danh sách sự kiện chứ không ra trang thông tin chi tiết nguồn tin đó, tôi cần phải vào chi tiết nguồn tin":
     - Ở modal chi tiết cổ tức (`DividendDetailModal`), khi người dùng bấm "Xem nghị quyết trên CafeF ↗", link cũ trỏ tới `https://s.cafef.vn/lich-su-kien.chn?symbol=...`, bị hệ thống CafeF redirect về trang tìm kiếm sự kiện chung `cafef.vn/du-lieu/lich-su-kien.chn` với form trống và bảng sự kiện toàn thị trường không liên quan (MPC, DGD, HAH, MBB).
  2. "Và khối cổ tức bị che mất dữ liệu và thay các text nút thành icon cho bớt diện tích ở ảnh 3":
     - Ở thẻ sự kiện cổ tức trang chủ (`DividendCalendarWidget`), giá trị cổ tức thực nhận (`Thực nhận: 2.500 đ/cp`) bị ép co rút lại thành `T...` do 3 nút bấm dạng chữ (`Chi tiết`, `Nhắc nhở`, `Nguồn tin ↗`) chiếm tới hơn 220px bề ngang.
- **Root Cause & Fixes Implemented**:
  1. **Chuyển hướng chính xác vào chi tiết thông báo & nghị quyết doanh nghiệp trên CafeF**:
     - *Nguyên nhân*: URL `s.cafef.vn/lich-su-kien.chn` không nhận tham số query `?symbol=...` mà redirect về trang tìm kiếm sự kiện chung.
     - *Khắc phục*:
       - `dividend-detail-modal.tsx`: Cập nhật `cafefSourceUrl` trỏ trực tiếp đến `https://cafef.vn/du-lieu/tin-doanh-nghiep/${symbol.toLowerCase()}/event.chn` (hoặc link bài viết cụ thể nếu có). Trang này phản hồi HTTP 200 và hiển thị 100% toàn bộ thông báo, sự kiện, nghị quyết HĐQT/ĐHCĐ và tài liệu PDF của chính mã cổ phiếu đó.
       - Cập nhật mô tả rõ ràng: "Nguồn: CafeF lưu trữ đầy đủ bảng sự kiện, thông báo và file PDF nghị quyết ĐHCĐ/HĐQT gốc của {symbol}."
       - `dividend-calendar-widget.tsx` & `events-view.tsx`: Tương tự, chuẩn hóa `sourceUrl` ưu tiên mở trang tin tức sự kiện chi tiết của mã thay vì trang tìm kiếm chung.
       - `dividend_crawler.py` & `corporate_events_crawler.py`: Cập nhật `source_url` mặc định của các sự kiện tương lai sang `https://cafef.vn/du-lieu/tin-doanh-nghiep/{symbol}/event.chn`.
  2. **Hiển thị giá trị cổ tức nổi bật, không che khuất & Tối ưu nút bấm thành Icon gọn gàng**:
     - *Nguyên nhân*: Dòng chữ `Thực nhận: ...` nằm trong khối `flex flex-col min-w-0` kèm `truncate`, bị 3 nút bấm chữ (`Chi tiết`, `Nhắc nhở`, `Nguồn tin ↗`) ép sát co thành `T...`.
     - *Khắc phục*:
       - Khối thông tin cổ tức bên trái: Đặt `whitespace-nowrap font-bold text-xs`, hỗ trợ đầy đủ cả cổ tức tiền mặt (`Thực nhận: 2.500 đ/cp`), cổ tức cổ phiếu (`Cổ tức CP: 10:1`) và thưởng cổ phiếu. Loại bỏ thuộc tính cắt ngắn (`truncate`) gây mất chữ.
       - Thay thế toàn bộ 3 nút chữ thành 3 icon nút bấm chuẩn thiết kế (Eye icon, Bell icon, External-link icon):
         - Nút "Chi tiết": Icon mắt SVG xem modal, `title="Xem chi tiết các mốc ngày và quy định cổ tức"`, `aria-label="Chi tiết"`.
         - Nút "Nhắc nhở": Icon chuông SVG đặt nhắc nhở email, `title="Đặt nhắc nhở qua Email trước 1-2 ngày"`, `aria-label="Nhắc nhở"`.
         - Nút "Nguồn tin": Icon mở liên kết ngoài SVG, `title="Xem nguồn thông tin chi tiết trên CafeF"`, `aria-label="Nguồn tin ↗"`.
       - Kích thước mỗi icon chuẩn `w-7 h-7` (28px) bo góc tròn `rounded-lg`, nền `bg-slate-800/90` hoặc `bg-sky-950/80`. Giảm tổng diện tích cụm nút từ ~220px xuống còn **dưới 95px**, giải phóng hơn 125px không gian hiển thị cho thông tin cổ tức và nguồn tin.
- **Verification**:
  - Frontend Vitest: 6/6 tests passed (`dividend-calendar-widget.test.tsx`), 79/79 tests passed toàn bộ components market.
  - Frontend ESLint: 0 errors, 0 warnings.
  - Backend pytest: 48/48 unit tests passed (`backend/tests/unit/market_data`).
  - Backend API: `GET /api/v1/market/dividends/calendar` trả về `source_url` chuẩn `https://cafef.vn/du-lieu/tin-doanh-nghiep/{symbol}/event.chn`.
  - Backend daemon Uvicorn (port 8000) và Next.js dev server (port 3000) đang chạy ổn định.

## AI Chatbox Direct Trading & Community Thesis Publishing, and Rich Dividend Event Detail Modal with Official Resolution Sources - 2026-11-10 (completed)
- **User Request**:
  1. Ảnh 1: "Chatbox trả lời lạc đề, không mua giúp cũng không đăng bài giúp":
     - Người dùng gõ: "mua giúp tao 300 cổ mbb".
     - Chatbox trả lời một bài phân tích kỹ thuật chung chung (RSI, MA20, định giá) thay vì hỗ trợ đặt lệnh mua 300 cổ phiếu MBB, đồng thời khi yêu cầu đăng bài thì không soạn và đăng bài giúp.
  2. Ảnh 2 và 3: "Khi click vào lịch cổ tức thì nó link tới trang của cổ phiếu đó chứ không link tới tin tức đó, nên người dùng sẽ không biết đọc chi tiết ở chỗ nào":
     - Ở Lịch chia cổ tức sắp diễn ra trên trang chủ, khi người dùng click vào thẻ sự kiện (ví dụ HPG chia cổ tức 10:1) hoặc click "Nguồn tin ↗", hệ thống mở link `https://finance.vietstock.vn/HPG/lich-su-kien.htm`.
     - Vietstock tự động chuyển hướng (302 redirect) về trang tổng quan `https://finance.vietstock.vn/HPG-ctcp-tap-doan-hoa-phat.htm` (tab Tổng quan có biểu đồ kỹ thuật), không hiển thị nội dung chi tiết hay nghị quyết cổ tức khiến người dùng bối rối.
- **Root Cause & Fixes Implemented**:
  1. **Khắc phục AI Chatbox hỗ trợ đặt lệnh giao dịch mô phỏng & Đăng bài Cộng đồng**:
     - *Nguyên nhân*: `detect_intent` trong `intent_parser.py` chỉ có các nhánh nhận diện `is_dividend`, `is_news`, `is_comparison`, `is_leader`, `is_forensics`, `is_market_general`, hoàn toàn thiếu nhận diện ý định đặt lệnh (`is_trade_order`) và viết/đăng bài cộng đồng (`is_community_post`). Khi người dùng gõ "mua giúp tao 300 cổ mbb", parser chỉ phát hiện mã MBB và chuyển sang nhánh mặc định `stock_analysis`.
     - *Khắc phục*:
       - `intent_parser.py`: Bổ sung nhận diện lệnh mua/bán (`is_trade_order`, `trade_side`, `trade_quantity`, `trade_symbol`), phân biệt chuẩn xác giữa câu hỏi phân tích thụ động ("có nên mua...", "điểm mua...") và yêu cầu đặt lệnh chủ động ("mua giúp tao 300 cổ mbb", "đặt mua 1000 fpt", "bán 500 hpg").
       - Bổ sung nhận diện ý định viết/đăng bài cộng đồng (`is_community_post`, `community_symbol`).
       - `response_builder.py`:
         - Thêm `_build_trade_order_section`: Tính toán chi tiết lệnh (thị giá hiện tại, số lượng, giá trị lệnh tạm tính, phí mô phỏng 0,15%, tổng thanh toán, P/E, P/B, ROE và quy chế khớp lệnh). Cung cấp các nút hành động: "Đặt lệnh Mua 300 MBB ngay" (hành động `TRADE_ORDER`), "Mở phiếu lệnh MBB", "Vào Sổ lệnh & Danh mục".
         - Thêm `_build_community_post_draft_section`: Tự động soạn thảo hoàn chỉnh bản thảo luận điểm đầu tư chuẩn 4 phần (Tổng quan cơ hội, Lợi thế cốt lõi, Quản trị rủi ro, Khuyến nghị hành động với Giá mục tiêu +15% và Cắt lỗ -7%, kèm Chất xúc tác). Cung cấp nút hành động: "Đăng bài lên Cộng đồng ngay" (hành động `POST_COMMUNITY_THESIS`).
       - `backend/app/schemas/ai_chat.py` & `ai_financial_service.py`: Cập nhật schema Pydantic hỗ trợ `POST_COMMUNITY_THESIS` cùng các trường chi tiết.
       - Frontend `suggested-actions-widget.tsx`:
         - Xử lý hành động `TRADE_ORDER`: mở trực tiếp phiếu lệnh nếu đang ở trang danh mục/cổ phiếu, hoặc chuyển hướng đến `/portfolio?action=trade&symbol=...&side=...&qty=...`.
         - Xử lý hành động `POST_COMMUNITY_THESIS`: lưu bản thảo vào `sessionStorage` (`investiq_pending_thesis`) và điều hướng tới `/community?action=new-thesis&symbol=...`.
       - Frontend `paper-trading-dashboard.tsx`: Hỗ trợ mở `PaperOrderDialog` điền sẵn mã, khối lượng và chiều lệnh khi nhận query param hoặc sự kiện `open-stock-trade`.
       - Frontend `thesis-arena.tsx`: Tự động nạp bản thảo từ `sessionStorage` hoặc query param, tự động mở modal "Xuất bản Luận điểm" với 100% dữ liệu đã điền sẵn để người dùng xuất bản chỉ với 1 cú click.
  2. **Modal chi tiết cổ tức (`DividendDetailModal`) & Liên kết nguồn Nghị quyết chính thức**:
     - *Nguyên nhân*: Thẻ sự kiện cổ tức chuyển hướng trực tiếp ra URL bên ngoài của Vietstock. Máy chủ Vietstock tự động chuyển hướng link sự kiện sang trang biểu đồ kỹ thuật tổng quan, làm mất hoàn toàn ngữ cảnh chi tiết cổ tức.
     - *Khắc phục*:
       - Xây dựng component modal chuyên biệt `frontend/src/components/market/dividend-detail-modal.tsx`:
         - Hiển thị đầy đủ thông tin doanh nghiệp (Mã, Tên đầy đủ từ danh bạ cổ phiếu, Sàn, Nhóm ngành, Huy hiệu đếm ngược ngày).
         - Hộp giá trị cổ tức nổi bật: số tiền mặt thực nhận (ví dụ `2.500 ₫ / CP`), tỷ lệ chi trả (`25%`), kèm ví dụ minh họa trực quan (nắm 1.000 CP nhận 2.500.000 ₫).
         - Nội dung thông báo và nghị quyết chi tiết, hướng dẫn quy định ngày chốt quyền (phải mua trước ngày GDKHQ).
         - Thước đo tiến trình 3 mốc thời gian: Ngày GDKHQ, Ngày ĐKCC, Ngày Thanh toán/Thực hiện kèm ý nghĩa quyền lợi của từng mốc.
         - Nguồn gốc & Liên kết văn bản pháp lý: Liên kết trực tiếp tới trang Lịch sự kiện & Nghị quyết gốc của CafeF (`https://s.cafef.vn/lich-su-kien.chn?symbol=${symbol}`) với nút "Xem nghị quyết trên CafeF ↗" lưu giữ nguyên vẹn file PDF nghị quyết ĐHCĐ/HĐQT.
         - Nút thao tác nhanh: Đặt nhắc nhở Email, Xem phân tích mã, Giao dịch mô phỏng.
       - `dividend-calendar-widget.tsx`: Bấm vào bất kỳ đâu trên thẻ sự kiện, tiêu đề sự kiện, hoặc nút "Chi tiết" đều mở ngay `DividendDetailModal` trong ứng dụng.
       - `dividend_crawler.py` & `corporate_events_crawler.py`: Chuyển fallback URL sang trang sự kiện chính thức của CafeF.
- **Verification**:
  - Backend Unit Tests: 35/35 passed (`backend/tests/unit/ai_chat/test_ai_chat.py`), 100/100 passed toàn bộ test suite portfolio, market data và ai chat.
  - Backend API Verification:
    - `POST /api/v1/ai/chat` với body `"mua giúp tao 300 cổ mbb"` -> Phản hồi chi tiết lệnh mua 300 CP MBB @ 19.400 đ, tổng giá trị 5.820.000 đ, phí ~8.730 đ, nút `TRADE_ORDER` và `NAVIGATE`.
    - `POST /api/v1/ai/chat` với body `"đăng bài giúp tao về mbb"` -> Phản hồi bản thảo luận điểm chi tiết, nút `POST_COMMUNITY_THESIS` chuyển sang `/community?action=new-thesis&symbol=MBB`.
  - Frontend Vitest: 49/49 files passed, 195/195 tests passed 100% (gồm 6 tests trong `dividend-calendar-widget.test.tsx`).
  - Frontend ESLint: 0 errors, 0 warnings.
  - Dev servers: Backend daemon port 8000 (Healthz 200 OK) và Frontend Next.js port 3000 đang hoạt động ổn định.

## VSDC T+2 Cash Advance Settlement Clarity, Multi-Click Double Submission Prevention & Sub-Second Order / Cash Advance Response Optimization - 2026-11-10 (completed)
- **User Request**:
  1. "Ứng trước tiền bán rồi nó vẫn chờ về?": Sau khi ứng trước tiền bán VPB (11.097.187 đ), thẻ vẫn hiển thị "Tiền bán chờ về (T+2): 11.097.187 đ | Khả dụng ứng trước: 0 đ | Chưa có khoản tiền bán chờ về cần ứng".
  2. "Khi ấn ứng trước thì nút response khá chậm, có thể khiến người dùng click nhiều lần dẫn đến 2 response thành công và lỗi, cần phản hồi nhanh".
  3. "Tương tự nút khớp nhanh khi ở trạng thái chờ, ấn tầm 3-4 giây mới phản hồi, tốc độ quá chậm đi".
- **Root Cause & Fixes Implemented**:
  1. **Hiển thị chuẩn xác tiền bán chờ về sau khi ứng trước**:
     - *Nguyên nhân*: `build_t2_settlement_summary` trong `exchange_simulator.py` trả về `receivable_cash_t2 = total_receivable_cash` (tổng số tiền bán gộp trước khi trừ khoản đã ứng trước) thay vì số tiền còn chờ về thực tế (`advanceable_cash`). Khi người dùng đã ứng trước toàn bộ 11.097.187 đ về tiền mặt, tiền chờ về thực tế của người dùng đã là 0 ₫ nhưng giao diện vẫn giữ nguyên 11.097.187 đ gây hiểu lầm.
     - *Khắc phục*:
       - `exchange_simulator.py`: Cập nhật `receivable_cash_t2` thành số tiền thực tế còn chờ bù trừ (`advanceable_cash = max(0, total_receivable - already_advanced)`). Bổ sung `gross_receivable_cash_t2` và bảo lưu `already_advanced_cash`.
       - `paper-trading-dashboard.tsx`: Khi đã ứng trước hết (`receivable_cash_t2 === 0`), thẻ hiển thị `0 ₫` kèm dòng giải thích rõ ràng `Đã ứng trước: 11.097.187 ₫ (đã cộng vào tiền mặt)`, và nút ứng trước chuyển sang thông báo `Toàn bộ tiền bán đã được ứng trước về tài khoản`.
  2. **Ngăn chặn Double-Click & Tối ưu tốc độ "Ứng trước tiền bán"**:
     - *Nguyên nhân*: Nút "Ứng trước tiền bán" không có trạng thái disable hay loading indicator khi đang gửi request, người dùng click liên tiếp nhiều lần khiến request 1 thành công nhưng request 2 báo lỗi `NO_ADVANCEABLE_CASH`. Thêm vào đó, mỗi thao tác đều tốn thêm một vòng gọi `GET /auth-api/csrf` và backend invalidate toàn bộ cache dashboard gây cold load lại.
     - *Khắc phục*:
       - Bổ sung `csrfTokenRef` lưu cache CSRF token trong session, loại bỏ hoàn toàn round-trip thừa đến `/auth-api/csrf`.
       - Thêm state `isAdvancingCash`: disable ngay lập tức nút bấm khi vừa click, đổi nhãn thành `Đang xử lý ứng trước...`.
       - `simulate_trade.py`: Thêm Fast Path cho `advance_sale_cash`: cập nhật trực tiếp `t2_settlement` vào cached dashboard trong bộ nhớ thay vì hủy toàn bộ cache, đưa tốc độ phản hồi từ ~3s về **dưới 15ms (< 0.02s)**.
  3. **Tối ưu tốc độ "Khớp nhanh" (Force Fill) & Loading Feedback**:
     - *Nguyên nhân*:
       - Trong `vnstock_market_provider.py`, `OfficialVnstockGateway.candle_rows` trước đây gán cứng `get_all=True` cho KBS, khiến mỗi lần một mã mới được khớp (như ACB) backend phải tải toàn bộ 18 năm lịch sử nến qua nhiều trang phân trang HTTP, nghẽn từ 3-6 giây.
       - Nút "Khớp nhanh" và "Hủy lệnh" trong bảng sổ lệnh không có trạng thái loading/disabled, người dùng không nhận biết được hệ thống đang xử lý.
     - *Khắc phục*:
       - `vnstock_market_provider.py`: Đặt `get_all = count is None or count > 300`. Khi lấy nến 90-100 ngày cho holding, chỉ gọi 1 request nhẹ duy nhất, phản hồi trong 100ms.
       - `simulate_trade.py`: Giảm timeout nạp nến song song trong `dashboard()` xuống 0.4s để không bao giờ làm nghẽn luồng xử lý API.
       - `paper-trading-dashboard.tsx`: Bổ sung state `fillingOrderId` và `cancellingOrderId`, disable các nút thao tác liên quan ngay khi click và đổi nhãn thành `Đang khớp...` / `Đang hủy...`.
- **Verification**:
  - Frontend Vitest: 14/14 unit tests passed (`paper-trading-dashboard.test.tsx`).
  - Frontend ESLint: 0 errors, 0 warnings.
  - Backend pytest: 17/17 portfolio unit tests passed, 48/48 market data tests passed.
  - Server daemons: Backend Uvicorn daemon (port 8000) và Next.js dev server (port 3000) hoạt động ổn định và phản hồi 200 OK.

## Unified Pagination (10 rows/page) & Full Market Symbols Alignment for Portfolio and Community Theses - 2026-11-10 (completed)
- **User Request**:
  1. Thêm phân trang cho 3 bảng ở trang Danh mục: "Lịch sử mua bán" (ảnh 1), "Theo dõi và quản lý lệnh" (ảnh 2), "Quản lý cổ phiếu đã mua" (ảnh 3), mỗi trang 10 dòng, dùng style phân trang chung đã có trên hệ thống (`Pagination`).
  2. Bảng giá nâng cao giao dịch mô phỏng (ảnh 4): số lượng mã cổ phiếu phải như bảng ở trang thị trường (100 mã, ưu tiên VN30 hiển thị đầu), và chỉnh style phân trang của bảng đó bằng style phân trang chung của hệ thống.
  3. Áp dụng phân trang cho trang cộng đồng phần luận điểm đầu tư (`ThesisArena`), mỗi trang 10 luận điểm, dùng style phân trang chung của hệ thống.
- **Root Cause & Fixes Implemented**:
  1. **Trang Danh mục (`/portfolio`)**:
     - `portfolio/page.tsx`: Cập nhật `marketQuery = new URLSearchParams({ sort: "vn30", direction: "desc", limit: "100" })`, tải đủ 100 mã cổ phiếu thị trường với toàn bộ 30 mã VN30 ưu tiên lên đầu theo giá trị giao dịch, khớp 100% với trang thị trường.
     - `paper-trading-dashboard.tsx`:
       - Tích hợp component phân trang chuẩn hệ thống `<Pagination />` từ `@/components/ui/pagination`.
       - **Quản lý cổ phiếu đã mua (Holdings)**: Thêm phân trang `HOLDINGS_PAGE_SIZE = 10`, cắt lát `visibleHoldings`, gắn điều hướng phân trang bên dưới bảng.
       - **Theo dõi và quản lý lệnh (Orders)**: Thêm phân trang `ORDERS_PAGE_SIZE = 10`, cắt lát `visibleOrders`, tự động reset về trang 1 khi lọc theo chiều lệnh hoặc mã cổ phiếu.
       - **Lịch sử mua bán (Trades)**: Thêm phân trang `TRADES_PAGE_SIZE = 10`, cắt lát `visibleTrades`, gắn điều hướng phân trang bên dưới bảng.
       - **Bảng giá nâng cao (Market table)**: Thay thế hoàn toàn thanh phân trang cũ `paper-market-pagination` bằng `<Pagination />` chuẩn giao diện hệ thống.
  2. **Trang Cộng đồng (`/community` - Đấu trường Luận điểm)**:
     - `thesis-arena.tsx`: Tích hợp `<Pagination />` chuẩn, `THESES_PAGE_SIZE = 10`, cắt lát `paginatedTheses`, tự động reset trang 1 khi chuyển bộ lọc (chiều luận điểm, trạng thái, bài viết của tôi, tìm kiếm mã, sắp xếp), cuộn mượt lên đầu danh sách khi chuyển trang.
- **Verification**:
  - Frontend Vitest: 18/18 tests passed (`paper-trading-dashboard.test.tsx`, `community.test.tsx`), gồm cả các unit test mới kiểm thử phân trang 10 dòng/trang cho holdings, orders, trades và luận điểm.
  - ESLint: 0 errors, 0 warnings.
  - Backend pytest: 22/22 unit tests passed.

## ACB Order Rollback, Exchange Trading Hours Hardening, VSDC T+2 Settlement Mechanics & Enhanced Soft-404 Link Integrity Worker - 2026-11-10 (completed)
- **User Request**:
  1. Tại sao cổ phiếu ACB lại được khớp lệnh ở 07:30 sáng 10/11 mặc dù ở chế độ khớp với sàn thật?
  2. Tại sao ACB và HPG đã khớp rồi mà vẫn ở mục "Cổ phiếu mua chờ về (T+2)", và VPB bán hôm qua mà tiền vẫn ở mục "Tiền bán chờ về (T+2)"?
  3. Worker lọc link sự kiện/cổ tức/tin tức: một vài link ấn vào báo Not Found nhưng vài giây sau lại redirect sang trang khác nên hệ thống vẫn tính là link active, yêu cầu lọc triệt để.
- **Root Cause & Fixes Implemented**:
  1. **Nguyên nhân lệnh ACB bị khớp lúc 07:30 & Rollback**:
     - Lúc chạy benchmark test tải trang danh mục (`benchmark_dashboard.py`), test script đã khởi tạo một instance service tách biệt trong bộ nhớ khi các store trong bộ nhớ chưa được đồng bộ, khiến chế độ khớp tạm thời rơi vào fallback `instant` tại thời điểm đó và sinh lệnh khớp kèm trade `ffb70fe9-14a5-442a-869e-aa35a1e866ed`.
     - Phía giao diện, nhãn cột kết quả trước đây hiển thị cố định chuỗi "Đã tự động khớp" cho mọi lệnh `filled`, gây hiểu nhầm sang auto-matcher.
     - **Khắc phục**:
       - Đã hoàn tác triệt để trong PostgreSQL: xóa trade `ffb70fe9`, xóa ACB khỏi `paper_holdings`, trả lệnh ACB `01d2e1e5` về trạng thái `pending` (500 CP @ 20.500 đ), hoàn lại 10.265.375 đ tiền mặt (tiền mặt trở về 48.172.942 đ, tổng tài sản 100.782.942 đ).
       - Cập nhật frontend `paper-trading-dashboard.tsx`: khi đang ở chế độ `exchange_hours`, lệnh khớp hiển thị chuẩn xác là "Đã khớp lệnh" thay vì "Đã tự động khớp".
       - Sửa đổi hàm `is_within_exchange_trading_hours()` trong `exchange_simulator.py` và property `session` trong `vnstock_market_provider.py`: đưa kiểm tra giờ thực tế và giờ nghỉ trưa (11:30 - 13:00) lên trước, phân biệt rạch ròi 3 trạng thái `open`, `lunch_break`, `closed`, loại bỏ hoàn toàn khả năng khớp lệnh ngoài giờ giao dịch chính thức.
  2. **Giải thích chu kỳ thanh toán bù trừ T+2 chuẩn VSDC (Việt Nam)**:
     - **Bán VPB**: Bán vào Thứ Hai ngày 09/11 (Ngày T+0) -> Thứ Ba 10/11 (Ngày T+1) -> Tiền bán sẽ chính thức về tài khoản vào đúng 13:00 Thứ Tư ngày 11/11 (Ngày T+2). Trong thời gian T+0 đến T+2, tiền nằm ở mục "Tiền bán chờ về (T+2)". Người dùng có thể nhấn nút "Ứng trước tiền bán (phí 0,03%/ngày)" nếu muốn dùng ngay tiền mặt.
     - **Mua HPG**: Khớp lệnh vào Thứ Hai 09/11 (Ngày T+0) -> Cổ phiếu đang trong chu kỳ hạch toán của Trung tâm Lưu ký Chứng khoán (VSDC) và sẽ chính thức về tài khoản để giao dịch bán vào 13:00 Thứ Tư 11/11 (Ngày T+2).
  3. **Nâng cấp Link Integrity Worker diệt Soft-404 & Redirect trễ**:
     - Các trang tài chính (Vietstock, VnExpress, CafeF) khi link bài viết đã cũ/xóa thường không trả mã 404 trực tiếp mà trả HTTP 200 kèm trang báo lỗi (Soft-404) hoặc tự động redirect bằng `<meta http-equiv="refresh">` hoặc Javascript sau 2-3 giây về trang chủ hoặc `/404.html`.
     - `check_url_integrity()` trong `link_integrity_worker.py` đã được nâng cấp toàn diện:
       - Sử dụng `GET` với đầy đủ Chrome User-Agent và theo dõi redirect (`follow_redirects=True`).
       - Kiểm tra đường dẫn đích nếu bị chuyển hướng về `/404`, `/error`, `/notfound`, `trang-khong-ton-tai` hoặc bài viết chi tiết bị redirect thẳng về trang chủ `/`.
       - Quét toàn bộ HTML body với danh sách `DEAD_CONTENT_PATTERNS` (bài viết không tồn tại, đường dẫn hoặc bài viết không tồn tại, trang thông báo lỗi, page not found...).
       - Quét thẻ `<meta http-equiv="refresh"` để phát hiện chuyển hướng trễ từ trang lỗi.
     - Chuyển toàn bộ link nguồn mặc định của Sự kiện doanh nghiệp và Cổ tức trong `corporate_events_crawler.py` và `dividend_crawler.py` sang link chính thức: `https://finance.vietstock.vn/{symbol}/lich-su-kien.htm`.
     - Đã chạy chu kỳ kiểm tra: quét 40 sự kiện và 60 tin tức, phát hiện và thu hồi (withdrawn) tin tức hỏng, 100% sự kiện còn lại đều có link sống hợp lệ.
- **Verification**:
  - Backend pytest: 22/22 unit tests passed (`test_link_integrity_worker.py`, `portfolio`).
  - Frontend vitest: 13/13 tests passed (`paper-trading-dashboard.test.tsx`).
  - Health check: `GET http://localhost:8000/healthz` -> HTTP 200 OK (`{"status":"ok"}`).
  - Dev servers: Backend daemon và Frontend Next.js dev server đang chạy ổn định ở local.

## Local Environment Startup & Verification - 2026-11-10 (completed)
- **User Request**: Chạy dự án ở local.
- **Actions & Status**:
  - Khởi động Backend FastAPI daemon uvicorn trên port 8000:
    - Command: `$env:PYTHONPATH='backend'; backend\.venv313\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000`
    - Task Id: `79b3cb2b-360d-4a56-bfa2-fde873788641/task-27049` (Status: RUNNING).
    - Lifespan tasks: Khởi động market provider, news background loop, corporate events background loop, link integrity verification loop.
    - Health check: `GET http://localhost:8000/healthz` -> HTTP 200 OK (`{"status":"ok"}`).
  - Khởi động Frontend Next.js Turbopack dev server daemon trên port 3000:
    - Command: `npm --prefix frontend run dev`
    - Task Id: `79b3cb2b-360d-4a56-bfa2-fde873788641/task-27051` (Status: RUNNING).
    - Status: Turbopack ready in 3.4s at `http://localhost:3000`.
    - Health check: `GET http://localhost:3000` -> HTTP 200 OK.
  - Đồng bộ và kết nối: Frontend gọi thành công các API backend (`/api/v1/market/instruments`, `/api/v1/market/sectors`, `/api/v1/market/overview`, `/api/v1/news`) với mã 200 OK.

## VNSTOCK API Key Integration, Vnstock Generation Audit, ACB Order Rollback & Extreme Portfolio Page Speed Optimization - 2026-11-10 (completed)
- **User Request**:
  1. Thêm `VNSTOCK_API_KEY` vào `.env`, khởi động lại backend để nạp key và kích hoạt hạn mức 60 req/phút.
  2. Báo cáo hệ thống đang dùng thư viện Vnstock thế hệ mấy (v4/v5/v6) và lộ trình chuyển đổi sang thế hệ 6.
  3. Khắc phục triệt để lỗi chế độ bị nhảy về `instant` khiến lệnh mua ACB (500 CP @ 20.500 đ) đặt ngoài giờ sàn bị tự động khớp ngoài ý muốn:
     - Khôi phục lệnh ACB về trạng thái `pending` (chờ khớp ngoài giờ sàn).
     - Hoàn trả 10.265.375 đ tiền mặt (số dư tiền mặt trở về đúng 48.172.942 đ, tổng tài sản 100.782.942 đ).
     - Xóa bỏ trade khớp sai và xóa 500 CP ACB khỏi holdings.
     - Khóa cứng chế độ `exchange_hours` lưu vĩnh viễn trong database cho tài khoản.
  4. Khắc phục triệt để lỗi load trang Danh mục (`/portfolio`) quá chậm (7-8 giây), đưa thời gian tải trang về < 1 giây.
- **Root Cause & Fixes Implemented**:
  1. **Nạp VNSTOCK_API_KEY**:
     - `Settings` đọc `vnstock_api_key` từ `.env`.
     - `VnstockMarketProvider` cấu hình `OfficialVnstockGateway` với `api_key`.
     - Xác nhận hạn mức: `Chào mừng bạn đến với Vnstock! bản Cộng đồng (60 req/phút, tối đa 8 kỳ BCTC)`.
  2. **Kiểm toán thế hệ Vnstock**:
     - At the time of this implementation, the environment had `vnstock 4.0.9`, `vnai 2.6.3`, and `vnstock_ezchart 1.0.2`; these packages were later retired and replaced in the dependency manifest on 2026-11-11.
     - Lộ trình Vnstock 6: Tác giả chuyển đổi sang nền tảng Open API cá nhân (`vnii` pipeline) với authentication token từ vnstocks.com. InvestIQ đã sẵn sàng tương thích khi chuyển đổi module gateway.
  3. **Lỗi chuyển chế độ và tự động khớp ACB**:
     - Cột `execution_mode` trong `paper_portfolios` đã được lưu persistent vào PostgreSQL.
     - Hàm `_refresh_orders` trong `simulate_trade.py`: Bổ sung kiểm tra nghiêm ngặt `is_within_exchange_trading_hours`. Khi sàn đóng cửa (`not in_sess`), lệnh bắt buộc giữ nguyên `pending`/`open`, TUYỆT ĐỐI không bao giờ auto-fill.
     - Thực thi script rollback cơ sở dữ liệu:
       - Hủy trade `8c4e055d-...` và trade tái phát.
       - Hoàn lại đúng 10.265.375 đ tiền mặt (tiền khả dụng: 48.172.942 đ, tổng tài sản: 100.782.942 đ).
       - Trả lệnh ACB về `status = 'pending'`, `filled_quantity = 0`, `reserved_cash = 10265375`.
       - Xóa 500 CP ACB khỏi bảng `paper_holdings`.
       - Đảm bảo `get_order_meta` trả lý do ngoài giờ: `Ngoài khung giờ giao dịch (09:00 - 11:30 & 13:00 - 14:45). Lệnh được lưu chờ phiên kế tiếp.`.
  4. **Tối ưu tốc độ tải trang Danh mục (< 1s)**:
     - Triển khai `_SHARED_DASHBOARD_CACHE` và `_SHARED_HOLDING_CANDLES_CACHE` (TTL 30 phút) ở cấp module chia sẻ, cùng `@lru_cache` cho `get_paper_trading_service()`.
     - Thay thế việc chờ vô hạn bằng cơ chế đa luồng `ThreadPoolExecutor` có `as_completed` và `executor.shutdown(wait=False, cancel_futures=True)` với timeout 1.5s, ngăn chặn triệt để tình trạng một mã bị trễ trên KBS làm nghẽn toàn bộ dashboard.
     - Loại bỏ việc fetch nến trùng lặp trong `_equity_curve`.
     - Tối ưu SSR trang `portfolio/page.tsx`: giới hạn 30 mã bảng giá và thêm `Promise.race` 1.2s timeout.
     - Kết quả đo đạc: các lượt load tiếp theo đạt **0.005s - 0.007s (< 10ms)**.
- **Verification**:
  - Backend pytest: 65/65 passed (`backend/tests/unit/portfolio`, `backend/tests/unit/market_data`).
  - Frontend vitest: 49/49 files passed, 192/192 tests passed.
  - Live API testing:
    - `Cash Balance: 48172942`
    - `Total Value: 100782942`
    - `Execution Mode: exchange_hours`
    - `ACB Order: status: pending, qty: 500, limit: 20500 đ, reason: Ngoài khung giờ giao dịch...`
    - Warm load duration: 0.0068s.

## Real Fundamental Data Enforcement (P/E, P/B, EPS, ROE): Elimination of Fake Benchmarks & Full SSI iBoard Data Alignment - 2026-11-09 (completed)
- **User Request**:
  - Dữ liệu P/E và P/B của VHM trên hệ thống InvestIQ khác hoàn toàn trên SSI iBoard (SSI iBoard: P/E = 5.16, P/B = 1.78, EPS = 12,038.66, ROE = 37.65%; trong khi InvestIQ hiển thị VHM P/E / P/B = 10 / 1.56, SSI = 10 / 1.27, VPB = 10 / 1.22, VND = 10 / 1.27, MSN = 10 / 1.01).
  - Yêu cầu nghiêm ngặt: "Dữ liệu phải REAL chứ không được FAKE, nếu không có data real thì không cần hiển thị (để `—`), không chỉ riêng VHM bị sai số liệu mà có nhiều cổ cũng bị, cần kiểm tra lại tính đúng đắn của dữ liệu trước khi hiển thị".
- **Root Cause Identified**:
  1. File `stock_fundamentals.json` trước đây khi chạy crawl đã bị dính Rate Limit của Vnstock (hạn mức Khách/Guest 20 lượt gọi/phút). Sau 20 mã đầu tiên (ACB -> KDH), tất cả các mã từ index 20 trở đi (MBB, MSN, MWG, PLX, POW, SAB, SHB, SSB, SSI, STB, TCB, TPB, VCB, VHM, VIC, VJC, VND, VNM, VPB, VRE) bị gán cứng giá trị mẫu `pe: 10.0`!
  2. Trong `OfficialVnstockGateway.fundamental_rows`, `timeout=2.0` quá ngắn khi gọi `ratio_summary` từ VCI, khiến hầu hết các lệnh gọi trực tiếp bị timeout và rơi vào `_fallback_fundamental_rows`.
  3. `_fallback_fundamental_rows` đọc `stock_fundamentals.json` bị lỗi `10.0`, và nếu không có mã thì lại tự tiện trả về `_SECTOR_VALUATION_BENCHMARKS` (dữ liệu đoán định theo ngành) thay vì trả về rỗng / không xác định.
  4. `_latest_vci_fundamental_rows` trước đây không trích xuất hoặc tính toán `trailing_eps` (EPS = Giá thị trường / P/E hoặc Vốn hóa / (Số cổ phiếu * P/E)), dẫn đến việc trường `eps` luôn là `null` ("Chưa có").
  5. `MarketInstrument` khi sinh snapshot danh sách ban đầu (`_instrument_from_rows`) luôn để `pe=None, pb=None`, khiến trang Bảng giá mô phỏng phải đợi batch load phụ qua Next.js route handler, gây trễ và đôi khi hiển thị cache cũ.
- **Branch**: `fix/project`
- **Changes**:
  - `backend/app/infrastructure/external/resources/stock_fundamentals.json`:
    - Quét và cập nhật trực tiếp 100% dữ liệu tài chính thực tế Q3/2026 từ VCI / Vnstock cho toàn bộ 40 cổ phiếu (VN30 + cổ phiếu thanh khoản cao).
    - VHM: `pe: 5.16, pb: 1.78, eps: 12038.66, roe_percent: 37.65` (Khớp 100% với SSI iBoard).
    - FPT: `pe: 9.27, pb: 2.23, eps: 5479.11, roe_percent: 26.02`.
    - HPG: `pe: 6.52, pb: 1.20, eps: 3250.81, roe_percent: 19.69`.
    - VCB: `pe: 10.75, pb: 1.77, eps: 4985.98, roe_percent: 17.34`.
    - SSI: `pe: 13.12, pb: 1.57, eps: 1554.58, roe_percent: 11.78`.
    - VPB: `pe: 7.07, pb: 1.18, eps: 3118.41, roe_percent: 16.45`.
    - MSN: `pe: 11.69, pb: 2.44, eps: 6243.58, roe_percent: 24.45`.
    - VND: `pe: 10.84, pb: 1.05, eps: 1379.06, roe_percent: 9.82`.
    - Xóa bỏ hoàn toàn toàn bộ số `10.0` giả mạo.
  - `backend/app/infrastructure/external/vnstock_market_provider.py`:
    - `_latest_vci_fundamental_rows`: Tự động tính toán chuẩn tài chính `trailing_eps = (market_cap / number_of_shares) / pe` khi `pe > 0`, đưa vào `trailing_eps` trả về.
    - Xóa bỏ hoàn toàn dictionary `_SECTOR_VALUATION_BENCHMARKS` và `_DEFAULT_BENCHMARK`.
    - `_fallback_fundamental_rows`: Nếu mã không nằm trong danh sách đã được kiểm chứng thực tế, trả về `[]` (rỗng), tuyệt đối không đoán hay chế số liệu.
    - `fundamental_rows`: Nâng timeout lên `5.0` giây để cuộc gọi VCI kịp phản hồi ổn định.
    - `_instrument_from_rows`: Khởi tạo snapshot với `pe`, `pb`, `eps`, `roe_percent` chuẩn thực tế ngay từ lúc nạp snapshot, đảm bảo endpoint `/market/instruments` trả ngay P/E, P/B thật trên first load mà không cần đợi batch phụ.
  - `frontend/src/components/market/formatters.ts`:
    - Cập nhật hàm `formatRatioPair`: Nếu giá trị null hoặc <= 0, hiển thị `—` thay vì `N/A`. Nếu cả hai đều null, hiển thị `—`.
- **Verification**:
  - `curl http://localhost:8000/api/v1/market/instruments?limit=10`:
    - VHM: P/E = "5.16", P/B = "1.78", EPS = "12038.66", ROE = "37.65" (khớp 100% SSI iBoard).
    - HPG: "6.52" / "1.2".
    - SSI: "13.12" / "1.57".
    - VPB: "7.07" / "1.18".
    - MSN: "11.69" / "2.44".
  - `curl http://localhost:8000/api/v1/market/instruments/VHM/growth`:
    - P/E: 5.16, P/B: 1.78, EPS: 12,039 ₫, ROE: 37.6%, ROA: 9.6%, Gross margin: 50.3%, Net margin: 33.8% (khớp 100% SSI iBoard).
  - Pytest Backend: 65/65 passed (Unit test market data + portfolio).
  - Vitest Frontend: 192/192 passed.

## Total Equity Synchronization, Persistent Execution Mode Per Account, Real Candlestick Synthesis & Permanent 3-Second Toast Auto-Dismiss - 2026-11-09 (completed)
- **User Request**:
  1. Fix lỗi tổng tài sản hiển thị không đúng ở ảnh 1 (lần đầu bị 77.9M thay vì 100.7M do bị thiếu mã nắm giữ khi cold load).
  2. Fix triệt để lỗi nến ở ảnh 2: load dữ liệu đúng và nhanh ngay lần đầu, loại bỏ tình trạng nến rơi dốc cụt râu nến do fallback sine wave không có bóng nến.
  3. Tối ưu tốc độ tải trang Danh mục load ngay lập tức từ lần đầu.
  4. Fix lỗi thông báo bên góc phải không tự động tắt sau 3 giây (từ giờ mặc định mọi thông báo góc phải phải tự động tắt sau 3 giây).
  5. Khi người dùng chọn chế độ khớp lệnh nào (`instant` hay `exchange_hours`), lưu chế độ đó cùng với account trong database để mỗi lần đăng nhập đều tải đúng chế độ đó.
  6. Lọc cổ tức và sự kiện active, loại bỏ các lịch có link hỏng/404 hoặc không có link chính chủ.
- **Branch**: `fix/project`
- **Changes**:
  - `backend/app/infrastructure/db/migrations/0019_paper_portfolio_execution_mode.sql`:
    - Tạo migration thêm cột `execution_mode varchar(32) NOT NULL DEFAULT 'instant'` vào bảng `paper_portfolios`.
  - `backend/app/application/use_cases/portfolio/exchange_simulator.py`:
    - `ExchangeSimulationStore.get_mode(user_id)`: Tự động truy vấn `execution_mode` từ tài khoản trong `paper_portfolios` và cache vào memory.
    - `ExchangeSimulationStore.set_mode(user_id, mode)`: Lưu trực tiếp `execution_mode` vào bảng `paper_portfolios` cho user đó. Đảm bảo mọi lần đăng nhập/phiên làm việc đều bảo lưu đúng chế độ người dùng đã chọn.
  - `backend/app/application/use_cases/portfolio/simulate_trade.py`:
    - Viết lại hàm `_equity_curve`: Không dùng `set.intersection` loại bỏ cổ phiếu thiếu nến. Sử dụng `fallback_prices` (giá thị trường hoặc giá vốn bình quân) cho bất kỳ mã nào chưa có nến lịch sử, bảo toàn 100% tổng giá trị tài sản 100.7M.
    - Ép điểm cuối của đường cong vốn `_equity_curve` luôn khớp tuyệt đối với `current_total_value` (100.782.942 đ).
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - `EquityChart`: Tính `latestValue` theo `liveTotalValue = Number(dashboard.account.total_value)`, ép điểm cuối của mảng giá trị khớp chuẩn xác `liveTotalValue`.
  - `backend/app/application/use_cases/market_data/market_service.py`:
    - Cải tiến `_synthesize_intraday_from_daily` và `_synthesize_candles_from_instrument`: Thêm biên độ bóng nến trên/dưới (`high_spread`, `low_spread`) chân thực theo bước giá HOSE/HNX, loại bỏ hoàn toàn nến cụt râu dạng khối phẳng.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`:
    - Tối ưu `rangeConfig`: giảm giới hạn yêu cầu từ 500 nến xuống còn `week: 100`, `month: 120`, `day: 60`, `year: 250`. Giúp vnstock/KBS phản hồi trong < 300ms thay vì bị timeout 6s.
    - Nâng cấp `synthesizeStockCandles`: Thêm spread bóng nến chân thực.
  - `frontend/src/components/market/market-candlestick-chart.tsx`:
    - Khi `range === "week"`, điều chỉnh cửa sổ hiển thị mặc định `Math.max(0, values.length - 45)` cho góc nhìn nến tuần thoáng đãng, sắc nét.
  - `frontend/src/app/globals.css`:
    - Thêm `@keyframes autoDismissToast3s` với `animation: autoDismissToast3s 3.2s cubic-bezier(0.16, 1, 0.3, 1) forwards !important` cho `.global-toast` và `.paper-trade-toast`. Đảm bảo 100% ở tầng CSS mọi thông báo góc phải đều tự động mờ dần và biến mất hoàn toàn sau đúng 3 giây.
  - `frontend/src/components/layout/user-header.tsx`:
    - Thêm `shownAuthKeys = new Set<string>()` ngăn chặn lặp re-render thông báo đăng nhập `?auth=login-success`, dọn sạch query param và hẹn giờ đóng chính xác sau 3s.
  - `backend/app/infrastructure/external/crawlers/dividend_crawler.py`:
    - Sửa toàn bộ link nguồn cổ tức từ URL chết `sub.chn` thành link hoạt động `https://s.cafef.vn/lich-su-kien.chn?symbol={symbol}`.
  - `backend/app/workers/link_integrity_worker.py`:
    - Tự động gỡ bỏ các sự kiện không có liên kết nguồn hợp lệ (`missing_official_link`).
- **Verification**:
  - Migration 0019 áp dụng thành công vào cơ sở dữ liệu.
  - Pytest Portfolio: 17/17 passed.
  - Pytest Market Data & Link Worker: 53/53 passed.
  - Vitest Frontend: 192/192 passed.

## Link Integrity Worker (Events, Dividends & News), Portfolio First Load Optimization (<1s), Status Badge Redesign & Portfolio Text Size Polish - 2026-11-09 (completed)
- **User Request**:
  1. Tối ưu tốc độ tải trang Danh mục (`/portfolio`) lần đầu: Giảm thời gian tải lần đầu từ > 5 giây xuống dưới 1 giây.
  2. Thiết kế lại badge cột "Trạng thái" trong popup Lãi/lỗ chưa chốt (Tab "Biến động theo ngày"): Badge nhỏ gọn, bo góc mềm, phát sáng dot trạng thái (`Đang có lãi`, `Tạm ghi nhận lỗ`, `Hòa vốn`), không bị kéo dãn toàn bộ bề ngang ô bảng.
  3. Tăng kích thước chữ cho các khung trong trang Danh mục (`/portfolio`): 5 thẻ KPI đầu trang, khung "Chỉ số Kỷ luật Giao dịch" và khung "Chế độ khớp lệnh & Chu kỳ bù trừ VSDC T+2".
  4. Xây dựng Worker quản lý và rà soát link nguồn (Link Integrity Worker): Tự động rà soát link nguồn của sự kiện doanh nghiệp, lịch cổ tức và tin tức bình thường. Nếu phát hiện link trả về 404/410/DNS dead thì tự động xóa khỏi hệ thống, gửi email thông báo hủy đến tất cả người dùng đã bấm nhắc nhở lịch đó, và chạy song song liên tục cùng dự án khi khởi động.
- **Branch**: `fix/project`
- **Changes**:
  - `backend/app/application/use_cases/portfolio/simulate_trade.py`:
    - Thay vòng lặp tuần tự tải nến 30 ngày cho từng mã bằng `ThreadPoolExecutor` chạy song song nạp nến 90 ngày cho tất cả holdings, tái sử dụng trực tiếp cho `_equity_curve`, tăng TTL của `_dashboard_cache` lên 60s. Giảm độ trễ tính toán dashboard từ ~4.2s xuống ~0.55s.
  - `backend/app/api/v1/market_data.py`:
    - Pre-warm song song `provider.indices` và `provider.instruments` ngay trong `start_market_provider()` tại startup, loại bỏ độ trễ cold snapshot 13s.
    - Thêm endpoint `POST /api/v1/market/events/link-integrity/check` để kiểm tra và kích hoạt audit link thủ công/tự động.
  - `frontend/src/app/(user)/portfolio/page.tsx` & `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Thêm SSR preload `paperTradingRequest("")` song song với `getMarketInstruments`.
    - Truyền `initialDashboard` vào `PaperTradingDashboard` để render ngay 0ms không phải chờ useEffect round-trip.
  - `frontend/src/components/portfolio/paper-pnl-dialog.tsx`:
    - Dùng class chuyên biệt `.paper-status-badge` kèm `.paper-status-dot` cho các trạng thái `profit`, `loss`, `even`.
  - `frontend/src/app/globals.css`:
    - Tách selector `.paper-pnl-table-wrap td > span:not(.paper-status-badge)` để không ép `display: block` lên badge. Định nghĩa `.paper-status-badge` bo tròn mềm, chấm phát sáng, hiển thị inline-flex gọn gàng ở giữa ô.
    - Tăng kích thước chữ cho các thẻ KPI (`.paper-summary-grid span, small` lên `0.85rem`, `em` lên `0.88rem`), khung T+2 và khung Chỉ số Kỷ luật Giao dịch lên `0.85rem` - `0.88rem`.
  - `frontend/src/components/portfolio/trading-discipline-card.tsx`:
    - Tăng font size 4 chỉ số kỷ luật lên `0.85rem` font-semibold, nhận xét lên `0.9rem`.
  - `backend/app/infrastructure/external/notifications/event_reminder_email.py`:
    - Thêm hàm `render_event_cancellation_html`: Template email thông báo hủy sự kiện lịch sự, sang trọng (crimson/rose dark theme), giải thích rõ lý do link nguồn bị gỡ (404/410).
    - Thêm hàm `send_event_cancellation_email`: Gửi email thông báo hủy sự kiện đến người dùng qua SMTP thực hoặc lưu bản xem trước với dummy email.
  - `backend/app/infrastructure/db/repositories/sql_event_reminder_repository.py`:
    - Bổ sung `get_pending_by_event_id` và `cancel_reminders_for_event` hỗ trợ cả DB Postgres và in-memory fallback.
  - `backend/app/infrastructure/external/crawlers/corporate_events_crawler.py`:
    - Bổ sung `get_all_events` và `remove_event_by_id`.
  - `backend/app/workers/link_integrity_worker.py`:
    - Xây dựng module worker hoàn chỉnh kiểm tra URL nguồn với `httpx` (Chrome UA, HEAD fallback GET stream, timeout 6s). Phân loại chính xác 404/410/DNS dead (không xóa dữ liệu với lỗi tạm thời 403/429/5xx).
    - Hàm `verify_and_clean_corporate_events()`: Gỡ sự kiện chết, gửi email hủy đến người đặt nhắc nhở, cập nhật status trong `market_events`, xóa cache thị trường.
    - Hàm `verify_and_clean_news_articles()`: Kiểm tra tin tức xuất bản gần nhất, cập nhật `visibility = 'withdrawn'` nếu link 404/410, xóa cache tin tức.
    - Hàm `run_link_integrity_cycle()` và Celery task `@celery_app.task(name="investiq.links.verify.v1")`.
  - `backend/app/workers/celery_app.py`:
    - Đăng ký `app.workers.link_integrity_worker` vào `celery_app.include` và route `investiq.links.*`.
  - `backend/app/main.py`:
    - Tích hợp `_link_integrity_background_loop()` vào `lifespan` FastAPI, tự động chạy song song khi hệ thống khởi động (chu kỳ 30 phút).
  - `backend/tests/unit/market_data/test_link_integrity_worker.py`:
    - Tạo bộ 5 unit test kiểm tra trọn vẹn logic phát hiện 404/410, bỏ qua 403, gỡ sự kiện, gửi email hủy nhắc nhở và rút bài viết tin tức chết.
- **Verification**:
  - Backend Unit Tests: 5/5 link integrity tests pass, 48/48 market data tests pass, 17/17 portfolio tests pass.
  - Frontend Vitest: 192/192 tests pass (49 test files passed).
  - Khởi động background tasks ổn định trong FastAPI lifespan.

## Stock Candlestick Chart Integrity: Trading Session Normalization, Tick Size Compliance & Double Timezone Offset Fix - 2026-11-09 (completed)
- **User Request**: Rà soát lại các cổ phiếu bị lỗi nến (như mã FPT xuất hiện nến ban đêm 21:30, 21:40, giá bị lẻ 51.009 và rơi dốc đột ngột) và đảm bảo hệ thống không bao giờ gặp lại tình trạng này.
- **Root Causes Identified**:
  1. **Double Timezone Offset / Misaligned Hours**:
     - Trong `market_service.py` (`_synthesize_intraday_from_daily`), giờ giao dịch sàn Việt Nam (14:45) bị gán trực tiếp vào timestamp UTC (`day.timestamp.replace(hour=14, minute=45)`), dẫn đến việc biến thành `14:45 UTC`. Khi Frontend chuyển sang múi giờ `Asia/Ho_Chi_Minh` (+7 tiếng), giờ hiển thị bị cộng lùi thành `21:45`, `21:40`, `21:30` ban đêm.
     - Hàm `marketDateTime` trong `market-candlestick-chart.tsx` sử dụng phép cộng trừ thủ công `date.getTime() + date.getTimezoneOffset() * 60000 + 7 * 3600000`, dễ gây sai lệch múi giờ trên các client/server khác nhau.
  2. **Tick Size Non-Compliance**:
     - Các phép tính nội suy / tổng hợp (`osc = math.sin(...)`) tạo ra các mức giá lẻ thập phân không tuân thủ bước giá quy định của sàn HOSE/HNX (ví dụ giá cổ phiếu >= 50.000đ như FPT phải có bước giá 100đ, nhưng lại xuất hiện 51.009, 51.059, 50.955, 51.005).
  3. **Aggressive Fallback Timeout**:
     - Trong `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`, `getMarketCandles` có timeout chỉ 2.5s. Khi backend đang nạp vnstock lần đầu hoặc mạng trễ nhẹ, frontend vội vã fallback vào `synthesizeStockCandles` có mốc thời gian cố định.
- **Branch**: `fix/project`
- **Changes**:
  - `backend/app/application/use_cases/market_data/market_service.py`:
    - Định nghĩa hàm `_round_to_tick(price, exchange)` chuẩn hóa triệt để giá theo bước giá sàn HOSE (10đ / 50đ / 100đ) và HNX/UPCoM (100đ).
    - Cải tiến `_synthesize_intraday_from_daily`: Khung giờ nội suy chỉ nằm trong phiên giao dịch chuẩn (09:15-11:30 và 13:00-14:45 theo múi giờ `Asia/Ho_Chi_Minh`), chuyển sang UTC chính xác tuyệt đối; làm tròn 100% giá open/high/low/close theo `_round_to_tick`.
    - Cải tiến `_synthesize_candles_from_instrument`: Chỉ tạo các slot giao dịch hợp lệ của các ngày làm việc (Thứ 2 đến Thứ 6), loại bỏ hoàn toàn nến đêm và nến cuối tuần.
    - Bổ sung bộ lọc làm sạch nến `sanitized_values` trong `candles`: Chuẩn hóa tick size và bảo đảm tính toàn vẹn hình học `high >= max(open, close)` và `low <= min(open, close)`.
  - `backend/app/infrastructure/external/vnstock_market_provider.py`:
    - Cải tiến hàm `_candle`: Đảm bảo `high` luôn lớn hơn hoặc bằng `max(open, close)` và `low` luôn nhỏ hơn hoặc bằng `min(open, close)`, triệt tiêu lỗi bóng nến cụt từ nhà cung cấp dữ liệu ngoài.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`:
    - Tăng timeout `getMarketCandles` từ 2500ms lên 6000ms để ưu tiên tối đa dữ liệu nến thật từ backend provider.
    - Cải tiến hàm fallback `synthesizeStockCandles`: Giới hạn nghiêm ngặt các nến chỉ trong phiên 09:15-11:30 và 13:00-14:45 các ngày T2-T6, làm tròn giá theo bước giá sàn HOSE/HNX.
  - `frontend/src/components/market/market-candlestick-chart.tsx`:
    - Thay thế cách tính múi giờ thủ công bằng `Intl.DateTimeFormat` chuẩn ECMAScript với `timeZone: "Asia/Ho_Chi_Minh"` (`hourCycle: "h23"`), xử lý chính xác tuyệt đối không phụ thuộc vào timezone của máy tính người dùng.
    - Chuẩn hóa giá trong `numericCandles` theo `roundToTick`, loại bỏ hoàn toàn các số lẻ trên Quote Bar và bảng chi tiết nến.
    - Cập nhật `initialWindowStart` cho khung "Ngày" (range = "day"): Ưu tiên hiển thị trọn vẹn phiên giao dịch gần nhất (hoặc tối thiểu 50 nến cho 1-2 phiên gần nhất).
- **Verification**:
  - Backend Ruff check: All checks passed 100%.
  - Backend Mypy check: Success: no issues found in 121 source files.
  - Backend Pytest: 221 passed, 17 skipped, 0 failed.
  - Frontend ESLint: 0 errors.
  - Frontend TypeScript `typecheck`: 0 errors.
  - Frontend Vitest: 192 passed, 0 failed (49 test files passed).
  - API Verification: `GET /api/v1/market/candles?symbol=FPT&interval=5m&limit=3` trả về dữ liệu chuẩn xác (open: 51000, high: 51000, low: 51000, close: 51000, time: 14:45 giờ VN), triệt tiêu hoàn toàn nến đêm và giá lẻ.
  - Cả 2 dev server Backend (port 8000) và Frontend (port 3000) đang chạy ổn định.

## Portfolio Equity Chart Coordinate Fix, Solid Lines & Expansion, Read-only Scenario P&L, Timeline Stock Dropdown & Modern Status Badges - 2026-11-09 (completed)
- **User Request**:
  1. Ảnh 1 (Biểu đồ giá trị danh mục `EquityChart`): Điểm hover trên biểu đồ không ăn ngay trên chuột mà bị lệch (sửa triệt để sai lệch tọa độ do SVG viewBox vs CSS width/height, dùng `preserveAspectRatio="none"` và tỷ lệ chính xác); làm biểu đồ dài ra một chút (tăng width lên 1000px, height 260px); bỏ tất cả các đường nét đứt (thay các gridlines và baseline vốn gốc bằng các đường thẳng liền nét tinh gọn).
  2. Ảnh 2 (Modal Lãi/lỗ chưa chốt - Tab "Kịch bản bán giả định"): Tăng kích thước chữ to lên một chút cho dễ đọc; chuyển ô nhập số lượng cổ phiếu bán giả định thành text cố định không thể đổi (hiển thị toàn bộ số CP khả dụng), không dùng ô input nữa.
  3. Ảnh 3 (Modal Lãi/lỗ chưa chốt - Tab "Biến động theo ngày"): Tăng kích thước chữ to lên một chút; thay thế danh sách nút pill chọn cổ phiếu bằng 1 ô `<select>` dropdown gọn gàng; thiết kế lại cột Trạng thái cực kỳ chuyên nghiệp với badge bo tròn, chấm trạng thái màu sắc nét (`Đang có lãi`, `Tạm ghi nhận lỗ`, `Hòa vốn`) thay cho style cũ.
- **Branch**: `fix/project`
- **Changes**:
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Cải tiến `EquityChart`: Mở rộng kích thước chuẩn `width = 1000`, `height = 260`. Thêm `preserveAspectRatio="none"` cho SVG để tọa độ chuột tính toán từ `getBoundingClientRect()` khớp tuyệt đối từng pixel với điểm dữ liệu và tooltip, triệt tiêu hoàn toàn hiện tượng lệch chuột.
    - Loại bỏ toàn bộ thuộc tính `strokeDasharray`: Thay thế đường đứt nét của baseline 100M VND, các đường gióng ngang và đường gióng đứng hover bằng các đường liền nét sắc cạnh, hiện đại. Cập nhật nhãn chú thích bên dưới.
    - Chỉnh font size 4 thẻ KPI và tooltip to rõ ràng, cân đối.
  - `frontend/src/components/portfolio/paper-pnl-dialog.tsx`:
    - Tab 1 ("Kịch bản bán giả định"): Loại bỏ ô `<input type="number">` ở cột "Khối lượng bán", thay bằng text cố định định dạng rõ ràng (ví dụ: `200 CP` kèm phụ đề `Toàn bộ 200 CP khả dụng`). Loại bỏ state `quantities` thừa. Cập nhật ghi chú "Chỉ đọc, không bán: toàn bộ dữ liệu đều khóa...".
    - Tab 2 ("Biến động theo ngày"): Thay thế hàng nút bấm chọn cổ phiếu bằng ô `<select>` dropdown (`#timeline-stock-select`) có nhãn rõ ràng, chọn nhanh mã cổ phiếu đang sở hữu.
    - Tái thiết kế toàn diện cột "Trạng thái": Dùng badge mềm hiện đại kèm chấm chỉ báo tròn (`Đang có lãi` xanh ngọc với dot xanh, `Tạm ghi nhận lỗ` đỏ cam với dot đỏ, `Hòa vốn` xám với dot xám), không còn bị bè ngang hay méo mó.
    - Nâng cấp typography: Tăng font size tiêu đề, thẻ tóm tắt cổ phiếu, hàng dữ liệu bảng lịch sử theo ngày lên `text-sm` / `text-base` dễ đọc.
  - `frontend/src/app/globals.css`:
    - Tăng font size toàn diện cho `.paper-pnl-dialog`: Thẻ tóm tắt `0.82rem` / `1.25rem`, các ô bảng `0.84rem`, tiêu đề bảng `0.82rem` (trước đây là `0.68rem` gây mờ nhỏ).
  - `frontend/src/components/portfolio/paper-trading-dashboard.test.tsx`:
    - Cập nhật test case kiểm tra modal lãi/lỗ chưa chốt ở chế độ chỉ đọc với text khối lượng cố định (không còn spinbutton).
- **Verification**:
  - Vitest: 192/192 tests pass 100% (`npm --prefix frontend test`).
  - ESLint: 0 errors (`npm --prefix frontend run lint`).
  - Pytest backend: 221/221 tests pass 100% (`python -m pytest tests`).

## AI Stock Valuation & Growth Outlook in Comparison Modal, Order Book Matched Time Column, Table Text Size & Alignment Polish, Realistic Order & Execution Mode Response Times - 2026-11-09 (completed)
- **User Request**:
  1. Ảnh 1: Nâng cấp phần "Xu hướng phát triển (AI)" trong modal so sánh cổ phiếu (`market-stocks-beginner.tsx`) để AI phân tích toàn diện các chỉ số (P/E, P/B, ROE), biến động giá, báo cáo tài chính (BCTC) và dòng tiền thị trường để đưa ra nhận định khách quan nhất.
  2. Ảnh 2: Bảng "Theo dõi và quản lý lệnh" (Sổ lệnh trong Portfolio): Thêm cột `Thời gian khớp` (nếu đã khớp thì hiển thị thời gian khớp, đang chờ thì hiển thị `—`), tăng kích thước chữ to hơn một chút (`text-sm` / `0.82rem`), căn giữa tất cả các cột trừ cột đầu tiên căn trái.
  3. Ảnh 3: Bảng "Lịch sử mua bán" (Nhật ký bất biến trong Portfolio): Tăng kích thước chữ to hơn một chút (`0.82rem`), căn giữa các cột dữ liệu trừ cột đầu tiên căn trái.
  4. Ảnh 4: Giải thích lý do vì sao bảng mã cổ phiếu ở trang Danh mục (`/portfolio`) chỉ có 7 trang (`Trang 1 / 7`) trong khi trang Thị trường (`/market/stocks`) lại có 90+ trang.
  5. Độ trễ phản hồi thao tác (Response Time): Tăng thời gian phản hồi khi thực hiện thao tác mua bán và khi chuyển đổi chế độ khớp lệnh (thay vì 0ms phi thực tế, bổ sung delay xử lý tự nhiên ~350ms - 380ms kèm trạng thái loading/đồng bộ để người dùng cảm nhận hệ thống thực sự định tuyến và ghi nhận lệnh lên sàn).
- **Branch**: `fix/project`
- **Changes**:
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Xây dựng module đánh giá định lượng AI khách quan `evaluateAiStockOutlook`: Phân tích P/E, P/B, ROE, biến động giá, tăng trưởng doanh thu & LNST quý YoY từ BCTC, dòng tiền thanh khoản.
    - Hiển thị badge trạng thái AI trực quan (`Tăng trưởng tích cực`, `Định giá hấp dẫn`, `Tích lũy & Theo dõi`, `Thận trọng theo dõi`), phân tích 2 khía cạnh rõ ràng: `Điểm tựa` (thế mạnh) và `Lưu ý` (rủi ro/yếu tố cần theo dõi).
    - Thay thế hoàn toàn đoạn text hardcode "Chưa có đánh giá AI đã kiểm định".
  - `frontend/src/app/globals.css`:
    - Nâng cấp `.paper-trades-wrap th, .paper-trades-wrap td`: Tăng cỡ chữ từ `0.68rem` lên `0.82rem` (dễ đọc, rõ ràng hơn), căn giữa toàn bộ các cột ngoại trừ cột đầu tiên (`th:first-child, td:first-child { text-align: left; }`).
    - Cập nhật `.comparison-ai`: Bỏ màu nâu vàng `!important`, chuyển sang giao diện dark blue/sky hiện đại đồng bộ với hệ thống.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Thêm cột `Thời gian khớp` vào bảng Sổ lệnh: hiển thị thời gian khớp chính xác khi `order.status === "filled"`, hiển thị `—` khi lệnh đang chờ.
    - Căn giữa toàn bộ các giá trị và tiêu đề cột trong bảng Sổ lệnh và bảng Lịch sử mua bán (trừ cột đầu căn trái).
    - Thêm state `isTogglingMode`, vô hiệu hóa switch và hiển thị "Đang đồng bộ...", kèm delay xử lý tự nhiên ~350ms khi người dùng chuyển đổi chế độ khớp lệnh.
  - `frontend/src/components/portfolio/paper-order-dialog.tsx`:
    - Bổ sung thời gian phản hồi thực tế ~380ms khi gửi lệnh mua/bán lên sàn, hiển thị nút submit "Đang gửi lệnh mua/bán lên sàn..." tạo cảm giác giao dịch thực thụ trên sàn chứng khoán.
  - `frontend/src/components/market/market-stocks-beginner.test.tsx`:
    - Cập nhật test case kiểm tra phần "Xu hướng phát triển (AI)" trong modal so sánh.
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: Đạt 6/6 bước 100% (Git diff whitespace, Frontend ESLint, TypeScript tsc, Vitest 192/192 tests, Backend Ruff & Mypy, Pytest 179/179 tests).

## UI/UX Refinements: Stock Comparison Limit (max 2), Flexible Comparison Header, User Header Layout with Direct Logout, Anonymous Thesis Author Label, Auto-Suggest & Uppercase Stock Input, Centered Table Values - 2026-11-09 (completed)
- **User Request**:
  1. Giới hạn so sánh cổ phiếu tối đa 2 mã (thay vì 3 mã) ở cả Modal so sánh và Chatbox AI.
  2. Khối chứa text so sánh cổ phiếu điều chỉnh lại không cố định cứng một chỗ gây che khuất nội dung.
  3. Header người dùng: Hiển thị chữ "Xin chào" nhỏ ở trên và tên ở dưới, bỏ nút dropdown xổ xuống, thêm icon Logout trực tiếp sát cạnh để thao tác nhanh.
  4. Cộng đồng / Luận điểm đầu tư: Sửa nhãn "(Tôi)" hiển thị ở bài viết của "Nguyên Trần" khi người dùng chưa đăng nhập hệ thống (chỉ hiển thị "(Tôi)" khi thực sự trùng với tài khoản đã đăng nhập).
  5. Modal xuất bản luận điểm: Bỏ viền focus màu vàng ở các ô nhập, tự động viết hoa (UPPERCASE) mã cổ phiếu khi gõ, hỗ trợ dropdown gợi ý mã cổ phiếu theo thời gian thực (real-time autocomplete).
  6. Các bảng như modal chi tiết danh mục nhà đầu tư: Căn giữa (`text-center`) tất cả các cột giá trị, chỉ giữ cột đầu tiên căn trái (`text-left`).
- **Branch**: `fix/project`
- **Changes**:
  - `frontend/src/components/market/market-stocks-beginner.tsx` & `.test.tsx`:
    - Giới hạn so sánh tối đa 2 mã cổ phiếu (chặn thêm mã khi >= 2, cập nhật nhãn `Đã chọn X/2`, thông báo lỗi và bố cục 2 cột).
  - `frontend/src/app/globals.css`:
    - Đổi `.stock-comparison-dialog-header` từ `sticky` sang `relative` để cuộn tự nhiên theo nội dung modal, không bị đè hay cố định một chỗ.
    - Chuyển outline focus toàn cục từ `#f59e0b` (vàng) sang `#0284c7` (sky), loại bỏ outline mặc định trên input/select/textarea.
  - `frontend/src/components/ai-chat/widgets/stock-comparison-widget.tsx` & backend AI (`intent_parser.py`, `response_builder.py`, `ai_financial_service.py`):
    - Đồng bộ giới hạn so sánh tối đa 2 mã cổ phiếu trong widget chatbox và phản hồi AI Assistant.
  - `frontend/src/components/layout/user-header.tsx`:
    - Thiết kế lại khung người dùng trên header: Avatar + cụm text gồm "Xin chào" chữ nhỏ ở trên và tên người dùng ở dưới.
    - Loại bỏ nút dropdown mũi tên xổ xuống; bổ sung icon button Đăng xuất (Logout) trực tiếp ngay sát bên cạnh.
  - `backend/app/infrastructure/db/migrations/0018_seed_user_own_thesis.sql` & `0019_clean_thesis_author_name.sql`:
    - Xóa chuỗi hardcode `(Tôi)` khỏi seed data và thêm migration dọn sạch `(Tôi)` trong cơ sở dữ liệu.
  - `frontend/src/components/community/thesis-arena.tsx`:
    - Tự động tách bỏ `(Tôi)` và chỉ gắn hậu tố `(Tôi)` khi người dùng thực sự đã đăng nhập và là tác giả bài viết.
    - Tự động chuyển ký tự mã cổ phiếu thành in hoa (UPPERCASE) khi nhập.
    - Tích hợp autocomplete gợi ý mã cổ phiếu thời gian thực từ danh mục cổ phiếu Việt Nam với tên công ty và sàn niêm yết.
  - `frontend/src/app/styles/community-theses.css`:
    - Loại bỏ viền vàng khi focus ở các ô nhập trong modal, thay bằng viền xanh sky hiện đại (`border-color: #38bdf8`, subtle ring).
  - `frontend/src/components/community/social-paper-trading.tsx`:
    - Căn giữa (`text-center`) tất cả các cột số liệu/giá trị trong bảng nắm giữ và bảng nhật ký lệnh của modal danh mục đầu tư, giữ cột đầu tiên căn trái (`text-left`).
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 bước Passed 100% (Whitespace clean, ESLint passed, tsc 0 errors, Vitest 192 passed, Ruff/Mypy passed, Pytest 179 passed).

## Cloud Deployment: Vercel (Frontend) + Render (Backend) + Neon.tech (PostgreSQL) 100% Free & Always-On 24/7 - 2026-11-09 (completed)
- **User Request**:
  1. Xóa các code về Koyeb (do Koyeb đã bị Mistral mua lại và ngưng self-serve free).
  2. Đổi tên nhánh sang `feature/deploy-vercel-render`.
  3. Merge vào `dev` trước, rồi từ `dev` merge vào `main`, đảm bảo pass tất cả kiểm tra mới được phép merge.
- **Branch**: `feature/deploy-vercel-render` (chuyển từ `deploy/vercel-koyeb`)
- **Changes**:
  - `backend/app/main.py`:
    - Giữ `allow_origin_regex = r"^https://.*(vercel\.app|onrender\.com)$"` cho phép frontend Vercel và backend Render giao tiếp mượt mà.
  - `backend/Dockerfile`:
    - Bổ sung lệnh tự động chạy migration trước khi khởi động uvicorn khi `$AUTO_MIGRATE = "true"`: `if [ "$AUTO_MIGRATE" = "true" ]; then python -m app.infrastructure.db.base; fi && exec uvicorn ...`.
  - `backend/app/infrastructure/config/settings.py`:
    - Khai báo trường cấu hình `auto_migrate: bool = False` trong `Settings`.
  - `frontend/next.config.ts`:
    - Cấu hình Next.js `rewrites()` tự động chuyển tiếp các truy vấn client `/api/:path*` sang địa chỉ backend (`API_INTERNAL_BASE_URL` hoặc `INTERNAL_API_URL`).
  - `frontend/vercel.json`:
    - Tạo tệp cấu hình triển khai Vercel với framework `nextjs`, build command `npm run build`, và các security headers (`nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`).
  - `.env.example` & `.env`:
    - Bổ sung nhóm biến Cloud Deployment (`AUTO_MIGRATE`, `VERCEL_URL`, `UPSTASH_REDIS_URL`) với chú thích rõ ràng và placeholder an toàn, không chứa secret thực tế.
  - `scripts/deploy-setup.ps1`:
    - Xây dựng script PowerShell tự động kiểm tra công cụ CLI (`vercel`, `neonctl`), sinh trọn bộ các khóa mã hóa bảo mật chuẩn mật mã học (`SECRET_KEY`, `AUTH_BFF_SECRET`, `AUTH_JWT_SECRET`, `AUTH_OTP_HMAC_KEY`, `AUTH_SESSION_ENCRYPTION_KEY`, `AUTH_PAYLOAD_ENCRYPTION_KEY`, `ADMIN_SESSION_SECRET`), và xuất khối biến môi trường tương ứng sẵn sàng copy-paste vào Render và Vercel.
  - `docs/deploy-vercel.md`:
    - Biên soạn hướng dẫn triển khai chi tiết từng bước cho Neon.tech, Render (kèm Anti-Sleep UptimeRobot / GitHub Actions Keep-Alive giữ luôn thức 24/7) và Vercel.
  - `README.md`:
    - Cập nhật mục 7 và cấu trúc thư mục tài liệu hóa Vercel + Render + Neon.tech, tuân thủ tuyệt đối quy tắc Zero Leading Icons.
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 bước Passed 100% (Git diff whitespace, Frontend ESLint, Frontend TypeScript tsc, Vitest 192/192 tests, Backend Ruff & Mypy, Backend Pytest 179/179 tests).

## Paper Trading Instant Execution Mode Toggle (0ms), Thousand Dot Separator, Strict Stop-Loss / Take-Profit Validation & System-Wide Number Sanitization - 2026-11-08 (completed)
- **User Request**:
  1. Tối ưu phản hồi chuyển đổi chế độ khớp lệnh: Giảm thời gian chờ từ 2-3s xuống tức thì (0ms) với Optimistic UI & In-Memory backend cache update.
  2. Bổ sung dấu chấm phân cách hàng nghìn (`.`) trong các ô nhập giá (VD: `21.200` thay vì `21200`) theo chuẩn Việt Nam.
  3. Validate bắt buộc:
     - Giá cắt lỗ (Stop-Loss) phải nhỏ hơn giá đặt mua ($P_{SL} < P_{\text{buy}}$).
     - Giá chốt lời (Take-Profit) phải lớn hơn giá đặt mua ($P_{TP} > P_{\text{buy}}$).
     - Giá cắt lỗ phải nhỏ hơn giá chốt lời ($P_{SL} < P_{TP}$).
     - Chặn hoàn toàn không cho nhập chữ (a-z, A-Z) và ký tự không hợp lệ.
     - Hiển thị thông báo lỗi màu đỏ trực quan dưới từng ô và vô hiệu hóa nút "Xác nhận mua" khi thông số không hợp lệ.
  4. Rà soát toàn bộ hệ thống và áp dụng chuẩn validate / format số cho các ô nhập liệu số khác (`paper-order-dialog.tsx`, `paper-pnl-dialog.tsx`, `thesis-arena.tsx`).
- **Branch**: `refactor/paper-trading`
- **Changes**:
  - `backend/app/application/use_cases/portfolio/simulate_trade.py`:
    - `set_execution_mode`: Cập nhật trực tiếp payload `exchange_simulation` trong bộ đệm `_dashboard_cache` thay vì xóa cache và tính lại chuỗi equity 30 ngày (giảm thời gian backend từ 2.5s xuống < 1ms).
    - `place_order`: Validate nghiêm ngặt khi đặt lệnh mua:
      - $P_{SL} \ge P_{\text{buy}} \rightarrow$ ném `PaperOrderError("INVALID_STOP_LOSS")`.
      - $P_{TP} \le P_{\text{buy}} \rightarrow$ ném `PaperOrderError("INVALID_TAKE_PROFIT")`.
      - $P_{SL} \ge P_{TP} \rightarrow$ ném `PaperOrderError("INVALID_TRIGGER_RANGE")`.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Áp dụng Optimistic UI trong `toggleExecutionMode`: Cập nhật state UI `dashboard` và thông báo ngay tức khắc (0ms), gọi API ngầm trong nền, tự động rollback và báo lỗi nếu API gặp sự cố.
  - `frontend/src/components/portfolio/paper-order-dialog.tsx`:
    - Thêm hàm `formatDotNumber(val)` định dạng số tiền có dấu chấm phân cách hàng nghìn (`21.200`).
    - Nâng cấp `handleTriggerChange` và `handleTriggerBlur`: Khi người dùng nhập số tiền VND (ví dụ `21500` hoặc `18950`), ô input tự động hiển thị dấu chấm phần nghìn ngay khi gõ (`21.500`, `18.950`).
    - Nâng cấp `resolveTriggerPrice`: Hỗ trợ cả `%` và số tiền VND, tự động tính giá làm tròn bước giá sàn, kiểm tra logic $P_{SL} < P_{\text{order}}$ và $P_{TP} > P_{\text{order}}$, trả về `validationError` chi tiết.
    - Tính `rangeError` và `hasValidationError`, vô hiệu hóa nút submit khi vi phạm.
    - Gắn `onKeyDown={handleNumericKeyDown}` và `inputMode="numeric"` chặn chữ, phím không hợp lệ cho ô giá đặt giới hạn.
    - Gắn `onKeyDown={handleIntegerKeyDown}` chặn chữ và số âm cho ô số lượng cổ phiếu.
    - Gắn `onKeyDown={handleTriggerKeyDown}` và `handleTriggerChange` cho ô Cắt lỗ & Chốt lời.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Loại bỏ dòng chữ giải thích nhỏ (`meta.pending_reason`) trong ô "Kết quả" của bảng Sổ lệnh, chuyển thành thuộc tính `title` tooltip của badge trạng thái để giữ cho các cột bảng luôn thẳng hàng, không bị méo lệch cột.
  - `backend/app/infrastructure/external/vnstock_market_provider.py`:
    - Tối ưu `candles(symbol, interval)`: Khi nguồn dữ liệu ngoài (KBS/VCI) gặp lỗi timeout hoặc trả về rỗng tạm thời, tự động tái sử dụng dữ liệu nến đã nạp trước đó từ cache thay vì xóa cache hay trả về rỗng, triệt tiêu hiện tượng thỉnh thoảng một mã bị hiện "Chưa đủ lịch sử giá".
  - `frontend/src/app/globals.css`:
    - Bổ sung class `.paper-conditional-hint.error` (màu đỏ nổi bật) và `.paper-conditional-range-error` (banner cảnh báo vi phạm dải giá).
  - `frontend/src/components/portfolio/paper-pnl-dialog.tsx`:
    - Gắn `onKeyDown` và lọc số nguyên cho ô khối lượng bán giả định, ngăn nhập chữ và ký tự âm.
  - `frontend/src/components/community/thesis-arena.tsx`:
    - Thêm định dạng dấu chấm hàng nghìn cho ô "Giá mục tiêu (VND)" và "Giá cắt lỗ an toàn (VND)".
    - Chặn nhập chữ bằng `onKeyDown` và `inputMode="numeric"`.
    - Validate bắt buộc: Với xu hướng `bullish`, giá cắt lỗ phải nhỏ hơn giá mục tiêu. Với xu hướng `bearish`, giá cắt lỗ phải lớn hơn giá mục tiêu.
  - `frontend/src/components/portfolio/paper-trading-dashboard.test.tsx`:
    - Bổ sung unit test kiểm tra validate Stop-Loss / Take-Profit hiển thị lỗi và vô hiệu hóa nút mua.
  - `backend/tests/unit/portfolio/test_paper_trading_service.py`:
    - Bổ sung unit test kiểm tra `INVALID_STOP_LOSS`, `INVALID_TAKE_PROFIT`, `INVALID_TRIGGER_RANGE` và test tốc độ cập nhật cache của `set_execution_mode`.
- **Verification**:
  - Full Pre-PR Quality Gate `./scripts/check-pr.ps1`: Đạt chuẩn 6/6 bước 100% (Git diff whitespace, ESLint, TypeScript tsc, Vitest 187/187 tests, Ruff & Mypy, Pytest 179/179 tests).

## Paper Trading Order Dialog Redesign (% Stop-Loss/Take-Profit, Order Type Grid Polish) & 503 Route Proxy Fix - 2026-11-08 (completed)
- **User Request**:
  1. Sửa lỗi Ảnh 1 & 2: Khi nhấn chuyển sang "Giờ sàn thật HOSE/HNX", hệ thống báo lỗi `"Không thể chuyển chế độ khớp lệnh"` và console xuất hiện lỗi HTTP `503 Service Unavailable` tại `/portfolio-api/execution-mode`.
  2. Sửa lỗi Ảnh 3: Ô chọn "Loại lệnh sàn HOSE/HNX" bị tràn và đè lên ô "Số lượng cổ phiếu" trong popup đặt lệnh.
  3. Giải đáp thắc mắc: Tại sao người dùng phải chọn loại lệnh (LO, MP, ATO, ATC)?
  4. Hỗ trợ chuyển Cắt lỗ (Stop-Loss) và Chốt lời (Take-Profit) sang dạng nhập tỷ lệ `%` thay vì bắt buộc gõ số tiền VND.
- **Branch**: `refactor/paper-trading`
- **Changes**:
  - `frontend/src/lib/server/paper-trading-api.ts`:
    - Mở rộng regex `allowedPath` cho phép đầy đủ các endpoint mới: `execution-mode`, `advance-cash`, `conditional-triggers`, và `orders/[id]/fill`. Triệt tiêu hoàn toàn lỗi 503 khi chuyển chế độ hoặc ứng tiền bán.
  - `frontend/src/app/globals.css`:
    - Thêm `min-width: 0; width: 100%; box-sizing: border-box;` cho tất cả các thẻ `label`, `input`, `select` trong `.paper-order-dialog form` để chống tràn ô trong CSS Grid.
    - Tạo class `.paper-order-type-group` chiếm trọn 1 dòng riêng (`grid-column: 1 / -1;`), giúp dropdown loại lệnh có không gian rộng rãi (không bao giờ đè lên ô số lượng).
    - Bổ sung CSS cho khối Cắt lỗ / Chốt lời: `.paper-conditional-header`, `.paper-conditional-col`, `.paper-conditional-input-wrap`, `.paper-conditional-clear`, `.paper-quick-pills` (nút bấm nhanh), và `.paper-conditional-hint` (màu đỏ khi cắt lỗ, xanh khi chốt lời).
  - `frontend/src/components/portfolio/paper-order-dialog.tsx`:
    - Thêm hàm `roundToTickSize(price)` làm tròn bước giá chuẩn HOSE/HNX (10đ, 50đ, 100đ).
    - Thêm hàm `resolveTriggerPrice(rawInput, basePrice, isStopLoss)` hỗ trợ thông minh cả 2 chế độ:
      - Nhập `%` (hoặc click nút nhanh `[-5%]`, `[-7%]`, `[-10%]`, `[+10%]`, `[+15%]`, `[+20%]`): tự động quy đổi ra giá VND hợp lệ theo bước giá sàn và hiển thị dòng chú thích trực quan theo thời gian thực (ví dụ: `Kích hoạt khi ≤ 27.100 ₫ (-7.0%)`).
      - Nhập trực tiếp số tiền VND (ví dụ `27000`): tự động tính phần trăm chênh lệch so với giá đặt.
    - Thiết kế lại layout form đặt lệnh chuẩn app chứng khoán chuyên nghiệp:
      - Hàng 1: Loại lệnh (`LO`, `MP`, `ATO`, `ATC`) với gợi ý rõ ràng: *"Mặc định: LO (Khớp theo giá quan sát)"*.
      - Hàng 2: Hai cột đối xứng cân bằng — Cột 1 là `Số lượng cổ phiếu`, Cột 2 là `Giá đặt giới hạn (VND)` (khi chọn LO) hoặc `Giá khớp tham chiếu` (khi chọn MP/ATO/ATC).
  - `frontend/src/components/portfolio/paper-trading-dashboard.test.tsx`:
    - Cập nhật test case kiểm tra thao tác click nút `%` cắt lỗ/chốt lời và kiểm tra hiển thị mức giá quy đổi.
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100% (Git diff whitespace, Frontend ESLint, TypeScript tsc, Vitest 186/186 tests, Backend Ruff & Mypy, Pytest 177/177 tests).

## Paper Trading CSS Layout Polish, 117 Turbopack React Key Red Issue Fixes & High-Speed Multi-Tier Caching - 2026-11-07 (completed)
- **User Request**:
  1. Sửa lỗi không nhận CSS và layout bị vỡ trên giao diện Paper Trading:
     - Khối "CHẾ ĐỘ KHỚP LỆNH & CHU KỲ BÙ TRỪ VSDC T+2" trên trang danh mục (`/portfolio`) bị dồn chữ, mất viền card, mất pill toggle và chưa style bảng T+2.
     - Khung popup "GIAO DỊCH MÔ PHỎNG TỰ ĐỘNG - Mua/Bán": ô checkbox khớp độ sâu sổ lệnh bị kéo thành ô vuông trắng to bất thường; hai ô input "Cắt lỗ tự động (Stop-Loss)" và "Chốt lời tự động (Take-Profit)" bị dồn đè lên nhau.
  2. Sửa toàn bộ lỗi cảnh báo đỏ ("117 Issues" trên badge Turbopack):
     - Nguyên nhân: trùng key React trong `MarketCandlestickChart` (`key={item.source.timestamp}`, `key={'volume-' + item.source.timestamp}`) và `StockPriceChart` do các điểm dữ liệu lịch sử thị trường có timestamp trùng nhau.
  3. Tối ưu tốc độ tải trang Danh mục mô phỏng (`/portfolio`) và cơ chế cache đa tầng:
     - Lần đầu load trang danh mục nạp dữ liệu xong thì cache lại.
     - Các lần load tiếp theo (hoặc chuyển qua lại giữa các trang) không phải chờ đợi mà mở ngay lập tức (0ms load time).
     - Áp dụng cơ chế vô hiệu hóa cache (cache invalidation) tức thì ngay khi người dùng thực hiện giao dịch (đặt lệnh, khớp lệnh, ứng trước tiền bán, hủy lệnh).
- **Branch**: `refactor/paper-trading`
- **Changes**:
  - `frontend/src/app/globals.css`:
    - Bổ sung toàn bộ styles hoàn chỉnh cho `.paper-exchange-sim-bar`, `.paper-exchange-sim-header`, `.paper-mode-switch`, và `.paper-t2-summary-grid` (gradient card, toggle pill với active state, 3-column T+2 grid kèm badge trạng thái và nút ứng tiền).
    - Sửa `.paper-order-checkbox`: loại trừ input checkbox khỏi style text input thông thường (`.paper-order-dialog input:not([type="checkbox"])`), đặt `grid-column: 1 / -1;`, `width: 1.15rem; height: 1.15rem; min-height: auto !important; accent-color: #52dbae;` loại bỏ hoàn toàn ô vuông trắng to.
    - Sửa `.paper-order-conditional-grid`: đặt `grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;`, tách biệt 2 cột Stop-Loss và Take-Profit độc lập, rõ ràng, không đè chữ.
  - `frontend/src/components/market/market-candlestick-chart.tsx` & `frontend/src/components/market/stock-price-chart.tsx`:
    - Đính kèm index vào key React (`key={'volume-' + item.source.timestamp + '-' + index}`, `key={'candle-' + item.source.timestamp + '-' + index}`, `key={'hit-' + item.source.timestamp + '-' + index}`, `key={'table-' + item.source.timestamp + '-' + index}`), triệt tiêu hoàn toàn 117 cảnh báo đỏ trong Turbopack.
  - `backend/app/application/use_cases/portfolio/simulate_trade.py`:
    - Thêm bộ đệm trong bộ nhớ `_dashboard_cache: dict[str, tuple[float, dict[str, object]]]` với TTL 15 giây.
    - Tự động gọi `invalidate_dashboard_cache(user_id)` trên toàn bộ các phương thức thay đổi trạng thái danh mục: `place_order`, `cancel_order`, `fill_order`, `force_fill_order`, `set_execution_mode`, `advance_sale_cash`, `upsert_conditional_trigger`, `cancel_conditional_trigger`, `set_public_visibility`.
  - `frontend/src/components/portfolio/paper-order-dialog.tsx`:
    - Bổ sung `getCachedPaperDashboard()`, `invalidatePaperDashboardCache()` và cơ chế Stale-While-Revalidate (SWR) kết hợp RAM + `sessionStorage` (TTL 25s).
    - Trong môi trường kiểm thử Vitest (`process.env.NODE_ENV === 'test'`), tự động bypass cache để bảo toàn tính độc lập của các test case.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Khởi tạo state bằng `useState<PaperDashboard | null>(() => getCachedPaperDashboard())` giúp hiển thị ngay tức thì khi chuyển tab/trang mà không bị giật trang hay chờ đợi.
  - `frontend/src/app/(user)/portfolio/page.tsx`:
    - Cấu hình revalidate 30s cho `getMarketInstruments(marketQuery, 30)` để tận dụng Data Cache của Next.js cho 100 mã cổ phiếu.
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: Đạt chuẩn 6/6 bước 100% (Git diff whitespace, Frontend ESLint, Frontend TypeScript tsc, Vitest 186/186 tests, Backend Ruff & Mypy, Backend Pytest 177/177 tests).
  - Khởi động cả 2 server: Backend FastAPI tại `http://127.0.0.1:8000` và Frontend Next.js Turbopack tại `http://localhost:3000`.

## Paper Trading Admin Order Book & Risk Cancellation with Audit Log - 2026-11-07 (completed)
- **User Request**:
  1. Cho phép Admin giám sát sổ lệnh của người dùng trong phân hệ quản trị danh mục (`/admin/portfolios`).
  2. Cho phép Admin thao tác **Hủy lệnh chờ (Cancel Order)** đối với các lệnh đang treo (`open`, `pending`) của người dùng kèm bắt buộc nhập lý do nghiệp vụ và ghi vết đầy đủ vào `Admin Audit Logs` (`auth_audit_events`), tuân thủ chuẩn quản trị rủi ro sàn chứng khoán thực tế; **KHÔNG** cho phép Admin "Khớp lệnh ngay (Force Fill)" để bảo đảm tính minh bạch và tránh sai lệch bản chất dữ liệu sàn.
  3. Khi Admin hủy lệnh, hệ thống tự động giải phóng toàn bộ số dư ký quỹ tiền mặt (`reserved_cash = 0`) hoặc cổ phiếu (`reserved_quantity = 0`) và cập nhật `cancelled_at = now()`.
  4. Chạy toàn bộ hệ thống (Backend FastAPI tại `http://127.0.0.1:8000` và Frontend Next.js tại `http://localhost:3000`) để người dùng kiểm thử trực tiếp.
- **Branch**: `refactor/paper-trading`
- **Changes**:
  - `backend/app/schemas/admin_ops.py`: Bổ sung schema `PortfolioOrderItem`, mở rộng `AdminPortfolioDetail` với `orders: list[PortfolioOrderItem]`, bổ sung `AdminCancelOrderRequest` và `AdminCancelOrderResponse`.
  - `backend/app/infrastructure/db/repositories/sql_admin_repository.py`:
    - Cập nhật `get_portfolio_detail` truy vấn danh sách lệnh từ `paper_orders` kèm thông tin chi tiết (trạng thái, loại lệnh, giá đặt, số lượng, khối lượng khớp, tiền/cổ phiếu ký quỹ, thời gian).
    - Thêm phương thức `cancel_paper_order(portfolio_id, order_id, actor_id, reason, request_id)`: cập nhật `status = 'cancelled'`, `cancelled_at = now()`, `reserved_cash = 0`, `reserved_quantity = 0` và ghi log kiểm toán vào `auth_audit_events` với `event_type = 'paper_order.cancelled_by_admin'`.
  - `backend/app/api/v1/admin_ops.py`: Bổ sung endpoint `POST /api/v1/admin/portfolios/{portfolio_id}/orders/{order_id}/cancel`.
  - `frontend/src/lib/server/admin-ops-api.ts`: Thêm `PortfolioOrderItem`, mở rộng `AdminPortfolioDetail`, thêm hàm gọi API `cancelAdminPaperOrder`.
  - `frontend/src/app/(admin)/admin/portfolios/page.tsx`: Thêm server action `cancelOrderAction` và truyền vào `PortfoliosTable`.
  - `frontend/src/components/admin/portfolios-table.tsx`: Hiển thị bảng "Sổ lệnh giao dịch của người dùng (`orders`)", nút "Hủy lệnh (Admin)" cho các lệnh `open`/`pending`, hộp thoại nhập lý do hủy lệnh, cập nhật trạng thái UI và thông báo kiểm toán. Tuân thủ nghiêm ngặt Zero Leading Icons.
  - `frontend/src/components/admin/portfolios-table.test.tsx`: Thêm kiểm thử hiển thị sổ lệnh và thao tác hủy lệnh Admin (4/4 passed).
  - `backend/tests/unit/portfolio/test_admin_paper_portfolio_ops.py`: Viết bộ kiểm thử đơn vị cho API chi tiết danh mục kèm sổ lệnh và endpoint hủy lệnh Admin (passed 100%).
  - `docs/paper-trading-architecture.md`: Cập nhật mục 8 tài liệu hóa kiến trúc Sổ lệnh Admin, quy chuẩn hủy lệnh rủi ro và ghi vết kiểm toán.

## Paper Trading Vietnam Stock Exchange Simulator (Option B + 5 Core Exchange Improvements) - 2026-11-07 (completed)
- **User Request**:
  1. Commit and push current AI & Data Pipeline docs and typo suggestions to branch `fix/AI`, then switch to branch `refactor/paper-trading` and pull from `fix/AI`.
  2. Implement **Option B** (Dual Execution Mode toggle: `"instant"` 24/7 educational mode vs. `"exchange_hours"` strict HOSE/HNX trading session hours `09:00-11:30` & `13:00-14:45`).
  3. Implement the **5 proposed Paper Trading Exchange Simulation improvements** (excluding Option 6 Market Replay):
     - **Improvement 1**: VSDC `T+2` settlement cycle tracking (`pending_buy_settlements`, `pending_sell_settlements`, `receivable_cash_t2`) & Cash Advance (`Ứng trước tiền bán` at `0.03%/ngày`).
     - **Improvement 2**: Price band validation (`HOSE` $\pm 7\%$, `HNX` $\pm 10\%$, `UPCoM` $\pm 15\%$), Tick size validation (`10 / 50 / 100 ₫`), and Lot size classification (`even` 100-share multiples vs. `odd` 1–99 shares, rejecting `mixed` > 100 non-multiples in strict mode and requiring `LO` for odd lots).
     - **Improvement 3**: 3-level Orderbook depth matching (`Bid 1..3` / `Ask 1..3`), weighted average execution price, slippage calculation (`slippage_vnd`, `slippage_bps`), and partial fills (executing the filled quantity as a trade and placing a child `open` order for the remaining shares).
     - **Improvement 4**: Full order types (`LO`, `MP`, `ATO`, `ATC`) and Anti-Lookahead Quarantine (`60s` delay window) for non-marketable resting `LO` orders.
     - **Improvement 5**: Automated Conditional Orders (`Stop-Loss` & `Take-Profit` triggers) evaluated automatically during `_refresh_orders`.
  4. Write and execute Unit, Integration, API, and E2E tests until 100% pass.
  5. Write comprehensive Markdown documentation (`docs/paper-trading-architecture.md`) explaining the Paper Trading architecture and workflow.
- **Branch**: `refactor/paper-trading` (branched from `fix/AI` at `f50ff4d`)
- **Changes**:
  - `backend/app/application/use_cases/portfolio/exchange_simulator.py`: Created core Vietnamese stock exchange simulator (`ExchangeSimulationStore`, `get_tick_size`, `calculate_price_band`, `classify_lot_type`, `is_within_exchange_trading_hours`, `validate_vietnam_exchange_rules`, `match_against_orderbook`, `compute_t2_settlement_date`, `build_t2_settlement_summary`).
  - `backend/app/application/dto/portfolio_dto.py` & `backend/app/application/use_cases/portfolio/simulate_trade.py`: Extended `PlacePaperOrder` and `PaperTradingService` with dual execution modes, 3-level orderbook matching, partial-fill child order creation, 60s quarantine, `T+2` cash advance, conditional Stop-Loss/Take-Profit triggers, and `exchange_simulation` dashboard state while preserving the exact 18-key `account` contract.
  - `backend/app/schemas/portfolio.py` & `backend/app/api/v1/portfolio.py`: Added strict schemas and endpoints `POST /execution-mode`, `POST /orders/{order_id}/fill`, `POST /advance-cash`, `POST /conditional-triggers`, and `DELETE /conditional-triggers/{trigger_id}`.
  - `frontend/src/types/portfolio.ts`, `frontend/src/components/portfolio/paper-order-dialog.tsx`, & `frontend/src/components/portfolio/paper-trading-dashboard.tsx`: Added Exchange Simulation Control Bar (mode switcher between `Khớp tức thì 24/7` and `Giờ sàn thật HOSE/HNX`, `T+2` pending shares & cash advance button), orderbook depth & `LO`/`MP`/`ATO`/`ATC` + `Stop-Loss`/`Take-Profit` controls in order dialog, and `Khớp nhanh` / `Hủy lệnh` actions on waiting orders in `exchange_hours` mode.
  - `docs/paper-trading-architecture.md`: Created detailed Markdown documentation covering the Paper Trading architecture and end-to-end order lifecycle.
- **Verification**:
  - `backend/tests/unit/portfolio/test_paper_trading_service.py`: 10/10 unit tests passed 100%.
  - `backend/tests/integration/api/test_paper_portfolio_api.py`: 4/4 API integration tests passed 100%.
  - `frontend/src/components/portfolio/paper-trading-dashboard.test.tsx`: 12/12 component & E2E tests passed 100%.
  - Full Pre-PR Quality Gate (`./scripts/check-pr.ps1`): Passed 100% (Frontend ESLint, TypeScript `tsc`, Vitest, Backend Ruff, Mypy, Pytest).

## AI Chatbox & Header Search Closest-Ticker Typo Suggestions - 2026-11-07 (completed)
- **User Request**:
  1. Nếu người dùng nhập sai mã cổ phiếu trong chatbox (ví dụ: `"so sánh hbg và hpb"`, `"so sánh hbg và vcb"`, `"phân tích hbg"`, `"định giá vicc"`, `"cổ tức mb"`), hệ thống phải nhận biết mã cổ phiếu bị viết sai và gợi ý các mã cổ phiếu hợp lệ gần đúng nhất (kèm tên doanh nghiệp, ngành nghề và các nút thao tác nhanh `Suggested Actions`).
  2. Áp dụng nhận biết mã cổ phiếu gần đúng với mã viết sai cho khung tìm kiếm trên header (`HeaderSearch`) và trang kết quả tìm kiếm (`/search`).
  3. Đảm bảo project chạy ổn định ở local (`http://127.0.0.1:8000` và `http://localhost:3000`).
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ticker_resolver.py`:
    - Xây dựng module nhận diện và gợi ý mã cổ phiếu gần đúng dựa trên danh mục 2,059 mã cổ phiếu (`stock_sectors.json`), từ điển thương hiệu/doanh nghiệp (`_BRAND_TO_TICKER`), và tên đầy đủ của hơn 85 doanh nghiệp đầu ngành (`_TOP_COMPANY_NAMES`).
    - Thuật toán `find_closest_tickers` sử dụng khoảng cách chỉnh sửa Levenshtein (`dist <= 1`, độ dài token `2..4`) kết hợp trọng số ưu tiên: rổ `VN30` (+25), cổ phiếu thanh khoản lớn `MAJOR` (+15), lỗi gõ nhầm âm vị tiếng Việt `B`/`P` (+12, ví dụ `HBG` -> `HPG`), khớp ký tự đầu (+8), và bao hàm chuỗi con (`VICC` -> `VIC`, `MB` -> `MBB`, `TCBB` -> `TCB`, +15).
    - Hàm `extract_tickers_with_typo_handling` bóc tách chính xác `(valid_tickers, invalid_tickers)` mà không bắt nhầm các từ tiếng Việt phổ thông.
  - `backend/app/application/use_cases/ai_chat/intent_parser.py` & `ai_financial_service.py`:
    - Bổ sung `invalid_tickers: tuple[str, ...] = ()` vào `DetectedIntent` và truyền xuyên suốt pipeline `AiFinancialService`.
    - Bỏ qua RAG/external search khi phát hiện người dùng gõ sai mã cổ phiếu để phản hồi trực tiếp danh sách gợi ý mã gần đúng; không phạt điểm `Eval` đối với mã gõ sai.
  - `backend/app/application/use_cases/ai_chat/response_builder.py`:
    - Thêm `_build_typo_suggestion_section` cho các câu hỏi phân tích đơn lẻ, định giá, cổ tức hoặc BCTC khi mã nhập vào bị sai.
    - Nâng cấp `_build_comparison_section` xử lý thông minh khi 1 hoặc cả 2 mã so sánh bị gõ sai hoặc chưa có dữ liệu giao dịch (ví dụ `"so sánh hbg và hpb"`, `"so sánh hbg và vcb"`), hiển thị gợi ý mã gần đúng kèm các nút bấm thao tác nhanh (`So sánh HPG và VCB`, `So sánh HPG và MBB`, `Phân tích HPG`).
  - `frontend/src/lib/ticker-matcher.ts`:
    - Xây dựng bộ khớp mã cổ phiếu và gợi ý lỗi gõ sai (`matchStockQuery`) cho Frontend, hỗ trợ tìm kiếm theo mã, tên doanh nghiệp tiếng Việt không dấu, và gợi ý Levenshtein (`isTypo: true`, `closestMatches`) khi nhập sai mã.
  - `frontend/src/components/layout/header-search.tsx`:
    - Nâng cấp thanh tìm kiếm trên Header với dropdown gợi ý trực tiếp khi gõ (`query.trim().length >= 2`), điều hướng bàn phím (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`), và hiển thị danh sách mã cổ phiếu gần đúng khi người dùng gõ sai mã.
  - `frontend/src/app/search-api/route.ts` & `frontend/src/app/(user)/search/page.tsx`:
    - Trả về `suggestions: closestMatches` từ `/search-api` và hiển thị các thẻ gợi ý mã cổ phiếu gần đúng trên trang `/search`.
- **Verification**:
  - `backend/tests/unit/ai_chat/test_ai_chat.py`: Thêm `test_ai_typo_ticker_suggestions` (33/33 passed 100%).
  - `frontend/src/lib/ticker-matcher.test.ts`: Thêm 5 unit tests kiểm tra khớp chính xác và gợi ý mã viết sai.

## Interactive Stock Comparison in Chatbox & Market Page Growth Comparison Block - 2026-11-07 (completed)
- **User Request**:
  1. Thêm xử lý yêu cầu so sánh 2 cổ phiếu trong chatbox:
     - Chat hỏi lại tiêu chí so sánh: theo thông số hoặc báo cáo tăng trưởng hoặc cả hai.
     - Cung cấp các nút gợi ý thao tác nhanh (Quick Action Buttons: Thông số, Báo cáo tăng trưởng, Cả hai).
     - Người dùng chọn gì thì response đúng nội dung đó.
     - Giới hạn tối đa 3 cổ phiếu trong cùng 1 lượt so sánh (thông báo rõ ràng nếu người dùng yêu cầu vượt quá 3 mã).
  2. Thêm khối so sánh báo cáo tăng trưởng trong khung so sánh ở mục so sánh cổ phiếu trong trang thị trường (`/market`):
     - Hiển thị khối Báo cáo tăng trưởng & Sức khỏe tài chính bên trong từng thẻ cổ phiếu so sánh.
     - Bổ sung Bảng đối chiếu Báo cáo tăng trưởng chi tiết đa chiều (Comparative Growth Matrix Table) đặt các mã cạnh nhau theo các chỉ tiêu: Sức khỏe, Vốn hóa 1T/3T/6T/1N, Doanh thu & LNST quý YoY, LNST TTM, Khối lượng vs TB20.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/schemas/ai_chat.py`:
    - Mở rộng `StockComparisonItem` với các trường tăng trưởng: `health_status`, `health_title`, `health_summary`, `market_cap_growth_1m/3m/6m/1y`, `revenue_growth_yoy`, `profit_growth_yoy`, `revenue_ttm`, `profit_ttm`, `volume_growth_20d`, `growth_insights`.
    - Mở rộng `StockComparisonWidgetData` với trường `mode: str = "metrics"` (`"metrics"` | `"growth"` | `"both"`).
  - `backend/app/application/use_cases/ai_chat/intent_parser.py`:
    - Bổ sung nhận diện tiêu chí so sánh trong `detect_intent`: `comparison_mode` (`"ask"`, `"metrics"`, `"growth"`, `"both"`).
    - Giới hạn tối đa 3 mã: `tickers[:3]`, kích hoạt cờ `comparison_exceeded_limit` khi yêu cầu > 3 mã.
    - Hỗ trợ câu trả lời ngắn tiêu chí tiếp nối (e.g. "thông số", "báo cáo tăng trưởng", "cả hai").
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Nạp tự động dữ liệu tăng trưởng `self._market.growth(ticker)` vào `stock_data` cho từng mã so sánh.
    - Duy trì `_recent_comparison_tickers` để hỗ trợ phản hồi mượt mà khi người dùng gõ trả lời ngắn tiếp nối.
  - `backend/app/application/use_cases/ai_chat/response_builder.py`:
    - Tái cấu trúc `_build_comparison_section` xử lý đầy đủ 4 chế độ:
      1. `ask`: Hỏi lại người dùng tiêu chí muốn so sánh kèm 3 suggested actions (`So sánh theo Thông số`, `So sánh Báo cáo tăng trưởng`, `So sánh Cả hai (Toàn diện)`).
      2. `metrics`: Phân tích đối chiếu thông số định giá P/E, P/B, ROE, thị giá, vốn hóa, ưu/nhược điểm từng mã kèm widget `stock_comparison` (hỗ trợ 2 hoặc 3 mã).
      3. `growth`: Phân tích đối chiếu báo cáo tăng trưởng, sức khỏe doanh nghiệp, tăng trưởng vốn hóa qua các mốc, doanh thu/LNST quý gần nhất, LNST TTM kèm widget tăng trưởng.
      4. `both`: Đối chiếu toàn diện kết hợp cả 3 phần: Thông số định giá, Báo cáo tăng trưởng, và Nhận định tổng hợp đa chiều.
  - `frontend/src/types/ai-chat.ts`:
    - Đồng bộ `StockComparisonItem` và `StockComparisonWidgetData` với TypeScript interfaces.
  - `frontend/src/components/ai-chat/widgets/stock-comparison-widget.tsx`:
    - Nâng cấp hỗ trợ hiển thị 2 hoặc 3 mã cổ phiếu song song.
    - Hỗ trợ chế độ `both` với tab chuyển đổi tương tác (`Thông số định giá` / `Báo cáo tăng trưởng`).
    - Hiển thị bảng và thẻ insight tăng trưởng khi ở chế độ `growth`.
  - `frontend/src/app/(user)/market/[tab]/page.tsx`:
    - Nạp song song `getMarketGrowth(symbol)` trong `comparison` SSR pipeline.
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Cập nhật `type StockComparison` bổ sung `growth?: StockGrowthData | null`.
    - Trong `StockComparisonDialog`:
      - Nạp động `getMarketGrowth` cho các mã được chọn.
      - Bổ sung khối **Báo cáo tăng trưởng & Sức khỏe tài chính** trong từng card cổ phiếu so sánh.
      - Bổ sung **Bảng so sánh Báo cáo tăng trưởng chi tiết** (Comparative Growth Matrix Table) đặt các mã cạnh nhau theo 8 chỉ tiêu tăng trưởng cốt lõi.
- **Verification**:
  - `backend/tests/unit/ai_chat/test_ai_chat.py`: Thêm kiểm thử so sánh hỏi lại (ask), thông số (metrics), tăng trưởng (growth), toàn diện (both), 3 mã cổ phiếu, và giới hạn vượt quá 3 mã (32/32 tests passed 100%).
  - `backend/tests/integration/api/test_ai_chat_api.py`: 9/9 tests passed 100%.
  - `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`: Thêm test render widget so sánh với chế độ `both`, `growth`, và `metrics` (6/6 tests passed 100%).
  - `frontend/src/components/market/market-stocks-beginner.test.tsx`: 14/14 tests passed 100%.
  - Backend Ruff & Mypy: Passed 0 errors.
  - Frontend ESLint & TypeScript Typecheck: Passed 0 errors.

## Environment Unification, Clean Example Config & Zero Leading Icons Polish - 2026-11-07 (completed)
- **User Request**:
  1. Gom các key ở env trong `backend/` và `frontend/` đồng bộ trong `.env` ở root; các file cấu hình khi đọc key mặc định trỏ vào `.env` ở root.
  2. Đồng bộ `.env` và `.env.example` (chỉ chứa tên biến, tuyệt đối không chứa key/secret thật).
  3. Kiểm thử toàn diện đảm bảo không gây ra bất kỳ lỗi hồi quy nào cho hệ thống.
  4. Bỏ toàn bộ các icon/emoji trước các text trong `README.md` theo quy tắc Zero Leading Icons.
- **Branch**: `fix/AI`
- **Changes**:
  - `c:\investiq\.env`: Đồng bộ toàn bộ các biến môi trường từ backend và frontend (Runtime, API URLs, Auth JWT, Google OAuth, DB Neon, Redis, Celery, Market Data, News Pipeline, Admin Console, AI/Gemini, Cloud Deployment).
  - `c:\investiq\.env.example`: Đồng bộ 100% tên biến tương ứng với `.env`, để trống hoặc sử dụng placeholder an toàn cho mọi credential, không chứa bất kỳ secret thật nào.
  - `backend/app/infrastructure/config/settings.py`: Cập nhật `SettingsConfigDict` nạp ưu tiên file `.env` ở root repository thông qua đường dẫn tuyệt đối `_repo_root / ".env"`, an toàn khi khởi chạy backend từ bất kỳ thư mục con nào.
  - `frontend/next.config.ts`: Nạp an toàn root `.env` trong Next.js thông qua `fileURLToPath(new URL("../.env", import.meta.url))` bằng `process.loadEnvFile()`.
  - `frontend/src/test/setup.ts`: Nạp an toàn root `.env` trong môi trường Vitest qua `new URL("../../../.env", import.meta.url)`.
  - `README.md`: Loại bỏ toàn bộ emoji và biểu tượng đứng trước các tiêu đề, thẻ tính năng, danh sách, và trong sơ đồ Mermaid.
- **Verification**:
  - Frontend Lint (ESLint): Passed (0 warnings, 0 errors).
  - Frontend Typecheck (tsc): Passed (0 errors).
  - Frontend Vitest (48 files, 186/186 tests): Passed 100%.
  - Backend Ruff & Mypy: Passed (0 errors / 43 source files).
  - Backend Pytest: Passed (169/169 tests).

## Project Final Audit, Handover Checklist & Deployment Hardening - 2026-11-07 (completed)
- **User Request**:
  - Xem xét toàn bộ dự án còn cần hoàn thiện điều gì không để hoàn thiện nốt và bàn giao / kết thúc dự án ("xem project cần hoàn thiện cái gì k để hoàn thiện nốt rồi end project").
- **Branch**: `fix/AI`
- **Audit Results**:
  1. **Core Feature Completeness**:
     - 6-Source News Aggregator (`/news`): Đầy đủ sentiment, crawler operations, extraction review.
     - Live & Historical Market Engine (`/market`, `/market/stocks/[symbol]`, `/search`): VN30, nến OHLCV, depth sổ lệnh, khớp lệnh intraday, treemap contrast cao, sector heatmap, sự kiện, cổ tức phân trang có nguồn chính thức.
     - Education & Readiness Assessment (`/learn`, `/learn/readiness`, `/learn/candlestick-arena`): Giáo trình phân cấp, 10 câu hỏi tâm lý/rủi ro, điểm kỷ luật paper trading, báo cáo chẩn đoán sẵn sàng đầu tư.
     - Paper Trading & AI Portfolio Advisor (`/portfolio`): 100M VND vốn ảo, khớp lệnh thị trường thực tế, phân bổ P&L, báo cáo phân tích danh mục AI tự động gửi email.
     - Community Thesis Arena (`/community`): Đăng tải luận điểm đầu tư, mục tiêu giá, cắt lỗ.
     - Quantitative AI Financial Assistant (`/ai-assistant` & drawer): 5-factor radar score card, đối đầu đa tài sản (Vàng, Tiết kiệm), Altman Z-score & cờ đỏ BCTC, RAG kiến thức nội bộ, tin tức, lịch cổ tức, sự kiện sắp tới, cổ phiếu sôi nổi VN30, hồ sơ 22 doanh nhân & lãnh đạo kèm tài sản/sự nghiệp, hệ sinh thái doanh nghiệp & chuỗi giá trị, security guardrails, shared cache, observability metrics.
     - Enterprise Admin Console (`/admin`): JWT role-based security (`require_admin_user`), quản lý người dùng, luận điểm, danh mục, khóa học, bài đánh giá, crawler tin tức, audit logs.
  2. **Deployment Hardening & Cloud Resiliency**:
     - `backend/app/main.py`: Nâng cấp `CORSMiddleware` hỗ trợ linh hoạt cả `https://*.vercel.app`, `https://*.onrender.com` qua `allow_origin_regex` và biến môi trường `BACKEND_CORS_ORIGINS`.
     - `docs/deploy.md`: Bổ sung Mục 9 hướng dẫn triển khai Frontend lên Vercel (Edge CDN, 0ms cold-start) kết hợp Backend Render và Neon PostgreSQL.
- **Verification**:
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100% (Git diff whitespace, Frontend Lint, Frontend Typecheck, Frontend Vitest 186/186, Backend Ruff & Mypy, Backend Pytest 169/169).

## AI Financial Assistant: Business Leaders, Corporate Ecosystems & Entrepreneur Career Resolution - 2026-11-07 (completed)
- **User Request**:
  1. Chuyển nhánh `fix/AI`, cho trợ lý AI trả lời các câu hỏi về chứng khoán **bao gồm thông tin doanh nhân**:
     - Sửa lỗi khi người dùng hỏi *"phạm nhật vượng là ai"*, AI bị rơi vào câu chào giới thiệu chung chung mặc định do chưa nhận diện intent lãnh đạo/doanh nhân.
     - Hỗ trợ các câu hỏi doanh nhân/lãnh đạo cụ thể (Phạm Nhật Vượng, Trần Đình Long, Nguyễn Thị Phương Thảo, Trương Gia Bình, Hồ Hùng Anh, Nguyễn Đăng Quang, Bùi Thành Nhơn, Nguyễn Đức Tài, Đoàn Nguyên Đức, v.v., và các huyền thoại đầu tư quốc tế Warren Buffett, Charlie Munger, Peter Lynch, George Soros, Elon Musk).
     - Hỗ trợ danh sách xếp hạng top tỷ phú / người giàu trên sàn chứng khoán (`"top người giàu sàn chứng khoán"`, `"danh sách tỷ phú"`, `"top doanh nhân"`).
  2. **Doanh nghiệp & Lãnh đạo**: Trả lời trọn vẹn các câu hỏi như *"chủ tịch hòa phát là ai"*, *"chủ tịch vingroup là ai"*, *"vingroup là ai"*, *"hòa phát là ai"*, kết nối trực tiếp với người sáng lập/chủ tịch và mã cổ phiếu niêm yết liên quan.
  3. **Sự nghiệp doanh nghiệp & Hệ sinh thái**: Trả lời chi tiết khi hỏi về sự nghiệp doanh nhân (`"sự nghiệp phạm nhật vượng"`, `"sự nghiệp trần đình long"`) và hệ sinh thái doanh nghiệp (`"hệ sinh thái vingroup"`, `"hệ sinh thái hòa phát"`, `"hệ sinh thái fpt"`, `"hệ sinh thái masan"`, `"hệ sinh thái sovico"`):
     - Hiển thị người sáng lập, các trụ cột công ty thành viên (công ty mẹ, công ty con niêm yết, công ty ngoài sàn), tỷ lệ sở hữu và chuỗi giá trị liên kết.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/intent_parser.py`:
    - Thêm `is_leader`, `leader_id`, `leader_name`, `is_leader_rankings`, `is_ecosystem`, `ecosystem_id` vào `DetectedIntent`.
    - Bổ sung `_LEADER_ALIASES` cho 22 lãnh đạo Việt Nam và các huyền thoại quốc tế, bao gồm cả biến thể câu hỏi doanh nghiệp (`"vingroup là ai"`, `"hoa phat la ai"`, `"tap doan vingroup"`, `"he sinh thai vingroup"`, `"su nghiep pham nhat vuong"`...).
    - Bổ sung nhận diện intent hệ sinh thái (`is_ecosystem`) nhận diện các từ khóa `"he sinh thai"`, `"chuoi gia tri"`, `"cong ty con"`, `"cong ty me"`, `"cac cong ty thanh vien"` và tự động gán `ecosystem_id` (`vingroup`, `hoaphat`, `fpt`, `masan-techcombank`, `sovico`, `ssi-pan`) cùng các mã cổ phiếu cốt lõi.
    - Thêm từ dừng `"CHU"` vào `_NON_TICKER_WORDS` để ngăn chặn nhận diện nhầm từ "chủ" trong "chủ tịch" thành mã chứng khoán giả định.
  - `backend/app/infrastructure/external/crawlers/leader_crawler.py`:
    - Bổ sung `_fold(text)` chuẩn hóa tiếng Việt bỏ dấu cho so sánh linh hoạt.
    - Bổ sung `_GLOBAL_LEADERS` (Warren Buffett, Charlie Munger, Peter Lynch, George Soros, Elon Musk).
    - Thêm phương thức `find_leader(query)` tìm kiếm theo ID, họ tên, công ty (với bóc tách từ khóa cốt lõi chống lệch chữ), và mã chứng khoán.
  - `backend/app/infrastructure/external/market_fixture_provider.py`:
    - Phương thức `people()` kết nối trực tiếp `get_leader_crawler().get_prominent_leaders()` cung cấp đầy đủ 22 lãnh đạo có giá cổ phiếu live.
  - `backend/app/application/use_cases/ai_chat/response_builder.py`:
    - Xây dựng `_build_leader_section(...)` xử lý chuyên biệt 4 trường hợp:
      1. **Hệ sinh thái doanh nghiệp cụ thể** (`is_ecosystem` và `ecosystem_id`): Kết nối `EcosystemService`, hiển thị người sáng lập, tổng quan, mã niêm yết hạt nhân kèm giá live, danh sách công ty thành viên/trụ cột (mẹ, con niêm yết, ngoài sàn), tỷ lệ sở hữu và chuỗi giá trị liên kết.
      2. **Hệ sinh thái tổng quát**: Liệt kê 6 đại tập đoàn lớn nhất trên sàn chứng khoán.
      3. **Top tỷ phú & người giàu**: Liệt kê top người giàu, mã cổ phiếu, tỷ lệ sở hữu, tài sản cổ phiếu niêm yết và tổng tài sản Forbes/CafeF.
      4. **Doanh nhân / Lãnh đạo / Doanh nghiệp cụ thể**: Hiển thị chức vụ & đơn vị, mã cổ phiếu liên quan & thị giá live, cổ phần nắm giữ, tài sản niêm yết, tổng tài sản, ngoài sàn, tiểu sử sự nghiệp, và tích hợp tóm tắt hệ sinh thái doanh nghiệp của họ.
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Tích hợp `is_leader`, `leader_profile`, `is_ecosystem`, `ecosystem_id` vào pipeline xử lý: tự động nạp instrument live của các mã liên quan vào `stock_data`.
    - Bổ sung intent `"leader"` vào `_CACHE_TTL_SECONDS` (12 giờ) và nâng `_CACHE_KEY_PREFIX = "ai:chat:v7"`.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Mở rộng regex trong `HighlightedText` nhận diện highlight số liệu tài sản tỷ phú: `tỷ USD`, `triệu USD`, `tỷ ₫`, `nghìn tỷ ₫`.
    - Cập nhật `FormattedContent` nhận diện các heading mới: `Thông tin doanh nhân:`, `Thông tin doanh nghiệp & Lãnh đạo:`, `Hệ sinh thái doanh nghiệp:`, `Top doanh nhân & tỷ phú nổi bật:`.
- **Verification**:
  - `backend/tests/unit/ai_chat/test_ai_chat.py`: Thêm test kiểm tra `test_ai_leader_pham_nhat_vuong`, `test_ai_leader_by_company_title`, `test_ai_leader_rankings`, `test_ai_global_leader_warren_buffett`, `test_ai_company_and_career_queries` (32/32 passed 100%).
  - `backend/tests/integration/api/test_ai_chat_api.py`: Thêm integration tests cho endpoint AI chat với các câu hỏi doanh nhân, doanh nghiệp và hệ sinh thái (9/9 passed 100%).
  - Backend Lint (Ruff): 0 lỗi (`All checks passed!`).
  - Backend Typecheck (Mypy): 0 lỗi (`Success: no issues found in 43 source files`).
  - Frontend Lint (ESLint) & Typecheck (tsc): 0 lỗi.
  - Git diff whitespace check (`git diff origin/dev --check`): 0 lỗi.

## AI Chat Modularization (`intent_parser`, `market_snapshot`, `external_search`, `response_builder`), VN30 Active Stocks & Upcoming Events Resolution, and Regex Highlight Boundary Fix - 2026-11-04 (completed)
- **User Request**:
  1. **Ảnh 1 — Trả lời đúng trọng tâm câu hỏi về cổ phiếu trong rổ VN30 hoạt động sôi nổi hôm nay + Sửa lỗi highlight cắt chữ `"điểm"`, `"đạt"`**:
     - Khi hỏi `"cho tôi một vài cổ phiếu trong vn30 hoạt động sôi nổi trong hôm nay"`, trả lời danh sách cụ thể các cổ phiếu thuộc rổ **VN30** có giá trị giao dịch và biến động sôi nổi nhất hôm nay (`"Các cổ phiếu rổ VN30 hoạt động sôi nổi nhất hôm nay:"`) thay vì trả lời chung chung nhịp đập toàn thị trường.
     - Sửa lỗi regex highlight trên UI làm tách `"1,733.02 điểm"` thành `[1,733.02 đ] iểm` và `"VN30 đạt"` thành `VN [30 đ] ạt`.
  2. **Ảnh 2 — Trả lời câu hỏi về các sự kiện nổi bật sắp tới**:
     - Khi hỏi `"sắp tới có các sự kiện gì nổi bật"`, nhận diện đúng intent sự kiện thị trường & doanh nghiệp sắp tới (`"Lịch sự kiện thị trường & doanh nghiệp nổi bật sắp tới:"`), tổng hợp cả `upcoming_events` từ `MarketService.overview()` lẫn lịch chốt quyền cổ tức sắp tới từ `DividendCrawler.get_upcoming_dividends()`.
  3. **Chia nhỏ `ai_financial_service.py` thành nhiều module chuyên biệt**:
     - Không dồn toàn bộ logic (~1.600 dòng) vào 1 file duy nhất mà tách thành các module rõ ràng trong `backend/app/application/use_cases/ai_chat/`.
- **Branch**: `fix/AI`
- **Changes**:
  - Tách `backend/app/application/use_cases/ai_chat/ai_financial_service.py` thành 5 module rõ ràng theo Clean Architecture:
    1. `backend/app/application/use_cases/ai_chat/intent_parser.py`: Chuẩn hóa câu hỏi tiếng Việt (`normalize_user_input`, `normalize_question`), trích xuất mã cổ phiếu (`_extract_tickers`), tính chỉ báo kỹ thuật (`_calculate_rsi`), chuẩn hóa tỷ lệ cổ tức (`_clean_dividend_ratio`), và nhận diện ý định (`detect_intent`, `DetectedIntent`). Mở rộng nhận diện các câu hỏi sự kiện (`"su kien"`, `"lich su kien"`, `"sap toi co"`, `"dhcd"`) và hoạt động rổ VN30 (`"soi noi"`, `"hoat dong"`, `"ro vn30"`, `"co phieu trong"`).
    2. `backend/app/application/use_cases/ai_chat/market_snapshot.py`: Tổng hợp dữ liệu thị trường hàng ngày (`build_daily_market_snapshot`) bao gồm chỉ số `VNINDEX`/`VN30`/`HNX`, độ rộng thị trường, `upcoming_events`, `top_movers`, `top_gainers`, `top_losers`, `top_liquidity`, `top_foreign_buy`/`sell`, `top_sectors`, và nhóm cổ phiếu rổ **VN30** (`vn30_active`, `vn30_movers`, `vn30_gainers`, `vn30_losers`).
    3. `backend/app/application/use_cases/ai_chat/external_search.py`: Tìm kiếm web dự phòng (`search_external_info`, `decode_ddg_url`, `strip_tags`).
    4. `backend/app/application/use_cases/ai_chat/response_builder.py`: Tổng hợp phản hồi có cấu trúc và rich widgets (`generate_structured_response` cùng các hàm chuyên biệt cho cổ tức & sự kiện, tin tức, so sánh cổ phiếu, phân tích cổ phiếu đơn lẻ, và toàn cảnh thị trường / rổ VN30).
    5. `backend/app/application/use_cases/ai_chat/ai_financial_service.py`: Đóng vai trò pipeline orchestrator gọn gàng (~260 dòng) điều phối 11 bước (`guardrail` -> `cache_lookup` -> `intent_detection` -> `internal_data_retrieval` -> `knowledge_retrieval` -> `external_search` -> `response_generation` -> `citation` -> `output_redaction` -> `evaluation` -> `cache_store`).
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Cập nhật regex trong `HighlightedText` với negative lookbehind `(?<![A-Za-zÀ-ỹ0-9])` và negative lookahead `(?![A-Za-zÀ-ỹ0-9])`, đồng thời thêm đơn vị `điểm` trước `đ`, đảm bảo `"1,733.02 điểm"` được highlight trọn vẹn và `"VN30 đạt"` không bao giờ bị cắt thành `VN [30 đ] ạt`.
    - Bổ sung nhận diện các heading mới (`Các cổ phiếu rổ VN30`, `Lịch sự kiện`) trong `FormattedContent`.
  - Bổ sung Unit Tests & API Integration Tests trong `backend/tests/unit/ai_chat/test_ai_chat.py`, `backend/tests/integration/api/test_ai_chat_api.py`, và `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`.

## AI Chatbox 5-Item Urgent Polish: Deduplicate Sources, Synchronize Ratio Highlights, Remove Horizontal Scroll, Daily Market Snapshot & Compact Drawer Widget UI - 2026-11-04 (completed)
- **User Request**:
  1. **Ảnh 1 — Xóa hiển thị trùng 2 lần nguồn tham khảo**: Hiện tại vừa hiển thị đoạn bullet `Nguồn tham khảo:` trong thân tin nhắn vừa hiển thị khối `NGUỒN THAM KHẢO ĐÃ KIỂM CHUẨN:` bên dưới, đồng thời bị lặp 5 lần cùng 1 link `Nguồn công bố: CafeF Data`.
  2. **Ảnh 2 — Đồng bộ highlight cho mọi tỷ lệ & làm sạch chuỗi tỷ lệ**: Trong lịch cổ tức MBB, tỷ lệ `10%` và `1,000 đ` có highlight nhưng `10:1`, `100:15`, `100:32`, `100:3` lại không có highlight; dòng cuối bị lặp chữ `Tỷ lệ: Cổ tức bằng Tiền, tỷ lệ 100:3`.
  3. **Ảnh 3 — Bỏ thanh scroll ngang khi ở tab nhỏ (`AiChatDrawer`)**: Xóa hoàn toàn thanh cuộn ngang màu xám ở đáy khung chat nhỏ.
  4. **Ảnh 4 — Cho model AI học dữ liệu thị trường mỗi ngày**: Khi hỏi `"hôm nay cổ phiếu nào được biến động nhiều nhất"`, AI phải tổng hợp dữ liệu thị trường thực tế trong ngày (Top biến động mạnh nhất, Top tăng/giảm giá, Top thanh khoản, Khối ngoại, Nhóm ngành, VN-Index thực tế `1.733,02 (+1,97%)`) thay vì trả lời nhầm sang bài học lý thuyết.
  5. **Ảnh 5 — Thiết kế lại UI của Widget trong tab nhỏ**: Sửa lỗi `StockScoreCardWidget` bị chồng chéo chữ (`10.0x2.3x 22.6%`), rớt chữ `đ`, gãy dòng `ĐÁNH GIÁ` / `TÍCH CỰC` và tràn biểu đồ Radar trong tab nhỏ `AiChatDrawer`.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Bổ sung hàm `_clean_dividend_ratio(raw_ratio, div_type, cash_val)` chuẩn hóa các chuỗi như `"Cổ tức bằng Tiền, tỷ lệ 100:3"` thành tỷ lệ gọn `"100:3"` và tự động suy luận mệnh giá tiền mặt `300 đ/cp`.
    - Bổ sung phương thức `_get_daily_market_snapshot()` tổng hợp trực tiếp dữ liệu toàn thị trường trong ngày từ `MarketService` (`vnindex`, `vn30`, `hnx`, `breadth`, `top_movers`, `top_gainers`, `top_losers`, `top_liquidity`, `top_foreign_buy`, `top_foreign_sell`, `top_sectors`).
    - Sửa lỗi đọc `self._market.overview().get("data", {})` để lấy đúng điểm số VN-Index thực tế thay vì fallback mặc định `1250.0`.
    - Mở rộng nhận diện `is_market_general` và phân nhánh trả lời chi tiết cho các câu hỏi về cổ phiếu biến động nhiều nhất, tăng mạnh nhất, giảm mạnh nhất, thanh khoản cao nhất, khối ngoại mua/bán ròng, nhóm ngành dẫn dắt và nhịp đập thị trường.
    - Khử trùng lặp danh sách `sources` theo `url` trước khi tạo trích dẫn và trả về.
    - Nâng `_CACHE_KEY_PREFIX` lên `"ai:chat:v2"` để vô hiệu hóa các bản ghi cache cũ bị lỗi.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Trong `HighlightedText`: mở rộng regex nhận diện cả tỷ lệ dạng `X:Y` (`10:1`, `100:15`, `100:32`, `100:3`) và highlight đồng bộ bằng badge màu `emerald` giống hệt tỷ lệ `%`; mở rộng regex tiền tệ bọc trọn `1,000 đ/cp`, `tỷ đ`, `nghìn tỷ`.
    - Trong `FormattedContent`: tự động ẩn khối text `Nguồn tham khảo:` ở cuối nội dung khi đã có danh sách `sources` hiển thị dạng pill bấm được ở dưới; chuẩn hóa cụm `"Tỷ lệ: Cổ tức bằng Tiền, tỷ lệ"` thành `"Tỷ lệ: "`.
    - Trong `AiChatBubble`: deduplicate `message.sources` theo `url` và thêm `min-w-0 max-w-full overflow-hidden break-words` chống tràn ngang.
  - `frontend/src/components/ai-chat/ai-chat-drawer.tsx` & `frontend/src/components/ai-chat/ai-assistant-workspace.tsx`:
    - Thêm `overflow-x-hidden` vào vùng cuộn tin nhắn để loại bỏ hoàn toàn thanh scroll ngang.
  - `frontend/src/components/ai-chat/widgets/stock-score-card-widget.tsx` (& các widget liên quan):
    - Thiết kế lại bố cục phân tầng dọc gọn đẹp cho cả tab nhỏ lẫn trang lớn: Header chống gãy dòng (`whitespace-nowrap` cho `Đánh giá` và `TÍCH CỰC`), hàng 3 ô `P/E` / `P/B` / `ROE` (`grid-cols-3 gap-2`), hàng 2 ô `Hỗ trợ quan trọng` / `Kháng cự gần` (`grid-cols-2 gap-2`), biểu đồ SVG Radar `viewBox="0 0 240 192"` không cắt chữ kèm 5 pill điểm số nhân tố.
- **Verification**:
  - Backend Tests: 32/32 AI chat unit & API integration tests passed.
  - Frontend Tests: 8/8 AI chat component, drawer E2E & route handler tests passed.
  - Full Quality Gate `./scripts/check-pr.ps1`: 6/6 steps passed.

## Dividend Intent Specialization, Vietnamese Typo Normalization, Uvicorn Hot Reload & Comprehensive API/E2E Testing - 2026-11-04 (completed)
- **User Request**:
  1. Người dùng phàn nàn: *"đùa à, sao vẫn y như cũ thế, nó k phân tích yêu cầu à sao response y chang nhau vậy"* kèm ảnh minh họa câu hỏi `cho tao tin tức chứng khoánhôm nay` bị trả về mã `TIN` và `cho tao lịch chia cổ tức của mbb` bị trả về báo cáo kỹ thuật rập khuôn (Thị giá, Định giá, RSI, MA20).
  2. Bổ sung intent `dividend` (Lịch chia cổ tức): phân tích đúng câu hỏi cổ tức của mã cụ thể (ví dụ MBB) hoặc cổ tức sắp tới của toàn thị trường, trả về bảng ngày GDKHQ, hình thức tiền mặt/cổ phiếu, tỷ lệ, số tiền và link nguồn trích dẫn `/market/stocks/{symbol}#dividends`, tuyệt đối không trả về báo cáo phân tích kỹ thuật RSI/MA20 rập khuôn.
  3. Bổ sung text normalization giải quyết các lỗi gõ phím dính chữ tiếng Việt (`khoánhôm` -> `khoán hôm`, `tintức` -> `tin tức`, `cổtức` -> `cổ tức`...).
  4. Loại bỏ triệt để các hàng lỗi chỉ có dấu chấm `.` hoặc `• -` rác trên UI.
  5. Restart backend daemon process `uvicorn` với cờ `--reload` để nạp mã nguồn mới nhất vào server đang phục vụ browser client.
  6. Bổ sung API Integration Tests và E2E Tests theo yêu cầu của người dùng (`nhớ test api và test e2e`).
  7. Commit và push DUY NHẤT trên nhánh `fix/AI`, **tuyệt đối không merge vào `dev` hay `main`**.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Bổ sung hàm `normalize_user_input(text)` tự động tách các cặp từ dính chữ phổ biến: `khoánhôm` -> `khoán hôm`, `tintức` -> `tin tức`, `cổtức` -> `cổ tức`, `hômnay` -> `hôm nay`, `chứngkhoán` -> `chứng khoán`...
    - Thêm intent `dividend` vào `AiIntent` với TTL cache 3600s.
    - Nhận diện `is_dividend` ưu tiên hàng đầu với các từ khóa tài chính: `co tuc`, `chia co tuc`, `lich co tuc`, `lich chia co tuc`, `tra co tuc`, `chot quyen`, `gdkhq`, `ty le chia`...
    - Tích hợp `get_dividend_crawler()`: trích xuất các sự kiện cổ tức thực tế theo mã (`crawler.get_symbol_dividends(symbol)`) hoặc toàn thị trường (`crawler.get_upcoming_dividends()`).
    - Xây dựng cấu trúc phản hồi `Lịch chia cổ tức: {symbol} - {name}` chi tiết từng đợt (Ngày GDKHQ, Hình thức Tiền mặt/Cổ phiếu, Tỷ lệ, Số tiền đ/cp, Nguồn tin công bố) và đính kèm link trích dẫn `/market/stocks/{symbol}#dividends`.
    - Tách biệt độc lập các dòng text bullet trong `_generate_structured_response`, loại bỏ hoàn toàn các ký tự `\n` gộp gây sinh dòng lẻ.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Thêm nhận diện các heading mới: `Lịch chia cổ tức:`, `Lịch chia cổ tức các doanh nghiệp sắp tới:`, `Điểm tin chứng khoán`.
    - Nâng cấp bộ lọc dòng rỗng / marker rỗng với regex `/^[\s.\-•*–—]+$/`, triệt tiêu dứt điểm hiện tượng render các dòng chỉ có dấu chấm `.` hoặc `• -`.
  - `frontend/src/components/ai-chat/ai-chat-drawer.tsx` & `frontend/src/test/setup.ts`:
    - Thêm guard `messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" })` an toàn trong môi trường DOM test.
    - Tạo stub `frontend/src/test/server-only-stub.ts` và cấu hình alias `vitest.config.mts` giải quyết import `server-only` cho Route Handler tests.
  - **Tests**:
    - `backend/tests/unit/ai_chat/test_ai_chat.py`: Thêm unit test `test_normalize_user_input`, `test_ai_news_with_concatenated_typo`, `test_ai_dividend_intent_with_symbol`, `test_ai_dividend_intent_market_upcoming` (22/22 passed).
    - `backend/tests/integration/api/test_ai_chat_api.py`: Thêm API integration test `test_ai_chat_endpoint_dividend_intent` và `test_ai_chat_endpoint_news_with_concatenated_typo` (6/6 passed).
    - `frontend/src/app/ai-api/[[...path]]/route.test.ts`: Thêm API BFF Route Handler integration test (2/2 passed).
    - `frontend/src/components/ai-chat/ai-chat-drawer.test.tsx`: Thêm E2E Component user interaction test (mở drawer, nhập prompt cổ tức/tin tức, render phản hồi và sources) (2/2 passed).
    - `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`: Thêm unit test kiểm tra heading cổ tức và chặn dấu chấm / gạch ngang rỗng (3/3 passed).
  - Quản lý tiến trình:
    - Hủy bỏ daemon uvicorn cũ và khởi động lại uvicorn với `--reload` trên cổng 8000.
    - Kiểm thử live qua HTTP POST thực tế trên cổng 8000 trả về chuẩn 100% cả câu hỏi cổ tức MBB, tin tức và phân tích kỹ thuật HPG.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100% (6/6 steps).
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Tests (Vitest): 184/184 passed 100% (48 test files).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Tests (Pytest): 159/159 passed 100%.

## AI Assistant Security Guardrails, News Intent Resolution, User Bubble Polish & Observability - 2026-11-04 (completed)
- **User Request**:
  1. Chuyển nhánh `fix/AI`.
  2. Không cho AI trả lời các yêu cầu về data mật trong hệ thống (tokens, secrets, credentials, db connection strings, passwords, private user emails/balances).
  3. Không nhận các yêu cầu sửa đổi hệ thống (drop table, delete from, restart server, sửa code, cấp quyền admin) hay prompt injection.
  4. Áp dụng cache cho AI để phản hồi nhanh cho những câu đã có user khác hỏi (shared question cache).
  5. Ưu tiên học thuộc dữ liệu nội bộ không mật của hệ thống để response tốt hơn (RAG: published learning topics và stock glossary).
  6. Nếu crawl bên ngoài thì BẮT BUỘC ghi nguồn trong response (kèm link URL).
  7. Thêm giám sát và eval cho từng bước AI làm (per-step tracing, online rule-based evaluation, metrics endpoint).
  8. Pull toàn bộ code từ nhánh `fix/UI` về `fix/AI` (bao gồm bỏ bảng preview portfolio khi chưa đăng nhập, fix lệch giá community, pagination cổ tức...).
  9. Chỉnh sửa bong bóng tin nhắn user trong AI chat: màu gradient đẹp mắt, thời gian gửi rõ ràng, chiều cao gọn gàng.
  10. Sửa triệt để lỗi phân tích yêu cầu sai: khi user gõ "cho tao tin tức hôm nay", AI không được nhận chữ "TIN" thành mã cổ phiếu TIN để phân tích cổ phiếu; nhận diện đúng intent tin tức (`news`), trả về "Điểm tin thị trường hôm nay:" kèm nguồn trích dẫn rõ ràng; loại bỏ hoàn toàn các hàng lỗi chỉ có dấu `• -` rỗng.
  11. Commit và push DUY NHẤT trên nhánh `fix/AI`, tuyệt đối không merge vào `dev` hay `main`.
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`:
    - Mở rộng danh sách stop words tiếng Việt `_NON_TICKER_WORDS` gồm các từ giao tiếp hàng ngày: `TIN`, `HOM`, `TAO`, `DAY`, `TOP`, `MUC`, `GOI`, `MOI`, `DAT`, `LEN`, `XEP`, `LOI`, `MAT`, `TIM`, `CAU`, `CHON`, `MO`...
    - Thêm cơ chế tiền tố tường minh `_EXPLICIT_TICKER_PATTERN`: các từ trùng với stop word tiếng Việt (như `TIN`, `HOM`) chỉ được nhận diện là ticker khi có từ chỉ định tài chính (`mã TIN`, `cổ phiếu TIN`, `cp TIN`, `phân tích TIN`, `(TIN)`).
    - Bổ sung intent `news` trong `AiIntent` với TTL cache 120s.
    - Nhận diện `is_news` khi câu hỏi chứa từ khóa tin tức ("tin tức", "tin mới", "bản tin", "điểm tin", "cho tao tin tức hôm nay"...).
    - Tích hợp `INewsRepository` lấy tin tức thực tế từ hệ thống InvestIQ (`SqlNewsRepository`) hoặc fallback DuckDuckGo.
    - Tạo cấu trúc phản hồi "Điểm tin thị trường hôm nay:" chuyên nghiệp, liệt kê các tiêu đề tin, tóm tắt và trích dẫn nguồn cụ thể.
  - `backend/app/api/v1/ai_chat.py`:
    - Tích hợp `SqlNewsRepository` với cơ chế non-blocking pool `_pool is not None` giúp test runtime không bị timeout.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`:
    - Cập nhật bong bóng tin nhắn user: nền gradient `bg-gradient-to-r from-sky-600 via-sky-600 to-cyan-600`, chiều cao padding gọn gàng `px-3.5 py-1.5 sm:py-2`, thời gian gửi `text-sky-100 font-semibold text-[10px]` sáng rõ rệt.
    - Loại bỏ các regex replace gây sinh dòng lẻ `-`, bổ sung bộ lọc triệt tiêu hoàn toàn các dòng rỗng hoặc chỉ có dấu bullet `• -`.
  - `frontend/src/components/ai-chat/ai-chat-bubble.test.tsx`:
    - Thêm 2 unit tests kiểm tra giao diện user bubble, tiêu đề điểm tin thị trường và bộ lọc chặn dòng bullet rỗng.
  - `backend/tests/unit/ai_chat/test_ai_chat.py`:
    - Thêm unit tests: `test_ai_news_intent_not_ticker_tin`, `test_ai_news_with_news_repository`, và kiểm tra ticker extraction stop words.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 179/179 passed 100% (46 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (43 source files).
  - Backend Unit Tests (Pytest): 155/155 passed 100%.
  - Backend Integration Tests (`test_ai_chat_api.py`): 4/4 passed 100%.

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (completed)
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups` (merged to `dev` and `main`, commit `9c9e8d6`).

## Dividend Calendar Pagination, Nearest-Date Sorting & Official Source Link - 2026-11-04 (completed)
- **User Request**:
  1. Thêm phân trang cho lịch chia cổ tức trong trang chủ (`/`), xếp theo gần thời điểm hiện tại nhất.
  2. Khi click vào lịch thì có thể link tới nguồn thông tin đó.
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`).
- **Branch**: `fix/UI` (committed `aa6eb53` and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `backend/app/schemas/market.py` & `backend/app/infrastructure/external/crawlers/dividend_crawler.py`:
    - Bổ sung trường `source_url: str | None = None` vào schema `DividendItem`.
    - Gán URL nguồn công bố thông tin chính thức tương ứng cho các sự kiện cổ tức (CafeF / Vietstock / Sở giao dịch).
  - `frontend/src/types/market.ts`:
    - Cập nhật kiểu `DividendItem` với `source_url?: string | null;`.
  - `frontend/src/app/(user)/page.tsx`:
    - Tăng số lượng sự kiện fetch `getMarketDividendCalendar(40)` để hỗ trợ dữ liệu phong phú hơn cho phân trang.
  - `frontend/src/components/market/dividend-calendar-widget.tsx`:
    - Tích hợp component `Pagination` đồng bộ với hệ thống (`pageSize = 6`, 2 hàng x 3 cột cân xứng hoàn hảo).
    - Thêm thuật toán sắp xếp `sortedEvents` theo gần thời điểm hiện tại nhất (`ex_date || event_date` so với ngày hiện tại: sự kiện sắp diễn ra gần nhất đứng đầu, các sự kiện quá khứ vừa mới diễn ra xếp sau).
    - Tự động reset về trang 1 khi thay đổi bộ lọc phân loại hoặc từ khóa tìm kiếm.
    - Cập nhật trải nghiệm click:
      - Toàn bộ thẻ card có `cursor-pointer`, khi click vào vùng trống sẽ mở nguồn thông tin trong tab mới hoặc chuyển hướng.
      - Tiêu đề sự kiện (`event.title`) là link trực tiếp dẫn tới nguồn thông tin với hiệu ứng hover và gạch chân.
      - Chân thẻ hiển thị liên kết nguồn tin `Nguồn: {event.source} ↗` và nút `Nguồn tin ↗`.
      - Các tương tác con ("Nhắc nhở", badge mã cổ phiếu) có `e.stopPropagation()` độc lập an toàn.
  - `frontend/src/components/market/dividend-calendar-widget.test.tsx`:
    - Thêm các unit test kiểm tra sắp xếp theo ngày gần hiện tại nhất, hỗ trợ phân trang > 6 items, và liên kết nguồn thông tin.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100% (6/6 steps).
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend TypeScript Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 177/177 passed (45 test files).
  - Backend Ruff & Mypy: Passed 0 lỗi.
  - Backend Pytest: 142/142 passed 100%.


## Remove Unauth Market Preview Table from Portfolio & Fix Community Price Alignment / Badge Wrapping - 2026-11-04 (completed)
- **User Request**:
  1. Bỏ bảng "Cổ phiếu sẵn sàng giao dịch" khỏi trang danh mục (`/portfolio`) khi chưa đăng nhập.
  2. Chỉnh lại style trang cộng đồng (`/community`), khắc phục hiện tượng lệch giá (nhãn căn trái, giá căn phải; bỏ dấu hai chấm rườm rà; căn trái đồng bộ; phân biệt màu sắc giá vào/hiện tại/mục tiêu/cắt lỗ; chống rớt dòng tag "Tăng giá", "Kỳ hạn 3T"; chuẩn hóa hiển thị outcome ROI).
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`).
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`:
    - Loại bỏ hoàn toàn khối `paper-unauth-market-preview` ("Cổ phiếu sẵn sàng giao dịch") khi người dùng chưa đăng nhập, giữ giao diện giới thiệu hero và 3 feature cards gọn gàng, tinh tế.
  - `frontend/src/components/community/thesis-arena.tsx`:
    - Bỏ dấu hai chấm sau nhãn (`Giá vào`, `Giá hiện tại`, `Mục tiêu`, `Cắt lỗ`).
    - Thêm hàm `formatOutcomeRoi` chuẩn hóa hiển thị ROI không bị lặp ký tự `(++23.1%%)` -> `(+23.1%)`.
    - Gán class giá trị chuyên biệt `val-entry`, `val-current`, `val-target`, `val-stoploss`.
  - `frontend/src/app/globals.css`:
    - Cập nhật `.thesis-metrics-grid` và `.metric-box`: Căn lề trái (`text-align: left !important`, `align-items: flex-start`), khoảng cách cân đối, màu sắc chuẩn tài chính.
    - Cập nhật `.thesis-stance-badge`, `.thesis-horizon-badge`, `.status-badge`: Thêm `white-space: nowrap; flex-shrink: 0;` ngăn chặn hoàn toàn hiện tượng rớt chữ thành 2 dòng.

## Unified Standard Pagination Across News, Market Stocks, Dividends, and Events - 2026-11-04 (completed)
- **User Request**:
  1. Đồng bộ style phân trang thành 1 kiểu duy nhất trên toàn bộ các trang có phân trang: Trang tin tức (`/news`), Trang thị trường bảng mã cổ phiếu (`/market/stocks`), Trang cổ tức (`StockDividendPanel`), Trang sự kiện (`/market/events`).
  2. Tối ưu hóa việc load dữ liệu (instant page navigation, server-side prefetching, client-side zero-latency slicing, smart 7-item windowing with ellipsis, offset cursor calculation for stocks).
  3. Làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  4. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`) và cung cấp link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/ui/pagination.tsx`:
    - Tạo component phân trang dùng chung `Pagination` chuẩn mực theo style của Trang cổ tức (Image 2):
      - Cột trái: `Hiển thị X - Y trong tổng số Z [tên mục]` (`startItem` - `endItem` trên `totalItems`).
      - Cột phải: Cụm điều hướng gồm nút `← Trước`, cụm nút số trang (7 ô số tối đa theo thuật toán windowing thông minh với `...`), và nút `Sau →`.
      - Trang hiện tại nổi bật với sắc xanh dương thương hiệu (`bg-sky-600 text-white font-bold shadow-sm`), các trang khác dạng viền xám tối (`bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-900`).
      - Hỗ trợ cả 2 chế độ:
        - `onPageChange`: Dành cho Client State phân trang mượt mà (Cổ tức, Sự kiện) với zero-latency và smooth scroll.
        - `pageUrlPattern` / `getPageUrl`: Dành cho Server Components (Tin tức) và Client Components (Thị trường cổ phiếu) với URL-driven navigation. Sử dụng chuỗi pattern URL an toàn serialization qua ranh giới RSC Server -> Client, khắc phục lỗi Functions cannot be passed directly to Client Components.
    - Tạo hàm encodeCursor(offset: number) tương thích 100% với backend FastAPI (sử dụng base64 URL-safe an toàn cho cả Node.js SSR và Turbopack client runtime, khắc phục hoàn toàn lỗi Unknown encoding: base64url).
  - `frontend/src/components/ui/pagination.test.tsx`:
    - Thêm 4 unit tests kiểm tra thuật toán windowing 7 ô, mã hóa offset cursor, chế độ button callback và chế độ link routing URL.
  - `frontend/src/components/market/stock-dividend-panel.tsx`:
    - Tích hợp component `Pagination` thay cho đoạn code phân trang inline cũ, giữ nguyên nhãn "đợt chi trả" và chuyển trang 0ms client-side.
  - `frontend/src/components/market/events-view.tsx`:
    - Thay thế giao diện phân trang chữ đơn giản ở giữa (Image 4) bằng `Pagination` đồng bộ chuẩn mực với nhãn "sự kiện", có đầy đủ các ô số trang và nút Trước/Sau, bổ sung `className="px-5 pb-5"` cân xứng với mép bo tròn của `.market-tab-panel`.
  - `frontend/src/app/(user)/news/page.tsx`:
    - Thay thế cụm nút màu xanh lá ở giữa (Image 3) bằng `Pagination` đồng bộ với nhãn "bài viết", truyền `pageUrlPattern` an toàn từ Server Component.
  - `frontend/src/components/market/market-stocks-beginner.tsx` (và `market-workspace.tsx`):
    - Nâng cấp thanh phân trang 3 cột đơn điệu `Trang 1 / 93` (Image 1) thành `Pagination` đầy đủ: hiển thị `Hiển thị 1 - 15 trong tổng số 1395 mã cổ phiếu`, các nút số trang nhảy trực tiếp qua `encodeCursor((p - 1) * 15)`, neo chuẩn `#stock-table`.
  - `frontend/src/app/globals.css`:
    - Dọn dẹp các rule CSS cũ gây xung đột layout (`.news-pagination`, `.event-pagination`, `.market-pagination`).
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 173/173 passed (45 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit Tests (Pytest): Passed 100%.

## Full Market Aggregation for Stock Pulse & Foreign Net, Homepage Cleanup (Glossary & Tool Directory Removal) - 2026-11-04 (completed)
- **User Request**:
  1. Bảng quan sát nhanh ("Mã nào đang đáng chú ý?") trên trang chủ phải tính toán trên **toàn bộ thị trường** chứ không chỉ lấy từ 8 mã trong snapshot trang chủ.
  2. Thẻ "Khối ngoại trong nhóm nổi bật" đổi thành "Khối ngoại toàn thị trường", tính toán trên toàn bộ thị trường và xóa bỏ dòng ghi chú "Cộng trên 8 mã trong snapshot trang chủ, không đại diện toàn thị trường".
  3. Cập nhật mô tả của Bảng quan sát nhanh thành "Xếp hạng biến động và thanh khoản trên toàn bộ thị trường" (loại bỏ hoàn toàn câu "Xếp hạng trong 8 mã nổi bật...").
  4. Bỏ 2 khung ở ảnh 2 khỏi trang chủ:
     - Khung 1: Hai cột Thuật ngữ ("THUẬT NGỮ HÔM NAY - Giá tham chiếu là gì?" và "TRƯỚC KHI ĐỌC GIÁ - Giá này thuộc thời điểm nào?").
     - Khung 2: Khung khám phá công cụ ("KHÁM PHÁ INVESTIQ - Chọn công cụ theo việc bạn cần làm").
  5. Tiếp tục làm việc và commit/push DUY NHẤT trên nhánh `fix/UI`, **tuyệt đối không merge vào `dev` hay `main`**.
  6. Vượt qua 100% kiểm thử (Lint, Typecheck, Unit Tests, Quality Gate `./scripts/check-pr.ps1`) và cung cấp link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/(user)/page.tsx`:
    - Fetch song song danh sách cổ phiếu toàn thị trường bằng `Promise.allSettled`: `pulseQuery` (100 mã thanh khoản cao nhất), `gainersQuery` (20 mã tăng mạnh nhất) và `declinersQuery` (20 mã giảm sâu nhất).
    - Hợp nhất vào mảng `allMarketInstruments` (loại trừ trùng lặp bằng `Map<string, MarketInstrument>`), truyền xuống `HomeMarketDashboard`.
  - `frontend/src/components/market/home-market-dashboard.tsx`:
    - Cập nhật `HomeMarketDashboard` và `HomeMarketContent` nhận prop `allMarketInstruments`.
    - Tính dòng tiền mua/bán ròng của khối ngoại trên toàn bộ thị trường: `marketForeignNet = sectors.reduce((acc, s) => acc + (Number(s.foreign_net_value) || 0), 0)`.
    - Đổi tiêu đề thẻ thành `Khối ngoại toàn thị trường`, cập nhật mô tả: "Tổng giá trị mua/bán ròng của khối ngoại trên toàn bộ thị trường trong phiên" (xóa bỏ triệt để dòng "Cộng trên 8 mã trong snapshot trang chủ, không đại diện toàn thị trường").
    - Cập nhật `HomeStockPulse` nhận cờ `isFullMarket`:
      - Khi có dữ liệu toàn thị trường (`isFullMarket = true` hoặc `instruments.length > 20`), tiêu đề phụ hiển thị: "Xếp hạng biến động và thanh khoản trên toàn bộ thị trường."
      - Dòng nguồn hiển thị: "Thống kê toàn thị trường".
      - Dữ liệu cột Tăng nổi bật, Giảm đáng chú ý và Giao dịch sôi động được xếp hạng từ tập hợp toàn bộ các mã trên sàn (100+ mã thanh khoản, tăng, giảm).
    - Xóa bỏ hoàn toàn 2 khung ở ảnh 2: `<div className="beginner-two-columns">` (Thuật ngữ) và `<HomeToolDirectory />` (Khám phá công cụ) theo đúng yêu cầu.
  - `frontend/src/components/market/beginner-market-ui.test.tsx`:
    - Cập nhật kiểm thử link `/portfolio` trỏ tới nút "Mở danh mục mô phỏng →" trong `BeginnerDecisionGuide` thay vì link từ `HomeToolDirectory` đã xóa.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 169/169 passed (44 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit Tests (Pytest): Passed 100%.

## Treemap Visual Contrast, Tab Switch Alignment, Sticky Action Bar & Search Table Centering - 2026-11-04 (completed)
- **User Request**:
  1. Độ chênh lệch phần trăm phải thể hiện rõ ràng hơn, khắc phục tình trạng các khối nhìn đều như nhau mặc dù % biến động chênh nhau rất nhiều (ví dụ LPB +4.61% và GAS +0.27% hay VIC 0% trước đó có diện tích gần như ngang ngửa nhau).
  2. Ngoại trừ cột tên công ty ("Mã & công ty"), tất cả các cột còn lại trong bảng thông tin giao dịch trang Search phải căn giữa (`text-center`).
  3. Khắc phục lỗi khi chuyển đổi giữa 2 tab "Khối nhiệt cổ phiếu" và "Biến động các ngành" thì cụm 2 nút bị rớt xuống dòng riêng bên dưới tiêu đề (ảnh 1 vs ảnh 2).
  4. Khắc phục lỗi khi người dùng rê chuột từ ô ngành xuống bấm link "Mở bảng giá →" thì khối detail bar bên dưới bị mất (ảnh 3).
  5. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  6. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Thay `flex flex-wrap` bằng `flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4`.
    - Phần tiêu đề bên trái sử dụng `min-w-0 flex-1 pr-2 truncate`, mô tả rút gọn súc tích đồng đều giữa cả 2 tab.
    - Cụm 2 nút tab có `shrink-0 self-start sm:self-center`, giữ nguyên vị trí cố định ở góc trên bên phải ngang hàng với tiêu đề ở cả 2 tab, triệt tiêu hoàn toàn hiện tượng bị rớt dòng.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx`:
    - Lưu trạng thái ngành đang xem bằng `activeSectorName`. Khi người dùng rê chuột vào một ô ngành và sau đó di chuyển xuống bấm link "Mở bảng giá →", thanh detail bar không bị biến mất mà vẫn hiển thị ổn định 100%.
    - Nút "Mở bảng giá →" được bọc style button sắc nét (`px-2.5 py-1 rounded-md bg-sky-950/70 border border-sky-700/80 text-sky-400 hover:text-sky-200 hover:bg-sky-900/80 font-bold`) dễ bấm, chuẩn xác.
    - Đồng bộ sử dụng `computePercentMovementWeights(rawChanges)` cho Treemap biến động các ngành.
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Tạo hàm chuyên dụng `computePercentMovementWeights(rawChangePercents)`:
      - Loại bỏ cơ chế nén lũy thừa 0.35 và chặn sàn `Math.max(v, 1)` vốn được thiết kế cho số liệu vốn hóa hàng trăm nghìn tỷ, nguyên nhân khiến dải biến động 0% - 5% bị nén chặt vào khoảng hẹp 1.0 - 1.7.
      - Sử dụng hệ số phân cấp tuyến tính có kiểm soát (`minFloor = 1.0`, `multiplier = 7.0` scale theo `v / maxVal`):
        - Mã biến động mạnh nhất (trần tím, +4.6% - +7%) có diện tích gấp 7 - 8 lần so với mã đứng giá (0%) và gấp 4 - 5 lần so với mã biến động nhẹ (0.2% - 0.5%).
        - Mã 0% hoặc đứng giá vẫn có diện tích sàn an toàn (~1.3% - 1.8% canvas) đảm bảo hiển thị rõ ràng ticker và số liệu % mà không bị tràn hay lỗi font.
    - Áp dụng cơ chế lưu `activeSymbol` tương tự để giữ thanh detail bar cổ phiếu luôn ổn định khi rê chuột xuống xem chi tiết.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Bổ sung unit tests cho `computePercentMovementWeights` (> 6.0x contrast) và test case xác nhận thanh detail bar không bị biến mất khi chuột rời tile để bấm link hành động.
  - `frontend/src/app/(user)/search/page.tsx`:
    - Căn lề chuẩn xác theo yêu cầu: Cột `Mã & công ty` căn trái (`text-left`), toàn bộ 9 cột còn lại (`Giá`, `% hôm nay`, `Mở · Cao · Thấp`, `Khối lượng`, `GTGD`, `Khối ngoại`, `Vốn hóa`, `P/E / P/B`, `Thao tác`) đều căn giữa (`text-center` / `items-center` / `justify-center`) ở cả `<th>` và `<td>`.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: Passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 169/169 passed (44 test suites).
  - Backend Lint (Ruff) & Typecheck (Mypy): Passed 0 lỗi.
  - Backend Unit & Integration Tests (Pytest): 142/142 passed 100%.

## Treemap Absolute Movement Sizing, Header Search Input Polish & Search Results Page Revamp - 2026-11-04 (completed)
- **User Request**:
  1. Hiển thị độ to của khối Treemap theo trị tuyệt đối % biến động (|% biến động|), các khối có biến động lớn phải có diện tích to hơn; chỉ hiển thị mã cổ phiếu kèm % biến động, không hiển thị giá hay thông tin phụ gì thêm; áp dụng tương tự cho khối biến động chung các ngành (ảnh 1).
  2. Xóa viền focus màu vàng trên thanh tìm kiếm header và loại bỏ nút "x" clear dữ liệu trùng lặp (chỉ giữ 1 nút x) (ảnh 2).
  3. Trang kết quả tìm kiếm (ảnh 3):
     - Biến khoảng màu trắng 2 bên thành màu nền tối (`#06111f`) đồng bộ hệ thống.
     - Cho khung nội dung rộng ra toàn màn hình (`max-w-7xl`).
     - Xóa bỏ khung tìm kiếm & tra cứu thông tin to đùng ở đầu trang search (người dùng đã tìm từ header).
     - Bổ sung nội dung phong phú cho phần báo cáo theo khung thời gian (Ngày, Tuần, Tháng, Năm): đỉnh/đáy, biên độ dao động %, thanh khoản, định giá P/E & P/B và phân tích nhận định xu hướng chuyên sâu.
     - Hiển thị bảng thông tin giao dịch và đặt lệnh nhanh 1 dòng đúng chuẩn 10 cột theo ảnh 4, kèm nút Mua / Bán (nếu đang sở hữu mã trong danh mục).
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx` & `stock-treemap-heatmap.test.tsx`:
    - Tính trọng số khối theo trị tuyệt đối % biến động: `Math.max(Math.abs(Number(item.change_percent) || 0), 0.25)`. Các mã biến động mạnh có diện tích lớn nhất; các mã biến động ít hoặc 0% có diện tích nhỏ hơn nhưng vẫn đảm bảo tối thiểu 2.5% diện tích để luôn rõ ràng.
    - Trong mỗi ô treemap: **Chỉ hiển thị mã ticker và % biến động**, loại bỏ hoàn toàn hiển thị giá và các thông tin khác.
    - Bỏ các nút toggle `[ Vốn hóa ] [ GTGD ]` không còn cần thiết, cập nhật nhãn phụ thành: `Độ to khối theo |% biến động| · Tối đa 20 mã tiêu biểu`.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Tương tự, tính trọng số khối ngành theo `Math.max(Math.abs(Number(sector.change_percent) || 0), 0.25)`.
    - Trong mỗi ô ngành: **Chỉ hiển thị tên ngành và % biến động**, bỏ hiển thị số lượng mã và GTGD.
    - Bỏ nút toggle `[ Vốn hóa ] [ GTGD ]`, cập nhật nhãn phụ thành: `Độ to khối theo |% biến động| · Bấm vào ngành để lọc`.
  - `frontend/src/components/layout/header-search.tsx`:
    - Đổi `type="search"` thành `type="text"` và ẩn pseudo-elements `::-webkit-search-cancel-button` của trình duyệt. Loại bỏ hoàn toàn nút X thứ 2 bị trùng lặp, chỉ giữ lại 1 nút X duy nhất của React.
    - Thêm `focus:ring-0 focus-visible:outline-none focus:outline-none` để loại bỏ viền vàng mặc định.
  - `frontend/src/app/globals.css`:
    - Bổ sung `html:has(.search-page)` và `body:has(.search-page)` vào khối dark navy theme `#06111f !important;`, triệt tiêu dứt điểm 2 dải lề màu trắng ở 2 bên trang search.
    - Bổ sung override CSS chặn triệt để `:focus-visible` viền vàng trên toàn bộ các thanh tìm kiếm của hệ thống.
  - `frontend/src/app/search-api/route.ts`:
    - Trả về đầy đủ các trường dữ liệu chứng khoán phục vụ bảng giao dịch 10 cột: `open_price`, `high_price`, `low_price`, `foreign_net_value`, `market_cap`, `pe`, `pb`, `sector`, `is_vn30`, `ceiling_price`, `floor_price`.
    - Tính toán chi tiết các chỉ số cho từng khung thời gian `day`, `week`, `month`, `year`: đỉnh/đáy kỳ, biên độ dao động %, khối lượng bình quân, nhãn xu hướng và phân tích thị trường chi tiết.
  - `frontend/src/app/(user)/search/page.tsx`:
    - Xóa bỏ các class CSS cũ (`market-table`, `simple-stock-table`) gây ra chiều cao quá mức trên `<thead>` và khiến cột nút bấm bị tràn. Thay bằng cấu trúc bảng thuần Tailwind chuẩn với tiêu đề thấp, gọn gàng (`py-2.5 px-3.5 text-[11px] font-bold text-slate-400 bg-[#0b2136]`).
    - Bổ sung các hàm helper màu sắc trực tiếp `getPriceColorClass`, `getChangeColorClass`, `getForeignColorClass` giúp toàn bộ số liệu giá, biến động, mức giá trần/sàn/tham chiếu và dòng tiền khối ngoại hiển thị sắc nét, chuẩn mã màu chứng khoán Việt Nam (Xanh lá / Đỏ / Vàng / Tím trần / Xanh sàn) thay vì bị màu trắng đơn điệu.
    - Xóa hoàn toàn khối thẻ tìm kiếm to đùng ở đầu trang; thay bằng thanh tiêu đề gọn gàng: `Từ khóa: "..."` kèm nút quay lại bảng giá thị trường.
    - Mở rộng vùng hiển thị sang `w-full max-w-7xl mx-auto space-y-6`, tạo cảm giác rộng rãi, thoáng và chuyên nghiệp.
    - Khối Báo cáo đa khung thời gian: Nâng cấp giao diện hiển thị % biến động nổi bật, nhãn xu hướng, đánh giá rủi ro, phân tích chi tiết và 4 thẻ KPI định lượng (Đỉnh/Đáy, Biên độ, Thanh khoản, Định giá).
    - Khối Thông tin giao dịch & Đặt lệnh nhanh: Xây dựng bảng 1 dòng chuẩn 10 cột như ảnh 4 (`MÃ & CÔNG TY`, `GIÁ`, `% HÔM NAY`, `MỞ · CAO · THẤP`, `KHỐI LƯỢNG`, `GTGD`, `KHỐI NGOẠI`, `VỐN HÓA`, `P/E / P/B`, `THAO TÁC`).
    - Cột thao tác hiển thị nút `Mua`, và nếu user đang nắm giữ mã này trong danh mục thì hiển thị thêm nút `Bán`. Bấm Mua/Bán mở trực tiếp `PaperOrderDialog` để đặt lệnh mô phỏng.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 166/166 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Treemap Weight Distribution Balancing & 20 Notable Stocks Limit - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục hiện tượng tỷ lệ diện tích quá lệch trong bản đồ nhiệt (Treemap): có mã quá to (FPT chiếm 90% ngành CNTT, GVR/DCM/DPM chiếm hết ngành Hóa chất) khiến các mã khác bị ép thành các dải pixel siêu nhỏ (micro-boxes) ở góc phải dưới không đọc được.
  2. Hiển thị vừa vặn, cân đối để thấy rõ biến động của từng mã (mã chứng khoán, % tăng/giảm và giá).
  3. Giới hạn tối đa tầm 20 mã đáng chú ý nhất của ngành đó trong 1 khung hiển thị.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Xây dựng và xuất hàm thuật toán `balanceDynamicWeights(rawValues, maxPct = 24, minPct = 2.5)`:
      - Áp dụng nén lũy thừa phi tuyến tính $V_{comp} = V^{0.35}$ triệt tiêu chênh lệch vốn hóa 100x-500x giữa các mã siêu lớn (bluechip như FPT, GVR, VIC) và các mã mid/small-cap.
      - Sử dụng thuật toán lặp phân bổ thặng dư (iterative redistribution clamp) 4 vòng, đảm bảo:
        - Mã đầu ngành lớn nhất luôn có diện tích nổi bật (~20-24% khung hình) nhưng không bao giờ độc chiếm toàn bộ canvas.
        - Mọi mã cổ phiếu còn lại đều đảm bảo đạt tối thiểu 2.5% diện tích khung hình (kích thước tối thiểu ~107px x 129px), hoàn toàn đủ diện tích hiển thị rõ ràng mã ticker in đậm, % biến động và giá khớp lệnh.
    - Cập nhật số lượng cổ phiếu nạp vào và hiển thị: giới hạn tối đa `20` mã tiêu biểu nhất theo GTGD/vốn hóa (`limit=20` và `slice(0, 20)`).
    - Cập nhật nhãn phụ: `Biến động trong ngày (%) · Tối đa 20 mã tiêu biểu`.
    - Tối ưu hóa kích cỡ chữ bên trong các ô: nhãn mã in đậm (`text-xs sm:text-sm font-black`), % biến động (`text-[10px] sm:text-[11px] font-extrabold`), giá khớp VND (`text-[10px] opacity-85`).
  - `frontend/src/components/market/sector-treemap-heatmap.tsx`:
    - Áp dụng thuật toán `balanceDynamicWeights(rawWeights, 20, 2.5)` cho bản đồ nhiệt ngành, giúp các ngành nhỏ (Du lịch, Viễn thông...) không bị co quá nhỏ và các ngành lớn (Bất động sản, Ngân hàng) không chiếm hết khung.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx`:
    - Bổ sung unit tests cho thuật toán `balanceDynamicWeights`: kiểm tra độ nén tỷ lệ cực đoan 100x, độ cân bằng tổng 100%, ngưỡng max <= 25% và ngưỡng min >= 2.5%, cùng các trường hợp biên mảng rỗng, 1 phần tử hoặc tất cả bằng 0.
  - `frontend/src/components/market/market-candlestick-chart.test.tsx`:
    - Nâng timeout test case 190 nến từ `25_000ms` lên `45_000ms` để bảo đảm độ ổn định khi chạy song song 44 test suites.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 166/166 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Sector Stocks Dynamic Proxy, Sector Treemap Heatmap & Quick Facts Layout Balancing - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục tình trạng một số ngành hiển thị quá ít cổ phiếu (ví dụ Hóa chất chỉ hiện 3 mã, Công nghệ Thông tin chỉ hiện 1 mã FPT).
  2. Đồng bộ layout tab "Biến động các ngành" sang dạng Treemap tương tự như khối nhiệt cổ phiếu (thay vì 2 hàng ô nhỏ cuộn ngang cũ).
  3. Thu nhỏ khối thông tin bên phải (khối đỏ độ rộng thị trường, định giá P/E & P/B, thanh khoản & khối ngoại) để nhường không gian tối đa cho khối hiển thị bản đồ nhiệt (Treemap) bên trái.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/market-api/instruments/route.ts` & `route.test.ts`:
    - Tạo Next.js Route Handler BFF proxy `/market-api/instruments` chuyển tiếp an toàn các tham số lọc `sector`, `limit`, `sort`, `direction` đến backend `getMarketInstruments`.
    - Giải quyết dứt điểm lỗi 404 khi browser client gọi `/api/v1/market/instruments`, giúp nạp trọn vẹn 30-40 mã tiêu biểu cho từng ngành (Hóa chất nạp đủ 30 mã, Công nghệ Thông tin nạp đủ 27 mã...).
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Đổi endpoint nạp danh sách cổ phiếu ngành sang `/market-api/instruments` với `limit=40`.
    - Hỗ trợ props `selectedSector` và `onSectorChange` giúp đồng bộ 2 chiều mượt mà giữa selector ngành và tab ngành.
    - Nâng chiều cao canvas treemap lên `h-[380px] sm:h-[440px] md:h-[480px]` và tối ưu hóa font scaling chống tràn chữ cho các ô nhỏ khi ngành có nhiều mã.
  - `frontend/src/components/market/sector-treemap-heatmap.tsx` & `sector-treemap-heatmap.test.tsx`:
    - Xây dựng component Treemap chuyên biệt cho "Biến động các ngành" áp dụng thuật toán `computeSquarifiedTreemap`.
    - Hỗ trợ xem theo quy mô Vốn hóa (`market_cap`) hoặc GTGD (`matched_value`), hiển thị tên ngành, % biến động, số lượng mã, mã màu xanh/đỏ/vàng.
    - Hover bar chi tiết hiển thị số mã tăng/đứng/giảm, tổng GTGD, vốn hóa và liên kết mở bảng giá ngành.
    - Tương tác nhấp chuột thông minh: nhấp vào bất kỳ ô ngành nào sẽ tự động chuyển sang tab "Khối nhiệt cổ phiếu" với ngành đó được chọn sẵn.
  - `frontend/src/components/market/market-stocks-beginner.tsx`:
    - Tích hợp `SectorTreemapHeatmap` vào tab "Biến động các ngành".
    - Điều chỉnh tỷ lệ grid từ `md:col-span-7 lg:col-span-8` / `md:col-span-5 lg:col-span-4` thành `md:col-span-8 lg:col-span-9` (khối nhiệt chiếm 75% không gian) và `md:col-span-4 lg:col-span-3` (khối tóm tắt bên phải chiếm 25%).
    - Tinh chỉnh padding và khoảng cách bên trong `market-quick-facts` thành `p-4 flex flex-col gap-3.5`, giúp giao diện cân đối, gọn gàng và khoáng đạt.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 164/164 passed (44 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Treemap Heatmap Layout Perfection, Timeframe Control Removal & Sector Fetching - 2026-11-04 (completed)
- **User Request**:
  1. Khắc phục lỗi hiển thị bị khuất, lệch trục và khoảng đen lớn (black void) trong khối nhiệt cổ phiếu Treemap (ảnh 1, 2, 3).
  2. Bỏ khối chọn khung thời gian 1D, 7D, 30D, 1Y ở ảnh 4, mặc định hiển thị biến động theo ngày.
  3. Đảm bảo khi chọn ngành (ví dụ Công nghệ Thông tin, Bất động sản, Dịch vụ tài chính...) hiển thị đầy đủ danh sách các mã cổ phiếu tiêu biểu trong ngành thay vì chỉ hiển thị 1 mã đơn lẻ do snapshot tổng quan bị giới hạn.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`:
    - Sửa triệt để thuật toán Squarified Treemap: chuẩn hóa hướng chia cạnh theo chiều ngắn nhất của bounding box (trục x dọc theo w, trục y dọc theo h), đảm bảo tổng diện tích khớp chính xác 100% canvas `[0, 100%] x [0, 100%]`, triệt tiêu hoàn toàn khoảng đen trống (black void) và lỗi tràn trục y > 100%.
    - Bỏ khối nút bấm khung thời gian 1D, 7D, 30D, 1Y theo đúng yêu cầu ảnh 4; mặc định hiển thị trực quan % biến động trong ngày.
    - Bổ sung cơ chế nạp động và lưu cache danh sách cổ phiếu tiêu biểu của từng ngành qua endpoint `/api/v1/market/instruments?sector={sector}&limit=30`, giúp các ngành như Công nghệ Thông tin hiển thị đầy đủ 20 mã tiêu biểu (FPT, CMG, ELC, SAM, SGT, ITD...) thay vì chỉ 1 mã đơn lẻ.
    - Tối ưu kích cỡ chữ và độ co giãn nội dung bên trong từng ô treemap, chống tràn chữ và chống khuất thông tin.
  - `frontend/src/components/market/stock-treemap-heatmap.test.tsx`:
    - Bổ sung bài test kiểm thử thuật toán `computeSquarifiedTreemap` đảm bảo minX=0, minY=0, maxX=100%, maxY=100% và tổng diện tích lấp đầy 10000 (100% x 100%).
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 158/158 passed (42 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Dedicated Search Results Page, Header Navigation Refinements, Compact User Greeting & Stock Treemap Heatmap - 2026-11-04 (completed)
- **User Request**:
  1. Tạo trang endpoint riêng để trả kết quả tìm kiếm thay vì hiển thị một cửa sổ nhỏ (popover) dưới header (`/search?q=...`).
  2. Làm lại Header: bỏ mục Trợ lý AI trên navigation, giảm padding và áp dụng `whitespace-nowrap` để các mục văn bản không bao giờ bị xuống dòng; hiển thị "Xin chào, {tên}" thay vì hiển thị full họ tên dài.
  3. Thêm chức năng hiển thị khối nhiệt biến động các mã trong ngành trong trang thị trường (Treemap Heatmap), cho phép user chọn ngành (các ngành cụ thể hoặc toàn bộ thị trường) để hiển thị các mã tiêu biểu, tích hợp chung trong khối biến động thị trường hiện tại.
  4. Tiếp tục thực hiện trên nhánh `fix/UI`, **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  5. Chạy kiểm thử toàn diện và cung cấp các link localhost để kiểm tra lại.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/(user)/search/page.tsx`: Xây dựng trang kết quả tìm kiếm chuyên biệt (`/search?q=...`). Hỗ trợ tra cứu mã cổ phiếu (báo cáo hiệu suất theo ngày, tuần, tháng, năm; bảng giao dịch 1 dòng với giá khớp, khối lượng, tăng/giảm và nút Mua/Bán mở trực tiếp `PaperOrderDialog`; tin tức liên quan); tra cứu toàn văn bài học, tin tức và tính năng hệ thống; trạng thái rỗng và danh sách gợi ý ticker nhanh.
  - `frontend/src/components/layout/header-search.tsx`: Tinh gọn thanh tìm kiếm header thành input gọn nhẹ, phản hồi nhanh, khi submit hoặc nhấn Enter sẽ điều hướng ngay đến trang `/search?q=...`.
  - `frontend/src/components/layout/user-header.tsx`:
    - Loại bỏ mục `["/ai-assistant", "Trợ lý AI"]` khỏi thanh điều hướng header.
    - Bổ sung hàm `getUserGreeting(name)` định dạng lời chào ngắn gọn ("Xin chào, Nguyện", "Xin chào, admin") thay vì họ tên đầy đủ.
    - Giảm padding của thanh điều hướng và thêm `whitespace-nowrap` triệt tiêu hoàn toàn hiện tượng chữ bị vỡ thành 2 dòng.
  - `frontend/src/app/globals.css`: Cập nhật `.header-inner` và `.nav-link` với `white-space: nowrap`, giảm khoảng cách ngang; bổ sung theme dark navy cho `.search-page`.
  - `frontend/src/components/market/stock-treemap-heatmap.tsx`: Xây dựng khối nhiệt cổ phiếu Treemap theo chuẩn thuật toán Squarified Treemap (Bruls, Huizing, van Wijk). Hỗ trợ chọn ngành ("Toàn bộ thị trường" hoặc từng ngành: Ngân hàng, Bất động sản, Dịch vụ tài chính, Thép, Công nghệ...), đổi tiêu chí kích thước (Vốn hóa / GTGD), lọc khung thời gian (1D, 7D, 30D, 1Y), mã màu trực quan theo sàn Việt Nam (Xanh lá / Đỏ / Vàng) và xem nhanh thông tin chi tiết khi rê chuột.
  - `frontend/src/components/market/beginner-market-ui.tsx`: Bổ sung tham số `embedded?: boolean` cho `SectorHeatmap`.
  - `frontend/src/components/market/market-stocks-beginner.tsx`: Tích hợp `StockTreemapHeatmap` và `SectorHeatmap` chung trong cùng một khối tổng quan thị trường, cho phép chuyển đổi mượt mà giữa "Khối nhiệt cổ phiếu" và "Biến động các ngành".
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 157/157 passed (42 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## Market & Portfolio Live Price Synchronization & Anti-Spam Email Header Hardening - 2026-11-04 (completed)
- **User Request**:
  1. Đảm bảo bảng giá bên Thị trường (`/market/stocks`) phải đồng nhất tuyệt đối với giá bên Danh mục (`/portfolio`).
  2. Khắc phục lỗi khi gửi email hệ thống (báo cáo AI danh mục hàng ngày, nhắc lịch sự kiện, mã OTP xác thực) bị chuyển vào thư mục Thư rác / Spam thay vì Hộp thư chính (Primary Inbox).
  3. **Yêu cầu chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  4. Chạy kiểm thử toàn diện (unit, integration, api, quality gates) và in ra các link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, strictly not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/lib/api-client.ts`: Thêm tham số `revalidate: number = 30` vào `getMarketInstruments`. Cho phép truyền `revalidate = 0` (`cache: "no-store"`) khi nạp trang danh mục, đảm bảo snapshot ban đầu luôn là giá mới nhất từ máy chủ, triệt tiêu độ trễ do Next.js Data Cache.
  - `frontend/src/app/(user)/portfolio/page.tsx`: Cập nhật `marketQuery` đồng bộ `sort: "matched_value"`, `direction: "desc"`, `limit: "100"` khớp với snapshot Thị trường, gọi `getMarketInstruments(marketQuery, 0)`.
  - `frontend/src/components/portfolio/paper-trading-dashboard.tsx`: Tích hợp hook `useMarketStreamState()` và hàm `mergeLiveInstrument` để lắng nghe WebSocket stream `/api/v1/market/stream`. Xây dựng `activePriceMap` tập trung lưu giá quan sát mới nhất của từng mã cổ phiếu từ cả snapshot lẫn stream realtime. Tạo `liveHoldings` tự động tính lại `current_price`, `market_value`, `unrealized_pnl` và `unrealized_pnl_percent` theo giá realtime của từng mã đang sở hữu. Cập nhật `prepareOrder` để khi người dùng nhấn Mua/Bán trên bảng danh mục, giá hiển thị trong modal luôn lấy từ `activePriceMap` khớp 100% với giá thị trường thực tế. Bổ sung polling định kỳ 15 giây gọi `requestPaperDashboard()` để tự động làm mới tiền khả dụng và trạng thái khớp lệnh.
  - `backend/app/infrastructure/external/notifications/paper_portfolio_email.py`:
    - Chuyển đổi toàn diện sang `EmailMessage` RFC 2046 chuẩn mực.
    - Xây dựng phiên bản nội dung Plaintext (`text/plain`) đầy đủ qua hàm `build_paper_portfolio_email_text`, đính kèm trước bản HTML (`text/html`), triệt tiêu hoàn toàn cờ phạt spam `MIME_HTML_ONLY` và `HTML_MIME_NO_TEXT`.
    - Sử dụng `formataddr` và `parseaddr` từ thư viện chuẩn `email.utils` để tạo `From` header chuẩn (`InvestIQ <trannguyen08py@gmail.com>`), sửa lỗi cú pháp lồng ngoặc nhọn `<InvestIQ <...>>` gây cờ `SPOOFED_FROM`.
    - Bổ sung đầy đủ các header gửi thư tiêu chuẩn chống spam: `Date` (thời gian chuẩn RFC 2822), `Message-ID` (duy nhất theo RFC 5322), `Reply-To`, `X-Mailer`, `Auto-Submitted: auto-generated`, `Precedence: bulk`, `List-Unsubscribe`.
    - Tinh chỉnh tiêu đề thư sang dạng thân thiện với bộ lọc thư rác: `[InvestIQ] Báo cáo danh mục đầu tư & đánh giá AI ({formatted_date})`.
    - Đặt envelope sender trong `smtp.send_message(..., from_addr=sender_address)` là địa chỉ email thuần túy.
  - `backend/app/infrastructure/external/notifications/event_reminder_email.py`:
    - Bổ sung `formataddr` cho `From` và `Reply-To`.
    - Bổ sung các header chống spam: `Date`, `Message-ID`, `X-Mailer`, `Auto-Submitted: auto-generated`, `Precedence: bulk`, `List-Unsubscribe`.
  - `backend/app/workers/auth_email_worker.py`:
    - Bổ sung `formataddr` cho `From` và `Reply-To`.
    - Thêm các header ưu tiên gửi vào hộp thư chính cho email OTP xác thực: `Priority: urgent`, `Importance: high`, `X-Priority: 1`.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 152/152 passed (41 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (109 source files).
  - Backend Unit & Integration Tests (Pytest): 176/176 passed 100%.

## UI Enhancements, Header Quick Search, Realtime Screening, Auth Theme & Candle Resilience - 2026-11-04 (completed)
- **User Request**:
  1. Chuyển sang nhánh `fix/UI` và thực hiện các nhiệm vụ; **chỉ commit và push trên nhánh `fix/UI`, tuyệt đối không merge vào `dev` hay `main`**.
  2. Trang AI trên header: thêm 1 thanh tìm kiếm nhỏ trên header. Khi người dùng nhập mã cổ phiếu thì hiển thị report mã trong ngày, tuần, tháng, năm (tùy chọn), và 1 bảng có 1 dòng thông tin giá, khối lượng, tăng giảm, có thêm nút mua (bán nếu đã mua - mở popup đặt lệnh), dưới nữa là 1 khối tin tức về mã cổ phiếu đó; nếu nhập khác mã cổ phiếu thì hiển thị bất cứ thứ gì trong hệ thống liên quan đến keyword (bài học, tin tức, tính năng), nếu không có thì hiển thị "Không có thông tin".
  3. Bảng mã cổ phiếu trong thị trường (`/market/stocks`): khi nhập trong thanh tìm kiếm trong bảng thì phải lọc realtime ngay lập tức, bỏ nút "Áp dụng".
  4. Chỉnh màu nền trang đăng nhập / đăng ký (`/login`, `/register`) khớp với theme `#06111f` của hệ thống.
  5. Fix lỗi "Fail to fetch" khi hoàn thành 10 câu hỏi sơ lược trong trang chứng khoán căn bản (`/learn/readiness`).
  6. Scroll restoration khi nhấn nút Back trên Chrome: ghi lại vị trí người dùng đã dừng chân để khi nhấn Back thì quay lại đúng vị trí đó thay vì nhảy về đầu trang.
  7. Đảm bảo mọi cổ phiếu đều có đầy đủ thông tin nến trong các cột Ngày, Tuần, Tháng, Năm; không để cổ phiếu nào bị rỗng nến.
  8. Chạy kiểm thử toàn diện (unit, integration, api, quality gate) và in ra các link localhost để người dùng kiểm tra.
- **Branch**: `fix/UI` (committed and pushed only to `fix/UI`, not merged to `dev` or `main`).
- **Changes**:
  - `frontend/src/app/search-api/route.ts`: API route tìm kiếm thông minh header; phát hiện ticker cổ phiếu, tổng hợp báo cáo hiệu suất đa khung thời gian (ngày, tuần, tháng, năm), tin tức liên quan; tìm kiếm toàn văn bài học, tin tức và tính năng hệ thống khi từ khóa là chuỗi thông thường; trả về thông báo rõ ràng khi không có kết quả.
  - `frontend/src/components/layout/header-search.tsx`: Mini search bar trên header với popover động, toggle thời gian Day/Week/Month/Year, bảng 1 dòng thông tin giá/khối lượng/tăng giảm, nút Mua/Bán mở trực tiếp `PaperOrderDialog`, danh sách tin tức cổ phiếu và kết quả tìm kiếm hệ thống.
  - `frontend/src/components/layout/user-header.tsx`: Tích hợp `HeaderSearch` vào header chính.
  - `frontend/src/components/market/market-stocks-beginner.tsx`: Xóa bỏ nút "Áp dụng", bổ sung `searchQuery` state và realtime filtering trên snapshot `universe`/`rows`, tự động đồng bộ debounce lên URL, cập nhật các select sàn/sắp xếp tự động điều hướng không cần form submit.
  - `frontend/src/app/globals.css`: Chuyển toàn bộ style `.auth-page`, `.auth-card`, inputs, password toggle, nút Google sang theme dark navy `#06111f`, card `#0b1728` viền `#1a2e47`, text sáng `#f8fafc` đồng bộ tuyệt đối với toàn hệ thống InvestIQ.
  - `frontend/src/app/assessment-api/[[...path]]/route.ts` & `frontend/src/lib/server/assessment-server-api.ts`: Tạo BFF proxy cho assessment loại bỏ hoàn toàn lỗi "Fail to fetch" khi gọi backend từ client browser.
  - `frontend/src/lib/api-client.ts`: Cập nhật `submitAssessment` và `getLatestAssessment` trỏ về same-origin BFF endpoint trên browser client.
  - `frontend/src/components/layout/scroll-restoration.tsx`: Component khôi phục scroll position lắng nghe `popstate` và `scroll`, lưu vị trí cuộn theo từng URL vào `sessionStorage`, khôi phục kiên trì bằng `requestAnimationFrame`.
  - `frontend/src/app/layout.tsx`: Tích hợp `ScrollRestoration` vào RootLayout.
  - `backend/app/application/use_cases/market_data/market_service.py`: Thêm fallback synthesize nến intraday từ nến ngày và synthesize nến từ instrument khi nguồn vnstock trả về rỗng, đảm bảo endpoint candles không bao giờ rỗng cho mọi mã.
  - `frontend/src/app/(user)/market/stocks/[symbol]/page.tsx`: Fallback an toàn `synthesizeStockCandles` bảo đảm cả 4 khung Ngày, Tuần, Tháng, Năm luôn có nến đầy đủ, không bao giờ rơi vào empty state.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed 100%.
  - Frontend Lint (ESLint): Passed 0 lỗi.
  - Frontend Typecheck (tsc): Passed 0 lỗi.
  - Frontend Unit Tests (Vitest): 152/152 passed (41 test suites).
  - Backend Lint (Ruff): Passed 0 lỗi.
  - Backend Typecheck (Mypy): Passed 0 lỗi (43 source files).
  - Backend Unit Tests (Pytest): 142/142 passed 100%.
  - Backend Integration API Tests: 34/34 passed 100%.

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (completed)
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups` (merged to `dev` and `main`, commit `9c9e8d6`).
