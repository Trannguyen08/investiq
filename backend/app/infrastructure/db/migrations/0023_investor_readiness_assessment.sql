-- 0023_investor_readiness_assessment.sql
-- Migration for Investor Persona, Risk Profile Assessment, Trading Discipline, and Readiness Evaluation

CREATE TABLE IF NOT EXISTS investor_personas (
    code VARCHAR(50) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_strategy TEXT NOT NULL,
    asset_allocation JSONB NOT NULL,
    ideal_time_hours_per_week INT NOT NULL DEFAULT 3,
    suitable_instruments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order INT NOT NULL DEFAULT 1,
    category VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    subtext TEXT,
    options JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_readiness_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    guest_identifier VARCHAR(100),
    persona_code VARCHAR(50) REFERENCES investor_personas(code),
    risk_score NUMERIC(5, 2) NOT NULL,
    knowledge_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    discipline_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    readiness_score NUMERIC(5, 2) NOT NULL,
    readiness_level VARCHAR(50) NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_order ON assessment_questions(sort_order);
CREATE INDEX IF NOT EXISTS idx_user_readiness_user_id ON user_readiness_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_readiness_created_at ON user_readiness_assessments(created_at DESC);

-- Seed 4 Investor Personas
INSERT INTO investor_personas (
    code, title, tagline, description, strengths, weaknesses,
    recommended_strategy, asset_allocation, ideal_time_hours_per_week, suitable_instruments
) VALUES
(
    'dca_accumulator',
    'Nhà đầu tư Tích sản Dài hạn (DCA)',
    'Tích lũy tài sản bền vững theo năm tháng qua cổ tức và tăng trưởng',
    'Bạn ưu tiên sự an toàn, bảo toàn vốn và tăng trưởng ổn định dài hạn. Bạn không có nhiều thời gian canh bảng điện tử trong giờ giao dịch và không muốn để biến động ngắn hạn làm ảnh hưởng đến công việc chính hoặc cuộc sống gia đình.',
    '["Kiên nhẫn cao, không bị cuốn vào tâm lý FOMO/FUD", "Tận dụng được sức mạnh lãi kép qua nhiều năm", "Tâm lý thoải mái, không áp lực canh bảng điện từng phút"]'::jsonb,
    '["Lợi nhuận ngắn hạn không bùng nổ", "Cần kỷ luật thép để duy trì tích sản ngay cả khi thị trường giảm sâu"]'::jsonb,
    'Chiến lược bình quân giá (DCA) định kỳ hàng tháng vào các cổ phiếu đầu ngành VN30 hoặc chứng chỉ quỹ ETF VN30/VNFinLead, kết hợp tái đầu tư toàn bộ cổ tức tiền mặt.',
    '{"stocks": 50, "gold": 25, "savings": 25}'::jsonb,
    2,
    '["Cổ phiếu đầu ngành VN30 (FPT, HPG, VCB...)", "Chứng chỉ quỹ ETF E1VFVN30 / FUEVFVND", "Cổ phiếu chia cổ tức tiền mặt cao và đều đặn"]'::jsonb
),
(
    'value_growth',
    'Nhà đầu tư Giá trị & Tăng trưởng (FA)',
    'Đồng hành cùng doanh nghiệp xuất sắc với định giá hợp lý',
    'Bạn thích đào sâu tìm hiểu mô hình kinh doanh, đọc báo cáo tài chính và tìm kiếm các doanh nghiệp có lợi thế cạnh tranh bền vững (Economic Moat). Bạn nhìn nhận các nhịp thị trường sụt giảm mạnh là cơ hội vàng để mua gom cổ phiếu tốt với giá rẻ.',
    '["Khả năng đánh giá nội tại doanh nghiệp độc lập", "Không bị thao túng bởi tin đồn hay bảng điện xanh đỏ", "Tỷ suất sinh lời vượt trội khi chọn đúng cổ phiếu tăng trưởng"]'::jsonb,
    '["Đòi hỏi nhiều thời gian đọc và phân tích BCTC", "Phải kiên nhẫn chờ thị trường phản ánh đúng giá trị thực (thường mất 6 tháng - 2 năm)"]'::jsonb,
    'Xây dựng danh mục tập trung 4 - 6 mã cổ phiếu tăng trưởng có P/E, P/B hấp dẫn, ROE > 15%, nợ vay thấp và dòng tiền kinh doanh dương. Mua tích lũy tại các vùng định giá chiết khấu.',
    '{"stocks": 65, "gold": 15, "savings": 20}'::jsonb,
    6,
    '["Cổ phiếu tăng trưởng đầu ngành có ROE cao", "Cổ phiếu định giá thấp dưới giá trị sổ sách P/B < 1", "Doanh nghiệp có câu chuyện mở rộng công suất nhà máy"]'::jsonb
),
(
    'active_swing',
    'Nhà giao dịch Chủ động & Lướt sóng (Swing Trader)',
    'Tận dụng sóng dòng tiền và động lượng kỹ thuật theo xu hướng',
    'Bạn năng động, nhạy bén với tin tức thị trường và dòng tiền lớn. Bạn có khả năng theo dõi bảng điện thường xuyên, am hiểu đồ thị nến, chỉ báo kỹ thuật (MA, RSI, Volume) và sẵn sàng cắt lỗ dứt khoát khi xu hướng đảo chiều.',
    '["Tận dụng được các con sóng ngắn và trung hạn của thị trường", "Bảo toàn vốn nhanh chóng khi thị trường bước vào Downtrend", "Linh hoạt xoay chuyển dòng tiền giữa các nhóm ngành"]'::jsonb,
    '["Áp lực tâm lý và căng thẳng cao khi thị trường biến động giật cục", "Tốn nhiều phí và thuế giao dịch nếu mua bán quá nhiều", "Dễ dính bẫy tâm lý nếu thiếu kỷ luật cắt lỗ -7%"]'::jsonb,
    'Giao dịch theo xu hướng (Trend Following), mua tại các điểm bứt phá nền giá (Breakout) với khối lượng lớn, chốt lời từng phần theo mục tiêu 15-20% và tuyệt đối tuân thủ quy tắc cắt lỗ 7-8%.',
    '{"stocks": 70, "gold": 10, "savings": 20}'::jsonb,
    12,
    '["Cổ phiếu Midcap có thanh khoản cao và dòng tiền mạnh", "Cổ phiếu nhóm ngành đang hưởng lợi vĩ mô (Chứng khoán, Thép, Bất động sản...)", "Giao dịch theo mẫu hình kỹ thuật và đường MA"]'::jsonb
),
(
    'conservative_fund',
    'Người Thận trọng / Phù hợp Quỹ Mở & Tiết kiệm',
    'Bảo vệ an toàn vốn là ưu tiên hàng đầu, hạn chế tối đa rủi ro',
    'Bạn có khẩu vị rủi ro thấp, rất dễ bị căng thẳng mất ngủ khi nhìn thấy tài khoản giảm điểm. Bạn chưa có đủ thời gian hoặc kiến thức để tự phân tích và chọn lựa cổ phiếu đơn lẻ trên sàn.',
    '["Bảo vệ an toàn tuyệt đối cho số vốn tích lũy", "Tránh được rủi ro thua lỗ nặng do thiếu kinh nghiệm hoặc mua phải cổ phiếu rác", "Cuộc sống bình yên, không bị chi phối bởi thị trường"]'::jsonb,
    '["Lợi nhuận khó vượt qua tốc độ lạm phát nếu chỉ gửi ngân hàng đơn thuần", "Chưa tối ưu hóa được tiềm năng tăng trưởng của thị trường"]'::jsonb,
    'Chưa nên tự mua bán cổ phiếu đơn lẻ bằng tiền thật. Thay vào đó, hãy phân bổ phần lớn vào Tiền gửi tiết kiệm và Vàng tích lũy, đồng thời ủy thác một phần nhỏ (15-20%) vào các Quỹ mở cổ phiếu hoặc Quỹ ETF được quản lý bởi các chuyên gia tài chính.',
    '{"stocks": 20, "gold": 30, "savings": 50}'::jsonb,
    1,
    '["Tiền gửi ngân hàng có kỳ hạn", "Vàng vật chất tích sản SJC / PNJ", "Chứng chỉ quỹ mở / ETF uy tín (Dragon Capital, VinaCapital, SSIAM)"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- Seed 10 Assessment Questions
INSERT INTO assessment_questions (sort_order, category, prompt, subtext, options, status)
VALUES
(
    1,
    'financial_situation',
    'Mục tiêu tài chính quan trọng nhất của bạn khi tìm hiểu thị trường chứng khoán là gì?',
    'Mục tiêu rõ ràng sẽ quyết định phong cách và tâm lý đầu tư của bạn.',
    '[
        {"id": "q1_opt1", "label": "Tích lũy tài sản đều đặn hàng tháng cho tương lai dài hạn (5 - 10 năm tới)", "risk_weight": 40, "persona_weights": {"dca_accumulator": 8, "value_growth": 4, "active_swing": 1, "conservative_fund": 5}},
        {"id": "q1_opt2", "label": "Tìm kiếm các doanh nghiệp tốt để nhân đôi, nhân ba tài sản trong chu kỳ 2 - 4 năm", "risk_weight": 65, "persona_weights": {"dca_accumulator": 3, "value_growth": 8, "active_swing": 4, "conservative_fund": 1}},
        {"id": "q1_opt3", "label": "Kiếm thêm thu nhập chủ động hàng tuần/hàng tháng từ các con sóng ngắn hạn", "risk_weight": 85, "persona_weights": {"dca_accumulator": 1, "value_growth": 2, "active_swing": 9, "conservative_fund": 0}},
        {"id": "q1_opt4", "label": "Tìm kênh cất giữ tiền an toàn hơn lạm phát nhưng không muốn bị mất tiền", "risk_weight": 20, "persona_weights": {"dca_accumulator": 4, "value_growth": 1, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
),
(
    2,
    'risk_tolerance',
    'Nếu khoản đầu tư 100 triệu của bạn bị giảm xuống còn 85 triệu (-15%) sau 2 tuần, bạn sẽ cảm thấy và hành động như thế nào?',
    'Phản ứng tâm lý thực tế khi tài khoản sụt giảm mạnh là thước đo chính xác nhất về khẩu vị rủi ro.',
    '[
        {"id": "q2_opt1", "label": "Bình tĩnh rà soát lại lý do mua; nếu doanh nghiệp vẫn tốt, coi đây là cơ hội để mua thêm với giá rẻ", "risk_weight": 60, "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 2, "conservative_fund": 1}},
        {"id": "q2_opt2", "label": "Kỷ luật cắt lỗ ngay lập tức vì giá đã vi phạm ngưỡng cho phép (-7% đến -8%), đứng ngoài chờ cơ hội mới", "risk_weight": 80, "persona_weights": {"dca_accumulator": 2, "value_growth": 3, "active_swing": 9, "conservative_fund": 2}},
        {"id": "q2_opt3", "label": "Rất lo lắng, mất ngủ, liên tục mở ứng dụng xem giá nhưng không dám cắt vì sợ bán đúng đáy", "risk_weight": 35, "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 1, "conservative_fund": 7}},
        {"id": "q2_opt4", "label": "Hoảng loạn, bán tháo sạch toàn bộ danh mục ngay lập tức và quyết định không bao giờ chơi chứng khoán nữa", "risk_weight": 15, "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
),
(
    3,
    'time_commitment',
    'Bạn có thể dành ra trung bình bao nhiêu thời gian mỗi tuần cho việc nghiên cứu và theo dõi thị trường?',
    'Thời gian khả dụng quyết định bạn có thể theo dõi biến động từng phút hay chỉ xem xét định kỳ.',
    '[
        {"id": "q3_opt1", "label": "Dưới 2 giờ mỗi tuần (chỉ xem lại tài sản vào cuối tuần hoặc khi có kỳ trả lương)", "risk_weight": 30, "persona_weights": {"dca_accumulator": 9, "value_growth": 2, "active_swing": 0, "conservative_fund": 8}},
        {"id": "q3_opt2", "label": "Khoảng 3 - 6 giờ mỗi tuần (đọc báo cáo phân tích, tin tức buổi tối sau giờ làm việc)", "risk_weight": 55, "persona_weights": {"dca_accumulator": 5, "value_growth": 8, "active_swing": 3, "conservative_fund": 3}},
        {"id": "q3_opt3", "label": "Trên 10 giờ mỗi tuần (có thể theo dõi bảng điện thường xuyên trong giờ giao dịch 9h-15h)", "risk_weight": 85, "persona_weights": {"dca_accumulator": 1, "value_growth": 4, "active_swing": 9, "conservative_fund": 0}},
        {"id": "q3_opt4", "label": "Hầu như không có thời gian rảnh, công việc chính rất bận rộn và căng thẳng", "risk_weight": 20, "persona_weights": {"dca_accumulator": 6, "value_growth": 0, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
),
(
    4,
    'financial_situation',
    'Khoản tiền bạn dự kiến phân bổ vào chứng khoán có nguồn gốc và thời hạn sử dụng như thế nào?',
    'Thời hạn của dòng tiền quyết định khả năng gồng qua những chu kỳ điều chỉnh của thị trường.',
    '[
        {"id": "q4_opt1", "label": "Tiền nhàn rỗi dài hạn từ 3 đến 5 năm trở lên, hoàn toàn không cần dùng đến trong ngắn hạn", "risk_weight": 70, "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 4}},
        {"id": "q4_opt2", "label": "Tiền nhàn rỗi trong khoảng 6 tháng đến 1 năm", "risk_weight": 50, "persona_weights": {"dca_accumulator": 4, "value_growth": 5, "active_swing": 6, "conservative_fund": 4}},
        {"id": "q4_opt3", "label": "Tiền cần chi trả cho các nghĩa vụ trong 1 - 3 tháng tới (tiền học, tiền thuê nhà, tiền hàng)", "risk_weight": 10, "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 1, "conservative_fund": 9}},
        {"id": "q4_opt4", "label": "Tiền vay mượn từ người quen hoặc dự định dùng đòn bẩy Margin cao để làm giàu nhanh", "risk_weight": 95, "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 5, "conservative_fund": 0}}
    ]'::jsonb,
    'published'
),
(
    5,
    'investment_knowledge',
    'Mức độ hiểu biết hiện tại của bạn về việc đọc Báo cáo tài chính (Doanh thu, LNST, Nợ, P/E, ROE) như thế nào?',
    'Đánh giá nền tảng kỹ năng phân tích cơ bản của bản thân.',
    '[
        {"id": "q5_opt1", "label": "Chưa biết gì, nhìn vào các bảng số liệu tài chính thấy rất khó hiểu và nhức đầu", "risk_weight": 25, "persona_weights": {"dca_accumulator": 6, "value_growth": 1, "active_swing": 3, "conservative_fund": 8}},
        {"id": "q5_opt2", "label": "Đã hiểu các chỉ số cơ bản như P/E, P/B, Biên lợi nhuận nhưng chưa phân tích sâu được BCTC", "risk_weight": 50, "persona_weights": {"dca_accumulator": 6, "value_growth": 6, "active_swing": 4, "conservative_fund": 3}},
        {"id": "q5_opt3", "label": "Có thể đọc hiểu Bảng cân đối kế toán, Báo cáo KQKD và phát hiện các rủi ro nợ vay, dòng tiền", "risk_weight": 75, "persona_weights": {"dca_accumulator": 4, "value_growth": 9, "active_swing": 4, "conservative_fund": 1}},
        {"id": "q5_opt4", "label": "Không quan tâm đến BCTC, chỉ tin vào hành động giá, chỉ báo kỹ thuật và khối lượng giao dịch", "risk_weight": 80, "persona_weights": {"dca_accumulator": 1, "value_growth": 1, "active_swing": 9, "conservative_fund": 1}}
    ]'::jsonb,
    'published'
),
(
    6,
    'market_psychology',
    'Khi bạn bè hoặc hội nhóm trên mạng xã hội mách một "mã cổ phiếu sắp tăng trần liên tiếp", phản ứng thông thường của bạn là gì?',
    'Đo lường mức độ kháng lại tâm lý FOMO (sợ bỏ lỡ cơ hội).',
    '[
        {"id": "q6_opt1", "label": "Lập tức mở tài khoản mua ngay kẻo lỡ tàu, sợ mọi người kiếm được tiền mà mình đứng ngoài", "risk_weight": 85, "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 6, "conservative_fund": 1}},
        {"id": "q6_opt2", "label": "Tò mò tìm hiểu, mở biểu đồ kỹ thuật xem xu hướng dòng tiền và điểm vào hợp lý trước khi quyết định", "risk_weight": 70, "persona_weights": {"dca_accumulator": 2, "value_growth": 4, "active_swing": 8, "conservative_fund": 1}},
        {"id": "q6_opt3", "label": "Bỏ ngoài tai hoặc chỉ đọc cho vui, chỉ đầu tư vào những doanh nghiệp mình đã tự nghiên cứu kỹ", "risk_weight": 50, "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 2, "conservative_fund": 4}},
        {"id": "q6_opt4", "label": "Cảm thấy đây là cờ bạc lừa đảo và sợ hãi không dám tham gia bất cứ thứ gì", "risk_weight": 20, "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
),
(
    7,
    'risk_tolerance',
    'Quan điểm của bạn về nguyên tắc cắt lỗ khi một cổ phiếu mua vào bị âm -7% là gì?',
    'Kỷ luật cắt lỗ là yếu tố sống còn phân định giữa nhà đầu tư chuyên nghiệp và người cờ bạc.',
    '[
        {"id": "q7_opt1", "label": "Cắt dứt khoát 100% không do dự để bảo toàn vốn, sai thì làm lại ở cơ hội khác", "risk_weight": 85, "persona_weights": {"dca_accumulator": 2, "value_growth": 3, "active_swing": 9, "conservative_fund": 2}},
        {"id": "q7_opt2", "label": "Nếu là cổ phiếu đầu cơ ngắn hạn thì cắt ngay; nếu là cổ phiếu đầu ngành tích sản dài hạn thì giữ hoặc mua thêm", "risk_weight": 60, "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 2}},
        {"id": "q7_opt3", "label": "Không bao giờ cắt lỗ vì tin rằng cổ phiếu chưa bán là chưa lỗ, cứ ôm chờ vài năm sẽ về bờ", "risk_weight": 30, "persona_weights": {"dca_accumulator": 2, "value_growth": 2, "active_swing": 1, "conservative_fund": 5}},
        {"id": "q7_opt4", "label": "Rất sợ hãi khi phải nhấn nút bán lỗ, cảm giác như mình là kẻ thất bại", "risk_weight": 20, "persona_weights": {"dca_accumulator": 1, "value_growth": 0, "active_swing": 0, "conservative_fund": 8}}
    ]'::jsonb,
    'published'
),
(
    8,
    'investment_knowledge',
    'Kinh nghiệm quản lý tài chính và đầu tư thực tế trước đây của bạn như thế nào?',
    'Kinh nghiệm thực tiễn giúp xác định mức độ sẵn sàng khi bước vào thị trường thật.',
    '[
        {"id": "q8_opt1", "label": "Chưa từng đầu tư bất kỳ kênh nào, trước giờ chỉ gửi tiết kiệm ngân hàng", "risk_weight": 25, "persona_weights": {"dca_accumulator": 6, "value_growth": 2, "active_swing": 0, "conservative_fund": 9}},
        {"id": "q8_opt2", "label": "Đã từng mua vàng, gửi tiết kiệm online hoặc mua chứng chỉ quỹ mở", "risk_weight": 45, "persona_weights": {"dca_accumulator": 7, "value_growth": 5, "active_swing": 2, "conservative_fund": 6}},
        {"id": "q8_opt3", "label": "Đã tự giao dịch chứng khoán hoặc tiền số từ 6 tháng đến 1 năm trở lên", "risk_weight": 75, "persona_weights": {"dca_accumulator": 4, "value_growth": 6, "active_swing": 8, "conservative_fund": 1}},
        {"id": "q8_opt4", "label": "Có kinh nghiệm đầu tư bất động sản hoặc kinh doanh buôn bán bên ngoài", "risk_weight": 65, "persona_weights": {"dca_accumulator": 5, "value_growth": 8, "active_swing": 4, "conservative_fund": 2}}
    ]'::jsonb,
    'published'
),
(
    9,
    'financial_situation',
    'Bạn kỳ vọng mức tỷ suất sinh lời hàng năm từ danh mục chứng khoán là bao nhiêu?',
    'Kỳ vọng thực tế giúp tránh các cạm bẫy hứa hẹn làm giàu ảo tưởng.',
    '[
        {"id": "q9_opt1", "label": "Khoảng 10% - 15%/năm (cao hơn lãi suất ngân hàng 1.5 - 2 lần là hài lòng)", "risk_weight": 40, "persona_weights": {"dca_accumulator": 9, "value_growth": 5, "active_swing": 1, "conservative_fund": 6}},
        {"id": "q9_opt2", "label": "Khoảng 18% - 25%/năm (tương đương thành tích của các nhà đầu tư chuyên nghiệp)", "risk_weight": 65, "persona_weights": {"dca_accumulator": 4, "value_growth": 8, "active_swing": 5, "conservative_fund": 1}},
        {"id": "q9_opt3", "label": "Trên 40% - 50%/năm, hoặc nhân đôi tài khoản mỗi năm", "risk_weight": 90, "persona_weights": {"dca_accumulator": 0, "value_growth": 2, "active_swing": 8, "conservative_fund": 0}},
        {"id": "q9_opt4", "label": "Chỉ cần bảo toàn được vốn gốc và không bị âm tiền là đủ", "risk_weight": 20, "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
),
(
    10,
    'market_psychology',
    'Khi thị trường xảy ra một biến cố lớn bất ngờ (như thiên tai, khủng hoảng) và hàng loạt cổ phiếu giảm sàn, tâm lý của bạn sẽ ra sao?',
    'Đo lường sự kiên cường và khả năng phục hồi tâm lý trong nghịch cảnh.',
    '[
        {"id": "q10_opt1", "label": "Bình tĩnh hiểu rằng thị trường luôn có những cơn bão và sau bão kinh tế sẽ phục hồi", "risk_weight": 65, "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 2}},
        {"id": "q10_opt2", "label": "Lập tức đưa tỷ trọng tiền mặt lên mức an toàn cao nhất để bảo vệ thành quả", "risk_weight": 80, "persona_weights": {"dca_accumulator": 3, "value_growth": 4, "active_swing": 9, "conservative_fund": 3}},
        {"id": "q10_opt3", "label": "Vô cùng căng thẳng, stress kéo dài, liên tục đọc báo và mạng xã hội trong hoang mang", "risk_weight": 30, "persona_weights": {"dca_accumulator": 2, "value_growth": 1, "active_swing": 1, "conservative_fund": 8}},
        {"id": "q10_opt4", "label": "Sụp đổ tinh thần, cảm thấy mình không phù hợp với bất kỳ kênh đầu tư rủi ro nào", "risk_weight": 15, "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 0, "conservative_fund": 9}}
    ]'::jsonb,
    'published'
)
ON CONFLICT (id) DO NOTHING;
