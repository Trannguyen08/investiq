"""Repository for investor persona discovery, discipline scoring, and readiness evaluation."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg_pool import ConnectionPool

logger = logging.getLogger(__name__)

_DEFAULT_PERSONAS: list[dict[str, Any]] = [
    {
        "code": "dca_accumulator",
        "title": "Nhà đầu tư Tích sản Dài hạn (DCA)",
        "tagline": "Tích lũy tài sản bền vững theo năm tháng qua cổ tức và tăng trưởng",
        "description": "Bạn ưu tiên sự an toàn, bảo toàn vốn và tăng trưởng ổn định dài hạn. Bạn không có nhiều thời gian canh bảng điện tử trong giờ giao dịch và không muốn để biến động ngắn hạn làm ảnh hưởng đến công việc chính hoặc cuộc sống gia đình.",
        "strengths": [
            "Kiên nhẫn cao, không bị cuốn vào tâm lý FOMO/FUD",
            "Tận dụng được sức mạnh lãi kép qua nhiều năm",
            "Tâm lý thoải mái, không áp lực canh bảng điện từng phút",
        ],
        "weaknesses": [
            "Lợi nhuận ngắn hạn không bùng nổ",
            "Cần kỷ luật thép để duy trì tích sản ngay cả khi thị trường giảm sâu",
        ],
        "recommended_strategy": "Chiến lược bình quân giá (DCA) định kỳ hàng tháng vào các cổ phiếu đầu ngành VN30 hoặc chứng chỉ quỹ ETF VN30/VNFinLead, kết hợp tái đầu tư toàn bộ cổ tức tiền mặt.",
        "asset_allocation": {"stocks": 50, "gold": 25, "savings": 25},
        "ideal_time_hours_per_week": 2,
        "suitable_instruments": [
            "Cổ phiếu đầu ngành VN30 (FPT, HPG, VCB...)",
            "Chứng chỉ quỹ ETF E1VFVN30 / FUEVFVND",
            "Cổ phiếu chia cổ tức tiền mặt cao và đều đặn",
        ],
    },
    {
        "code": "value_growth",
        "title": "Nhà đầu tư Giá trị & Tăng trưởng (FA)",
        "tagline": "Đồng hành cùng doanh nghiệp xuất sắc với định giá hợp lý",
        "description": "Bạn thích đào sâu tìm hiểu mô hình kinh doanh, đọc báo cáo tài chính và tìm kiếm các doanh nghiệp có lợi thế cạnh tranh bền vững (Economic Moat). Bạn nhìn nhận các nhịp thị trường sụt giảm mạnh là cơ hội vàng để mua gom cổ phiếu tốt với giá rẻ.",
        "strengths": [
            "Khả năng đánh giá nội tại doanh nghiệp độc lập",
            "Không bị thao túng bởi tin đồn hay bảng điện xanh đỏ",
            "Tỷ suất sinh lời vượt trội khi chọn đúng cổ phiếu tăng trưởng",
        ],
        "weaknesses": [
            "Đòi hỏi nhiều thời gian đọc và phân tích BCTC",
            "Phải kiên nhẫn chờ thị trường phản ánh đúng giá trị thực (thường mất 6 tháng - 2 năm)",
        ],
        "recommended_strategy": "Xây dựng danh mục tập trung 4 - 6 mã cổ phiếu tăng trưởng có P/E, P/B hấp dẫn, ROE > 15%, nợ vay thấp và dòng tiền kinh doanh dương. Mua tích lũy tại các vùng định giá chiết khấu.",
        "asset_allocation": {"stocks": 65, "gold": 15, "savings": 20},
        "ideal_time_hours_per_week": 6,
        "suitable_instruments": [
            "Cổ phiếu tăng trưởng đầu ngành có ROE cao",
            "Cổ phiếu định giá thấp dưới giá trị sổ sách P/B < 1",
            "Doanh nghiệp có câu chuyện mở rộng công suất nhà máy",
        ],
    },
    {
        "code": "active_swing",
        "title": "Nhà giao dịch Chủ động & Lướt sóng (Swing Trader)",
        "tagline": "Tận dụng sóng dòng tiền và động lượng kỹ thuật theo xu hướng",
        "description": "Bạn năng động, nhạy bén với tin tức thị trường và dòng tiền lớn. Bạn có khả năng theo dõi bảng điện thường xuyên, am hiểu đồ thị nến, chỉ báo kỹ thuật (MA, RSI, Volume) và sẵn sàng cắt lỗ dứt khoát khi xu hướng đảo chiều.",
        "strengths": [
            "Tận dụng được các con sóng ngắn và trung hạn của thị trường",
            "Bảo toàn vốn nhanh chóng khi thị trường bước vào Downtrend",
            "Linh hoạt xoay chuyển dòng tiền giữa các nhóm ngành",
        ],
        "weaknesses": [
            "Áp lực tâm lý và căng thẳng cao khi thị trường biến động giật cục",
            "Tốn nhiều phí và thuế giao dịch nếu mua bán quá nhiều",
            "Dễ dính bẫy tâm lý nếu thiếu kỷ luật cắt lỗ -7%",
        ],
        "recommended_strategy": "Giao dịch theo xu hướng (Trend Following), mua tại các điểm bứt phá nền giá (Breakout) với khối lượng lớn, chốt lời từng phần theo mục tiêu 15-20% và tuyệt đối tuân thủ quy tắc cắt lỗ 7-8%.",
        "asset_allocation": {"stocks": 70, "gold": 10, "savings": 20},
        "ideal_time_hours_per_week": 12,
        "suitable_instruments": [
            "Cổ phiếu Midcap có thanh khoản cao và dòng tiền mạnh",
            "Cổ phiếu nhóm ngành đang hưởng lợi vĩ mô (Chứng khoán, Thép, Bất động sản...)",
            "Giao dịch theo mẫu hình kỹ thuật và đường MA",
        ],
    },
    {
        "code": "conservative_fund",
        "title": "Người Thận trọng / Phù hợp Quỹ Mở & Tiết kiệm",
        "tagline": "Bảo vệ an toàn vốn là ưu tiên hàng đầu, hạn chế tối đa rủi ro",
        "description": "Bạn có khẩu vị rủi ro thấp, rất dễ bị căng thẳng mất ngủ khi nhìn thấy tài khoản giảm điểm. Bạn chưa có đủ thời gian hoặc kiến thức để tự phân tích và chọn lựa cổ phiếu đơn lẻ trên sàn.",
        "strengths": [
            "Bảo vệ an toàn tuyệt đối cho số vốn tích lũy",
            "Tránh được rủi ro thua lỗ nặng do thiếu kinh nghiệm hoặc mua phải cổ phiếu rác",
            "Cuộc sống bình yên, không bị chi phối bởi thị trường",
        ],
        "weaknesses": [
            "Lợi nhuận khó vượt qua tốc độ lạm phát nếu chỉ gửi ngân hàng đơn thuần",
            "Chưa tối ưu hóa được tiềm năng tăng trưởng của thị trường",
        ],
        "recommended_strategy": "Chưa nên tự mua bán cổ phiếu đơn lẻ bằng tiền thật. Thay vào đó, hãy phân bổ phần lớn vào Tiền gửi tiết kiệm và Vàng tích lũy, đồng thời ủy thác một phần nhỏ (15-20%) vào các Quỹ mở cổ phiếu hoặc Quỹ ETF được quản lý bởi các chuyên gia tài chính.",
        "asset_allocation": {"stocks": 20, "gold": 30, "savings": 50},
        "ideal_time_hours_per_week": 1,
        "suitable_instruments": [
            "Tiền gửi ngân hàng có kỳ hạn",
            "Vàng vật chất tích sản SJC / PNJ",
            "Chứng chỉ quỹ mở / ETF uy tín (Dragon Capital, VinaCapital, SSIAM)",
        ],
    },
]

_DEFAULT_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "11111111-2222-3333-4444-000000000001",
        "sort_order": 1,
        "category": "financial_situation",
        "prompt": "Mục tiêu tài chính quan trọng nhất của bạn khi tìm hiểu thị trường chứng khoán là gì?",
        "subtext": "Mục tiêu rõ ràng sẽ quyết định phong cách và tâm lý đầu tư của bạn.",
        "options": [
            {
                "id": "q1_opt1",
                "label": "Tích lũy tài sản đều đặn hàng tháng cho tương lai dài hạn (5 - 10 năm tới)",
                "risk_weight": 40,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 4, "active_swing": 1, "conservative_fund": 5},
            },
            {
                "id": "q1_opt2",
                "label": "Tìm kiếm các doanh nghiệp tốt để nhân đôi, nhân ba tài sản trong chu kỳ 2 - 4 năm",
                "risk_weight": 65,
                "persona_weights": {"dca_accumulator": 3, "value_growth": 8, "active_swing": 4, "conservative_fund": 1},
            },
            {
                "id": "q1_opt3",
                "label": "Kiếm thêm thu nhập chủ động hàng tuần/hàng tháng từ các con sóng ngắn hạn",
                "risk_weight": 85,
                "persona_weights": {"dca_accumulator": 1, "value_growth": 2, "active_swing": 9, "conservative_fund": 0},
            },
            {
                "id": "q1_opt4",
                "label": "Tìm kênh cất giữ tiền an toàn hơn lạm phát nhưng không muốn bị mất tiền",
                "risk_weight": 20,
                "persona_weights": {"dca_accumulator": 4, "value_growth": 1, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000002",
        "sort_order": 2,
        "category": "risk_tolerance",
        "prompt": "Nếu khoản đầu tư 100 triệu của bạn bị giảm xuống còn 85 triệu (-15%) sau 2 tuần, bạn sẽ cảm thấy và hành động như thế nào?",
        "subtext": "Phản ứng tâm lý thực tế khi tài khoản sụt giảm mạnh là thước đo chính xác nhất về khẩu vị rủi ro.",
        "options": [
            {
                "id": "q2_opt1",
                "label": "Bình tĩnh rà soát lại lý do mua; nếu doanh nghiệp vẫn tốt, coi đây là cơ hội để mua thêm với giá rẻ",
                "risk_weight": 60,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 2, "conservative_fund": 1},
            },
            {
                "id": "q2_opt2",
                "label": "Kỷ luật cắt lỗ ngay lập tức vì giá đã vi phạm ngưỡng cho phép (-7% đến -8%), đứng ngoài chờ cơ hội mới",
                "risk_weight": 80,
                "persona_weights": {"dca_accumulator": 2, "value_growth": 3, "active_swing": 9, "conservative_fund": 2},
            },
            {
                "id": "q2_opt3",
                "label": "Rất lo lắng, mất ngủ, liên tục mở ứng dụng xem giá nhưng không dám cắt vì sợ bán đúng đáy",
                "risk_weight": 35,
                "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 1, "conservative_fund": 7},
            },
            {
                "id": "q2_opt4",
                "label": "Hoảng loạn, bán tháo sạch toàn bộ danh mục ngay lập tức và quyết định không bao giờ chơi chứng khoán nữa",
                "risk_weight": 15,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000003",
        "sort_order": 3,
        "category": "time_commitment",
        "prompt": "Bạn có thể dành ra trung bình bao nhiêu thời gian mỗi tuần cho việc nghiên cứu và theo dõi thị trường?",
        "subtext": "Thời gian khả dụng quyết định bạn có thể theo dõi biến động từng phút hay chỉ xem xét định kỳ.",
        "options": [
            {
                "id": "q3_opt1",
                "label": "Dưới 2 giờ mỗi tuần (chỉ xem lại tài sản vào cuối tuần hoặc khi có kỳ trả lương)",
                "risk_weight": 30,
                "persona_weights": {"dca_accumulator": 9, "value_growth": 2, "active_swing": 0, "conservative_fund": 8},
            },
            {
                "id": "q3_opt2",
                "label": "Khoảng 3 - 6 giờ mỗi tuần (đọc báo cáo phân tích, tin tức buổi tối sau giờ làm việc)",
                "risk_weight": 55,
                "persona_weights": {"dca_accumulator": 5, "value_growth": 8, "active_swing": 3, "conservative_fund": 3},
            },
            {
                "id": "q3_opt3",
                "label": "Trên 10 giờ mỗi tuần (có thể theo dõi bảng điện thường xuyên trong giờ giao dịch 9h-15h)",
                "risk_weight": 85,
                "persona_weights": {"dca_accumulator": 1, "value_growth": 4, "active_swing": 9, "conservative_fund": 0},
            },
            {
                "id": "q3_opt4",
                "label": "Hầu như không có thời gian rảnh, công việc chính rất bận rộn và căng thẳng",
                "risk_weight": 20,
                "persona_weights": {"dca_accumulator": 6, "value_growth": 0, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000004",
        "sort_order": 4,
        "category": "financial_situation",
        "prompt": "Khoản tiền bạn dự kiến phân bổ vào chứng khoán có nguồn gốc và thời hạn sử dụng như thế nào?",
        "subtext": "Thời hạn của dòng tiền quyết định khả năng gồng qua những chu kỳ điều chỉnh của thị trường.",
        "options": [
            {
                "id": "q4_opt1",
                "label": "Tiền nhàn rỗi dài hạn từ 3 đến 5 năm trở lên, hoàn toàn không cần dùng đến trong ngắn hạn",
                "risk_weight": 70,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 4},
            },
            {
                "id": "q4_opt2",
                "label": "Tiền nhàn rỗi trong khoảng 6 tháng đến 1 năm",
                "risk_weight": 50,
                "persona_weights": {"dca_accumulator": 4, "value_growth": 5, "active_swing": 6, "conservative_fund": 4},
            },
            {
                "id": "q4_opt3",
                "label": "Tiền cần chi trả cho các nghĩa vụ trong 1 - 3 tháng tới (tiền học, tiền thuê nhà, tiền hàng)",
                "risk_weight": 10,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 1, "conservative_fund": 9},
            },
            {
                "id": "q4_opt4",
                "label": "Tiền vay mượn từ người quen hoặc dự định dùng đòn bẩy Margin cao để làm giàu nhanh",
                "risk_weight": 95,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 5, "conservative_fund": 0},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000005",
        "sort_order": 5,
        "category": "investment_knowledge",
        "prompt": "Mức độ hiểu biết hiện tại của bạn về việc đọc Báo cáo tài chính (Doanh thu, LNST, Nợ, P/E, ROE) như thế nào?",
        "subtext": "Đánh giá nền tảng kỹ năng phân tích cơ bản của bản thân.",
        "options": [
            {
                "id": "q5_opt1",
                "label": "Chưa biết gì, nhìn vào các bảng số liệu tài chính thấy rất khó hiểu và nhức đầu",
                "risk_weight": 25,
                "persona_weights": {"dca_accumulator": 6, "value_growth": 1, "active_swing": 3, "conservative_fund": 8},
            },
            {
                "id": "q5_opt2",
                "label": "Đã hiểu các chỉ số cơ bản như P/E, P/B, Biên lợi nhuận nhưng chưa phân tích sâu được BCTC",
                "risk_weight": 50,
                "persona_weights": {"dca_accumulator": 6, "value_growth": 6, "active_swing": 4, "conservative_fund": 3},
            },
            {
                "id": "q5_opt3",
                "label": "Có thể đọc hiểu Bảng cân đối kế toán, Báo cáo KQKD và phát hiện các rủi ro nợ vay, dòng tiền",
                "risk_weight": 75,
                "persona_weights": {"dca_accumulator": 4, "value_growth": 9, "active_swing": 4, "conservative_fund": 1},
            },
            {
                "id": "q5_opt4",
                "label": "Không quan tâm đến BCTC, chỉ tin vào hành động giá, chỉ báo kỹ thuật và khối lượng giao dịch",
                "risk_weight": 80,
                "persona_weights": {"dca_accumulator": 1, "value_growth": 1, "active_swing": 9, "conservative_fund": 1},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000006",
        "sort_order": 6,
        "category": "market_psychology",
        "prompt": 'Khi bạn bè hoặc hội nhóm trên mạng xã hội mách một "mã cổ phiếu sắp tăng trần liên tiếp", phản ứng thông thường của bạn là gì?',
        "subtext": "Đo lường mức độ kháng lại tâm lý FOMO (sợ bỏ lỡ cơ hội).",
        "options": [
            {
                "id": "q6_opt1",
                "label": "Lập tức mở tài khoản mua ngay kẻo lỡ tàu, sợ mọi người kiếm được tiền mà mình đứng ngoài",
                "risk_weight": 85,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 6, "conservative_fund": 1},
            },
            {
                "id": "q6_opt2",
                "label": "Tò mò tìm hiểu, mở biểu đồ kỹ thuật xem xu hướng dòng tiền và điểm vào hợp lý trước khi quyết định",
                "risk_weight": 70,
                "persona_weights": {"dca_accumulator": 2, "value_growth": 4, "active_swing": 8, "conservative_fund": 1},
            },
            {
                "id": "q6_opt3",
                "label": "Bỏ ngoài tai hoặc chỉ đọc cho vui, chỉ đầu tư vào những doanh nghiệp mình đã tự nghiên cứu kỹ",
                "risk_weight": 50,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 2, "conservative_fund": 4},
            },
            {
                "id": "q6_opt4",
                "label": "Cảm thấy đây là cờ bạc lừa đảo và sợ hãi không dám tham gia bất cứ thứ gì",
                "risk_weight": 20,
                "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000007",
        "sort_order": 7,
        "category": "risk_tolerance",
        "prompt": "Quan điểm của bạn về nguyên tắc cắt lỗ khi một cổ phiếu mua vào bị âm -7% là gì?",
        "subtext": "Kỷ luật cắt lỗ là yếu tố sống còn phân định giữa nhà đầu tư chuyên nghiệp và người cờ bạc.",
        "options": [
            {
                "id": "q7_opt1",
                "label": "Cắt dứt khoát 100% không do dự để bảo toàn vốn, sai thì làm lại ở cơ hội khác",
                "risk_weight": 85,
                "persona_weights": {"dca_accumulator": 2, "value_growth": 3, "active_swing": 9, "conservative_fund": 2},
            },
            {
                "id": "q7_opt2",
                "label": "Nếu là cổ phiếu đầu cơ ngắn hạn thì cắt ngay; nếu là cổ phiếu đầu ngành tích sản dài hạn thì giữ hoặc mua thêm",
                "risk_weight": 60,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 2},
            },
            {
                "id": "q7_opt3",
                "label": "Không bao giờ cắt lỗ vì tin rằng cổ phiếu chưa bán là chưa lỗ, cứ ôm chờ vài năm sẽ về bờ",
                "risk_weight": 30,
                "persona_weights": {"dca_accumulator": 2, "value_growth": 2, "active_swing": 1, "conservative_fund": 5},
            },
            {
                "id": "q7_opt4",
                "label": "Rất sợ hãi khi phải nhấn nút bán lỗ, cảm giác như mình là kẻ thất bại",
                "risk_weight": 20,
                "persona_weights": {"dca_accumulator": 1, "value_growth": 0, "active_swing": 0, "conservative_fund": 8},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000008",
        "sort_order": 8,
        "category": "investment_knowledge",
        "prompt": "Kinh nghiệm quản lý tài chính và đầu tư thực tế trước đây của bạn như thế nào?",
        "subtext": "Kinh nghiệm thực tiễn giúp xác định mức độ sẵn sàng khi bước vào thị trường thật.",
        "options": [
            {
                "id": "q8_opt1",
                "label": "Chưa từng đầu tư bất kỳ kênh nào, trước giờ chỉ gửi tiết kiệm ngân hàng",
                "risk_weight": 25,
                "persona_weights": {"dca_accumulator": 6, "value_growth": 2, "active_swing": 0, "conservative_fund": 9},
            },
            {
                "id": "q8_opt2",
                "label": "Đã từng mua vàng, gửi tiết kiệm online hoặc mua chứng chỉ quỹ mở",
                "risk_weight": 45,
                "persona_weights": {"dca_accumulator": 7, "value_growth": 5, "active_swing": 2, "conservative_fund": 6},
            },
            {
                "id": "q8_opt3",
                "label": "Đã tự giao dịch chứng khoán hoặc tiền số từ 6 tháng đến 1 năm trở lên",
                "risk_weight": 75,
                "persona_weights": {"dca_accumulator": 4, "value_growth": 6, "active_swing": 8, "conservative_fund": 1},
            },
            {
                "id": "q8_opt4",
                "label": "Có kinh nghiệm đầu tư bất động sản hoặc kinh doanh buôn bán bên ngoài",
                "risk_weight": 65,
                "persona_weights": {"dca_accumulator": 5, "value_growth": 8, "active_swing": 4, "conservative_fund": 2},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000009",
        "sort_order": 9,
        "category": "financial_situation",
        "prompt": "Bạn kỳ vọng mức tỷ suất sinh lời hàng năm từ danh mục chứng khoán là bao nhiêu?",
        "subtext": "Kỳ vọng thực tế giúp tránh các cạm bẫy hứa hẹn làm giàu ảo tưởng.",
        "options": [
            {
                "id": "q9_opt1",
                "label": "Khoảng 10% - 15%/năm (cao hơn lãi suất ngân hàng 1.5 - 2 lần là hài lòng)",
                "risk_weight": 40,
                "persona_weights": {"dca_accumulator": 9, "value_growth": 5, "active_swing": 1, "conservative_fund": 6},
            },
            {
                "id": "q9_opt2",
                "label": "Khoảng 18% - 25%/năm (tương đương thành tích của các nhà đầu tư chuyên nghiệp)",
                "risk_weight": 65,
                "persona_weights": {"dca_accumulator": 4, "value_growth": 8, "active_swing": 5, "conservative_fund": 1},
            },
            {
                "id": "q9_opt3",
                "label": "Trên 40% - 50%/năm, hoặc nhân đôi tài khoản mỗi năm",
                "risk_weight": 90,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 2, "active_swing": 8, "conservative_fund": 0},
            },
            {
                "id": "q9_opt4",
                "label": "Chỉ cần bảo toàn được vốn gốc và không bị âm tiền là đủ",
                "risk_weight": 20,
                "persona_weights": {"dca_accumulator": 3, "value_growth": 1, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
    {
        "id": "11111111-2222-3333-4444-000000000010",
        "sort_order": 10,
        "category": "market_psychology",
        "prompt": "Khi thị trường xảy ra một biến cố lớn bất ngờ (như thiên tai, khủng hoảng) và hàng loạt cổ phiếu giảm sàn, tâm lý của bạn sẽ ra sao?",
        "subtext": "Đo lường sự kiên cường và khả năng phục hồi tâm lý trong nghịch cảnh.",
        "options": [
            {
                "id": "q10_opt1",
                "label": "Bình tĩnh hiểu rằng thị trường luôn có những cơn bão và sau bão kinh tế sẽ phục hồi",
                "risk_weight": 65,
                "persona_weights": {"dca_accumulator": 8, "value_growth": 8, "active_swing": 3, "conservative_fund": 2},
            },
            {
                "id": "q10_opt2",
                "label": "Lập tức đưa tỷ trọng tiền mặt lên mức an toàn cao nhất để bảo vệ thành quả",
                "risk_weight": 80,
                "persona_weights": {"dca_accumulator": 3, "value_growth": 4, "active_swing": 9, "conservative_fund": 3},
            },
            {
                "id": "q10_opt3",
                "label": "Vô cùng căng thẳng, stress kéo dài, liên tục đọc báo và mạng xã hội trong hoang mang",
                "risk_weight": 30,
                "persona_weights": {"dca_accumulator": 2, "value_growth": 1, "active_swing": 1, "conservative_fund": 8},
            },
            {
                "id": "q10_opt4",
                "label": "Sụp đổ tinh thần, cảm thấy mình không phù hợp với bất kỳ kênh đầu tư rủi ro nào",
                "risk_weight": 15,
                "persona_weights": {"dca_accumulator": 0, "value_growth": 0, "active_swing": 0, "conservative_fund": 9},
            },
        ],
        "status": "published",
    },
]

# In-memory storages
_MEM_PERSONAS: dict[str, dict[str, Any]] = {p["code"]: dict(p) for p in _DEFAULT_PERSONAS}
_MEM_QUESTIONS: dict[str, dict[str, Any]] = {q["id"]: dict(q) for q in _DEFAULT_QUESTIONS}
_MEM_ASSESSMENTS: list[dict[str, Any]] = []


class SqlAssessmentRepository:
    """Repository handling assessment questions, personas, and readiness calculation."""

    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool

    def get_personas(self) -> list[dict[str, Any]]:
        """Return all investor persona archetypes."""
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT code, title, tagline, description, strengths, weaknesses,
                               recommended_strategy, asset_allocation, ideal_time_hours_per_week, suitable_instruments
                        FROM investor_personas;
                        """
                    )
                    rows = cur.fetchall()
                    if rows:
                        results = []
                        for r in rows:
                            results.append({
                                "code": r[0],
                                "title": r[1],
                                "tagline": r[2],
                                "description": r[3],
                                "strengths": r[4] if isinstance(r[4], list) else json.loads(r[4]),
                                "weaknesses": r[5] if isinstance(r[5], list) else json.loads(r[5]),
                                "recommended_strategy": r[6],
                                "asset_allocation": r[7] if isinstance(r[7], dict) else json.loads(r[7]),
                                "ideal_time_hours_per_week": r[8],
                                "suitable_instruments": r[9] if isinstance(r[9], list) else json.loads(r[9]),
                            })
                        return results
            except Exception as exc:
                logger.warning("DB query investor_personas failed, using memory: %s", exc)

        return list(_MEM_PERSONAS.values())

    def get_persona(self, code: str) -> dict[str, Any] | None:
        """Find a persona by its code."""
        personas = self.get_personas()
        for p in personas:
            if p["code"] == code:
                return p
        return _MEM_PERSONAS.get(code)

    def update_persona(self, code: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Update persona strategy, strengths, or allocation."""
        existing = self.get_persona(code)
        if not existing:
            return None

        updated = dict(existing)
        for k, v in data.items():
            if v is not None:
                updated[k] = v

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE investor_personas
                        SET title = %s, tagline = %s, description = %s, strengths = %s, weaknesses = %s,
                            recommended_strategy = %s, asset_allocation = %s, ideal_time_hours_per_week = %s,
                            suitable_instruments = %s, updated_at = NOW()
                        WHERE code = %s;
                        """,
                        (
                            updated["title"], updated["tagline"], updated["description"],
                            json.dumps(updated["strengths"]), json.dumps(updated["weaknesses"]),
                            updated["recommended_strategy"], json.dumps(updated["asset_allocation"]),
                            updated["ideal_time_hours_per_week"], json.dumps(updated["suitable_instruments"]),
                            code,
                        ),
                    )
            except Exception as exc:
                logger.warning("DB update investor_personas failed: %s", exc)

        _MEM_PERSONAS[code] = updated
        return updated

    def get_questions(self, status: str | None = "published") -> list[dict[str, Any]]:
        """Return assessment questions ordered by sort_order."""
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    if status:
                        cur.execute(
                            """
                            SELECT id, sort_order, category, prompt, subtext, options, status
                            FROM assessment_questions
                            WHERE status = %s
                            ORDER BY sort_order ASC;
                            """,
                            (status,),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, sort_order, category, prompt, subtext, options, status
                            FROM assessment_questions
                            ORDER BY sort_order ASC;
                            """
                        )
                    rows = cur.fetchall()
                    if rows:
                        results = []
                        for r in rows:
                            results.append({
                                "id": str(r[0]),
                                "sort_order": r[1],
                                "category": r[2],
                                "prompt": r[3],
                                "subtext": r[4],
                                "options": r[5] if isinstance(r[5], list) else json.loads(r[5]),
                                "status": r[6],
                            })
                        return results
            except Exception as exc:
                logger.warning("DB query assessment_questions failed, using memory: %s", exc)

        questions = list(_MEM_QUESTIONS.values())
        if status:
            questions = [q for q in questions if q.get("status") == status]
        questions.sort(key=lambda x: int(x.get("sort_order", 1)))
        return questions

    def get_question(self, question_id: str) -> dict[str, Any] | None:
        """Find question by ID."""
        questions = self.get_questions(status=None)
        for q in questions:
            if q["id"] == question_id:
                return q
        return _MEM_QUESTIONS.get(question_id)

    def create_question(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new survey question."""
        q_id = str(uuid4())
        record = {
            "id": q_id,
            "sort_order": data.get("sort_order", 1),
            "category": data["category"],
            "prompt": data["prompt"],
            "subtext": data.get("subtext"),
            "options": data["options"],
            "status": data.get("status", "published"),
        }

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO assessment_questions (id, sort_order, category, prompt, subtext, options, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """,
                        (
                            record["id"], record["sort_order"], record["category"],
                            record["prompt"], record["subtext"], json.dumps(record["options"]),
                            record["status"],
                        ),
                    )
            except Exception as exc:
                logger.warning("DB insert assessment_question failed: %s", exc)

        _MEM_QUESTIONS[q_id] = record
        return record

    def update_question(self, question_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Update an existing question."""
        existing = self.get_question(question_id)
        if not existing:
            return None

        updated = dict(existing)
        for k, v in data.items():
            if v is not None:
                updated[k] = v

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE assessment_questions
                        SET sort_order = %s, category = %s, prompt = %s, subtext = %s,
                            options = %s, status = %s, updated_at = NOW()
                        WHERE id = %s;
                        """,
                        (
                            updated["sort_order"], updated["category"], updated["prompt"],
                            updated["subtext"], json.dumps(updated["options"]), updated["status"],
                            question_id,
                        ),
                    )
            except Exception as exc:
                logger.warning("DB update assessment_questions failed: %s", exc)

        _MEM_QUESTIONS[question_id] = updated
        return updated

    def delete_question(self, question_id: str) -> bool:
        """Delete a question."""
        existing = self.get_question(question_id)
        if not existing:
            return False

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute("DELETE FROM assessment_questions WHERE id = %s;", (question_id,))
            except Exception as exc:
                logger.warning("DB delete assessment_question failed: %s", exc)

        _MEM_QUESTIONS.pop(question_id, None)
        return True

    def calculate_discipline_score(
        self,
        cash_vnd: float,
        holdings: list[dict[str, Any]],
        realized_orders: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Compute behavioral discipline indicators from paper portfolio holdings & closed trades."""
        strengths: list[str] = []
        weaknesses: list[str] = []
        recommendations: list[str] = []

        total_stock_value = sum(float(h.get("market_value", 0)) for h in holdings)
        total_assets = cash_vnd + total_stock_value

        # 1. Diversification Score (25%)
        if not holdings:
            diversification_score = 70.0
            strengths.append("Tài khoản chưa giải ngân, bảo toàn nguyên vẹn 100% tiền mặt.")
        else:
            num_stocks = len(holdings)
            max_allocation_ratio = max(float(h.get("market_value", 0)) for h in holdings) / (total_assets or 1.0)
            if num_stocks == 1:
                diversification_score = 40.0
                weaknesses.append("Tất cả vốn đang dồn vào 1 mã duy nhất (rủi ro tập trung cực lớn).")
                recommendations.append("Nên phân bổ thành 3 đến 5 mã thuộc các ngành khác nhau để giảm thiểu rủi ro phi hệ thống.")
            elif 2 <= num_stocks <= 6 and max_allocation_ratio <= 0.40:
                diversification_score = 95.0
                strengths.append(f"Danh mục cân đối ({num_stocks} mã), không có mã nào chiếm quá 40% tổng tài sản.")
            elif max_allocation_ratio > 0.50:
                diversification_score = 60.0
                weaknesses.append(f"Có mã chiếm tới {int(max_allocation_ratio * 100)}% danh mục, rủi ro biến động theo mã này rất cao.")
                recommendations.append("Cân nhắc hạ bớt tỷ trọng của mã lớn nhất về dưới mức 35% danh mục.")
            else:
                diversification_score = 80.0
                strengths.append(f"Đa dạng hóa vừa phải với {num_stocks} mã cổ phiếu.")

        # 2. Cash Management Score (25%)
        cash_ratio = cash_vnd / (total_assets or 1.0)
        if 0.10 <= cash_ratio <= 0.35:
            cash_score = 95.0
            strengths.append(f"Duy trì bộ đệm tiền mặt an toàn {int(cash_ratio * 100)}%, sẵn sàng bắt đáy khi có nhịp điều chỉnh.")
        elif cash_ratio > 0.80:
            cash_score = 75.0
            strengths.append("Giữ tỷ lệ tiền mặt rất cao, rủi ro sụt giảm tài sản là cực thấp.")
            recommendations.append("Có thể giải ngân từng phần (DCA) vào các cổ phiếu đầu ngành định giá hấp dẫn.")
        elif cash_ratio < 0.05 and holdings:
            cash_score = 45.0
            weaknesses.append("Gần như 'All-in' 100% cổ phiếu, không còn tiền mặt dự phòng nếu thị trường sụt giảm bất ngờ.")
            recommendations.append("Nên giữ ít nhất 10% - 20% tiền mặt để chủ động quản trị rủi ro.")
        else:
            cash_score = 80.0

        # 3. Cut-loss Compliance Score (30%)
        deep_loss_count = 0
        for h in holdings:
            pnl_pct = float(h.get("unrealized_pnl_percent", 0))
            if pnl_pct <= -7.0:
                deep_loss_count += 1

        if deep_loss_count == 0:
            cut_loss_score = 95.0
            strengths.append("Không có vị thế nào bị âm sâu quá ngưỡng an toàn -7%.")
        elif deep_loss_count == 1:
            cut_loss_score = 65.0
            weaknesses.append("Đang có 1 mã âm vượt quá ngưỡng -7% nhưng chưa thực hiện cắt lỗ bảo toàn vốn.")
            recommendations.append("Cần xem xét dứt khoát hạ tỷ trọng hoặc cắt lỗ mã âm sâu theo nguyên tắc 7-8% của William O'Neil.")
        else:
            cut_loss_score = 40.0
            weaknesses.append(f"Đang gồng lỗ {deep_loss_count} mã âm vượt quá -7%, tâm lý 'chờ về bờ' đang chi phối.")
            recommendations.append("Tuyệt đối không gồng lỗ cổ phiếu đầu cơ. Cắt lỗ sớm giúp bạn giữ được 90% vốn để làm lại ở con sóng mới.")

        # 4. Emotional Pacing Score (20%)
        orders_count = len(realized_orders or [])
        if orders_count > 20:
            pacing_score = 60.0
            weaknesses.append("Tần suất mua bán khá dày đặc, có dấu hiệu giao dịch theo cảm xúc (Overtrading).")
            recommendations.append("Giảm nhịp độ giao dịch, chỉ mở vị thế khi cổ phiếu đạt đủ tiêu chí kỹ thuật và định giá.")
        else:
            pacing_score = 90.0
            strengths.append("Giao dịch có chọn lọc, nhịp độ bình tĩnh không bị cuốn vào bảng điện.")

        overall_discipline = (
            diversification_score * 0.25
            + cash_score * 0.25
            + cut_loss_score * 0.30
            + pacing_score * 0.20
        )

        if overall_discipline >= 85:
            badge = "Kỷ luật thép"
        elif overall_discipline >= 70:
            badge = "Khá chuẩn mực"
        elif overall_discipline >= 55:
            badge = "Cần rèn luyện thêm"
        else:
            badge = "Cảm xúc chi phối"

        return {
            "cut_loss_score": round(cut_loss_score, 1),
            "diversification_score": round(diversification_score, 1),
            "cash_management_score": round(cash_score, 1),
            "emotional_pacing_score": round(pacing_score, 1),
            "overall_discipline_score": round(overall_discipline, 1),
            "badge": badge,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": recommendations,
        }

    def evaluate_assessment(
        self,
        answers: dict[str, str],
        user_id: str | None = None,
        guest_identifier: str | None = None,
        knowledge_score: float | None = None,
        discipline_score: float | None = None,
    ) -> dict[str, Any]:
        """Process quiz answers, compute Persona fit, determine Readiness index, and persist."""
        questions = self.get_questions(status=None)
        q_map: dict[str, dict[str, Any]] = {}
        for q in questions:
            q_map[q["id"]] = q
            # Also map by sort_order / string number
            q_map[str(q.get("sort_order"))] = q
            q_map[f"q{q.get('sort_order')}"] = q

        persona_points: dict[str, int] = {
            "dca_accumulator": 0,
            "value_growth": 0,
            "active_swing": 0,
            "conservative_fund": 0,
        }
        risk_weights: list[int] = []

        for q_key, opt_id in answers.items():
            question = q_map.get(str(q_key))
            if not question:
                continue

            for opt in question.get("options", []):
                if opt["id"] == opt_id:
                    risk_weights.append(int(opt.get("risk_weight", 50)))
                    for p_code, weight in opt.get("persona_weights", {}).items():
                        if p_code in persona_points:
                            persona_points[p_code] += int(weight)
                    break

        # Calculate average risk tolerance (0-100)
        risk_score = round(sum(risk_weights) / (len(risk_weights) or 1), 1)

        # Pick winning persona
        top_persona_code = max(persona_points.items(), key=lambda x: x[1])[0]
        persona = self.get_persona(top_persona_code) or _DEFAULT_PERSONAS[0]

        # Knowledge & Discipline defaults if not provided
        k_score = float(knowledge_score) if knowledge_score is not None else 60.0
        d_score = float(discipline_score) if discipline_score is not None else 65.0

        # Holistic Readiness Index: Knowledge (35%) + Mindset/Risk (30%) + Discipline (35%)
        overall_readiness = round(k_score * 0.35 + risk_score * 0.30 + d_score * 0.35, 1)

        # Readiness classification
        if overall_readiness >= 80:
            level = "disciplined_investor"
            label = "Nhà đầu tư Bản lĩnh"
            can_trade = True
            verdict = "Bạn đã hội tụ đầy đủ kiến thức, tâm lý thực tế và kỷ luật quản trị vốn để có thể tự tin bước vào thị trường thật bằng một khoản vốn khởi đầu có kiểm soát."
            action = "Bắt đầu mở tài khoản chứng khoán thật tại công ty uy tín và giải ngân thử nghiệm với 10% - 20% vốn nhàn rỗi."
        elif overall_readiness >= 65:
            level = "ready_starter"
            label = "Sẵn sàng Khởi đầu có Kiểm soát"
            can_trade = True
            verdict = "Bạn có tố chất và nhận thức tốt, tuy nhiên cần bắt đầu bằng chiến lược an toàn như Tích sản định kỳ (DCA) hoặc các cổ phiếu phòng thủ VN30 trước khi nghĩ tới việc lướt sóng."
            action = "Thiết lập kế hoạch tích sản đều đặn hàng tháng và tiếp tục theo dõi kỷ luật danh mục trên InvestIQ."
        elif overall_readiness >= 50:
            level = "needs_training"
            label = "Cần Rèn luyện Thêm"
            can_trade = False
            verdict = "Bạn đã có nhận thức ban đầu về chứng khoán, nhưng tâm lý hoặc kỹ năng cắt lỗ còn yếu. Thị trường thật rất khốc liệt và bạn rất dễ bị cảm xúc chi phối dẫn tới thua lỗ."
            action = "Chưa nên nạp tiền thật ngay. Hãy hoàn thành các bài học phân tích kỹ thuật và luyện tập kỷ luật cắt lỗ -7% trên tài khoản thử nghiệm thêm 1 đến 2 tháng."
        else:
            level = "not_ready"
            label = "Chưa Sẵn sàng Đầu tư Thật"
            can_trade = False
            verdict = "Rủi ro mất tiền của bạn là cực kỳ cao nếu tham gia thị trường lúc này do chưa tích lũy đủ kiến thức và tâm lý sợ thua lỗ. Bạn nên bảo vệ tiền mồ hôi nước mắt của mình."
            action = "Tập trung gửi tiết kiệm ngân hàng hoặc tích lũy vàng an toàn, đồng thời hoàn thành toàn bộ khóa học Căn bản trên InvestIQ trước khi quyết định lại."

        assessment_id = str(uuid4())
        record = {
            "id": assessment_id,
            "user_id": user_id,
            "guest_identifier": guest_identifier,
            "persona": persona,
            "persona_code": top_persona_code,
            "persona_title": persona["title"],
            "risk_score": risk_score,
            "knowledge_score": k_score,
            "discipline_score": d_score,
            "overall_readiness_score": overall_readiness,
            "readiness_level": level,
            "readiness_label": label,
            "verdict_summary": verdict,
            "can_trade_real_money": can_trade,
            "recommended_action": action,
            "created_at": datetime.now(UTC).isoformat(),
            "answers": answers,
        }

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO user_readiness_assessments (
                            id, user_id, guest_identifier, persona_code, risk_score,
                            knowledge_score, discipline_score, readiness_score,
                            readiness_level, answers, summary_notes, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW());
                        """,
                        (
                            record["id"], user_id, guest_identifier, top_persona_code,
                            risk_score, k_score, d_score, overall_readiness,
                            level, json.dumps(answers), verdict,
                        ),
                    )
            except Exception as exc:
                logger.warning("DB insert user_readiness_assessment failed: %s", exc)

        _MEM_ASSESSMENTS.insert(0, record)
        return record

    def get_latest_assessment(
        self,
        user_id: str | None = None,
        guest_identifier: str | None = None,
    ) -> dict[str, Any] | None:
        """Retrieve most recent evaluation for user or guest."""
        if self._pool is not None and (user_id or guest_identifier):
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    if user_id:
                        cur.execute(
                            """
                            SELECT id, user_id, guest_identifier, persona_code, risk_score,
                                   knowledge_score, discipline_score, readiness_score,
                                   readiness_level, answers, summary_notes, created_at
                            FROM user_readiness_assessments
                            WHERE user_id = %s
                            ORDER BY created_at DESC LIMIT 1;
                            """,
                            (user_id,),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, user_id, guest_identifier, persona_code, risk_score,
                                   knowledge_score, discipline_score, readiness_score,
                                   readiness_level, answers, summary_notes, created_at
                            FROM user_readiness_assessments
                            WHERE guest_identifier = %s
                            ORDER BY created_at DESC LIMIT 1;
                            """,
                            (guest_identifier,),
                        )
                    row = cur.fetchone()
                    if row:
                        persona = self.get_persona(row[3]) or _DEFAULT_PERSONAS[0]
                        overall = float(row[7])
                        return {
                            "id": str(row[0]),
                            "user_id": str(row[1]) if row[1] else None,
                            "guest_identifier": row[2],
                            "persona": persona,
                            "persona_code": row[3],
                            "persona_title": persona["title"],
                            "risk_score": float(row[4]),
                            "knowledge_score": float(row[5]),
                            "discipline_score": float(row[6]),
                            "overall_readiness_score": overall,
                            "readiness_level": row[8],
                            "readiness_label": "Nhà đầu tư Bản lĩnh" if overall >= 80 else ("Sẵn sàng Khởi đầu có Kiểm soát" if overall >= 65 else ("Cần Rèn luyện Thêm" if overall >= 50 else "Chưa Sẵn sàng Đầu tư Thật")),
                            "verdict_summary": row[10] or "",
                            "can_trade_real_money": overall >= 65,
                            "recommended_action": "Bắt đầu với số vốn nhỏ" if overall >= 65 else "Tiếp tục học và rèn luyện trên tài khoản thử nghiệm",
                            "created_at": row[11].isoformat() if hasattr(row[11], "isoformat") else str(row[11]),
                            "answers": row[9] if isinstance(row[9], dict) else json.loads(row[9] or "{}"),
                        }
            except Exception as exc:
                logger.warning("DB query latest assessment failed: %s", exc)

        for a in _MEM_ASSESSMENTS:
            if user_id and a.get("user_id") == user_id:
                return a
            if guest_identifier and a.get("guest_identifier") == guest_identifier:
                return a
        if _MEM_ASSESSMENTS:
            return _MEM_ASSESSMENTS[0]
        return None

    def list_admin_assessments(
        self,
        page: int = 1,
        limit: int = 20,
        persona_code: str | None = None,
        readiness_level: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Admin listing of submitted assessments."""
        assessments = list(_MEM_ASSESSMENTS)
        if persona_code:
            assessments = [a for a in assessments if a.get("persona_code") == persona_code]
        if readiness_level:
            assessments = [a for a in assessments if a.get("readiness_level") == readiness_level]

        total = len(assessments)
        start = (page - 1) * limit
        end = start + limit
        paged = assessments[start:end]

        summary_items: list[dict[str, Any]] = []
        for item in paged:
            summary_items.append({
                "id": item["id"],
                "user_id": item.get("user_id"),
                "guest_identifier": item.get("guest_identifier"),
                "persona_code": item.get("persona_code", "dca_accumulator"),
                "persona_title": item.get("persona_title") or (item.get("persona", {}).get("title", "")),
                "risk_score": float(item.get("risk_score", 50)),
                "knowledge_score": float(item.get("knowledge_score", 50)),
                "discipline_score": float(item.get("discipline_score", 50)),
                "readiness_score": float(item.get("overall_readiness_score", 50)),
                "readiness_level": item.get("readiness_level", "needs_training"),
                "readiness_label": item.get("readiness_label", "Cần Rèn luyện Thêm"),
                "can_trade_real_money": bool(item.get("can_trade_real_money", False)),
                "created_at": str(item.get("created_at", "")),
            })
        return summary_items, total

    def get_admin_stats(self) -> dict[str, Any]:
        """Aggregate statistical distribution of tested users."""
        assessments = list(_MEM_ASSESSMENTS)
        total = len(assessments)
        if total == 0:
            return {
                "total_assessments": 0,
                "average_readiness_score": 0.0,
                "ready_percentage": 0.0,
                "top_persona_code": "dca_accumulator",
                "top_persona_title": "Nhà đầu tư Tích sản Dài hạn (DCA)",
                "persona_distribution": {
                    "dca_accumulator": 0,
                    "value_growth": 0,
                    "active_swing": 0,
                    "conservative_fund": 0,
                },
            }

        avg_score = round(sum(float(a.get("overall_readiness_score", 0)) for a in assessments) / total, 1)
        ready_count = sum(1 for a in assessments if a.get("can_trade_real_money"))
        ready_pct = round((ready_count / total) * 100, 1)

        distribution: dict[str, int] = {
            "dca_accumulator": 0,
            "value_growth": 0,
            "active_swing": 0,
            "conservative_fund": 0,
        }
        for a in assessments:
            code = a.get("persona_code")
            if code in distribution:
                distribution[code] += 1

        top_code = max(distribution.items(), key=lambda x: x[1])[0]
        persona = self.get_persona(top_code)
        top_title = persona["title"] if persona else "Nhà đầu tư Tích sản Dài hạn (DCA)"

        return {
            "total_assessments": total,
            "average_readiness_score": avg_score,
            "ready_percentage": ready_pct,
            "top_persona_code": top_code,
            "top_persona_title": top_title,
            "persona_distribution": distribution,
        }


_assessment_repo: SqlAssessmentRepository | None = None


def get_assessment_repository() -> SqlAssessmentRepository:
    """Dependency provider for assessment repository."""
    global _assessment_repo
    if _assessment_repo is None:
        try:
            from app.infrastructure.db.session import get_pool
            pool = get_pool()
        except Exception:
            pool = None
        _assessment_repo = SqlAssessmentRepository(pool=pool)
    return _assessment_repo
