"""Repository for stock basics learning topics, quizzes, and admin management."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg_pool import ConnectionPool

logger = logging.getLogger(__name__)

# Default in-memory curated lessons (mirroring 0022_learning_platform.sql)
_DEFAULT_CURATED_TOPICS: list[dict[str, Any]] = [
    {
        "id": "11111111-1111-1111-1111-111111111101",
        "slug": "stock-basics-saving-vs-investing",
        "level": "beginner",
        "stage": 1,
        "sort_order": 1,
        "title": "Bản chất Cổ phiếu & Phân biệt Tiết kiệm vs Đầu tư",
        "eyebrow": "BÀI 1 · NỀN TẢNG",
        "summary": "Hiểu rõ cổ phiếu là gì, quyền lợi của cổ đông và phân biệt rạch ròi giữa tiền gửi tiết kiệm và vốn đầu tư chịu biến động.",
        "estimated_minutes": 5,
        "theory_content": """### 1. Cổ phiếu là gì?
Cổ phiếu là chứng chỉ chứng nhận quyền sở hữu một phần vốn của công ty cổ phần. Khi bạn sở hữu dù chỉ 1 cổ phiếu của FPT hay Hòa Phát (HPG), bạn chính thức trở thành **cổ đông** của tập đoàn đó.

Quyền lợi của cổ đông bao gồm:
- **Hưởng cổ tức:** Nhận một phần lợi nhuận sau thuế của doanh nghiệp bằng tiền mặt hoặc cổ phiếu.
- **Tăng trưởng vốn:** Hưởng lợi từ việc giá cổ phiếu tăng lên theo thời gian khi doanh nghiệp ăn nên làm ra.
- **Quyền biểu quyết:** Tham gia biểu quyết các quyết sách trọng đại tại Đại hội đồng Cổ đông thường niên.

### 2. Tiết kiệm vs Đầu tư: Khác biệt cốt lõi
- **Tiết kiệm (Ngân hàng):** Ưu tiên hàng đầu là bảo toàn vốn và tính thanh khoản nhanh. Lãi suất cố định (thường 4% - 6%/năm), rất an toàn nhưng trong dài hạn dễ bị lạm phát làm hao mòn sức mua.
- **Đầu tư (Cổ phiếu):** Chấp nhận biến động giá trong ngắn hạn để đổi lấy tiềm năng sinh lời vượt trội (12% - 20%/năm hoặc hơn trong chu kỳ tăng trưởng). Tuy nhiên, lợi nhuận không được bảo đảm và bạn có thể chịu thua lỗ nếu chọn sai doanh nghiệp hoặc bán tháo trong hoảng loạn.

### 3. Nguyên tắc vàng về dòng tiền
Tuyệt đối không dùng tiền cho các nghĩa vụ tài chính ngắn hạn (học phí, tiền thuê nhà 3-6 tháng tới, quỹ khẩn cấp) để đầu tư cổ phiếu. Chỉ đầu tư bằng phần vốn nhàn rỗi có thời gian chờ đợi từ 1 đến 3 năm trở lên.""",
        "practical_example": {
            "title": "Khoản tích lũy 100 triệu của anh Nam",
            "ticker": "HPG",
            "scenario": "Anh Nam vừa tiết kiệm được 100 triệu đồng. Trong đó, 40 triệu chắc chắn cần thanh toán học phí đại học sau 3 tháng nữa, và 60 triệu còn lại là tiền nhàn rỗi dự kiến tích lũy dài hạn.",
            "analysis": "Nếu anh Nam mang toàn bộ 100 triệu đi mua cổ phiếu lướt sóng, rủi ro gặp phải nhịp điều chỉnh giảm 10-15% đúng lúc đến hạn đóng học phí sẽ buộc anh Nam phải cắt lỗ bán đáy trong cay đắng. Quyết định đúng đắn là gửi 40 triệu vào sổ tiết kiệm kỳ hạn ngắn để bảo toàn nguyên vẹn dòng tiền, và dùng 60 triệu nhàn rỗi giải ngân từng phần vào các cổ phiếu đầu ngành như HPG hoặc VCB.",
            "key_takeaway": "Mục tiêu tài chính và thời hạn cần tiền luôn phải đi trước việc chọn mã cổ phiếu."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Khoản tiền bạn chắc chắn cần dùng để trả tiền thuê nhà sau 2 tháng nên được giữ ở đâu?",
                "options": [
                    {"id": "opt1", "label": "Mua mã cổ phiếu đang tăng trần nóng nhất sàn", "correct": False, "feedback": "Chưa đúng. Đà tăng ngắn hạn không xóa bỏ rủi ro giá giảm đúng lúc bạn cần rút tiền."},
                    {"id": "opt2", "label": "Gửi tài khoản tiết kiệm kỳ hạn ngắn hoặc tài khoản thanh toán", "correct": True, "feedback": "Chính xác! Nghĩa vụ ngắn hạn bắt buộc phải ưu tiên tính an toàn và khả năng rút tiền đúng hạn."},
                    {"id": "opt3", "label": "Mua cổ phiếu ngân hàng vì ngân hàng luôn an toàn", "correct": False, "feedback": "Chưa đúng. Dù là ngân hàng thì cổ phiếu vẫn biến động theo thị trường và có thể giảm giá."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Khi bạn mua và sở hữu 1.000 cổ phiếu của Tập đoàn FPT, điều đó có ý nghĩa gì?",
                "options": [
                    {"id": "opt1", "label": "Bạn là chủ nợ của FPT và công ty có nghĩa vụ trả lãi cố định cho bạn", "correct": False, "feedback": "Chưa đúng. Chủ nợ là người sở hữu trái phiếu, không phải cổ phiếu."},
                    {"id": "opt2", "label": "Bạn là cổ đông sở hữu một phần vốn và có quyền hưởng lợi từ sự phát triển của FPT", "correct": True, "feedback": "Chính xác! Cổ phiếu xác nhận quyền sở hữu một phần doanh nghiệp của cổ đông."},
                    {"id": "opt3", "label": "FPT cam kết hoàn lại 100% số tiền mua sau 1 năm", "correct": False, "feedback": "Chưa đúng. Cổ phiếu không có cam kết hoàn vốn từ phía doanh nghiệp."}
                ]
            }
        ],
        "glossary": [
            {"term": "Cổ đông (Shareholder)", "definition": "Cá nhân hoặc tổ chức sở hữu ít nhất một cổ phần của công ty cổ phần."},
            {"term": "Cổ tức (Dividend)", "definition": "Phần lợi nhuận sau thuế được chia cho các cổ đông bằng tiền mặt hoặc cổ phiếu bổ sung."},
            {"term": "Quỹ khẩn cấp (Emergency Fund)", "definition": "Khoản dự phòng tương đương 3-6 tháng chi phí sinh hoạt thiết yếu để phòng ngừa biến cố."}
        ],
        "practice_action": {
            "href": "/portfolio",
            "label": "Xem danh mục mô phỏng",
            "description": "Quan sát cách InvestIQ tách tiền mô phỏng, vị thế và lãi/lỗ mà không sử dụng tiền thật."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111102",
        "slug": "stock-exchanges-and-trading-sessions",
        "level": "beginner",
        "stage": 1,
        "sort_order": 2,
        "title": "Các sàn giao dịch (HOSE, HNX, UPCoM) & Các phiên khớp lệnh",
        "eyebrow": "BÀI 2 · VẬN HÀNH",
        "summary": "Phân biệt ba sàn giao dịch chứng khoán tại Việt Nam, quy định biên độ dao động giá và cách vận hành của các phiên ATO, Khớp lệnh liên tục và ATC.",
        "estimated_minutes": 7,
        "theory_content": """### 1. Ba sàn giao dịch chứng khoán tại Việt Nam
- **Sàn HOSE (Sở GDCK TP.HCM):** Sàn giao dịch lớn nhất và uy tín nhất, quy tụ các doanh nghiệp vốn hóa lớn và đầu ngành (nhóm VN30). Biên độ dao động tối đa trong ngày là **+/-7%**.
- **Sàn HNX (Sở GDCK Hà Nội):** Sàn dành cho các doanh nghiệp quy mô vừa. Biên độ dao động tối đa là **+/-10%**.
- **Sàn UPCoM (Sàn giao dịch của công ty đại chúng chưa niêm yết):** Điều kiện đăng ký giao dịch linh hoạt hơn. Biên độ dao động tối đa lên tới **+/-15%** (phiên đầu tiên chào sàn có thể lên tới +/-40%).

### 2. Các phiên giao dịch trong ngày trên sàn HOSE
Một ngày giao dịch từ Thứ Hai đến Thứ Sáu (trừ ngày nghỉ lễ) được chia làm các giai đoạn:
1. **09:00 - 09:15 (Phiên ATO - Khớp lệnh định kỳ mở cửa):**
   - Dùng để xác định giá mở cửa của ngày hôm đó.
   - Lệnh ATO được ưu tiên khớp trước lệnh giới hạn (LO).
   - **Lưu ý đặc biệt:** Không được phép sửa hoặc hủy lệnh trong 15 phút này.
2. **09:15 - 11:30 & 13:00 - 14:30 (Phiên Khớp lệnh liên tục):**
   - Các lệnh mua bán được đối ứng và khớp ngay tức thì theo nguyên tắc: Ưu tiên về Giá -> Ưu tiên về Thời gian.
   - Được phép sửa hoặc hủy các lệnh chưa khớp.
3. **14:30 - 14:45 (Phiên ATC - Khớp lệnh định kỳ đóng cửa):**
   - Dùng để xác định giá đóng cửa chính thức của ngày giao dịch.
   - Tương tự ATO, lệnh ATC được ưu tiên khớp trước và không được phép sửa/hủy.""",
        "practical_example": {
            "title": "Biến động ATC trong ngày cơ cấu quỹ ETF tại mã VCB",
            "ticker": "VCB",
            "scenario": "Trong suốt phiên khớp lệnh liên tục, VCB giao dịch ổn định quanh mốc 90.000đ. Vào 14:30 đến 14:45 (phiên ATC), các quỹ ngoại tiến hành cơ cấu danh mục và đặt lệnh mua ATC lên tới hàng triệu cổ phiếu.",
            "analysis": "Do lệnh ATC có độ ưu tiên cao nhất và dồn dập quét hết toàn bộ các mức giá bán, giá đóng cửa của VCB vọt lên 92.500đ ngay khi kết thúc 14:45. Nhà đầu tư thiếu kinh nghiệm thường bất ngờ khi thấy thị giá thay đổi đột ngột sau phiên ATC.",
            "key_takeaway": "Giá đóng cửa (ATC) là mức giá chuẩn xác nhất xác định giá tham chiếu cho phiên kế tiếp."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Cổ phiếu niêm yết trên sàn HOSE có giá tham chiếu hôm nay là 40.000đ. Giá trần (giá tối đa) hôm nay là bao nhiêu?",
                "options": [
                    {"id": "opt1", "label": "44.000đ (Biên độ 10%)", "correct": False, "feedback": "Chưa đúng. 10% là biên độ của sàn HNX, không phải sàn HOSE."},
                    {"id": "opt2", "label": "42.800đ (Biên độ 7%: 40.000 x 1.07)", "correct": True, "feedback": "Chính xác! Biên độ sàn HOSE là 7%, giá trần làm tròn theo bước giá là 42.800đ."},
                    {"id": "opt3", "label": "46.000đ (Biên độ 15%)", "correct": False, "feedback": "Chưa đúng. 15% là biên độ sàn UPCoM."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Trong phiên khớp lệnh định kỳ ATO (09:00 - 09:15) trên sàn HOSE, bạn có được quyền sửa hoặc hủy lệnh không?",
                "options": [
                    {"id": "opt1", "label": "Được phép sửa hoặc hủy nếu lệnh chưa khớp", "correct": False, "feedback": "Chưa đúng. Quy chế sàn nghiêm cấm sửa/hủy lệnh trong phiên khớp lệnh định kỳ."},
                    {"id": "opt2", "label": "Tuyệt đối không được phép sửa hoặc hủy lệnh trong phiên định kỳ ATO/ATC", "correct": True, "feedback": "Chính xác! Lệnh đặt vào ATO/ATC phải chờ sau khi phiên khớp xong mới biết kết quả."}
                ]
            }
        ],
        "glossary": [
            {"term": "Lệnh ATO (At The Open)", "definition": "Lệnh mua/bán tại mức giá mở cửa, không ghi mức giá cụ thể và ưu tiên khớp trước lệnh LO."},
            {"term": "Lệnh ATC (At The Close)", "definition": "Lệnh mua/bán tại mức giá đóng cửa phiên giao dịch."},
            {"term": "Lệnh LO (Limit Order)", "definition": "Lệnh giới hạn, cho phép người mua/bán xác định mức giá cụ thể mong muốn."}
        ],
        "practice_action": {
            "href": "/market/indices?symbol=VNINDEX",
            "label": "Mở biểu đồ VN-Index",
            "description": "Quan sát diễn biến phiên khớp lệnh của chỉ số toàn thị trường."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111103",
        "slug": "how-to-read-stock-board-and-colors",
        "level": "beginner",
        "stage": 1,
        "sort_order": 3,
        "title": "Cách đọc Bảng điện tử & Giải mã 5 màu sắc kinh điển",
        "eyebrow": "BÀI 3 · GIAO DIỆN",
        "summary": "Nắm vững cách đọc bảng giá chứng khoán, ý nghĩa các cột Dư mua, Dư bán, Khớp lệnh và giải mã nhanh ngôn ngữ 5 màu sắc.",
        "estimated_minutes": 6,
        "theory_content": """### 1. Năm màu sắc cốt lõi trên bảng điện tử Việt Nam
Bảng điện tử chứng khoán Việt Nam sử dụng 5 màu sắc quy ước trực quan:
- **Màu Vàng (Giá tham chiếu):** Mức giá đóng cửa của phiên gần nhất (hoặc giá bình quân phiên trước đối với UPCoM). Đây là mốc chuẩn để tính tỷ lệ tăng giảm trong ngày.
- **Màu Xanh lá (Tăng giá):** Thị giá hiện tại cao hơn giá tham chiếu.
- **Màu Đỏ (Giảm giá):** Thị giá hiện tại thấp hơn giá tham chiếu.
- **Màu Tím (Giá trần):** Mức giá kịch trần cao nhất được phép giao dịch trong ngày (+7% trên HOSE, +10% trên HNX, +15% trên UPCoM).
- **Màu Xanh lơ (Giá sàn):** Mức giá kịch sàn thấp nhất trong ngày (-7% trên HOSE, -10% trên HNX, -15% trên UPCoM).

### 2. Cấu trúc 3 khu vực chính của bảng giá
1. **Khu vực Bên Mua (Bên trái):** Hiển thị 3 mức giá đặt mua tốt nhất (Giá 1 cao nhất, sau đó đến Giá 2, Giá 3) kèm khối lượng đang chờ khớp tương ứng.
2. **Khu vực Khớp lệnh (Ở giữa):** Hiển thị mức giá vừa được khớp thành công gần nhất, khối lượng khớp tức thời và tỷ lệ tăng/giảm so với tham chiếu.
3. **Khu vực Bên Bán (Bên phải):** Hiển thị 3 mức giá đặt bán tốt nhất (Giá 1 thấp nhất, sau đó đến Giá 2, Giá 3) kèm khối lượng đang chờ bán.""",
        "practical_example": {
            "title": "Đọc bảng giá cổ phiếu SSI trong phiên sáng",
            "ticker": "SSI",
            "scenario": "Cổ phiếu SSI có giá tham chiếu vàng 32.000đ. Bên mua đang chờ sẵn 500.000 cp tại Giá 1 là 32.400đ (xanh). Bên bán đang treo bán 200.000 cp tại Giá 1 là 32.450đ. Cột khớp lệnh nhảy liên tục mức giá 32.450đ với khối lượng hàng trăm nghìn đơn vị.",
            "analysis": "Điều này cho thấy phe mua đang chiếm ưu thế vượt trội, sẵn sàng mua thẳng vào giá bên bán đang treo thay vì kiên nhẫn xếp hàng chờ ở giá thấp. Áp lực mua này nhanh chóng đẩy giá SSI tiếp tục đi lên.",
            "key_takeaway": "Quan sát tương quan khối lượng Dư mua và Dư bán giúp bạn cảm nhận sức mạnh cung cầu trong phiên."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Màu sắc nào trên bảng điện tử cho biết cổ phiếu đang giảm giá so với tham chiếu nhưng chưa chạm mức kịch sàn?",
                "options": [
                    {"id": "opt1", "label": "Màu Đỏ", "correct": True, "feedback": "Chính xác! Màu Đỏ thể hiện mức giá đang giảm so với giá tham chiếu vàng."},
                    {"id": "opt2", "label": "Màu Xanh lơ", "correct": False, "feedback": "Chưa đúng. Màu xanh lơ là giá kịch sàn (giảm hết biên độ)."},
                    {"id": "opt3", "label": "Màu Vàng", "correct": False, "feedback": "Chưa đúng. Màu vàng là giá tham chiếu bằng phiên trước."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Cột \"Khớp lệnh\" ở chính giữa bảng giá thể hiện điều gì?",
                "options": [
                    {"id": "opt1", "label": "Mức giá và khối lượng thực tế vừa được giao dịch thành công giữa người mua và người bán", "correct": True, "feedback": "Chính xác! Đây là giao dịch đã diễn ra trong thực tế."},
                    {"id": "opt2", "label": "Số lượng cổ phiếu người mua đang xếp hàng chờ", "correct": False, "feedback": "Chưa đúng. Đó là thông tin bên cột Dư mua."}
                ]
            }
        ],
        "glossary": [
            {"term": "Giá tham chiếu", "definition": "Mức giá cơ sở dùng để tính toán biên độ giá trần và giá sàn của ngày giao dịch."},
            {"term": "Bên Dư mua", "definition": "Danh sách các lệnh đặt mua đang chờ khớp được xếp theo thứ tự giá từ cao xuống thấp."},
            {"term": "Bên Dư bán", "definition": "Danh sách các lệnh đặt bán đang chờ khớp được xếp theo thứ tự giá từ thấp lên cao."}
        ],
        "practice_action": {
            "href": "/market/stocks",
            "label": "Mở Bảng giá cổ phiếu",
            "description": "Quan sát bảng giá trực tiếp của rổ VN30 trên InvestIQ."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111104",
        "slug": "reading-japanese-candlesticks-and-volume",
        "level": "intermediate",
        "stage": 2,
        "sort_order": 4,
        "title": "Đọc biểu đồ Nến Nhật (Candlestick) & Khối lượng (Volume)",
        "eyebrow": "BÀI 4 · DỮ LIỆU GIÁ",
        "summary": "Phân tích cấu tạo nến Nhật (OHLC), râu nến và cách kết hợp với khối lượng giao dịch để nhận diện hành vi của dòng tiền lớn.",
        "estimated_minutes": 8,
        "theory_content": """### 1. Cấu tạo của một cây nến Nhật
Mỗi cây nến đại diện cho diễn biến giá trong một khung thời gian (1 ngày, 1 giờ, 15 phút) và bao gồm 4 mức giá (**OHLC**):
- **O (Open):** Giá mở cửa.
- **H (High):** Mức giá cao nhất đạt được trong phiên.
- **L (Low):** Mức giá thấp nhất chạm tới trong phiên.
- **C (Close):** Giá đóng cửa chính thức.

- **Thân nến (Body):** Khoảng cách giữa giá mở cửa và đóng cửa.
  + Nếu Close > Open: Thân nến **Xanh** (Phe mua thắng thế).
  + Nếu Close < Open: Thân nến **Đỏ** (Phe bán áp đảo).
- **Bóng nến / Râu nến (Shadow/Wick):** Phần đuôi nhô ra ngoài thân nến.
  + Râu trên dài: Giá từng tăng cao nhưng bị phe bán xả xuống quyết liệt.
  + Râu dưới dài: Giá từng giảm sâu nhưng có lực cầu bắt đáy mạnh mẽ đẩy giá hồi phục.

### 2. Sức mạnh của Khối lượng (Volume)
"Giá thể hiện kỳ vọng, khối lượng xác nhận xu hướng".
- **Giá tăng mạnh kèm Khối lượng đột biến (vượt 1.5 - 2 lần MA20):** Tín hiệu dòng tiền tổ chức (Smart Money) tham gia mua gom quyết liệt. Khả năng cao xu hướng tăng sẽ tiếp diễn.
- **Giá tăng nhưng Khối lượng lèo tèo:** Cảnh báo dòng tiền yếu, dễ gặp bẫy tăng giá giả (Bull-trap).""",
        "practical_example": {
            "title": "Cây nến Rút chân tại mã HPG quanh vùng hỗ trợ",
            "ticker": "HPG",
            "scenario": "Trong phiên thị trường chung hoảng loạn, HPG bị bán tháo về mức giá sàn 25.000đ. Tuy nhiên đến đầu phiên chiều, dòng tiền lớn nhập cuộc với khối lượng khớp hơn 60 triệu cổ phiếu, đẩy giá đóng cửa vọt lên 27.200đ.",
            "analysis": "Cây nến ngày hôm đó kết thúc với một bóng nến dưới (râu dưới) cực dài và khối lượng cao kỷ lục. Đây là mô hình nến Rút chân (Hammer) kinh điển, báo hiệu lực cầu hấp thụ hết lượng hàng bán tháo và đánh dấu đáy ngắn hạn của cổ phiếu.",
            "key_takeaway": "Râu nến dưới dài kết hợp với thanh khoản lớn là tín hiệu từ chối giảm giá rất đáng tin cậy."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Một cây nến ngày có râu dưới rất dài và thân nến nhỏ đóng cửa sát mức giá cao nhất phản ánh điều gì?",
                "options": [
                    {"id": "opt1", "label": "Phe bán đẩy giá giảm sâu nhưng phe mua đã nhập cuộc bắt đáy mạnh mẽ đẩy giá hồi phục", "correct": True, "feedback": "Chính xác! Râu nến dưới thể hiện sự từ chối giảm giá và phe mua đã lật ngược thế cờ."},
                    {"id": "opt2", "label": "Phe bán hoàn toàn áp đảo và cổ phiếu sẽ tiếp tục giảm sàn", "correct": False, "feedback": "Chưa đúng. Nếu phe bán áp đảo thì giá sẽ đóng cửa ở mức thấp nhất, không có râu dưới dài."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Khi cổ phiếu bứt phá vượt qua đỉnh cũ (Breakout), yếu tố nào xác nhận phiên bứt phá có độ tin cậy cao?",
                "options": [
                    {"id": "opt1", "label": "Khối lượng giao dịch (Volume) tăng vọt đột biến so với mức trung bình 20 phiên", "correct": True, "feedback": "Chính xác! Volume lớn chứng tỏ có dòng tiền lớn bảo trợ cho đà bứt phá."},
                    {"id": "opt2", "label": "Khối lượng giao dịch càng thấp càng tốt", "correct": False, "feedback": "Chưa đúng. Khối lượng thấp khi vượt đỉnh rất dễ là bẫy tăng giá Bull-trap."}
                ]
            }
        ],
        "glossary": [
            {"term": "OHLC", "definition": "Viết tắt của 4 mức giá quan trọng: Open (Mở), High (Cao nhất), Low (Thấp nhất), Close (Đóng)."},
            {"term": "Nến rút chân (Hammer)", "definition": "Mô hình nến có râu dưới dài ít nhất gấp đôi thân nến, báo hiệu đảo chiều tăng giá."},
            {"term": "Volume (Khối lượng)", "definition": "Tổng số lượng cổ phiếu được chuyển nhượng thành công trong phiên."}
        ],
        "practice_action": {
            "href": "/market/stocks/HPG",
            "label": "Mở biểu đồ nến HPG",
            "description": "Thực hành soi nến và khối lượng trên biểu đồ kỹ thuật tương tác."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111105",
        "slug": "financial-metrics-pe-pb-roe",
        "level": "intermediate",
        "stage": 2,
        "sort_order": 5,
        "title": "Định giá cổ phiếu qua chỉ số P/E, P/B và Hiệu quả ROE",
        "eyebrow": "BÀI 5 · BÁO CÁO TÀI CHÍNH",
        "summary": "Hiểu bản chất các chỉ số định giá P/E, P/B và thước đo hiệu quả sử dụng vốn ROE để sàng lọc doanh nghiệp tốt với mức giá hợp lý.",
        "estimated_minutes": 9,
        "theory_content": """### 1. Chỉ số P/E (Price to Earnings Ratio)
- **Công thức:** `P/E = Thị giá cổ phiếu / Lợi nhuận trên mỗi cổ phần (EPS)`.
- **Ý nghĩa:** Bạn sẵn sàng trả bao nhiêu đồng cho 1 đồng lợi nhuận mà doanh nghiệp kiếm được.
- Ví dụ P/E = 10 lần: Giả sử lợi nhuận giữ nguyên, mất 10 năm công ty sẽ kiếm đủ số tiền bằng thị giá bạn mua.
- **Lưu ý:** P/E thấp chưa chắc đã rẻ; P/E cao chưa chắc đã đắt (nếu doanh nghiệp tăng trưởng 30-40%/năm như công nghệ FPT).

### 2. Chỉ số P/B (Price to Book Value)
- **Công thức:** `P/B = Thị giá cổ phiếu / Giá trị sổ sách mỗi cổ phần (BVPS)`.
- **Ý nghĩa:** So sánh thị giá với giá trị tài sản ròng sau khi trừ đi toàn bộ nợ phải trả.
- Rất phù hợp định giá Ngân hàng, Bất động sản và Chứng khoán. P/B < 1 có nghĩa cổ phiếu đang giao dịch thấp hơn giá trị thanh lý sổ sách.

### 3. Thước đo ROE (Return on Equity)
- **Công thức:** `ROE = Lợi nhuận sau thuế / Vốn chủ sở hữu`.
- **Ý nghĩa:** Đo lường 100 đồng vốn cổ đông tạo ra bao nhiêu đồng lãi ròng mỗi năm.
- Warren Buffett ưu tiên các doanh nghiệp có ROE duy trì liên tục trên 15% - 20% nhiều năm liên tiếp, phản ánh lợi thế cạnh tranh bền vững.""",
        "practical_example": {
            "title": "So sánh P/E và ROE giữa FPT và nhóm sản xuất chu kỳ",
            "ticker": "FPT",
            "scenario": "Cổ phiếu FPT thường xuyên giao dịch ở mức P/E 18 - 22 lần, cao hơn nhiều so với P/E trung bình thị trường (12-14 lần). Tuy nhiên, ROE của FPT duy trì đều đặn ở mức 25% - 28% suốt hơn 5 năm qua.",
            "analysis": "Thị trường sẵn sàng trả P/E cao cho FPT vì doanh nghiệp có biên lợi nhuận cao, dòng tiền khỏe và tốc độ tăng trưởng lợi nhuận 20%/năm bền bỉ từ thị trường phần mềm toàn cầu. Định giá P/E phải luôn đặt cạnh tiềm năng tăng trưởng (PEG) và hiệu quả ROE.",
            "key_takeaway": "Thà mua một doanh nghiệp tuyệt vời với mức giá hợp lý còn hơn mua một doanh nghiệp tầm thường với giá rẻ."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Chỉ số ROE = 25% của một doanh nghiệp niêm yết cho bạn biết điều gì?",
                "options": [
                    {"id": "opt1", "label": "Cứ 100 đồng vốn chủ sở hữu, ban lãnh đạo tạo ra được 25 đồng lợi nhuận sau thuế", "correct": True, "feedback": "Chính xác! ROE đo lường hiệu quả sinh lời trên đồng vốn của cổ đông."},
                    {"id": "opt2", "label": "Doanh nghiệp có nợ vay bằng 25% tổng tài sản", "correct": False, "feedback": "Chưa đúng. Đó là tỷ lệ đòn bẩy tài chính, không phải ROE."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Khi định giá cổ phiếu của một ngân hàng thương mại, chỉ số nào thường được giới chuyên môn ưu tiên xem xét?",
                "options": [
                    {"id": "opt1", "label": "P/B (Price to Book Value) kết hợp tỷ lệ nợ xấu và ROE", "correct": True, "feedback": "Chính xác! Tài sản ngân hàng chủ yếu là tiền gửi và cho vay nên P/B phản ánh sát giá trị thực."},
                    {"id": "opt2", "label": "P/S (Price to Sales)", "correct": False, "feedback": "Chưa đúng. Ngân hàng không có doanh thu bán hàng thông thường như bán lẻ."}
                ]
            }
        ],
        "glossary": [
            {"term": "EPS (Earnings Per Share)", "definition": "Lợi nhuận ròng sau thuế tính trên một cổ phiếu đang lưu hành."},
            {"term": "P/E", "definition": "Hệ số giá trên lợi nhuận một cổ phiếu, đo mức định giá thị trường."},
            {"term": "ROE", "definition": "Tỷ suất sinh lời trên vốn chủ sở hữu, đo hiệu quả sử dụng vốn của ban lãnh đạo."}
        ],
        "practice_action": {
            "href": "/market/stocks/FPT?tab=financials",
            "label": "Xem BCTC cổ phiếu FPT",
            "description": "Kiểm tra thực tế các chỉ số P/E, ROE và Biên lợi nhuận của FPT."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111106",
        "slug": "dividends-and-ex-rights-date",
        "level": "intermediate",
        "stage": 2,
        "sort_order": 6,
        "title": "Cổ tức tiền mặt vs Cổ phiếu & Ngày giao dịch không hưởng quyền",
        "eyebrow": "BÀI 6 · QUYỀN LỢI",
        "summary": "Bản chất ngày GDKHQ, nguyên tắc điều chỉnh giá cổ phiếu và cách phân biệt cổ tức tiền mặt với phát hành cổ phiếu thưởng.",
        "estimated_minutes": 7,
        "theory_content": """### 1. Phân biệt các hình thức trả cổ tức
- **Cổ tức tiền mặt:** Tiền được chuyển thẳng vào tài khoản chứng khoán của bạn. Tỷ lệ % luôn tính trên mệnh giá pháp định 10.000đ (ví dụ: 15% cổ tức tiền mặt = 1.500đ/cp). Cổ tức tiền mặt bị trừ 5% thuế TNCN khi nhận.
- **Cổ tức bằng cổ phiếu / Thưởng cổ phiếu:** Doanh nghiệp giữ lại tiền mặt để tái đầu tư mở rộng sản xuất và phát hành thêm cổ phiếu chia cho cổ đông theo tỷ lệ.

### 2. Ngày giao dịch không hưởng quyền (GDKHQ) là gì?
- **Quy tắc:** Là ngày mà người mua cổ phiếu vào ngày này (hoặc các ngày sau đó) sẽ **KHÔNG** được quyền nhận cổ tức của đợt chia đó.
- Nếu bạn muốn nhận cổ tức: Bạn bắt buộc phải mua và nắm giữ cổ phiếu từ ngày **T-1 (ngày liền trước ngày GDKHQ)** trở về trước.
- **Nguyên tắc điều chỉnh giá:** Vào sáng ngày GDKHQ, giá tham chiếu của cổ phiếu sẽ bị trừ đi số tiền cổ tức tương ứng để bảo đảm tổng tài sản của nhà đầu tư không thay đổi tại thời điểm chốt quyền.""",
        "practical_example": {
            "title": "Cổ phiếu Vinamilk (VNM) chốt quyền trả cổ tức 2.000đ",
            "ticker": "VNM",
            "scenario": "VNM thông báo ngày 20/10 là ngày GDKHQ nhận cổ tức tiền mặt 2.000đ/cp. Ngày 19/10, giá đóng cửa của VNM là 72.000đ.",
            "analysis": "Đầu phiên sáng ngày 20/10 (ngày GDKHQ), hệ thống tự động điều chỉnh giá tham chiếu của VNM về 70.000đ (72.000 - 2.000). Nếu bạn mua vào ngày 20/10, bạn mua với giá 70.000đ và không nhận được 2.000đ cổ tức. Nếu bạn nắm giữ từ ngày 19/10, bạn có 1 cổ phiếu giá 70.000đ cộng quyền nhận 2.000đ tiền mặt vào tài khoản sau đó.",
            "key_takeaway": "Nhận cổ tức không làm tài sản của bạn tăng gấp đôi sau một đêm, mà là sự phân phối dòng tiền thực từ lợi nhuận doanh nghiệp."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Ngày GDKHQ của cổ phiếu MWG là Thứ Năm ngày 15/10. Bạn mua cổ phiếu MWG vào Thứ Năm 15/10 thì có được nhận cổ tức không?",
                "options": [
                    {"id": "opt1", "label": "Không được nhận cổ tức đợt này", "correct": True, "feedback": "Chính xác! Mua đúng hoặc sau ngày GDKHQ thì quyền hưởng cổ tức thuộc về người bán trước đó."},
                    {"id": "opt2", "label": "Vẫn được nhận cổ tức đầy đủ", "correct": False, "feedback": "Chưa đúng. Bạn phải mua chậm nhất vào Thứ Tư 14/10 mới có quyền nhận."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Doanh nghiệp công bố trả cổ tức tiền mặt tỷ lệ 20%. Bạn sở hữu 1.000 cổ phiếu thì số tiền cổ tức nhận được (trước thuế) là bao nhiêu?",
                "options": [
                    {"id": "opt1", "label": "2.000.000 đồng (1.000 cp x 10.000đ x 20%)", "correct": True, "feedback": "Chính xác! Tỷ lệ cổ tức luôn tính theo mệnh giá quy định 10.000đ, tức 2.000đ/cp."},
                    {"id": "opt2", "label": "20% tính trên thị giá đang giao dịch trên sàn", "correct": False, "feedback": "Chưa đúng. Cổ tức không tính trên thị giá thị trường."}
                ]
            }
        ],
        "glossary": [
            {"term": "Ngày GDKHQ", "definition": "Ngày giao dịch mà người mua chứng khoán sẽ không được hưởng các quyền lợi liên quan kèm theo."},
            {"term": "Ngày đăng ký cuối cùng", "definition": "Ngày Trung tâm Lưu ký chốt danh sách cổ đông sở hữu chứng khoán thực tế."},
            {"term": "Mệnh giá cổ phiếu", "definition": "Giá trị pháp định của một cổ phiếu, theo luật Chứng khoán Việt Nam là 10.000 VNĐ."}
        ],
        "practice_action": {
            "href": "/market/events",
            "label": "Xem Lịch sự kiện & Cổ tức",
            "description": "Theo dõi các đợt chia cổ tức sắp diễn ra trên sàn chứng khoán."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111107",
        "slug": "stop-loss-discipline-and-position-sizing",
        "level": "advanced",
        "stage": 3,
        "sort_order": 7,
        "title": "Kỷ luật Cắt lỗ & Quản trị quy mô vị thế (Position Sizing)",
        "eyebrow": "BÀI 7 · QUẢN TRỊ RỦI RO",
        "summary": "Nguyên tắc cắt lỗ sống còn 7-8%, bảng toán học phục hồi vốn và phương pháp phân bổ tỷ trọng danh mục để sống sót qua mọi đợt downtrend.",
        "estimated_minutes": 10,
        "theory_content": """### 1. Bảng toán học phục hồi vốn: Sự thật khốc liệt
Lý do tại sao nhà đầu tư chuyên nghiệp luôn tôn sùng kỷ luật cắt lỗ:
- Lỗ **-5%** -> Cần lãi **+5.3%** để hòa vốn.
- Lỗ **-10%** -> Cần lãi **+11.1%** để hòa vốn.
- Lỗ **-20%** -> Cần lãi **+25%** để hòa vốn.
- Lỗ **-30%** -> Cần lãi **+42.9%** để hòa vốn.
- Lỗ **-50%** -> Cần lãi **+100% (nhân đôi số vốn còn lại)** mới về được mốc hòa vốn!

Khi bạn để một khoản lỗ trượt dài quá -20%, xác suất bạn tìm được một cơ hội khác tăng gấp đôi để bù lỗ là cực kỳ khó khăn.

### 2. Nguyên tắc cắt lỗ 7% - 8% của William O’Neil
- Khi giá cổ phiếu giảm chạm mức **-7%** so với giá mua: Cắt ngay 1/2 vị thế.
- Khi chạm mức **-8%**: Cắt sạch toàn bộ, tuyệt đối không chần chừ, không nuôi hy vọng hay viện lý do doanh nghiệp tốt để gồng lỗ lướt sóng.
- Cắt lỗ là **chi phí bảo hiểm bắt buộc** để giữ lại vốn cho những trận đánh lớn có xác suất thắng cao hơn.

### 3. Phân bổ tỷ trọng (Position Sizing)
- Danh mục tối ưu cho nhà đầu tư cá nhân: **3 đến 5 mã cổ phiếu** thuộc các nhóm ngành độc lập.
- Không để bất kỳ cổ phiếu đơn lẻ nào chiếm vượt quá **25% - 30%** tổng tài sản.
- Khi một mã gặp sự cố bất ngờ, mức tổn thất tối đa cũng chỉ ảnh hưởng 1-2% tổng danh mục của bạn.""",
        "practical_example": {
            "title": "Cắt lỗ dứt khoát cứu vãn tài khoản trong chu kỳ downtrend",
            "ticker": "NVL",
            "scenario": "Một nhà đầu tư mua cổ phiếu bất động sản với giá 80.000đ. Cổ phiếu thủng hỗ trợ về 74.000đ (-7.5%).",
            "analysis": "Nếu nhà đầu tư kỷ luật bấm nút cắt lỗ ở 74.000đ, mức thiệt hại chỉ là 7.5% vốn và bảo toàn được hơn 92% tiền mặt. Ngược lại, nếu cố chấp gồng lỗ và hy vọng, cổ phiếu sau đó lao dốc về 15.000đ (-81%), số tiền 1 tỷ ban đầu chỉ còn chưa đầy 190 triệu. Để 190 triệu quay về 1 tỷ đòi hỏi mức sinh lời hơn 400% - điều gần như không tưởng.",
            "key_takeaway": "Sai lầm lớn nhất của nhà đầu tư không phải là mua sai cổ phiếu, mà là từ chối cắt lỗ khi vị thế đã sai."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Nếu một khoản đầu tư bị giảm -50% giá trị, bạn cần đạt tỷ suất lợi nhuận bao nhiêu % trên số vốn còn lại để đưa tài khoản về mức hòa vốn ban đầu?",
                "options": [
                    {"id": "opt1", "label": "Cần lãi +100% (nhân đôi số tiền còn lại)", "correct": True, "feedback": "Chính xác! 100 triệu lỗ 50% còn 50 triệu; từ 50 triệu muốn về lại 100 triệu phải lãi 100%."},
                    {"id": "opt2", "label": "Chỉ cần lãi +50%", "correct": False, "feedback": "Chưa đúng. 50 triệu lãi 50% chỉ được 75 triệu, vẫn còn lỗ 25 triệu."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Khi một vị thế giao dịch ngắn hạn chạm ngưỡng lỗ -7% đến -8%, quyết định chuẩn mực theo quản trị rủi ro là gì?",
                "options": [
                    {"id": "opt1", "label": "Dứt khoát kích hoạt lệnh cắt lỗ để bảo vệ vốn", "correct": True, "feedback": "Chính xác! Cắt lỗ bảo vệ bạn khỏi các thảm họa sụt giảm sâu của thị trường."},
                    {"id": "opt2", "label": "Nạp thêm tiền để mua gấp đôi hạ giá vốn (bình quân giá xuống)", "correct": False, "feedback": "Chưa đúng. Mua bình quân giá xuống khi đang lỗ là hành vi tự sát tài chính đối với giao dịch ngắn hạn."}
                ]
            }
        ],
        "glossary": [
            {"term": "Stop Loss (Cắt lỗ)", "definition": "Mức giá định sẵn mà tại đó nhà đầu tư chấp nhận đóng vị thế để hạn chế thiệt hại tối đa."},
            {"term": "Position Sizing", "definition": "Kỹ thuật xác định số lượng cổ phiếu hoặc tỷ trọng tiền giải ngân cho mỗi cơ hội đầu tư."},
            {"term": "Bình quân giá xuống (Averaging Down)", "definition": "Hành động mua thêm cổ phiếu khi giá đang giảm liên tiếp, tiềm ẩn rủi ro cháy tài khoản nếu cổ phiếu vào downtrend."}
        ],
        "practice_action": {
            "href": "/portfolio",
            "label": "Mở danh mục Paper Trading",
            "description": "Thực hành thiết lập ngưỡng cắt lỗ và chốt lời cho các mã trong danh mục mô phỏng."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111108",
        "slug": "fomo-psychology-and-market-crowd",
        "level": "advanced",
        "stage": 3,
        "sort_order": 8,
        "title": "Kiểm soát Tâm lý FOMO & Bẫy bầy đàn trên thị trường",
        "eyebrow": "BÀI 8 · TÂM LÝ CHIẾN",
        "summary": "Nhận diện hội chứng sợ bỏ lỡ (FOMO), bẫy tâm lý bầy đàn và cách xây dựng kế hoạch giao dịch (Trading Plan) để loại bỏ cảm xúc bốc đồng.",
        "estimated_minutes": 8,
        "theory_content": """### 1. FOMO (Fear Of Missing Out) là gì?
FOMO là nỗi sợ bị bỏ lỡ cơ hội làm giàu nhanh chóng. Dấu hiệu nhận biết bạn đang bị FOMO:
- Thấy một cổ phiếu tăng trần liên tục 3-4 phiên.
- Khắp các diễn đàn mạng xã hội, hội nhóm Zalo/Telegram đều hô hào khoe lãi mã đó.
- Cảm giác bồn chồn, tiếc nuối vì mình chưa có hàng.
- Bấm nút đặt mua lệnh giá trần bất chấp cổ phiếu đã quá xa vùng nền an toàn.
Kết quả: 80% các trường hợp FOMO mua đuổi sẽ dẫn đến việc "đu đỉnh ngắn hạn" khi dòng tiền lớn chốt lời.

### 2. Chu kỳ cảm xúc của nhà đầu tư nhỏ lẻ
1. **Thờ ơ:** Thị trường tạo đáy, thanh khoản ảm đạm, không ai quan tâm.
2. **Nghi ngờ:** Thị trường tăng nhẹ nhưng nghi là bẫy tăng giá.
3. **Lạc quan & Hưng phấn:** Thị trường tăng mạnh, mua mã nào cũng thắng, bắt đầu vay margin tối đa.
4. **Tham lam tột độ (Đỉnh):** Cảm giác thị trường không thể giảm được nữa, rủ bạn bè người thân nạp tiền.
5. **Lo lắng & Phủ nhận:** Thị trường quay đầu giảm mạnh, nghĩ rằng chỉ là điều chỉnh kỹ thuật.
6. **Hoảng loạn & Bán tháo (Đáy):** Không chịu nổi áp lực call margin, bán sạch tại vùng giá thấp nhất.

### 3. Vũ khí chống FOMO: Kế hoạch giao dịch (Trading Plan)
Trước khi bấm nút MUA bất kỳ mã nào, bắt buộc phải trả lời 4 câu hỏi:
1. Lý do mua là gì? (Doanh nghiệp tăng trưởng hay theo mẫu hình kỹ thuật?)
2. Điểm mua chuẩn ở đâu? (Tuyệt đối không mua khi giá đã tăng vượt quá 5% từ nền tích lũy)
3. Điểm cắt lỗ ở đâu nếu dự đoán sai?
4. Tỷ trọng dự kiến giải ngân là bao nhiêu?""",
        "practical_example": {
            "title": "Bẫy tâm lý tại nhóm cổ phiếu Penny đầu cơ",
            "ticker": "VIX",
            "scenario": "Một cổ phiếu đầu cơ có tin đồn sáp nhập tăng trần liên tiếp 6 phiên không có ai bán. Đến phiên thứ 7, thanh khoản nổ tung hàng chục triệu cổ phiếu. Các diễn đàn hô hào mục tiêu x3 tài khoản.",
            "analysis": "Rất nhiều nhà đầu tư F0 lao vào mua giá trần ở phiên thứ 7 vì sợ lỡ cơ hội. Ngay sau khi trao tay lượng lớn cổ phiếu cho đám đông, tay to ngừng đỡ giá và cổ phiếu rơi tự do với các cây nến giảm sàn liên tiếp. Nhà đầu tư bị kẹt hàng không thể bán được.",
            "key_takeaway": "Khi tất cả mọi người đều hưng phấn bàn luận về một cổ phiếu, bữa tiệc thường đã sắp tàn."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Hành vi nào dưới đây phản ánh rõ nhất tâm lý FOMO trong đầu tư?",
                "options": [
                    {"id": "opt1", "label": "Vội vã mua đuổi một cổ phiếu vừa tăng trần nhiều phiên vì sợ giá sẽ còn tăng tiếp và bỏ lỡ cơ hội", "correct": True, "feedback": "Chính xác! Nỗi sợ bỏ lỡ cơ hội khiến nhà đầu tư mua ở vùng giá rủi ro nhất."},
                    {"id": "opt2", "label": "Kiên nhẫn chờ cổ phiếu điều chỉnh về vùng hỗ trợ an toàn mới cân nhắc giải ngân", "correct": False, "feedback": "Chưa đúng. Đây là sự kỷ luật và bình tĩnh của nhà đầu tư chuyên nghiệp."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Cách tốt nhất để kiềm chế cảm xúc bốc đồng khi giao dịch chứng khoán là gì?",
                "options": [
                    {"id": "opt1", "label": "Luôn lập sẵn kế hoạch giao dịch (Trading Plan) gồm điểm mua, điểm cắt lỗ và tuân thủ kỷ luật", "correct": True, "feedback": "Chính xác! Kế hoạch định trước giúp bạn hành động theo lý trí thay vì cảm xúc bốc đồng."},
                    {"id": "opt2", "label": "Tham gia thật nhiều nhóm tư vấn Zalo để nghe ngóng tin tức nội bộ", "correct": False, "feedback": "Chưa đúng. Nghe ngóng tin đồn càng làm gia tăng tâm lý bầy đàn và nhiễu loạn thông tin."}
                ]
            }
        ],
        "glossary": [
            {"term": "FOMO", "definition": "Hội chứng sợ bỏ lỡ cơ hội, thúc đẩy hành động mua đuổi bốc đồng."},
            {"term": "Tâm lý bầy đàn", "definition": "Xu hướng bắt chước hành vi của số đông mà không qua phân tích độc lập."},
            {"term": "Trading Plan", "definition": "Kế hoạch hành động chi tiết xác định quy tắc vào lệnh, chốt lời và cắt lỗ."}
        ],
        "practice_action": {
            "href": "/theses",
            "label": "Xem Luận điểm đầu tư cộng đồng",
            "description": "Học cách các nhà đầu tư kinh nghiệm xây dựng luận điểm và phân tích rủi ro trước khi vào lệnh."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    },
    {
        "id": "11111111-1111-1111-1111-111111111109",
        "slug": "dca-long-term-investing-plan",
        "level": "advanced",
        "stage": 3,
        "sort_order": 9,
        "title": "Xây dựng Kế hoạch Đầu tư Tích sản Dài hạn (DCA Strategy)",
        "eyebrow": "BÀI 9 · THỰC CHIẾN TÍCH SẢN",
        "summary": "Phương pháp bình quân giá định kỳ (DCA), tận dụng sức mạnh lãi suất kép và tiêu chí lựa chọn cổ phiếu kim cương để tích sản 5-10 năm.",
        "estimated_minutes": 8,
        "theory_content": """### 1. Chiến lược DCA (Dollar-Cost Averaging) là gì?
DCA là chiến lược trích một khoản tiền cố định từ thu nhập nhàn rỗi (ví dụ: 5 triệu hoặc 10 triệu đồng mỗi tháng) để mua cổ phiếu của doanh nghiệp đầu ngành vào một ngày cố định, bất kể thị trường đang tăng hay giảm.

Ưu thế vượt trội của DCA:
- **Không cần đoán đỉnh đoán đáy (Market Timing):** Loại bỏ áp lực phải canh bảng điện mỗi ngày.
- **Tự động bình quân giá vốn:** Khi thị trường giảm, số tiền cố định mua được nhiều cổ phiếu hơn; khi thị trường tăng, danh mục gia tăng giá trị tài sản.
- **Tận dụng Lãi suất kép (Compound Interest):** Nhờ việc nhận cổ tức và tái đầu tư liên tục trong 5 - 10 năm, tài sản sẽ tăng trưởng theo cấp số nhân.

### 2. Tiêu chí chọn cổ phiếu để Tích sản
Tuyệt đối không áp dụng DCA cho cổ phiếu đầu cơ, doanh nghiệp nợ vay đầm đìa hoặc ban lãnh đạo tai tiếng. Chỉ tích sản các cổ phiếu đạt tiêu chuẩn:
1. **Lợi thế cạnh tranh con hào kinh tế (Economic Moat):** Doanh nghiệp số 1 ngành, sản phẩm thiết yếu khó bị thay thế.
2. **Sức khỏe tài chính lành mạnh:** Tỷ lệ nợ vay an toàn, dòng tiền kinh doanh (CFO) dương đều đặn qua các năm.
3. **Ban lãnh đạo liêm chính:** Ưu tiên quyền lợi của cổ đông, không lướt sóng chính cổ phiếu của mình.
4. **Lịch sử chia cổ tức minh bạch:** Có truyền thống trả cổ tức tiền mặt hoặc cổ phiếu ổn định suốt 5 năm gần nhất.""",
        "practical_example": {
            "title": "Tích sản 5 triệu/tháng vào FPT suốt giai đoạn 2018 - 2026",
            "ticker": "FPT",
            "scenario": "Một kỹ sư công nghệ trích đều đặn 5 triệu đồng tiền lương mỗi tháng để mua cổ phiếu FPT từ đầu năm 2018 đến nay. Dù trải qua các biến cố như Covid-19 năm 2020 hay thị trường giảm mạnh năm 2022, anh vẫn duy trì việc mua đều đặn vào ngày nhận lương hàng tháng.",
            "analysis": "Nhờ tăng trưởng lợi nhuận 20%/năm và cổ tức đều đặn bằng cả tiền và cổ phiếu, giá vốn bình quân của anh rất thấp so với thị giá hiện tại. Sau 8 năm, tổng số tiền gốc 480 triệu đã biến thành khối tài sản trị giá hơn 2.4 tỷ đồng (tăng gấp hơn 5 lần vốn gốc ban đầu).",
            "key_takeaway": "Thời gian ở trong thị trường (Time in the market) luôn quan trọng hơn việc cố gắng đoán đúng thời điểm thị trường (Timing the market)."
        },
        "quizzes": [
            {
                "id": "q1",
                "prompt": "Điểm mấu chốt quan trọng nhất quyết định thành công của phương pháp đầu tư tích sản định kỳ (DCA) là gì?",
                "options": [
                    {"id": "opt1", "label": "Lựa chọn doanh nghiệp đầu ngành vững mạnh và duy trì kỷ luật tích lũy đều đặn dài hạn", "correct": True, "feedback": "Chính xác! Doanh nghiệp tốt kết hợp với sự kiên trì là chìa khóa của tích sản."},
                    {"id": "opt2", "label": "Phải đoán đúng đáy thị trường mỗi tháng để mua", "correct": False, "feedback": "Chưa đúng. Bản chất của DCA là không cần đoán đáy thị trường."}
                ]
            },
            {
                "id": "q2",
                "prompt": "Khi đang thực hiện chiến lược tích sản định kỳ mỗi tháng, nếu tháng này thị trường giảm điểm mạnh khiến giá cổ phiếu giảm sâu, bạn nên làm gì?",
                "options": [
                    {"id": "opt1", "label": "Tiếp tục thực hiện kế hoạch mua định kỳ vì bạn đang được gom thêm nhiều cổ phiếu tốt với giá rẻ hơn", "correct": True, "feedback": "Chính xác! Đối với người tích sản, các đợt giảm giá là cơ hội gom tài sản giá hời."},
                    {"id": "opt2", "label": "Hoảng loạn bán sạch số cổ phiếu đã gom được từ trước đến nay", "correct": False, "feedback": "Chưa đúng. Bán tháo trong hoảng loạn phá vỡ toàn bộ chiến lược tích sản dài hạn."}
                ]
            }
        ],
        "glossary": [
            {"term": "DCA", "definition": "Chiến lược phân bổ vốn mua định kỳ theo thời gian bất kể biến động giá ngắn hạn."},
            {"term": "Economic Moat", "definition": "Lợi thế cạnh tranh bền vững bảo vệ doanh nghiệp trước sự tấn công của đối thủ."},
            {"term": "Lãi suất kép", "definition": "Lợi nhuận sinh ra từ cả vốn gốc ban đầu lẫn lợi nhuận tích lũy của các kỳ trước."}
        ],
        "practice_action": {
            "href": "/market/stocks/FPT?modal=comparator",
            "label": "Mở Giả lập Tích sản DCA",
            "description": "Mô phỏng hiệu quả tích sản cổ phiếu vs Vàng SJC và Tiết kiệm ngân hàng."
        },
        "status": "published",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }
]

# In-memory store initialized with deep copy of seed
_MEM_TOPICS: dict[str, dict[str, Any]] = {item["slug"]: dict(item) for item in _DEFAULT_CURATED_TOPICS}


class SqlLearningRepository:
    def __init__(self, pool: ConnectionPool | None = None) -> None:
        self._pool = pool

    def _row_to_topic(self, row: tuple[Any, ...]) -> dict[str, Any]:
        return {
            "id": str(row[0]),
            "slug": str(row[1]),
            "level": str(row[2]),
            "stage": int(row[3]),
            "sort_order": int(row[4]),
            "title": str(row[5]),
            "eyebrow": str(row[6]),
            "summary": str(row[7]),
            "estimated_minutes": int(row[8]),
            "theory_content": str(row[9]),
            "practical_example": row[10] if isinstance(row[10], dict) else json.loads(row[10] or "{}"),
            "quizzes": row[11] if isinstance(row[11], list) else json.loads(row[11] or "[]"),
            "glossary": row[12] if isinstance(row[12], list) else json.loads(row[12] or "[]"),
            "practice_action": row[13] if isinstance(row[13], dict) else json.loads(row[13] or "{}"),
            "status": str(row[14]),
            "created_at": row[15].isoformat() if hasattr(row[15], "isoformat") else str(row[15]),
            "updated_at": row[16].isoformat() if hasattr(row[16], "isoformat") else str(row[16]),
        }

    def get_topics(self, level: str | None = None, status: str | None = "published") -> list[dict[str, Any]]:
        """Get topics ordered by stage, sort_order."""
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    query = """
                        SELECT id, slug, level, stage, sort_order, title, eyebrow, summary,
                               estimated_minutes, theory_content, practical_example, quizzes,
                               glossary, practice_action, status, created_at, updated_at
                        FROM learning_topics
                        WHERE (%s IS NULL OR level = %s)
                          AND (%s IS NULL OR status = %s)
                        ORDER BY stage ASC, sort_order ASC;
                    """
                    cur.execute(query, (level, level, status, status))
                    rows = cur.fetchall()
                    if rows:
                        return [self._row_to_topic(r) for r in rows]
            except Exception as exc:
                logger.warning("Failed to fetch topics from DB, falling back to memory: %s", exc)

        # Fallback to memory
        items = list(_MEM_TOPICS.values())
        if level:
            items = [it for it in items if it.get("level") == level]
        if status:
            items = [it for it in items if it.get("status") == status]
        items.sort(key=lambda x: (x.get("stage", 1), x.get("sort_order", 1)))

        # Serialize datetime if needed
        serialized: list[dict[str, Any]] = []
        for it in items:
            copy_it = dict(it)
            if hasattr(copy_it.get("created_at"), "isoformat"):
                copy_it["created_at"] = copy_it["created_at"].isoformat()
            if hasattr(copy_it.get("updated_at"), "isoformat"):
                copy_it["updated_at"] = copy_it["updated_at"].isoformat()
            serialized.append(copy_it)
        return serialized

    def get_topic_by_slug(self, slug: str) -> dict[str, Any] | None:
        """Get single topic by slug."""
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, slug, level, stage, sort_order, title, eyebrow, summary,
                               estimated_minutes, theory_content, practical_example, quizzes,
                               glossary, practice_action, status, created_at, updated_at
                        FROM learning_topics
                        WHERE slug = %s;
                        """,
                        (slug,),
                    )
                    row = cur.fetchone()
                    if row:
                        return self._row_to_topic(row)
            except Exception as exc:
                logger.warning("Failed to fetch topic by slug from DB: %s", exc)

        item = _MEM_TOPICS.get(slug)
        if not item:
            return None
        copy_it = dict(item)
        if hasattr(copy_it.get("created_at"), "isoformat"):
            copy_it["created_at"] = copy_it["created_at"].isoformat()
        if hasattr(copy_it.get("updated_at"), "isoformat"):
            copy_it["updated_at"] = copy_it["updated_at"].isoformat()
        return copy_it

    def get_topic_by_id(self, topic_id: str) -> dict[str, Any] | None:
        """Get single topic by UUID."""
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, slug, level, stage, sort_order, title, eyebrow, summary,
                               estimated_minutes, theory_content, practical_example, quizzes,
                               glossary, practice_action, status, created_at, updated_at
                        FROM learning_topics
                        WHERE id = %s;
                        """,
                        (topic_id,),
                    )
                    row = cur.fetchone()
                    if row:
                        return self._row_to_topic(row)
            except Exception as exc:
                logger.warning("Failed to fetch topic by id from DB: %s", exc)

        for it in _MEM_TOPICS.values():
            if str(it.get("id")) == str(topic_id):
                copy_it = dict(it)
                if hasattr(copy_it.get("created_at"), "isoformat"):
                    copy_it["created_at"] = copy_it["created_at"].isoformat()
                if hasattr(copy_it.get("updated_at"), "isoformat"):
                    copy_it["updated_at"] = copy_it["updated_at"].isoformat()
                return copy_it
        return None

    def create_topic(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new learning topic."""
        now = datetime.now(UTC)
        topic_id = str(data.get("id") or uuid4())
        record = {
            "id": topic_id,
            "slug": data["slug"].strip().lower(),
            "level": data.get("level", "beginner"),
            "stage": int(data.get("stage", 1)),
            "sort_order": int(data.get("sort_order", 1)),
            "title": data["title"].strip(),
            "eyebrow": data.get("eyebrow", "").strip(),
            "summary": data.get("summary", "").strip(),
            "estimated_minutes": int(data.get("estimated_minutes", 5)),
            "theory_content": data.get("theory_content", ""),
            "practical_example": data.get("practical_example") or {},
            "quizzes": data.get("quizzes") or [],
            "glossary": data.get("glossary") or [],
            "practice_action": data.get("practice_action") or {"href": "/portfolio", "label": "Xem danh mục mô phỏng", "description": "Thực hành ngay"},
            "status": data.get("status", "published"),
            "created_at": now,
            "updated_at": now,
        }

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO learning_topics (
                            id, slug, level, stage, sort_order, title, eyebrow, summary,
                            estimated_minutes, theory_content, practical_example, quizzes,
                            glossary, practice_action, status, created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        ) RETURNING id;
                        """,
                        (
                            record["id"], record["slug"], record["level"], record["stage"],
                            record["sort_order"], record["title"], record["eyebrow"], record["summary"],
                            record["estimated_minutes"], record["theory_content"],
                            json.dumps(record["practical_example"]), json.dumps(record["quizzes"]),
                            json.dumps(record["glossary"]), json.dumps(record["practice_action"]),
                            record["status"], record["created_at"], record["updated_at"]
                        ),
                    )
            except Exception as exc:
                logger.warning("DB insert topic failed, persisting to memory: %s", exc)

        _MEM_TOPICS[record["slug"]] = record
        copy_it = dict(record)
        copy_it["created_at"] = now.isoformat()
        copy_it["updated_at"] = now.isoformat()
        return copy_it

    def update_topic(self, topic_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Update an existing topic."""
        now = datetime.now(UTC)
        existing = self.get_topic_by_id(topic_id)
        if not existing:
            return None

        slug = existing["slug"]
        updated = dict(existing)
        for k, v in data.items():
            if v is not None:
                updated[k] = v
        updated["updated_at"] = now

        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE learning_topics
                        SET level = %s, stage = %s, sort_order = %s, title = %s, eyebrow = %s,
                            summary = %s, estimated_minutes = %s, theory_content = %s,
                            practical_example = %s, quizzes = %s, glossary = %s,
                            practice_action = %s, status = %s, updated_at = %s
                        WHERE id = %s;
                        """,
                        (
                            updated["level"], updated["stage"], updated["sort_order"],
                            updated["title"], updated["eyebrow"], updated["summary"],
                            updated["estimated_minutes"], updated["theory_content"],
                            json.dumps(updated["practical_example"]), json.dumps(updated["quizzes"]),
                            json.dumps(updated["glossary"]), json.dumps(updated["practice_action"]),
                            updated["status"], updated["updated_at"], topic_id
                        ),
                    )
            except Exception as exc:
                logger.warning("DB update topic failed, updating memory: %s", exc)

        _MEM_TOPICS[slug] = updated
        copy_it = dict(updated)
        copy_it["updated_at"] = now.isoformat()
        return copy_it

    def delete_topic(self, topic_id: str) -> bool:
        """Delete a topic by ID."""
        existing = self.get_topic_by_id(topic_id)
        if not existing:
            return False

        slug = existing["slug"]
        if self._pool is not None:
            try:
                with self._pool.connection() as conn, conn.cursor() as cur:
                    cur.execute("DELETE FROM learning_topics WHERE id = %s;", (topic_id,))
            except Exception as exc:
                logger.warning("DB delete topic failed: %s", exc)

        _MEM_TOPICS.pop(slug, None)
        return True

    def update_topic_status(self, topic_id: str, new_status: str) -> bool:
        """Toggle status between published and draft."""
        return self.update_topic(topic_id, {"status": new_status}) is not None

    def list_admin_topics(
        self,
        q: str | None = None,
        level: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        """List topics for admin management with search & pagination."""
        all_topics = self.get_topics(level=level, status=status)
        if q:
            q_clean = q.strip().lower()
            all_topics = [
                t for t in all_topics
                if q_clean in t.get("title", "").lower()
                or q_clean in t.get("slug", "").lower()
                or q_clean in t.get("summary", "").lower()
            ]

        total = len(all_topics)
        start = (page - 1) * limit
        end = start + limit
        paged = all_topics[start:end]
        return paged, total


_learning_repo: SqlLearningRepository | None = None


def get_learning_repository() -> SqlLearningRepository:
    global _learning_repo
    if _learning_repo is None:
        try:
            from app.infrastructure.db.session import get_pool
            pool = get_pool()
        except Exception:
            pool = None
        _learning_repo = SqlLearningRepository(pool=pool)
    return _learning_repo
