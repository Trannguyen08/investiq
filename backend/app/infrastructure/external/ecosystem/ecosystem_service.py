"""Vietnamese Business Conglomerates & Corporate Ecosystems Service.

Maps conglomerates, parent holding companies, listed/unlisted subsidiaries,
cross-ownership percentages, and value chains across prominent Vietnamese enterprises.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.domain.entities.market import MarketInstrument

D = Decimal


@dataclass(frozen=True, slots=True)
class EcosystemNode:
    id: str
    name: str
    ticker: str | None
    node_type: str  # 'parent' | 'listed_subsidiary' | 'unlisted_subsidiary' | 'strategic_partner'
    role: str
    ownership_percent: Decimal
    exchange: str
    description: str


@dataclass(frozen=True, slots=True)
class EcosystemLink:
    source_id: str
    target_id: str
    relation_type: str  # 'ownership' | 'supply_chain' | 'strategic_alliance'
    percentage: Decimal
    label: str


@dataclass(frozen=True, slots=True)
class EcosystemGroup:
    id: str
    name: str
    founder_id: str
    founder_name: str
    sector: str
    overview: str
    core_tickers: tuple[str, ...]
    nodes: tuple[EcosystemNode, ...]
    links: tuple[EcosystemLink, ...]


# Authoritative data for top Vietnamese business conglomerates
_ECOSYSTEMS: tuple[EcosystemGroup, ...] = (
    EcosystemGroup(
        id="vingroup",
        name="Hệ sinh thái Vingroup",
        founder_id="person-1",
        founder_name="Phạm Nhật Vượng",
        sector="Bất động sản · Xe điện · Dịch vụ",
        overview=(
            "Tập đoàn tư nhân quy mô lớn nhất Việt Nam, dẫn đầu trong mảng phát triển "
            "đô thị nhà ở cao cấp (Vinhomes), trung tâm thương mại bán lẻ (Vincom Retail), "
            "xe điện thông minh toàn cầu (VinFast) cùng dịch vụ taxi xanh GSM."
        ),
        core_tickers=("VIC", "VHM", "VRE"),
        nodes=(
            EcosystemNode(
                id="vic",
                name="Tập đoàn Vingroup",
                ticker="VIC",
                node_type="parent",
                role="Tập đoàn mẹ điều phối vốn, hạ tầng và chiến lược toàn cầu",
                ownership_percent=D("100.0"),
                exchange="HOSE",
                description="Hạt nhân trung tâm chi phối toàn bộ các công ty thành viên",
            ),
            EcosystemNode(
                id="vhm",
                name="Vinhomes",
                ticker="VHM",
                node_type="listed_subsidiary",
                role="Đầu tàu phát triển đại đô thị và bất động sản nhà ở số 1 VN",
                ownership_percent=D("66.66"),
                exchange="HOSE",
                description="Đóng góp tỷ trọng dòng tiền và lợi nhuận lớn nhất tập đoàn",
            ),
            EcosystemNode(
                id="vre",
                name="Vincom Retail",
                ticker="VRE",
                node_type="listed_subsidiary",
                role="Hệ thống trung tâm thương mại cho thuê mặt bằng lớn nhất VN",
                ownership_percent=D("18.82"),
                exchange="HOSE",
                description="Vận hành hơn 83 trung tâm thương mại Vincom khắp cả nước",
            ),
            EcosystemNode(
                id="vfs",
                name="VinFast Auto",
                ticker="VFS",
                node_type="listed_subsidiary",
                role="Hãng xe điện thông minh toàn cầu",
                ownership_percent=D("51.50"),
                exchange="NASDAQ",
                description="Mũi nhọn công nghiệp công nghệ cao vươn ra thị trường quốc tế",
            ),
            EcosystemNode(
                id="gsm",
                name="Taxi Xanh GSM",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Vận tải hành khách bằng xe thuần điện 100%",
                ownership_percent=D("95.00"),
                exchange="Unlisted",
                description="Tiêu thụ đội xe VinFast và phổ cập giao thông xanh tại Đông Nam Á",
            ),
            EcosystemNode(
                id="vinmec",
                name="Vinmec & Vinschool",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Hệ thống y tế và giáo dục phi lợi nhuận chuẩn quốc tế",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Mảnh ghép hoàn thiện tiện ích cho các đại đô thị Vinhomes",
            ),
        ),
        links=(
            EcosystemLink("vic", "vhm", "ownership", D("66.66"), "VIC sở hữu 66.66% VHM"),
            EcosystemLink("vic", "vre", "ownership", D("18.82"), "Sở hữu và liên kết quản lý"),
            EcosystemLink("vic", "vfs", "ownership", D("51.50"), "Cổ đông kiểm soát VinFast"),
            EcosystemLink(
                "vic", "gsm", "strategic_alliance", D("95.00"), "Hợp tác chiến lược xe điện"
            ),
            EcosystemLink(
                "vhm", "vre", "supply_chain", D("0"), "Mặt bằng TTTM trong các đại đô thị"
            ),
            EcosystemLink("vic", "vinmec", "ownership", D("100.0"), "Hệ thống an sinh cư dân"),
        ),
    ),
    EcosystemGroup(
        id="masan-techcombank",
        name="Hệ sinh thái Masan & Techcombank",
        founder_id="person-6",
        founder_name="Nguyễn Đăng Quang & Hồ Hùng Anh",
        sector="Tiêu dùng · Bán lẻ · Tài chính",
        overview=(
            "Liên minh quyền lực giữa đế chế hàng tiêu dùng - bán lẻ hiện đại Masan "
            "và ngân hàng số tư nhân hàng đầu Techcombank, cùng hệ sinh thái số One Mount Group."
        ),
        core_tickers=("MSN", "TCB", "MCH", "MSR"),
        nodes=(
            EcosystemNode(
                id="msn",
                name="Tập đoàn Masan",
                ticker="MSN",
                node_type="parent",
                role="Tập đoàn mẹ mảng tiêu dùng, thực phẩm và bán lẻ tích hợp",
                ownership_percent=D("100.0"),
                exchange="HOSE",
                description="Sở hữu chuỗi WinCommerce, Masan Consumer và Masan MEATLife",
            ),
            EcosystemNode(
                id="tcb",
                name="Ngân hàng Techcombank",
                ticker="TCB",
                node_type="listed_subsidiary",
                role="Ngân hàng tư nhân top đầu về CASA, vốn và dịch vụ tài chính",
                ownership_percent=D("19.90"),
                exchange="HOSE",
                description="Masan nắm giữ 19.9% cổ phần chiến lược tại Techcombank",
            ),
            EcosystemNode(
                id="mch",
                name="Masan Consumer",
                ticker="MCH",
                node_type="listed_subsidiary",
                role="Hàng tiêu dùng nhanh (Nước mắm Nam Ngư, Mì Omachi, Chinsu)",
                ownership_percent=D("70.50"),
                exchange="UPCOM",
                description="Cỗ máy in tiền mặt tỷ USD với biên lợi nhuận cao vượt trội",
            ),
            EcosystemNode(
                id="wincommerce",
                name="Chuỗi WinMart / WinMart+",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Hệ thống bán lẻ nhu yếu phẩm hiện đại lớn nhất VN (>3.600 cửa hàng)",
                ownership_percent=D("85.00"),
                exchange="Unlisted",
                description="Kênh phân phối offline trực tiếp đến hàng chục triệu người tiêu dùng",
            ),
            EcosystemNode(
                id="onemount",
                name="One Mount Group",
                ticker=None,
                node_type="strategic_partner",
                role="Hệ sinh thái công nghệ: VinShop, OneHousing, VinID",
                ownership_percent=D("0"),
                exchange="Unlisted",
                description="Liên minh công nghệ dữ liệu giữa Techcombank và gia đình Chủ tịch",
            ),
        ),
        links=(
            EcosystemLink("msn", "tcb", "ownership", D("19.90"), "MSN sở hữu 19.9% TCB"),
            EcosystemLink("msn", "mch", "ownership", D("70.50"), "Mẹ - con trực tiếp"),
            EcosystemLink("msn", "wincommerce", "ownership", D("85.00"), "Chi phối WinMart"),
            EcosystemLink(
                "tcb", "onemount", "strategic_alliance", D("0"), "Tài trợ và tích hợp tài chính số"
            ),
            EcosystemLink(
                "wincommerce", "mch", "supply_chain", D("0"), "Kênh phân phối hàng Chinsu/Omachi"
            ),
        ),
    ),
    EcosystemGroup(
        id="hoaphat",
        name="Hệ sinh thái Hòa Phát",
        founder_id="person-2",
        founder_name="Trần Đình Long",
        sector="Thép · Công nghiệp nặng · Cảng biển",
        overview=(
            "Nhà sản xuất thép số 1 Đông Nam Á, tích hợp trọn vẹn chuỗi giá trị từ quặng sắt, "
            "luyện kim Dung Quất, thép xây dựng & cuộn cán nóng HRC, đến cảng biển và nông nghiệp."
        ),
        core_tickers=("HPG",),
        nodes=(
            EcosystemNode(
                id="hpg",
                name="Tập đoàn Hòa Phát",
                ticker="HPG",
                node_type="parent",
                role="Tập đoàn mẹ chi phối 4 trụ cột: Gang thép, Sản phẩm thép, Nông nghiệp, BĐS",
                ownership_percent=D("100.0"),
                exchange="HOSE",
                description="Vốn hóa trên 130.000 tỷ đồng, thị phần thép xây dựng >38% cả nước",
            ),
            EcosystemNode(
                id="dungquat",
                name="Khu liên hợp Gang Thép Dung Quất",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Tổ hợp luyện thép quy mô hàng tỷ USD tại Quảng Ngãi",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Dung Quất 1 & 2 nâng công suất thép thô lên trên 14 triệu tấn/năm",
            ),
            EcosystemNode(
                id="cangbien",
                name="Cảng tổng hợp nước sâu Hòa Phát",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Cảng biển đón tàu trọng tải 200.000 DWT phục vụ xuất nhập khẩu than/quặng",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Tối ưu chi phí logistics vận chuyển nguyên nhiên liệu siêu rẻ",
            ),
            EcosystemNode(
                id="nongnghiep",
                name="Nông nghiệp Hòa Phát",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Thức ăn chăn nuôi, nuôi bò Úc và trứng gà sạch",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Đóng góp doanh thu ổn định hàng nghìn tỷ đồng mỗi quý",
            ),
        ),
        links=(
            EcosystemLink("hpg", "dungquat", "ownership", D("100.0"), "Chi phối 100% vốn"),
            EcosystemLink("hpg", "cangbien", "supply_chain", D("100.0"), "Logistics tích hợp"),
            EcosystemLink(
                "hpg", "nongnghiep", "ownership", D("100.0"), "Mảng nông nghiệp đa ngành"
            ),
        ),
    ),
    EcosystemGroup(
        id="fpt",
        name="Hệ sinh thái FPT",
        founder_id="person-7",
        founder_name="Trương Gia Bình",
        sector="Công nghệ thông tin · Viễn thông · Bán lẻ",
        overview=(
            "Đế chế công nghệ thông tin lớn nhất Việt Nam, dẫn dắt làn sóng xuất khẩu phần mềm "
            "sang Nhật, Mỹ, châu Âu; hạ tầng FPT Telecom; giáo dục FPT và chuỗi Long Châu."
        ),
        core_tickers=("FPT", "FOX", "FRT"),
        nodes=(
            EcosystemNode(
                id="fpt_corp",
                name="Tập đoàn FPT",
                ticker="FPT",
                node_type="parent",
                role="Tập đoàn mẹ điều hành mảng Xuất khẩu Phần mềm & Chuyển đổi số AI",
                ownership_percent=D("100.0"),
                exchange="HOSE",
                description="Dẫn dắt ngành công nghệ Việt Nam đạt doanh thu 1 tỷ USD quốc tế",
            ),
            EcosystemNode(
                id="fox",
                name="FPT Telecom",
                ticker="FOX",
                node_type="listed_subsidiary",
                role="Hạ tầng Internet cáp quang, Data Center và truyền hình FPT Play",
                ownership_percent=D("45.65"),
                exchange="UPCOM",
                description="Dòng tiền mặt dồi dào, chia cổ tức tiền mặt đều đặn hàng năm",
            ),
            EcosystemNode(
                id="frt",
                name="FPT Retail (Bán lẻ & Long Châu)",
                ticker="FRT",
                node_type="listed_subsidiary",
                role="Chuỗi nhà thuốc số 1 Việt Nam FPT Long Châu và FPT Shop",
                ownership_percent=D("46.50"),
                exchange="HOSE",
                description="Long Châu bùng nổ quy mô >1.700 nhà thuốc tạo tăng trưởng phi mã",
            ),
            EcosystemNode(
                id="fpt_edu",
                name="FPT Education",
                ticker=None,
                node_type="unlisted_subsidiary",
                role="Hệ thống Đại học, Cao đẳng và Phổ thông FPT",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Đào tạo hơn 100.000 học sinh/sinh viên cung ứng cho FPT Software",
            ),
        ),
        links=(
            EcosystemLink("fpt_corp", "fox", "ownership", D("45.65"), "FPT sở hữu 45.65%"),
            EcosystemLink("fpt_corp", "frt", "ownership", D("46.50"), "FPT sở hữu 46.50%"),
            EcosystemLink(
                "fpt_corp", "fpt_edu", "ownership", D("100.0"), "Cung cấp nhân tài công nghệ"
            ),
            EcosystemLink(
                "fox",
                "frt",
                "supply_chain",
                D("0"),
                "Tích hợp dịch vụ SIM, viễn thông và thanh toán",
            ),
        ),
    ),
    EcosystemGroup(
        id="sovico",
        name="Hệ sinh thái Sovico · HDBank · Vietjet",
        founder_id="person-3",
        founder_name="Nguyễn Thị Phương Thảo",
        sector="Hàng không · Tài chính · Bất động sản",
        overview=(
            "Tập đoàn đa ngành sở hữu hãng hàng không Vietjet Air, Ngân hàng HDBank "
            "cùng chuỗi bất động sản nghỉ dưỡng và năng lượng tái tạo cao cấp."
        ),
        core_tickers=("VJC", "HDB"),
        nodes=(
            EcosystemNode(
                id="sovico_holdings",
                name="Tập đoàn Sovico",
                ticker=None,
                node_type="parent",
                role="Tập đoàn đầu tư mẹ nắm giữ cổ phần kiểm soát trong Vietjet và HDBank",
                ownership_percent=D("100.0"),
                exchange="Unlisted",
                description="Đầu tư hạ tầng hàng không, năng lượng xanh và bất động sản",
            ),
            EcosystemNode(
                id="vjc",
                name="Vietjet Air",
                ticker="VJC",
                node_type="listed_subsidiary",
                role="Hãng hàng không tư nhân lớn nhất Việt Nam mạng bay quốc tế phủ rộng",
                ownership_percent=D("24.50"),
                exchange="HOSE",
                description="Doanh thu hàng không và phụ trợ dẫn đầu tăng trưởng",
            ),
            EcosystemNode(
                id="hdb",
                name="Ngân hàng HDBank",
                ticker="HDB",
                node_type="listed_subsidiary",
                role="Ngân hàng bán lẻ đa năng có tốc độ tăng trưởng ROE top đầu hệ thống",
                ownership_percent=D("14.50"),
                exchange="HOSE",
                description="Hỗ trợ tài chính, thanh toán và bảo hiểm độc quyền hệ sinh thái",
            ),
        ),
        links=(
            EcosystemLink(
                "sovico_holdings", "vjc", "ownership", D("24.50"), "Cổ đông sáng lập lớn"
            ),
            EcosystemLink("sovico_holdings", "hdb", "ownership", D("14.50"), "Cổ đông chiến lược"),
            EcosystemLink(
                "hdb",
                "vjc",
                "strategic_alliance",
                D("0"),
                "Tích hợp thanh toán vé máy bay và thẻ đồng thương hiệu",
            ),
        ),
    ),
    EcosystemGroup(
        id="ssi-pan",
        name="Hệ sinh thái SSI & The PAN Group",
        founder_id="person-14",
        founder_name="Nguyễn Duy Hưng",
        sector="Tài chính chứng khoán · Nông nghiệp sạch",
        overview=(
            "Liên minh vững chãi kết hợp giữa định chế tài chính dẫn đầu SSI và "
            "tập đoàn nông nghiệp - thực phẩm đóng gói chuẩn xuất khẩu The PAN Group."
        ),
        core_tickers=("SSI", "PAN"),
        nodes=(
            EcosystemNode(
                id="ssi",
                name="Chứng khoán SSI",
                ticker="SSI",
                node_type="parent",
                role="Định chế tài chính chứng khoán và ngân hàng đầu tư (IB) số 1 VN",
                ownership_percent=D("100.0"),
                exchange="HOSE",
                description="Thị phần môi giới và nguồn vốn cho vay margin hàng đầu",
            ),
            EcosystemNode(
                id="pan",
                name="Tập đoàn The PAN Group",
                ticker="PAN",
                node_type="listed_subsidiary",
                role="Nông nghiệp sạch khép kín Farm - Food - Family",
                ownership_percent=D("20.90"),
                exchange="HOSE",
                description="Sở hữu thương hiệu Bibica (BBC), Hạt giống NSC, Thủy sản Sao Ta (FMC)",
            ),
        ),
        links=(
            EcosystemLink(
                "ssi",
                "pan",
                "strategic_alliance",
                D("20.90"),
                "SSI và liên minh NDH nắm quyền chi phối",
            ),
        ),
    ),
)


class EcosystemService:
    """Service providing corporate ecosystem graphs and live ticker valuations."""

    def __init__(self) -> None:
        self._ecosystems: dict[str, EcosystemGroup] = {g.id: g for g in _ECOSYSTEMS}

    def list_ecosystems(self, instruments: Sequence[MarketInstrument] = ()) -> list[dict[str, Any]]:
        """Return summary of all corporate ecosystems."""
        price_map = {inst.symbol.upper(): inst for inst in instruments}
        result: list[dict[str, Any]] = []

        for eco in self._ecosystems.values():
            tickers_data = []
            total_cap = Decimal("0")
            for t in eco.core_tickers:
                inst = price_map.get(t.upper())
                cap = inst.market_cap if inst else Decimal("0")
                total_cap += cap
                tickers_data.append(
                    {
                        "symbol": t,
                        "price": str(inst.price) if inst else "0",
                        "change_percent": str(inst.change_percent) if inst else "0",
                        "market_cap": str(cap),
                    }
                )

            result.append(
                {
                    "id": eco.id,
                    "name": eco.name,
                    "founder_id": eco.founder_id,
                    "founder_name": eco.founder_name,
                    "sector": eco.sector,
                    "overview": eco.overview,
                    "core_tickers": tickers_data,
                    "total_market_cap": str(total_cap),
                    "node_count": len(eco.nodes),
                    "link_count": len(eco.links),
                }
            )

        return result

    def get_ecosystem_detail(
        self, ecosystem_id: str, instruments: Sequence[MarketInstrument] = ()
    ) -> dict[str, Any] | None:
        """Return full node graph for a specific corporate ecosystem."""
        eco = self._ecosystems.get(ecosystem_id)
        if not eco:
            return None

        price_map = {inst.symbol.upper(): inst for inst in instruments}

        nodes_list = []
        for n in eco.nodes:
            inst = price_map.get(n.ticker.upper()) if n.ticker else None
            nodes_list.append(
                {
                    "id": n.id,
                    "name": n.name,
                    "ticker": n.ticker,
                    "node_type": n.node_type,
                    "role": n.role,
                    "ownership_percent": str(n.ownership_percent),
                    "exchange": n.exchange,
                    "description": n.description,
                    "price": str(inst.price) if inst else None,
                    "change_percent": str(inst.change_percent) if inst else None,
                    "market_cap": str(inst.market_cap) if inst else None,
                }
            )

        links_list = [
            {
                "source": link.source_id,
                "target": link.target_id,
                "relation_type": link.relation_type,
                "percentage": str(link.percentage),
                "label": link.label,
            }
            for link in eco.links
        ]

        return {
            "id": eco.id,
            "name": eco.name,
            "founder_id": eco.founder_id,
            "founder_name": eco.founder_name,
            "sector": eco.sector,
            "overview": eco.overview,
            "nodes": nodes_list,
            "links": links_list,
        }


_ecosystem_service: EcosystemService | None = None


def get_ecosystem_service() -> EcosystemService:
    global _ecosystem_service
    if _ecosystem_service is None:
        _ecosystem_service = EcosystemService()
    return _ecosystem_service
