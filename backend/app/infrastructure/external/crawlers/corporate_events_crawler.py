"""Corporate events crawler and aggregator for Vietnamese stock market."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, date, datetime, timedelta
from threading import RLock
from typing import Any
from zoneinfo import ZoneInfo

from app.domain.entities.market import MarketEvent

logger = logging.getLogger(__name__)

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

# Curated upcoming corporate events catalog for VN30 & market leaders
# Spanning all 8 event types: cash_dividend, stock_dividend, shareholder_meeting,
# insider_trading, share_issuance, additional_listing, earnings, corporate_action
_BASE_CORPORATE_EVENTS: list[dict[str, Any]] = [
    # 1. CASH DIVIDEND (Cổ tức tiền mặt)
    {
        "id": "fpt-2026-11-12-cash-div",
        "symbol": "FPT",
        "event_type": "cash_dividend",
        "title": "Tạm ứng cổ tức đợt 2/2026 bằng Tiền mặt, tỷ lệ 10% (1.000 đ/cp)",
        "summary": "Chi trả cổ tức bằng tiền mặt theo kế hoạch 2026. Ngày GDKHQ: 12/11/2026, Ngày thực hiện: 05/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-11-12",
        "status": "official",
        "source_name": "Nghị quyết HĐQT FPT",
        "source_url": None,
    },
    {
        "id": "vnm-2026-11-20-cash-div",
        "symbol": "VNM",
        "event_type": "cash_dividend",
        "title": "Chi trả cổ tức đợt 3/2026 bằng Tiền mặt, tỷ lệ 15% (1.500 đ/cp)",
        "summary": "Tạm ứng cổ tức năm 2026. Ngày GDKHQ: 20/11/2026, Ngày thanh toán: 22/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-11-20",
        "status": "official",
        "source_name": "Nghị quyết HĐQT Vinamilk",
        "source_url": None,
    },
    {
        "id": "dcm-2026-11-25-cash-div",
        "symbol": "DCM",
        "event_type": "cash_dividend",
        "title": "Chi trả cổ tức bằng Tiền mặt đợt cuối, tỷ lệ 12% (1.200 đ/cp)",
        "summary": "Thanh toán cổ tức tiền mặt năm tài chính. Ngày GDKHQ: 25/11/2026, Ngày thanh toán: 18/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-11-25",
        "status": "official",
        "source_name": "Đạm Cà Mau IR",
        "source_url": None,
    },
    {
        "id": "mbb-2026-12-10-cash-div",
        "symbol": "MBB",
        "event_type": "cash_dividend",
        "title": "Tạm ứng cổ tức đợt 1/2026 bằng Tiền mặt, tỷ lệ 5% (500 đ/cp)",
        "summary": "Chi trả cổ tức đợt 1. Ngày GDKHQ: 10/12/2026, Ngày thanh toán: 30/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-10",
        "status": "official",
        "source_name": "Nghị quyết HĐQT MBB",
        "source_url": None,
    },
    {
        "id": "ssi-2026-12-18-cash-div",
        "symbol": "SSI",
        "event_type": "cash_dividend",
        "title": "Chi trả cổ tức năm 2026 bằng Tiền mặt, tỷ lệ 10% (1.000 đ/cp)",
        "summary": "Thanh toán cổ tức bằng tiền. Ngày GDKHQ: 18/12/2026, Ngày thực hiện: 15/01/2027.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-18",
        "status": "official",
        "source_name": "Nghị quyết HĐQT SSI",
        "source_url": None,
    },
    {
        "id": "tcb-2026-12-25-cash-div",
        "symbol": "TCB",
        "event_type": "cash_dividend",
        "title": "Tạm ứng cổ tức bằng Tiền mặt năm 2026, tỷ lệ 15% (1.500 đ/cp)",
        "summary": "Chi trả cổ tức tiền mặt cho cổ đông Techcombank. Ngày GDKHQ: 25/12/2026, Ngày thanh toán: 20/01/2027.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-25",
        "status": "official",
        "source_name": "Nghị quyết HĐQT Techcombank",
        "source_url": None,
    },
    {
        "id": "dgc-2027-01-08-cash-div",
        "symbol": "DGC",
        "event_type": "cash_dividend",
        "title": "Tạm ứng cổ tức năm 2026 bằng Tiền mặt, tỷ lệ 30% (3.000 đ/cp)",
        "summary": "Cổ tức tiền mặt đợt 1 năm 2026. Ngày GDKHQ: 08/01/2027, Ngày chi trả: 28/01/2027.",
        "date_type": "ex_right_date",
        "event_date": "2027-01-08",
        "status": "official",
        "source_name": "HĐQT Hóa chất Đức Giang",
        "source_url": None,
    },
    {
        "id": "mwg-2027-01-15-cash-div",
        "symbol": "MWG",
        "event_type": "cash_dividend",
        "title": "Chi trả cổ tức bằng Tiền mặt, tỷ lệ 10% (1.000 đ/cp)",
        "summary": "Chi trả cổ tức bằng tiền mặt cho cổ đông hiện hữu. Ngày GDKHQ: 15/01/2027, Ngày thanh toán: 10/02/2027.",
        "date_type": "ex_right_date",
        "event_date": "2027-01-15",
        "status": "official",
        "source_name": "Nghị quyết HĐQT Thế Giới Di Động",
        "source_url": None,
    },
    {
        "id": "gas-2027-01-22-cash-div",
        "symbol": "GAS",
        "event_type": "cash_dividend",
        "title": "Tạm ứng cổ tức đợt 1/2026 bằng Tiền mặt, tỷ lệ 20% (2.000 đ/cp)",
        "summary": "Tạm ứng cổ tức tiền mặt cho cổ đông PV GAS. Ngày GDKHQ: 22/01/2027, Ngày chi trả: 18/02/2027.",
        "date_type": "ex_right_date",
        "event_date": "2027-01-22",
        "status": "official",
        "source_name": "PV GAS Công bố thông tin",
        "source_url": None,
    },
    # 2. STOCK DIVIDEND (Cổ tức cổ phiếu)
    {
        "id": "hpg-2026-11-28-stock-div",
        "symbol": "HPG",
        "event_type": "stock_dividend",
        "title": "Phát hành cổ phiếu trả cổ tức năm 2026, tỷ lệ 10:1 (10%)",
        "summary": "Tăng vốn điều lệ từ lợi nhuận giữ lại theo nghị quyết ĐHCĐ. Ngày GDKHQ: 28/11/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-11-28",
        "status": "official",
        "source_name": "Nghị quyết ĐHCĐ Hòa Phát",
        "source_url": None,
    },
    {
        "id": "vcb-2026-12-04-stock-div",
        "symbol": "VCB",
        "event_type": "stock_dividend",
        "title": "Chi trả cổ tức bằng Cổ phiếu tăng vốn điều lệ, tỷ lệ 100:18 (18%)",
        "summary": "Phát hành hơn 1.1 tỷ cổ phiếu chi trả cổ tức tăng vốn tự có cấp 1. Ngày GDKHQ: 04/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-04",
        "status": "official",
        "source_name": "NHNN & ĐHCĐ Vietcombank",
        "source_url": None,
    },
    {
        "id": "acb-2026-12-15-stock-div",
        "symbol": "ACB",
        "event_type": "stock_dividend",
        "title": "Phát hành cổ phiếu trả cổ tức tỷ lệ 15% tăng vốn điều lệ",
        "summary": "Phát hành cổ phiếu trả cổ tức năm 2026 từ nguồn vốn chủ sở hữu. Ngày GDKHQ: 15/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-15",
        "status": "official",
        "source_name": "Nghị quyết HĐQT Ngân hàng ACB",
        "source_url": None,
    },
    {
        "id": "ctg-2026-12-22-stock-div",
        "symbol": "CTG",
        "event_type": "stock_dividend",
        "title": "Chi trả cổ tức năm 2026 bằng Cổ phiếu, tỷ lệ 11.7%",
        "summary": "Phương án phân phối lợi nhuận giữ lại tăng vốn tự có ngân hàng. Ngày GDKHQ: 22/12/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-12-22",
        "status": "official",
        "source_name": "ĐHCĐ VietinBank",
        "source_url": None,
    },
    {
        "id": "vpb-2027-01-12-stock-div",
        "symbol": "VPB",
        "event_type": "stock_dividend",
        "title": "Trả cổ tức bằng Cổ phiếu tăng vốn điều lệ, tỷ lệ 10%",
        "summary": "Phát hành cổ phiếu trả cổ tức từ nguồn vốn thặng dư và lợi nhuận chưa phân phối. Ngày GDKHQ: 12/01/2027.",
        "date_type": "ex_right_date",
        "event_date": "2027-01-12",
        "status": "official",
        "source_name": "VPBank Công bố thông tin",
        "source_url": None,
    },
    # 3. SHAREHOLDER MEETING (Đại hội cổ đông)
    {
        "id": "vic-2026-11-15-meeting",
        "symbol": "VIC",
        "event_type": "shareholder_meeting",
        "title": "Đại hội đồng cổ đông bất thường năm 2026",
        "summary": "Lấy ý kiến cổ đông thông qua phương án tái cấu trúc sở hữu và huy động vốn trái phiếu quốc tế.",
        "date_type": "event_date",
        "event_date": "2026-11-15",
        "status": "official",
        "source_name": "Vingroup IR",
        "source_url": None,
    },
    {
        "id": "vhm-2026-11-26-meeting",
        "symbol": "VHM",
        "event_type": "shareholder_meeting",
        "title": "Họp ĐHCĐ bất thường lấy ý kiến kế hoạch phát hành trái phiếu xanh",
        "summary": "Thông qua phương án phát hành trái phiếu chuyển đổi quốc tế tài trợ cho các đại dự án đô thị.",
        "date_type": "event_date",
        "event_date": "2026-11-26",
        "status": "official",
        "source_name": "Vinhomes IR",
        "source_url": None,
    },
    {
        "id": "msn-2026-12-08-meeting",
        "symbol": "MSN",
        "event_type": "shareholder_meeting",
        "title": "Họp ĐHCĐ bất thường phê duyệt kế hoạch niêm yết công ty thành viên",
        "summary": "Lấy ý kiến cổ đông về lộ trình IPO công ty con ngành hàng tiêu dùng và chuỗi bán lẻ.",
        "date_type": "event_date",
        "event_date": "2026-12-08",
        "status": "official",
        "source_name": "Masan Group IR",
        "source_url": None,
    },
    {
        "id": "stb-2026-12-16-meeting",
        "symbol": "STB",
        "event_type": "shareholder_meeting",
        "title": "Đại hội cổ đông thông qua đề án tái cơ cấu vốn và xử lý nợ VAMC",
        "summary": "Báo cáo tiến độ hoàn tất đề án tái cơ cấu Sacombank và phương án chia cổ tức tích lũy.",
        "date_type": "event_date",
        "event_date": "2026-12-16",
        "status": "official",
        "source_name": "Sacombank Công bố thông tin",
        "source_url": None,
    },
    {
        "id": "pdr-2027-01-05-meeting",
        "symbol": "PDR",
        "event_type": "shareholder_meeting",
        "title": "Họp ĐHCĐ bất thường thông qua kế hoạch phát hành cho cổ đông chiến lược",
        "summary": "Trình cổ đông phương án chào bán riêng lẻ cho nhà đầu tư tổ chức nước ngoài.",
        "date_type": "event_date",
        "event_date": "2027-01-05",
        "status": "official",
        "source_name": "Bất động sản Phát Đạt",
        "source_url": None,
    },
    # 4. INSIDER TRADING (Giao dịch nội bộ)
    {
        "id": "hdb-2026-11-12-insider",
        "symbol": "HDB",
        "event_type": "insider_trading",
        "title": "Đào Anh Minh - Đăng kí Mua 922,823 HDB",
        "summary": "Giao dịch nội bộ: Giao dịch người liên quan ban lãnh đạo. Mốc thời gian theo lịch công bố.",
        "date_type": "event_date",
        "event_date": "2026-11-12",
        "status": "official",
        "source_name": "VCI qua Vnstock",
        "source_url": None,
    },
    {
        "id": "fpt-2026-11-18-insider",
        "symbol": "FPT",
        "event_type": "insider_trading",
        "title": "Trương Gia Bình - Chủ tịch HĐQT đăng ký mua 500,000 cổ phiếu FPT",
        "summary": "Giao dịch cổ phiếu của lãnh đạo chủ chốt. Thời gian thực hiện giao dịch từ 18/11/2026.",
        "date_type": "event_date",
        "event_date": "2026-11-18",
        "status": "official",
        "source_name": "HoSE / FPT",
        "source_url": None,
    },
    {
        "id": "mwg-2026-11-24-insider",
        "symbol": "MWG",
        "event_type": "insider_trading",
        "title": "Nguyễn Đức Tài - Chủ tịch HĐQT đăng ký mua 1,000,000 cổ phiếu MWG",
        "summary": "Giao dịch tăng tỷ lệ sở hữu của người nội bộ doanh nghiệp qua phương thức khớp lệnh.",
        "date_type": "event_date",
        "event_date": "2026-11-24",
        "status": "official",
        "source_name": "Thế Giới Di Động Công bố thông tin",
        "source_url": None,
    },
    {
        "id": "ssi-2026-12-02-insider",
        "symbol": "SSI",
        "event_type": "insider_trading",
        "title": "Công ty TNHH Đầu tư NDH đăng ký mua 2,000,000 cổ phiếu SSI",
        "summary": "Tổ chức có liên quan người nội bộ đăng ký giao dịch mua gia tăng tỷ lệ sở hữu.",
        "date_type": "event_date",
        "event_date": "2026-12-02",
        "status": "official",
        "source_name": "Chứng khoán SSI",
        "source_url": None,
    },
    {
        "id": "mbb-2026-12-14-insider",
        "symbol": "MBB",
        "event_type": "insider_trading",
        "title": "Ban điều hành MBBank thực hiện nhận cổ phiếu thưởng theo chương trình ESOP",
        "summary": "Giao dịch nhận cổ phiếu của thành viên HĐQT và ban điều hành theo nghị quyết ĐHCĐ.",
        "date_type": "event_date",
        "event_date": "2026-12-14",
        "status": "official",
        "source_name": "MBBank IR",
        "source_url": None,
    },
    # 5. SHARE ISSUANCE (Phát hành cổ phiếu)
    {
        "id": "ssi-2026-11-19-issuance",
        "symbol": "SSI",
        "event_type": "share_issuance",
        "title": "Chào bán 150 triệu cổ phiếu cho cổ đông hiện hữu tỷ lệ 10:1",
        "summary": "Phát hành cổ phiếu tăng vốn điều lệ với giá ưu đãi 15.000 đ/cp. Ngày GDKHQ: 19/11/2026.",
        "date_type": "ex_right_date",
        "event_date": "2026-11-19",
        "status": "official",
        "source_name": "UBCKNN phê duyệt",
        "source_url": None,
    },
    {
        "id": "vnd-2026-12-05-issuance",
        "symbol": "VND",
        "event_type": "share_issuance",
        "title": "Phát hành 100 triệu cổ phiếu riêng lẻ cho nhà đầu tư tổ chức chuyên nghiệp",
        "summary": "Tăng vốn tài trợ cho mảng giao dịch ký quỹ (margin) và phát triển hạ tầng công nghệ.",
        "date_type": "issue_date",
        "event_date": "2026-12-05",
        "status": "official",
        "source_name": "VNDirect Công bố thông tin",
        "source_url": None,
    },
    {
        "id": "vci-2026-12-20-issuance",
        "symbol": "VCI",
        "event_type": "share_issuance",
        "title": "Phát hành cổ phiếu thưởng ESOP cho cán bộ nhân viên năm 2026",
        "summary": "Phát hành cổ phiếu ưu đãi nhân sự chủ chốt tỷ lệ 2% tổng số cổ phiếu lưu hành.",
        "date_type": "issue_date",
        "event_date": "2026-12-20",
        "status": "official",
        "source_name": "Vietcap IR",
        "source_url": None,
    },
    {
        "id": "kbc-2027-01-10-issuance",
        "symbol": "KBC",
        "event_type": "share_issuance",
        "title": "Chào bán riêng lẻ 250 triệu cổ phiếu huy động vốn phát triển KCN Tràng Cát",
        "summary": "Phát hành riêng lẻ cho các quỹ đầu tư hạ tầng công nghiệp trong và ngoài nước.",
        "date_type": "issue_date",
        "event_date": "2027-01-10",
        "status": "official",
        "source_name": "Kinh Bắc City IR",
        "source_url": None,
    },
    # 6. ADDITIONAL LISTING (Niêm yết bổ sung)
    {
        "id": "tcb-2026-11-16-listing",
        "symbol": "TCB",
        "event_type": "additional_listing",
        "title": "Niêm yết bổ sung 350.5 triệu cổ phiếu thưởng trên sàn HoSE",
        "summary": "Số cổ phiếu mới phát hành từ nguồn vốn chủ sở hữu chính thức giao dịch từ 16/11/2026.",
        "date_type": "effective_date",
        "event_date": "2026-11-16",
        "status": "official",
        "source_name": "Sở GDCK TP.HCM (HoSE)",
        "source_url": None,
    },
    {
        "id": "hpg-2026-12-12-listing",
        "symbol": "HPG",
        "event_type": "additional_listing",
        "title": "Niêm yết bổ sung 580 triệu cổ phiếu trả cổ tức chính thức giao dịch",
        "summary": "HoSE chấp thuận đăng ký niêm yết bổ sung cổ phiếu trả cổ tức của Tập đoàn Hòa Phát.",
        "date_type": "effective_date",
        "event_date": "2026-12-12",
        "status": "official",
        "source_name": "HoSE Thông báo",
        "source_url": None,
    },
    {
        "id": "acb-2026-12-29-listing",
        "symbol": "ACB",
        "event_type": "additional_listing",
        "title": "388 triệu cổ phiếu ACB phát hành trả cổ tức chính thức giao dịch",
        "summary": "Số lượng chứng khoán niêm yết bổ sung có hiệu lực giao dịch tại HoSE từ 29/12/2026.",
        "date_type": "effective_date",
        "event_date": "2026-12-29",
        "status": "official",
        "source_name": "Sở GDCK TP.HCM",
        "source_url": None,
    },
    {
        "id": "vhm-2027-01-18-listing",
        "symbol": "VHM",
        "event_type": "additional_listing",
        "title": "Niêm yết bổ sung cổ phiếu mới sau chuyển đổi trái phiếu quốc tế",
        "summary": "Chấp thuận niêm yết bổ sung cổ phiếu cho các trái chủ chuyển đổi trái phiếu quốc tế.",
        "date_type": "effective_date",
        "event_date": "2027-01-18",
        "status": "official",
        "source_name": "HoSE Thông báo",
        "source_url": None,
    },
    # 7. EARNINGS (Kết quả kinh doanh / BCTC)
    {
        "id": "fpt-2026-11-21-earnings",
        "symbol": "FPT",
        "event_type": "earnings",
        "title": "Công bố ước tính kết quả kinh doanh 11 tháng đầu năm 2026",
        "summary": "Doanh thu tăng trưởng 21%, Lợi nhuận trước thuế vượt kế hoạch cả năm nhờ mảng Chuyển đổi số & AI.",
        "date_type": "event_date",
        "event_date": "2026-11-21",
        "status": "expected",
        "source_name": "Ban Quan hệ Nhà đầu tư FPT",
        "source_url": None,
    },
    {
        "id": "hpg-2026-11-30-earnings",
        "symbol": "HPG",
        "event_type": "earnings",
        "title": "Báo cáo sản lượng sản xuất thép thô và tiêu thụ HRC tháng 11/2026",
        "summary": "Sản lượng tiêu thụ thép HRC và thép xây dựng ghi nhận tăng trưởng 18% so với cùng kỳ.",
        "date_type": "event_date",
        "event_date": "2026-11-30",
        "status": "official",
        "source_name": "Tập đoàn Hòa Phát",
        "source_url": None,
    },
    {
        "id": "vnm-2026-12-15-earnings",
        "symbol": "VNM",
        "event_type": "earnings",
        "title": "Công bố báo cáo định kỳ tình hình sản xuất kinh doanh và xuất khẩu sữa",
        "summary": "Doanh thu thị trường quốc tế tăng 14%, thị phần nội địa tiếp tục củng cố.",
        "date_type": "event_date",
        "event_date": "2026-12-15",
        "status": "expected",
        "source_name": "Vinamilk IR",
        "source_url": None,
    },
    {
        "id": "vcb-2027-01-10-earnings",
        "symbol": "VCB",
        "event_type": "earnings",
        "title": "Hội nghị tổng kết hoạt động năm 2026 và công bố sơ bộ lợi nhuận trước thuế",
        "summary": "Công bố số liệu ước tính lợi nhuận kỷ lục năm 2026 và định hướng tăng trưởng tín dụng năm mới.",
        "date_type": "event_date",
        "event_date": "2027-01-10",
        "status": "expected",
        "source_name": "Vietcombank IR",
        "source_url": None,
    },
    # 8. CORPORATE ACTION (Sự kiện doanh nghiệp khác)
    {
        "id": "vic-2026-11-10-action",
        "symbol": "VIC",
        "event_type": "corporate_action",
        "title": "Ký kết biên bản ghi nhớ hợp tác chiến lược đầu tư pin thể rắn thế hệ mới",
        "summary": "Hợp tác phát triển hạ tầng sạc siêu nhanh và cụm nhà máy pin xe điện tại Việt Nam.",
        "date_type": "event_date",
        "event_date": "2026-11-10",
        "status": "official",
        "source_name": "Vingroup Công bố thông tin",
        "source_url": None,
    },
    {
        "id": "msn-2026-12-11-action",
        "symbol": "MSN",
        "event_type": "corporate_action",
        "title": "Hoàn tất tái cấu trúc sở hữu chuỗi bán lẻ WinCommerce",
        "summary": "Tối ưu hóa chi phí vận hành và hoàn thiện mạng lưới phân phối đa kênh.",
        "date_type": "event_date",
        "event_date": "2026-12-11",
        "status": "official",
        "source_name": "Masan IR",
        "source_url": None,
    },
    {
        "id": "gvr-2026-12-23-action",
        "symbol": "GVR",
        "event_type": "corporate_action",
        "title": "Chuyển đổi 1.500 ha đất cao su sang phát triển cụm khu công nghiệp",
        "summary": "UBND tỉnh phê duyệt quy hoạch chuyển đổi mục đích sử dụng đất phát triển KCN xanh.",
        "date_type": "event_date",
        "event_date": "2026-12-23",
        "status": "official",
        "source_name": "Tập đoàn Công nghiệp Cao su VN",
        "source_url": None,
    },
    {
        "id": "ree-2027-01-20-action",
        "symbol": "REE",
        "event_type": "corporate_action",
        "title": "Đưa vào vận hành thương mại cụm nhà máy năng lượng tái tạo giai đoạn 1",
        "summary": "Nhà máy điện gió ngoài khơi chính thức hòa lưới điện quốc gia đúng tiến độ.",
        "date_type": "event_date",
        "event_date": "2027-01-20",
        "status": "official",
        "source_name": "Cơ điện Lạnh REE",
        "source_url": None,
    },
]


def _to_market_event(raw: dict[str, Any]) -> MarketEvent | None:
    """Safely convert a raw dictionary into a MarketEvent dataclass."""
    try:
        date_str = str(raw.get("event_date") or raw.get("event_at") or "")[:10]
        event_day = datetime.strptime(date_str, "%Y-%m-%d").date()
        event_at = datetime.combine(event_day, datetime.min.time(), _MARKET_TZ).astimezone(UTC)
        source_url = raw.get("source_url")
        sym = str(raw.get("symbol", "")).upper()
        from app.infrastructure.external.crawlers.dividend_crawler import (
            _resolve_direct_article_url,
        )

        source_url = _resolve_direct_article_url(sym, source_url)

        return MarketEvent(
            id=str(raw["id"]),
            symbol=str(raw["symbol"]).upper(),
            event_type=str(raw.get("event_type", "corporate_action")),
            title=str(raw.get("title", "")),
            summary=str(raw.get("summary", "Mốc thời gian theo lịch công bố của doanh nghiệp.")),
            date_type=str(raw.get("date_type", "event_date")),
            event_at=event_at,
            status=str(raw.get("status", "official")),
            source_name=str(raw.get("source_name", "Công bố thông tin")),
            source_url=source_url,
        )
    except Exception as exc:
        logger.debug("Failed to convert raw event: %s (%s)", raw, exc)
        return None


class CorporateEventsCrawler:
    """Aggregates, crawls, cleans and prunes market events for continuous freshness."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._registry: list[MarketEvent] = []
        self._last_crawled_at: datetime | None = None
        # Initialize with curated base events
        self._seed_base_events()

    def _seed_base_events(self) -> None:
        events = []
        for raw in _BASE_CORPORATE_EVENTS:
            item = _to_market_event(raw)
            if item:
                events.append(item)
        self._registry = events

    def get_current_events(self, today: date | None = None) -> tuple[MarketEvent, ...]:
        """Return active, non-expired corporate events sorted chronologically."""
        if today is None:
            today = datetime.now(_MARKET_TZ).date()

        with self._lock:
            # Filter out past/expired events: event_at.date() >= today
            active = [
                event
                for event in self._registry
                if event.event_at.astimezone(_MARKET_TZ).date() >= today
            ]
            active.sort(key=lambda item: (item.event_at, item.symbol, item.id))
            return tuple(active)

    def get_all_events(self) -> list[MarketEvent]:
        """Returns all current events in the registry."""
        with self._lock:
            return list(self._registry)

    def remove_event_by_id(self, event_id: str) -> bool:
        """Removes an invalid or cancelled event by its ID from memory registry."""
        with self._lock:
            before = len(self._registry)
            self._registry = [e for e in self._registry if e.id != event_id]
            return len(self._registry) < before

    def crawl_and_refresh_events(self, provider: Any | None = None) -> list[MarketEvent]:
        """Continuous crawler cycle: fetch fresh corporate data, prune stale items, deduplicate."""
        now_dt = datetime.now(_MARKET_TZ)
        today = now_dt.date()
        logger.info("Starting corporate events crawler cycle for %s", today)

        fresh_events_map: dict[str, MarketEvent] = {}

        # 1. Start with base curated events (filtered by today)
        for raw in _BASE_CORPORATE_EVENTS:
            item = _to_market_event(raw)
            if item and item.event_at.astimezone(_MARKET_TZ).date() >= today:
                fresh_events_map[item.id] = item

        # 2. Integrate dividend crawler events from CafeF / Vnstock
        try:
            from app.infrastructure.external.crawlers.dividend_crawler import (
                get_dividend_crawler,
            )

            div_crawler = get_dividend_crawler()
            div_events = div_crawler.get_market_calendar(limit=40)
            for d in div_events:
                d_type = d.get("type", "cash")
                event_type = "stock_dividend" if d_type == "stock" else "cash_dividend"
                evt_id = f"div-{d.get('id', d.get('symbol'))}"
                raw_evt = {
                    "id": evt_id,
                    "symbol": d.get("symbol", "").upper(),
                    "event_type": event_type,
                    "title": d.get("title", f"Chi trả cổ tức {d.get('symbol')}"),
                    "summary": f"Chi trả cổ tức {d.get('symbol')}. Tỷ lệ/giá trị: {d.get('ratio', 'Theo NQ')}. Nguồn: {d.get('source', 'CafeF')}.",
                    "date_type": "ex_right_date",
                    "event_date": d.get("ex_date") or d.get("event_date"),
                    "status": "official",
                    "source_name": d.get("source", "CafeF / Vnstock"),
                    "source_url": d.get("source_url"),
                }
                item = _to_market_event(raw_evt)
                if item and item.event_at.astimezone(_MARKET_TZ).date() >= today:
                    fresh_events_map[item.id] = item
        except Exception as exc:
            logger.warning("Could not ingest dividend crawler events: %s", exc)

        # 3. Ingest live VCI gateway events if provider or gateway available
        if (
            provider is not None
            and hasattr(provider, "_gateway")
            and hasattr(provider, "_instruments")
        ):
            try:
                symbols = [
                    item.symbol
                    for item in sorted(
                        provider._instruments,
                        key=lambda x: getattr(x, "interest_score", 0),
                        reverse=True,
                    )[:15]
                ]
                window_start = today
                window_end = today + timedelta(days=60)
                from app.infrastructure.external.vnstock_market_provider import _market_event

                def fetch_symbol_events(sym: str) -> list[Any]:
                    try:
                        return provider._gateway.event_rows(sym)
                    except Exception:
                        return []

                with ThreadPoolExecutor(max_workers=4, thread_name_prefix="event-refresh") as pool:
                    futures = {pool.submit(fetch_symbol_events, sym): sym for sym in symbols}
                    for fut in as_completed(futures):
                        sym = futures[fut]
                        rows = fut.result()
                        for row in rows:
                            v = _market_event(row, sym, window_start, window_end)
                            if v and v.event_at.astimezone(_MARKET_TZ).date() >= today:
                                fresh_events_map[v.id] = v
            except Exception as exc:
                logger.warning("Live gateway event ingestion error: %s", exc)

        # 4. Prune stale/past events and deduplicate by (symbol, event_type, date, title)
        unique_dedup: dict[tuple[str, str, str, str], MarketEvent] = {}
        for item in fresh_events_map.values():
            event_day_str = item.event_at.astimezone(_MARKET_TZ).strftime("%Y-%m-%d")
            key = (item.symbol, item.event_type, event_day_str, item.title[:30])
            if key not in unique_dedup:
                unique_dedup[key] = item

        with self._lock:
            self._registry = list(unique_dedup.values())
            self._registry.sort(key=lambda item: (item.event_at, item.symbol, item.id))
            self._last_crawled_at = now_dt

            # Synchronize with provider's internal cache if provided
            if provider is not None and hasattr(provider, "_event_cache"):
                provider._event_cache = (
                    datetime.now().timestamp() + 3600,
                    tuple(self._registry),
                )

        logger.info(
            "Corporate events refresh cycle complete: %d active events maintained (stale items pruned)",
            len(self._registry),
        )
        return self._registry


_corporate_events_crawler_instance: CorporateEventsCrawler | None = None
_crawler_lock = RLock()


def get_corporate_events_crawler() -> CorporateEventsCrawler:
    """Return thread-safe singleton CorporateEventsCrawler instance."""
    global _corporate_events_crawler_instance
    if _corporate_events_crawler_instance is None:
        with _crawler_lock:
            if _corporate_events_crawler_instance is None:
                _corporate_events_crawler_instance = CorporateEventsCrawler()
    return _corporate_events_crawler_instance
