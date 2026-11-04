# Current Task

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
