"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMarketEcosystemDetail, getMarketEcosystems } from "@/lib/api-client";
import { formatMoney, formatPercent, changeTone } from "@/components/market/formatters";
import type { EcosystemDetailData, EcosystemNode, EcosystemSummary } from "@/types/market";

// Brand styling definitions for the 6 conglomerates
const CONGLOMERATE_THEMES: Record<
  string,
  {
    accent: string;
    badgeBg: string;
    gradient: string;
    haloColor: string;
    monogram: string;
    icon: string;
    parentName: string;
    sectorLabel: string;
  }
> = {
  vingroup: {
    accent: "#38bdf8",
    badgeBg: "rgba(56, 189, 248, 0.14)",
    gradient: "linear-gradient(135deg, rgba(14, 116, 144, 0.28), rgba(30, 58, 138, 0.38))",
    haloColor: "rgba(56, 189, 248, 0.3)",
    monogram: "VIC",
    icon: "🏢",
    parentName: "Tập đoàn Vingroup",
    sectorLabel: "Bất động sản · Xe điện · Bán lẻ",
  },
  "masan-techcombank": {
    accent: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    gradient: "linear-gradient(135deg, rgba(220, 38, 38, 0.28), rgba(217, 119, 6, 0.34))",
    haloColor: "rgba(245, 158, 11, 0.3)",
    monogram: "MSN",
    icon: "🛒",
    parentName: "Masan Group & TCB",
    sectorLabel: "Hàng tiêu dùng · Bán lẻ · Tài chính số",
  },
  hoaphat: {
    accent: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.14)",
    gradient: "linear-gradient(135deg, rgba(5, 150, 105, 0.28), rgba(13, 148, 136, 0.34))",
    haloColor: "rgba(16, 185, 129, 0.3)",
    monogram: "HPG",
    icon: "🏗️",
    parentName: "Tập đoàn Hòa Phát",
    sectorLabel: "Thép · Công nghiệp nặng · Logistics cảng biển",
  },
  fpt: {
    accent: "#818cf8",
    badgeBg: "rgba(129, 140, 248, 0.14)",
    gradient: "linear-gradient(135deg, rgba(79, 70, 229, 0.28), rgba(147, 51, 234, 0.34))",
    haloColor: "rgba(129, 140, 248, 0.3)",
    monogram: "FPT",
    icon: "💻",
    parentName: "Tập đoàn FPT",
    sectorLabel: "Công nghệ thông tin · Viễn thông · AI & Bán lẻ",
  },
  sovico: {
    accent: "#fb923c",
    badgeBg: "rgba(251, 146, 60, 0.14)",
    gradient: "linear-gradient(135deg, rgba(225, 29, 72, 0.28), rgba(234, 88, 12, 0.34))",
    haloColor: "rgba(251, 146, 60, 0.3)",
    monogram: "VJC",
    icon: "✈️",
    parentName: "Tập đoàn Sovico",
    sectorLabel: "Hàng không · Tài chính ngân hàng · Bất động sản nghỉ dưỡng",
  },
  "ssi-pan": {
    accent: "#eab308",
    badgeBg: "rgba(234, 179, 8, 0.14)",
    gradient: "linear-gradient(135deg, rgba(202, 138, 4, 0.28), rgba(2, 132, 199, 0.34))",
    haloColor: "rgba(234, 179, 8, 0.3)",
    monogram: "SSI",
    icon: "🌾",
    parentName: "SSI & The PAN Group",
    sectorLabel: "Chứng khoán & Quản lý quỹ · Nông nghiệp sạch",
  },
};

function formatTrillion(rawVal: string | number | undefined | null): string {
  if (!rawVal) return "--";
  const num = typeof rawVal === "number" ? rawVal : Number(rawVal);
  if (!Number.isFinite(num) || num <= 0) return "--";
  if (num >= 1e12) {
    const formatted = (num / 1e12).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    return `${formatted} nghìn tỷ ₫`;
  }
  if (num >= 1e9) {
    const formatted = (num / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    return `${formatted} tỷ ₫`;
  }
  return `${num.toLocaleString("vi-VN")} ₫`;
}

export function EcosystemGraph({
  initialEcosystemId,
  initialEcosystems,
}: {
  initialEcosystemId?: string;
  initialEcosystems?: EcosystemSummary[];
} = {}) {
  const [ecosystems, setEcosystems] = useState<EcosystemSummary[]>(initialEcosystems ?? []);
  const [selectedId, setSelectedId] = useState<string>(initialEcosystemId ?? initialEcosystems?.[0]?.id ?? "vingroup");
  const [detail, setDetail] = useState<EcosystemDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialEcosystems?.length);
  const [viewLayout, setViewLayout] = useState<"tree" | "matrix">("tree");
  const [nodeFilter, setNodeFilter] = useState<"all" | "listed" | "unlisted">("all");

  // Sync if initialEcosystemId changes from external props or URL
  useEffect(() => {
    if (initialEcosystemId && initialEcosystemId !== selectedId) {
      setSelectedId(initialEcosystemId);
    }
  }, [initialEcosystemId, selectedId]);

  // Load ecosystems list if not provided
  useEffect(() => {
    if (ecosystems.length > 0) return;
    let ignore = false;
    getMarketEcosystems()
      .then((res) => {
        if (!ignore && res.data.length > 0) {
          setEcosystems(res.data);
          if (!selectedId) setSelectedId(res.data[0].id);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [ecosystems.length, selectedId]);

  // Load ecosystem detail whenever selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    let ignore = false;
    setLoading(true);
    getMarketEcosystemDetail(selectedId)
      .then((res) => {
        if (!ignore) setDetail(res.data);
      })
      .catch(() => {
        if (!ignore) setDetail(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedId]);

  const currentSummary = useMemo(
    () => ecosystems.find((e) => e.id === selectedId) ?? ecosystems[0],
    [ecosystems, selectedId]
  );

  const theme = CONGLOMERATE_THEMES[selectedId] ?? CONGLOMERATE_THEMES.vingroup;

  // Split nodes for tree layout: Parent node, Listed subsidiaries, Unlisted subsidiaries
  const { parentNode, listedNodes, unlistedNodes } = useMemo(() => {
    if (!detail) return { parentNode: null, listedNodes: [], unlistedNodes: [] };
    const parent = detail.nodes.find((n) => n.node_type === "parent") ?? detail.nodes[0];
    const listed = detail.nodes.filter((n) => n.id !== parent?.id && Boolean(n.ticker));
    const unlisted = detail.nodes.filter((n) => n.id !== parent?.id && !n.ticker);
    return { parentNode: parent, listedNodes: listed, unlistedNodes: unlisted };
  }, [detail]);

  // Filtered nodes for Matrix layout
  const filteredNodes = useMemo(() => {
    if (!detail) return [];
    return detail.nodes.filter((node) => {
      if (nodeFilter === "listed") return Boolean(node.ticker);
      if (nodeFilter === "unlisted") return !node.ticker;
      return true;
    });
  }, [detail, nodeFilter]);

  return (
    <div className="eco-explorer-root">
      {/* 1. Conglomerate Carousel Selector Strip */}
      <section className="eco-selector-strip" aria-label="Danh sách 6 Tập đoàn kinh tế lớn nhất">
        {ecosystems.map((eco) => {
          const itemTheme = CONGLOMERATE_THEMES[eco.id] ?? CONGLOMERATE_THEMES.vingroup;
          const isSelected = eco.id === selectedId;

          return (
            <button
              key={eco.id}
              type="button"
              className={`eco-strip-card ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedId(eco.id)}
              style={
                isSelected
                  ? {
                      borderColor: itemTheme.accent,
                      boxShadow: `0 8px 24px -4px ${itemTheme.haloColor}`,
                    }
                  : undefined
              }
            >
              <div className="eco-strip-header">
                <span className="eco-strip-monogram" style={{ background: itemTheme.badgeBg, color: itemTheme.accent }}>
                  {itemTheme.monogram}
                </span>
                <span className="eco-strip-badge">{eco.node_count} đơn vị</span>
              </div>
              <h3 className="eco-strip-name">{eco.name}</h3>
              <p className="eco-strip-founder">{eco.founder_name}</p>
              <div className="eco-strip-footer">
                <div className="eco-strip-tickers">
                  {eco.core_tickers.slice(0, 3).map((t) => (
                    <span key={t.symbol} className="eco-chip-ticker">
                      {t.symbol}
                    </span>
                  ))}
                  {eco.core_tickers.length > 3 && (
                    <span className="eco-chip-more">+{eco.core_tickers.length - 3}</span>
                  )}
                </div>
                <span className="eco-strip-cap" title="Tổng vốn hóa niêm yết">
                  {formatTrillion(eco.total_market_cap)}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Loading state indicator */}
      {loading && (
        <div className="eco-loading-indicator">
          <div className="eco-spinner" />
          <p>Đang tải dữ liệu mạng lưới hệ sinh thái {currentSummary?.name || ""}...</p>
        </div>
      )}

      {/* 2. Conglomerate Detail View */}
      {!loading && detail && (
        <div className="eco-content-body">
          {/* Hero Banner with Conglomerate Branding & Key Stats */}
          <section
            className="eco-hero-banner"
            style={{
              background: theme.gradient,
              borderColor: `${theme.accent}40`,
            }}
          >
            <div className="eco-hero-left">
              <div className="eco-hero-meta">
                <span className="eco-tag-sector" style={{ color: theme.accent, borderColor: `${theme.accent}60` }}>
                  {detail.sector}
                </span>
                <span className="eco-tag-id">Hệ sinh thái #{detail.id.toUpperCase()}</span>
              </div>
              <h2 className="eco-hero-title">{detail.name}</h2>
              <div className="eco-hero-founder-row">
                <span className="eco-founder-badge">
                  <span className="founder-icon">👑</span>
                  Lãnh đạo sáng lập: <strong>{detail.founder_name}</strong>
                </span>
                <Link
                  href="/market/people"
                  className="eco-founder-link"
                  title={`Xem hồ sơ của ${detail.founder_name} trên bảng Doanh nhân`}
                >
                  Xem hồ sơ tỷ phú →
                </Link>
              </div>
              <p className="eco-hero-overview">{detail.overview}</p>
            </div>

            {/* Conglomerate Key Stats 4-Pack */}
            <div className="eco-hero-stats-grid">
              <div className="eco-stat-box">
                <span className="eco-stat-label">Tổng vốn hóa niêm yết</span>
                <strong className="eco-stat-value highlight" style={{ color: theme.accent }}>
                  {formatTrillion(currentSummary?.total_market_cap)}
                </strong>
                <span className="eco-stat-hint">Tính theo thị giá thực tế Vnstock</span>
              </div>

              <div className="eco-stat-box">
                <span className="eco-stat-label">Quy mô doanh nghiệp</span>
                <strong className="eco-stat-value">{detail.nodes.length} đơn vị</strong>
                <span className="eco-stat-hint">
                  {listedNodes.length + (parentNode?.ticker ? 1 : 0)} niêm yết · {unlistedNodes.length} ngoài sàn
                </span>
              </div>

              <div className="eco-stat-box">
                <span className="eco-stat-label">Mạng lưới dòng vốn</span>
                <strong className="eco-stat-value">{detail.links.length} liên kết</strong>
                <span className="eco-stat-hint">Sở hữu chéo &amp; Chuỗi cung ứng</span>
              </div>

              <div className="eco-stat-box">
                <span className="eco-stat-label">Hạt nhân chi phối</span>
                <strong className="eco-stat-value">{theme.monogram}</strong>
                <span className="eco-stat-hint">{theme.parentName}</span>
              </div>
            </div>
          </section>

          {/* Interactive Layout Controls & Scope Switcher */}
          <div className="eco-controls-strip">
            <div className="eco-layout-toggle" role="tablist" aria-label="Chế độ hiển thị">
              <button
                type="button"
                className={`eco-layout-btn ${viewLayout === "tree" ? "active" : ""}`}
                onClick={() => setViewLayout("tree")}
              >
                🌳 Sơ đồ Cấu trúc Phân nhánh
              </button>
              <button
                type="button"
                className={`eco-layout-btn ${viewLayout === "matrix" ? "active" : ""}`}
                onClick={() => setViewLayout("matrix")}
              >
                📊 Ma trận Thẻ Chi tiết
              </button>
            </div>

            {viewLayout === "matrix" && (
              <div className="eco-filter-pills" role="tablist" aria-label="Bộ lọc doanh nghiệp">
                <button
                  type="button"
                  className={`eco-filter-btn ${nodeFilter === "all" ? "active" : ""}`}
                  onClick={() => setNodeFilter("all")}
                >
                  Tất cả ({detail.nodes.length})
                </button>
                <button
                  type="button"
                  className={`eco-filter-btn ${nodeFilter === "listed" ? "active" : ""}`}
                  onClick={() => setNodeFilter("listed")}
                >
                  Cổ phiếu niêm yết ({listedNodes.length + (parentNode?.ticker ? 1 : 0)})
                </button>
                <button
                  type="button"
                  className={`eco-filter-btn ${nodeFilter === "unlisted" ? "active" : ""}`}
                  onClick={() => setNodeFilter("unlisted")}
                >
                  Doanh nghiệp ngoài sàn ({unlistedNodes.length})
                </button>
              </div>
            )}
          </div>

          {/* LAYOUT 1: Sơ đồ Cấu trúc Phân nhánh (Tree View) */}
          {viewLayout === "tree" && (
            <section className="eco-tree-section" aria-label="Sơ đồ phân nhánh sở hữu">
              {/* LEVEL 1: Central Parent Holding Card */}
              {parentNode && (
                <div className="eco-tree-level level-parent">
                  <div className="level-badge-wrap">
                    <span className="level-badge parent" style={{ color: theme.accent, borderColor: theme.accent }}>
                      👑 HẠT NHÂN TẬP ĐOÀN MẸ &amp; TRUNG TÂM ĐIỀU PHỐI VỐN
                    </span>
                  </div>

                  <div className="eco-parent-hub-card" style={{ borderColor: `${theme.accent}80` }}>
                    <div className="hub-card-header">
                      <div className="hub-identity">
                        <span className="hub-icon">{theme.icon}</span>
                        <div>
                          <span className="hub-type-tag">Tập đoàn mẹ chi phối</span>
                          <h3 className="hub-name">{parentNode.name}</h3>
                        </div>
                      </div>

                      {parentNode.ticker && (
                        <div className="hub-quote-box">
                          <Link
                            href={`/market/stocks/${parentNode.ticker}`}
                            className="hub-ticker-capsule"
                            title={`Xem bảng giá và biểu đồ ${parentNode.ticker}`}
                            style={{ background: theme.accent }}
                          >
                            {parentNode.ticker} ↗
                          </Link>
                          {parentNode.price && (
                            <div className="hub-price-row">
                              <span className="hub-price">{formatMoney(parentNode.price)}</span>
                              <span className={`hub-change ${changeTone(parentNode.change_percent ?? "0")}`}>
                                {Number(parentNode.change_percent || 0) >= 0 ? "+" : ""}
                                {formatPercent(parentNode.change_percent ?? "0")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="hub-role">{parentNode.role}</p>
                    <p className="hub-desc">{parentNode.description}</p>

                    <div className="hub-metrics-bar">
                      <div className="hub-metric">
                        <span>Tỷ lệ kiểm soát tối đa</span>
                        <strong>100%</strong>
                      </div>
                      <div className="hub-metric">
                        <span>Sàn giao dịch</span>
                        <strong>{parentNode.exchange}</strong>
                      </div>
                      {parentNode.market_cap && (
                        <div className="hub-metric">
                          <span>Vốn hóa thị trường</span>
                          <strong>{formatTrillion(parentNode.market_cap)}</strong>
                        </div>
                      )}
                      <div className="hub-metric">
                        <span>Đơn vị trực thuộc</span>
                        <strong>{listedNodes.length + unlistedNodes.length} công ty con</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic SVG Branching Connector & Flow Divider */}
              <div className="eco-tree-branch-divider">
                <div className="branch-line-v" style={{ background: theme.accent }} />
                <div className="branch-banner">
                  <span className="branch-dot" style={{ background: theme.accent }} />
                  <span>DÒNG VỐN &amp; SỞ HỮU CHI PHỐI TRỰC TIẾP (DIRECT CAPITAL &amp; GOVERNANCE FLOW)</span>
                  <span className="branch-dot" style={{ background: theme.accent }} />
                </div>
                <div className="branch-line-v" style={{ background: theme.accent }} />
              </div>

              {/* LEVEL 2: Listed Subsidiaries Grid */}
              <div className="eco-tree-level level-listed">
                <div className="level-badge-wrap">
                  <span className="level-badge listed">
                    📈 CÔNG TY THÀNH VIÊN NIÊM YẾT TRÊN SÀN CHỨNG KHOÁN ({listedNodes.length})
                  </span>
                </div>

                <div className="eco-subsidiary-grid">
                  {listedNodes.map((node) => (
                    <NodeVisualCard key={node.id} node={node} accentColor={theme.accent} isListed />
                  ))}
                </div>
              </div>

              {/* Unlisted Flow Divider */}
              {unlistedNodes.length > 0 && (
                <>
                  <div className="eco-tree-branch-divider unlisted-divider">
                    <div className="branch-line-v dashed" />
                    <div className="branch-banner unlisted">
                      <span>DOANH NGHIỆP NGOÀI SÀN &amp; HỆ SINH THÁI MỞ RỘNG (STRATEGIC &amp; UNLISTED VENTURES)</span>
                    </div>
                    <div className="branch-line-v dashed" />
                  </div>

                  {/* LEVEL 3: Unlisted Strategic Subsidiaries */}
                  <div className="eco-tree-level level-unlisted">
                    <div className="level-badge-wrap">
                      <span className="level-badge unlisted">
                        🔒 DOANH NGHIỆP NGOÀI SÀN &amp; HỆ SINH THÁI DỊCH VỤ ({unlistedNodes.length})
                      </span>
                    </div>

                    <div className="eco-subsidiary-grid unlisted-grid">
                      {unlistedNodes.map((node) => (
                        <NodeVisualCard key={node.id} node={node} accentColor={theme.accent} isListed={false} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* LAYOUT 2: Ma trận Thẻ Chi tiết (Matrix Grid View) */}
          {viewLayout === "matrix" && (
            <section className="eco-matrix-section" aria-label="Ma trận thẻ doanh nghiệp">
              <div className="eco-matrix-grid">
                {filteredNodes.map((node) => (
                  <NodeVisualCard
                    key={node.id}
                    node={node}
                    accentColor={theme.accent}
                    isListed={Boolean(node.ticker)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3. Value Chain & Cross-holding Capital Flow Matrix */}
          <section className="eco-synergies-section" aria-label="Mối liên kết sở hữu chéo và chuỗi giá trị">
            <div className="eco-section-heading">
              <div>
                <h3>Mối quan hệ Sở hữu chéo &amp; Chuỗi Giá trị Liên kết</h3>
                <p>Bản đồ dòng vốn điều phối, cung ứng nguyên vật liệu và hỗ trợ chéo giữa các pháp nhân trong tập đoàn.</p>
              </div>
              <span className="eco-section-badge">{detail.links.length} liên kết trọng yếu</span>
            </div>

            <div className="eco-synergies-grid">
              {detail.links.map((link, idx) => {
                const isOwnership = link.relation_type === "ownership";
                const isSupply = link.relation_type === "supply_chain";

                return (
                  <div key={idx} className={`eco-synergy-card ${link.relation_type}`}>
                    <div className="synergy-top-row">
                      <span className={`synergy-tag ${link.relation_type}`}>
                        {isOwnership
                          ? "Sở hữu cổ phần"
                          : isSupply
                          ? "Chuỗi cung ứng & Mặt bằng"
                          : "Liên minh chiến lược"}
                      </span>
                      {link.percentage && Number(link.percentage) > 0 && (
                        <span className="synergy-pct-pill">{link.percentage}% vốn</span>
                      )}
                    </div>

                    {/* Source -> Target Visual Arrow */}
                    <div className="synergy-flow-row">
                      <span className="synergy-node-chip source">{link.source.toUpperCase()}</span>
                      <div className="synergy-arrow">
                        <span className="arrow-line" />
                        <span className="arrow-head">►</span>
                      </div>
                      <span className="synergy-node-chip target">{link.target.toUpperCase()}</span>
                    </div>

                    <p className="synergy-label">{link.label}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// Reusable Visual Node Card for both Tree and Matrix views
function NodeVisualCard({
  node,
  accentColor,
  isListed,
}: {
  node: EcosystemNode;
  accentColor: string;
  isListed: boolean;
}) {
  const changeVal = Number(node.change_percent || 0);

  return (
    <div className={`eco-card-node ${isListed ? "listed-card" : "unlisted-card"}`}>
      <div className="node-card-head">
        <div className="node-title-group">
          <span className={`node-badge-type ${isListed ? "listed" : "unlisted"}`}>
            {isListed ? "Công ty niêm yết" : "Doanh nghiệp ngoài sàn"}
          </span>
          <h4 className="node-name">{node.name}</h4>
        </div>

        {node.ticker && (
          <Link
            href={`/market/stocks/${node.ticker}`}
            className="node-ticker-pill"
            title={`Xem biểu đồ kỹ thuật mã ${node.ticker}`}
          >
            {node.ticker} ↗
          </Link>
        )}
      </div>

      <p className="node-role-text">{node.role}</p>
      <p className="node-desc-text">{node.description}</p>

      {/* Ownership progress gauge */}
      <div className="node-ownership-box">
        <div className="ownership-text-row">
          <span>Tỷ lệ tập đoàn nắm giữ</span>
          <strong>{node.ownership_percent}%</strong>
        </div>
        <div className="ownership-track">
          <div
            className="ownership-fill"
            style={{
              width: `${Math.min(100, Math.max(0, Number(node.ownership_percent) || 0))}%`,
              background: isListed ? accentColor : "#a855f7",
            }}
          />
        </div>
      </div>

      {/* Financial stats footer */}
      <div className="node-card-footer">
        {node.price ? (
          <div className="node-footer-cell">
            <span className="footer-label">Thị giá sàn</span>
            <div className="price-badge-row">
              <strong className="footer-price">{formatMoney(node.price)}</strong>
              <span className={`pill-mini-change ${changeTone(node.change_percent ?? "0")}`}>
                {changeVal >= 0 ? "+" : ""}
                {formatPercent(node.change_percent ?? "0")}
              </span>
            </div>
          </div>
        ) : (
          <div className="node-footer-cell">
            <span className="footer-label">Định dạng</span>
            <strong className="footer-val-unlisted">Pháp nhân riêng</strong>
          </div>
        )}

        <div className="node-footer-cell right">
          <span className="footer-label">Sàn giao dịch</span>
          <strong className="footer-exchange">{node.exchange}</strong>
        </div>
      </div>
    </div>
  );
}
