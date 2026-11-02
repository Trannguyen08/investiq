"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { changeTone, formatMoney, formatPercent } from "@/components/market/formatters";
import { EcosystemGraph } from "@/components/market/ecosystem-graph";
import { PersonDetailModal } from "@/components/market/person-detail-modal";
import type { MarketPerson, PeopleCollection } from "@/types/market";

export function PeopleView({ collection }: { collection: PeopleCollection }) {
  const [viewMode, setViewMode] = useState<"leaders" | "ecosystems">("leaders");
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("Tất cả");
  const [sortBy, setSortBy] = useState<"equity" | "change">("equity");
  const [selectedPerson, setSelectedPerson] = useState<MarketPerson | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | undefined>(undefined);
  const [targetEcosystemId, setTargetEcosystemId] = useState<string | undefined>(undefined);

  const sectors = useMemo(() => [
    "Tất cả",
    "Bất động sản",
    "Tài chính & Ngân hàng",
    "Công nghệ",
    "Thép & Công nghiệp",
    "Tiêu dùng & Bán lẻ",
    "Nông nghiệp",
    "Xây dựng",
    "Vật liệu & Năng lượng",
  ], []);

  const filteredLeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collection.data
      .filter((person) => {
        if (q) {
          const matchName = person.full_name.toLowerCase().includes(q);
          const matchComp = person.company.toLowerCase().includes(q);
          const matchSym = person.symbols.some((sym) => sym.toLowerCase().includes(q));
          if (!matchName && !matchComp && !matchSym) return false;
        }

        if (selectedSector !== "Tất cả") {
          const personSec = person.sector.toLowerCase();
          if (selectedSector === "Bất động sản" && !personSec.includes("bất động sản")) return false;
          if (selectedSector === "Tài chính & Ngân hàng" && !personSec.includes("tài chính") && !personSec.includes("ngân hàng")) return false;
          if (selectedSector === "Công nghệ" && !personSec.includes("công nghệ")) return false;
          if (selectedSector === "Thép & Công nghiệp" && !personSec.includes("thép") && !personSec.includes("công nghiệp")) return false;
          if (selectedSector === "Tiêu dùng & Bán lẻ" && !personSec.includes("tiêu dùng") && !personSec.includes("bán lẻ")) return false;
          if (selectedSector === "Nông nghiệp" && !personSec.includes("nông nghiệp")) return false;
          if (selectedSector === "Xây dựng" && !personSec.includes("xây dựng")) return false;
          if (selectedSector === "Vật liệu & Năng lượng" && !personSec.includes("vật liệu") && !personSec.includes("năng lượng")) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "change") {
          return Number(b.daily_change_percent || 0) - Number(a.daily_change_percent || 0);
        }
        return Number(b.estimated_listed_equity_value || 0) - Number(a.estimated_listed_equity_value || 0);
      });
  }, [collection.data, search, selectedSector, sortBy]);

  if (!collection.data.length) {
    return (
      <section className="market-tab-panel people-view">
        <div className="market-empty">
          <h3>Hiện chưa có dữ liệu doanh nhân</h3>
          <p>Vui lòng thử lại sau hoặc làm mới trang.</p>
        </div>
      </section>
    );
  }

  const totalListedEquity = filteredLeaders.reduce(
    (sum, person) => sum + Number(person.estimated_listed_equity_value || 0),
    0
  );
  const maximum = Math.max(
    ...filteredLeaders.map((person) => Number(person.estimated_listed_equity_value)),
    1
  );

  return (
    <section className="market-tab-panel people-view">
      {viewMode === "ecosystems" ? (
        <EcosystemGraph initialEcosystemId={targetEcosystemId} />
      ) : (
        <>
          {/* Controls Bar: Search, Sector Chips, Sort */}
          <div className="people-controls-bar">
            <div className="people-controls-row">
              <div className="people-search-box">
                <span className="people-search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="people-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm doanh nhân, mã cổ phiếu (VIC, HPG...), tập đoàn..."
                  aria-label="Tìm kiếm doanh nhân"
                />
                {search && (
                  <button type="button" className="clear-btn" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">
                    ✕
                  </button>
                )}
              </div>

              <div className="people-sort-wrap">
                <label htmlFor="people-sort" className="people-sort-label">Sắp xếp:</label>
                <select
                  id="people-sort"
                  className="people-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "equity" | "change")}
                >
                  <option value="equity">Tài sản niêm yết cao nhất</option>
                  <option value="change">Biến động phiên mạnh nhất</option>
                </select>
              </div>
            </div>

            {/* Sector filter chips */}
            <div className="people-sector-filters">
              {sectors.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`sector-chip ${selectedSector === sec ? "active" : ""}`}
                  onClick={() => setSelectedSector(sec)}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          <div className="people-summary">
            <article>
              <span>Quy mô theo dõi</span>
              <strong>{filteredLeaders.length} doanh nhân</strong>
              <p>Các lãnh đạo &amp; tỷ phú sáng lập các tập đoàn đầu ngành trên TTCK Việt Nam.</p>
            </article>
            <article>
              <span>Tổng giá trị cổ phiếu niêm yết</span>
              <strong>{formatMoney(String(totalListedEquity))}</strong>
              <p>Vốn hóa sở hữu trực tiếp tính theo thị giá thời gian thực từ Vnstock.</p>
            </article>
            <article className="people-chart">
              <span>Tỷ trọng giá trị niêm yết ({filteredLeaders.length} người)</span>
              <div>
                {filteredLeaders.map((person) => (
                  <span
                    key={person.id}
                    style={{
                      height: `${Math.max(
                        14,
                        (Number(person.estimated_listed_equity_value) / maximum) * 100
                      )}%`,
                    }}
                    title={`${person.full_name}: ${formatMoney(person.estimated_listed_equity_value)}`}
                  />
                ))}
              </div>
            </article>
          </div>

          {filteredLeaders.length === 0 ? (
            <div className="market-empty">
              <h3>Không tìm thấy doanh nhân phù hợp</h3>
              <p>Thử tìm kiếm với từ khóa khác hoặc bỏ chọn bộ lọc ngành.</p>
            </div>
          ) : (
            <div className="people-cards-list">
              {filteredLeaders.map((person, index) => {
                const changeVal = Number(person.daily_change_percent || 0);
                const displayRank = index + 1;
                return (
                  <article
                    key={person.id}
                    className="person-card interactive"
                    onClick={() => {
                      setSelectedPerson(person);
                      setSelectedRank(displayRank);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedPerson(person);
                        setSelectedRank(displayRank);
                      }
                    }}
                    aria-label={`Xem chi tiết hồ sơ ${person.full_name}`}
                  >
                    <div className="person-card-header">
                      <span className={`person-rank-badge rank-${displayRank <= 3 ? displayRank : "other"}`}>
                        #{displayRank}
                      </span>
                      <div className="person-avatar-wrap">
                        {person.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.avatar_url}
                            alt={person.full_name}
                            className="person-avatar-img"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <span
                          className="person-avatar"
                          style={{ display: person.avatar_url ? "none" : "flex" }}
                          aria-hidden="true"
                        >
                          {person.initials}
                        </span>
                      </div>
                      <div className="person-identity">
                        <div className="person-title-row">
                          <h3>{person.full_name}</h3>
                          <div className="leader-tickers" onClick={(e) => e.stopPropagation()}>
                            {person.symbols.map((sym) => (
                              <Link
                                href={`/market/stocks/${sym}`}
                                key={sym}
                                className="leader-ticker-pill"
                                title={`Xem chi tiết ${sym}`}
                              >
                                {sym}
                              </Link>
                            ))}
                          </div>
                          <span className="person-card-cta">Chi tiết hồ sơ →</span>
                        </div>
                        <p className="person-role-company">
                          {person.role} · <strong>{person.company}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="person-card-body">
                      <div className="person-metric-group listed-asset">
                        <span className="metric-label">Tài sản niêm yết</span>
                        <div className="metric-value-row">
                          <strong className="metric-val">
                            {formatMoney(person.estimated_listed_equity_value)}
                          </strong>
                          <span className={`metric-tag ${changeTone(person.daily_change_percent)}`}>
                            {changeVal >= 0 ? "+" : ""}
                            {formatPercent(person.daily_change_percent)}
                          </span>
                        </div>
                      </div>

                      <div className="person-metric-group total-asset">
                        <span className="metric-label">Tài sản ròng (Forbes)</span>
                        <strong className="metric-val highlight">
                          {person.net_worth_total ?? "Đang cập nhật"}
                        </strong>
                      </div>

                      {person.net_worth_external && (
                        <div className="person-metric-group external-asset">
                          <span className="metric-label">Doanh nghiệp liên quan</span>
                          <p className="external-desc">{person.net_worth_external}</p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <details className="people-method">
            <summary>Phương pháp tính toán &amp; Giới hạn dữ liệu</summary>
            <p>{collection.methodology.description}</p>
            <ul>
              {collection.methodology.excludes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      )}

      <PersonDetailModal
        person={selectedPerson}
        rank={selectedRank}
        onClose={() => setSelectedPerson(null)}
        onOpenEcosystem={(ecoId) => {
          setTargetEcosystemId(ecoId);
          setViewMode("ecosystems");
        }}
      />
    </section>
  );
}
