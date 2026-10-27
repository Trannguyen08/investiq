"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMarketEcosystemDetail, getMarketEcosystems } from "@/lib/api-client";
import { formatMoney, formatPercent, changeTone } from "@/components/market/formatters";
import type { EcosystemDetailData, EcosystemSummary } from "@/types/market";

export function EcosystemGraph({
  initialEcosystemId,
}: {
  initialEcosystemId?: string;
} = {}) {
  const [ecosystems, setEcosystems] = useState<EcosystemSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialEcosystemId ?? "vingroup");
  const [detail, setDetail] = useState<EcosystemDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    getMarketEcosystems()
      .then((res) => {
        setEcosystems(res.data);
        if (res.data.length > 0 && !selectedId) {
          setSelectedId(res.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    getMarketEcosystemDetail(selectedId)
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const filteredNodes = detail?.nodes.filter((node) => {
    if (activeFilter === "listed") return Boolean(node.ticker);
    if (activeFilter === "unlisted") return !node.ticker;
    return true;
  });

  return (
    <div className="ecosystem-container">
      {/* Selector pills */}
      <div className="ecosystem-selector-bar">
        {ecosystems.map((eco) => (
          <button
            key={eco.id}
            type="button"
            className={`eco-pill-btn ${eco.id === selectedId ? "active" : ""}`}
            onClick={() => setSelectedId(eco.id)}
          >
            <strong>{eco.name}</strong>
            <small>{eco.founder_name}</small>
          </button>
        ))}
      </div>

      {loading && (
        <div className="eco-loading">
          <p>Đang tải bản đồ mạng lưới hệ sinh thái...</p>
        </div>
      )}

      {!loading && detail && (
        <div className="ecosystem-view-body">
          {/* Group Overview Card */}
          <div className="eco-overview-card">
            <div className="eco-overview-main">
              <span className="eco-badge-sector">{detail.sector}</span>
              <h2>{detail.name}</h2>
              <p className="eco-founder">
                Lãnh đạo sáng lập: <strong>{detail.founder_name}</strong>
              </p>
              <p className="eco-desc">{detail.overview}</p>
            </div>
            <div className="eco-filter-tabs">
              <button
                type="button"
                className={activeFilter === "all" ? "active" : ""}
                onClick={() => setActiveFilter("all")}
              >
                Tất cả ({detail.nodes.length})
              </button>
              <button
                type="button"
                className={activeFilter === "listed" ? "active" : ""}
                onClick={() => setActiveFilter("listed")}
              >
                Cổ phiếu niêm yết ({detail.nodes.filter((n) => n.ticker).length})
              </button>
              <button
                type="button"
                className={activeFilter === "unlisted" ? "active" : ""}
                onClick={() => setActiveFilter("unlisted")}
              >
                Doanh nghiệp ngoài sàn ({detail.nodes.filter((n) => !n.ticker).length})
              </button>
            </div>
          </div>

          {/* Interactive Network Node Grid */}
          <div className="eco-network-grid">
            {filteredNodes?.map((node) => {
              const changeVal = Number(node.change_percent || 0);
              const isParent = node.node_type === "parent";

              return (
                <div
                  key={node.id}
                  className={`eco-node-card ${isParent ? "parent-node" : ""} ${node.ticker ? "listed-node" : ""}`}
                >
                  <div className="eco-node-header">
                    <div className="eco-node-title-group">
                      <span className={`eco-type-tag ${node.node_type}`}>
                        {isParent ? "Tập đoàn mẹ" : node.ticker ? "Công ty niêm yết" : "Doanh nghiệp thành viên"}
                      </span>
                      <h3>{node.name}</h3>
                    </div>

                    {node.ticker && (
                      <Link
                        href={`/market/stocks/${node.ticker}`}
                        className="eco-ticker-pill"
                        title={`Xem biểu đồ ${node.ticker}`}
                      >
                        {node.ticker} →
                      </Link>
                    )}
                  </div>

                  <p className="eco-node-role">{node.role}</p>
                  <p className="eco-node-desc">{node.description}</p>

                  <div className="eco-node-footer">
                    <div className="eco-metric-cell">
                      <span>Tỷ lệ kiểm soát / sở hữu</span>
                      <strong>{node.ownership_percent}%</strong>
                    </div>

                    {node.price && (
                      <div className="eco-metric-cell price-cell">
                        <span>Thị giá</span>
                        <div className="price-tag-row">
                          <strong>{formatMoney(node.price)}</strong>
                          <span className={`pill-change ${changeTone(node.change_percent ?? "0")}`}>
                            {changeVal >= 0 ? "+" : ""}{formatPercent(node.change_percent ?? "0")}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="eco-metric-cell">
                      <span>Sàn niêm yết</span>
                      <strong>{node.exchange}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Value Chain & Cross-holding Link Breakdown */}
          <div className="eco-links-section">
            <h4>Mối quan hệ Sở hữu chéo &amp; Chuỗi giá trị</h4>
            <div className="eco-links-grid">
              {detail.links.map((link, idx) => (
                <div key={idx} className="eco-link-item">
                  <span className="eco-link-dot" />
                  <p>{link.label}</p>
                  <small>Loại: {link.relation_type === "ownership" ? "Sở hữu cổ phần" : "Chuỗi cung ứng & Đối tác"}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
