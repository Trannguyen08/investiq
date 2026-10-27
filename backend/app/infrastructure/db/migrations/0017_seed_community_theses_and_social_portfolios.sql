-- Migration 0017: Seed Realistic Community Theses & Social Portfolios

-- 1. Insert seed analyst users
INSERT INTO users (id, email, display_name, role, status, email_verified_at)
VALUES
    ('a1111111-1111-4111-a111-111111111111', 'analyst.minhquan@investiq.vn', 'Trần Minh Quân', 'user', 'active', now()),
    ('a2222222-2222-4222-a222-222222222222', 'analyst.hoangyen@investiq.vn', 'Lê Hoàng Yến', 'user', 'active', now()),
    ('a3333333-3333-4333-a333-333333333333', 'analyst.ducthanh@investiq.vn', 'Vũ Đức Thành', 'user', 'active', now())
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name;

-- 2. Insert market instruments
INSERT INTO market_instruments (id, symbol, exchange, name, sector)
VALUES
    ('b1111111-1111-4111-b111-111111111111', 'HPG', 'HOSE', 'CTCP Tập đoàn Hòa Phát', 'Thép & Kim loại'),
    ('b2222222-2222-4222-b222-222222222222', 'FPT', 'HOSE', 'CTCP FPT', 'Công nghệ thông tin'),
    ('b3333333-3333-4333-b333-333333333333', 'MWG', 'HOSE', 'CTCP Đầu tư Thế Giới Di Động', 'Bán lẻ tiêu dùng'),
    ('b4444444-4444-4444-b444-444444444444', 'TCB', 'HOSE', 'Ngân hàng TMCP Kỹ Thương Việt Nam', 'Ngân hàng'),
    ('b5555555-5555-4555-b555-555555555555', 'VNM', 'HOSE', 'CTCP Sữa Việt Nam', 'Thực phẩm & Đồ uống'),
    ('b6666666-6666-4666-b666-666666666666', 'SSI', 'HOSE', 'CTCP Chứng khoán SSI', 'Dịch vụ tài chính')
ON CONFLICT (exchange, symbol) DO NOTHING;

-- 3. Insert public paper portfolios
INSERT INTO paper_portfolios (id, user_id, starting_cash, cash_balance, realized_pnl, is_public, nickname)
VALUES
    ('c1111111-1111-4111-c111-111111111111', 'a1111111-1111-4111-a111-111111111111', 1000000000, 320000000, 145000000, true, 'Dragon Capitalist'),
    ('c2222222-2222-4222-c222-222222222222', 'a2222222-2222-4222-a222-222222222222', 1000000000, 480000000, 98000000, true, 'Alpha Vietnam'),
    ('c3333333-3333-4333-c333-333333333333', 'a3333333-3333-4333-a333-333333333333', 1000000000, 560000000, 62000000, true, 'Buffett Saigon')
ON CONFLICT (user_id) DO UPDATE
SET is_public = true, nickname = EXCLUDED.nickname, realized_pnl = EXCLUDED.realized_pnl;

-- 4. Insert public holdings
INSERT INTO paper_holdings (portfolio_id, instrument_id, quantity, total_cost_basis)
SELECT 'c1111111-1111-4111-c111-111111111111', id, 15000, 420000000 FROM market_instruments WHERE symbol = 'HPG' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, instrument_id) DO NOTHING;

INSERT INTO paper_holdings (portfolio_id, instrument_id, quantity, total_cost_basis)
SELECT 'c1111111-1111-4111-c111-111111111111', id, 5000, 275000000 FROM market_instruments WHERE symbol = 'FPT' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, instrument_id) DO NOTHING;

INSERT INTO paper_holdings (portfolio_id, instrument_id, quantity, total_cost_basis)
SELECT 'c2222222-2222-4222-c222-222222222222', id, 6000, 450000000 FROM market_instruments WHERE symbol = 'MWG' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, instrument_id) DO NOTHING;

INSERT INTO paper_holdings (portfolio_id, instrument_id, quantity, total_cost_basis)
SELECT 'c3333333-3333-4333-c333-333333333333', id, 12000, 400000000 FROM market_instruments WHERE symbol = 'TCB' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, instrument_id) DO NOTHING;

-- 5. Insert public paper trades (History)
INSERT INTO paper_trades (
    portfolio_id, instrument_id, idempotency_key, side, symbol, instrument_name, exchange,
    quantity, execution_price, gross_amount, fee_rate, fee_amount, tax_rate, tax_amount, cash_effect, realized_pnl,
    provider, price_at, received_at, delay_class, created_at
)
SELECT 
    'c1111111-1111-4111-c111-111111111111', id, 'seed:trade:hpg:1', 'buy', 'HPG', 'CTCP Tập đoàn Hòa Phát', 'HOSE',
    15000, 28000.00000000, 420000000, 0.0015, 630000, 0, 0, -420630000, NULL,
    'seed', now() - interval '5 days', now() - interval '5 days', 'source_delayed', now() - interval '5 days'
FROM market_instruments WHERE symbol = 'HPG' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, idempotency_key) DO NOTHING;

INSERT INTO paper_trades (
    portfolio_id, instrument_id, idempotency_key, side, symbol, instrument_name, exchange,
    quantity, execution_price, gross_amount, fee_rate, fee_amount, tax_rate, tax_amount, cash_effect, realized_pnl,
    provider, price_at, received_at, delay_class, created_at
)
SELECT 
    'c1111111-1111-4111-c111-111111111111', id, 'seed:trade:fpt:1', 'buy', 'FPT', 'CTCP FPT', 'HOSE',
    5000, 55000.00000000, 275000000, 0.0015, 412500, 0, 0, -275412500, NULL,
    'seed', now() - interval '3 days', now() - interval '3 days', 'source_delayed', now() - interval '3 days'
FROM market_instruments WHERE symbol = 'FPT' AND exchange = 'HOSE'
ON CONFLICT (portfolio_id, idempotency_key) DO NOTHING;

-- 6. Insert rich investment theses
INSERT INTO investment_theses (
    id, user_id, author_name, symbol, stance, entry_price, target_price, stop_loss_price,
    horizon_months, title, thesis_body, catalysts, status, outcome_roi, closed_at, closed_price, upvotes, created_at
) VALUES
(
    'd1111111-1111-4111-d111-111111111111',
    'a1111111-1111-4111-a111-111111111111',
    'Trần Minh Quân',
    'HPG',
    'bullish',
    28000.0000,
    35000.0000,
    25000.0000,
    6,
    'HPG - Động lực từ Dung Quất 2 và chu kỳ thép xây dựng phục hồi mạnh mẽ',
    'Dự án Dung Quất 2 dự kiến đóng góp thêm 5.6 triệu tấn thép cuộn cán nóng HRC mỗi năm, đưa tổng sản lượng lên hơn 14 triệu tấn. Với mức P/E dự phóng 2026 chỉ khoảng 9.2x và nhu cầu phục hồi từ bất động sản dân dụng, HPG có dư địa tăng trưởng vượt trội trong 6 tháng tới.',
    ARRAY['Lò cao số 2 vận hành thương mại', 'Biên lợi nhuận gộp cải thiện 3.2%', 'Nhu cầu đầu tư công đẩy mạnh'],
    'active',
    NULL,
    NULL,
    NULL,
    28,
    now() - interval '2 days'
),
(
    'd2222222-2222-4222-d222-222222222222',
    'a2222222-2222-4222-a222-222222222222',
    'Lê Hoàng Yến',
    'FPT',
    'bullish',
    52000.0000,
    64000.0000,
    48000.0000,
    3,
    'FPT - Dẫn dắt chuyển đổi số toàn cầu và mở rộng trung tâm AI',
    'FPT duy trì tốc độ tăng trưởng doanh thu xuất khẩu phần mềm trên 25% năm nhờ sự bùng nổ nhu cầu điện toán đám mây và trí tuệ nhân tạo. Lợi nhuận sau thuế duy trì tăng trưởng đều đặn hai chữ số trong 5 năm liên tiếp, định giá hấp dẫn trong nhóm vốn hóa lớn.',
    ARRAY['Tăng trưởng ký mới khối ngoại 25%', 'Nhà máy AI Factory tại Nhật & VN', 'Biên lãi mảng giáo dục cao'],
    'hit_target',
    23.08,
    now() - interval '1 day',
    64000.0000,
    22,
    now() - interval '14 days'
),
(
    'd3333333-3333-4333-d333-333333333333',
    'a3333333-3333-4333-a333-333333333333',
    'Vũ Đức Thành',
    'MWG',
    'bullish',
    72000.0000,
    88000.0000,
    66000.0000,
    3,
    'MWG - Bách Hóa Xanh chạm điểm hòa vốn và tiến tới có lãi ròng',
    'Chuỗi Bách Hóa Xanh đã vượt qua giai đoạn tái cấu trúc và bắt đầu đóng góp dòng tiền dương. Mảng Điện Máy Xanh và Thế Giới Di Động giữ vững biên lợi nhuận hoạt động trong bối cảnh sức mua nội địa dần hồi phục.',
    ARRAY['Doanh thu mỗi cửa hàng BHX đạt 1.9 tỷ', 'Kế hoạch IPO chuỗi Bách Hóa Xanh', 'Thị phần điện máy ổn định'],
    'active',
    NULL,
    NULL,
    NULL,
    18,
    now() - interval '3 days'
),
(
    'd4444444-4444-4444-d444-444444444444',
    'a1111111-1111-4111-a111-111111111111',
    'Trần Minh Quân',
    'TCB',
    'bullish',
    31500.0000,
    38000.0000,
    28500.0000,
    6,
    'TCB - Lợi thế chi phí vốn thấp nhờ tỷ lệ CASA dẫn đầu hệ sinh thái',
    'Techcombank tiếp tục sở hữu chi phí vốn tốt nhất thị trường nhờ tỷ lệ CASA vượt 40%. Hệ số an toàn vốn CAR đạt trên 15%, tạo nền tảng vững chắc cho đà tăng trưởng tín dụng mạnh mẽ trong chu kỳ nới lỏng tiền tệ.',
    ARRAY['Tỷ lệ CASA vượt 40%', 'Tín dụng bất động sản cao cấp khơi thông', 'Chi phí dự phòng rủi ro giảm'],
    'active',
    NULL,
    NULL,
    NULL,
    15,
    now() - interval '4 days'
),
(
    'd5555555-5555-4555-d555-555555555555',
    'a2222222-2222-4222-a222-222222222222',
    'Lê Hoàng Yến',
    'VNM',
    'bullish',
    68000.0000,
    76000.0000,
    63000.0000,
    12,
    'VNM - Dòng tiền cổ tức tiền mặt đều đặn và mở rộng thị trường xuất khẩu',
    'Vinamilk là cổ phiếu phòng thủ lý tưởng với dòng tiền mặt dồi dào và chính sách cổ tức tiền mặt hấp dẫn. Việc tối ưu hóa chi phí đầu vào và mở rộng các thị trường Trung Đông giúp biên lợi nhuận gộp duy trì trên 41%.',
    ARRAY['Tỷ suất cổ tức tiền mặt 6.5%', 'Giá sữa nguyên liệu thế giới hạ nhiệt', 'Tái định vị thương hiệu thành công'],
    'active',
    NULL,
    NULL,
    NULL,
    9,
    now() - interval '6 days'
),
(
    'd6666666-6666-4666-d666-666666666666',
    'a3333333-3333-4333-a333-333333333333',
    'Vũ Đức Thành',
    'SSI',
    'bullish',
    32000.0000,
    39000.0000,
    29000.0000,
    3,
    'SSI - Hưởng lợi trực tiếp từ thanh khoản thị trường và triển vọng nâng hạng',
    'Công ty cổ phần Chứng khoán SSI sở hữu năng lực vốn lớn và thị phần môi giới hàng đầu. Kỳ vọng nâng hạng thị trường từ cận biên lên mới nổi sẽ thu hút dòng vốn ngoại quy mô lớn, tạo cú hích lớn cho mảng môi giới và cho vay ký quỹ.',
    ARRAY['Thanh khoản thị trường hồi phục', 'Hệ thống giao dịch mới vận hành', 'Thị phần môi giới top đầu'],
    'active',
    NULL,
    NULL,
    NULL,
    12,
    now() - interval '1 day'
)
ON CONFLICT (id) DO NOTHING;
