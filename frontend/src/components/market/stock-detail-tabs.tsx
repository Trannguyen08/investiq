"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

export type StockTabId = "chart" | "growth" | "news";

type StockDetailTabsProps = {
  symbol: string;
  initialTab?: string;
  newsCount?: number;
  chartContent: ReactNode;
  growthContent: ReactNode;
  newsContent: ReactNode;
};

function resolveTab(tabParam: string | null | undefined): StockTabId {
  if (tabParam === "growth" || tabParam === "news" || tabParam === "chart") {
    return tabParam;
  }
  return "chart";
}

export function StockDetailTabs({
  symbol,
  initialTab,
  newsCount = 0,
  chartContent,
  growthContent,
  newsContent,
}: StockDetailTabsProps) {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");

  const [selectedTab, setSelectedTab] = useState<StockTabId | null>(null);

  const activeTab = selectedTab ?? resolveTab(queryTab || initialTab);

  const handleSelectTab = (tabId: StockTabId) => {
    setSelectedTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tabId === "chart") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tabId);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const tabs: { id: StockTabId; label: string; count?: number; badge?: string }[] = [
    {
      id: "chart",
      label: "Biểu đồ & Sổ lệnh",
    },
    {
      id: "growth",
      label: "Tăng trưởng & Tài chính",
      badge: "Mới",
    },
    {
      id: "news",
      label: "Tin tức doanh nghiệp",
      count: newsCount,
    },
  ];

  return (
    <div className="stock-detail-tabs-container">
      {/* Tab Navigation */}
      <nav
        className="stock-tabs-nav"
        role="tablist"
        aria-label={`Các danh mục thông tin về cổ phiếu ${symbol}`}
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              className={`stock-tab-button ${isSelected ? "active" : ""}`}
              onClick={() => handleSelectTab(tab.id)}
              type="button"
            >
              <span className="tab-label">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="tab-count-badge" aria-label={`${tab.count} bài tin`}>
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className="tab-new-badge" aria-hidden="true">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab Panels */}
      <div className="stock-tabs-content">
        <div
          id="panel-chart"
          role="tabpanel"
          aria-labelledby="tab-chart"
          className={`tab-panel ${activeTab === "chart" ? "visible" : "hidden"}`}
        >
          {chartContent}
        </div>

        <div
          id="panel-growth"
          role="tabpanel"
          aria-labelledby="tab-growth"
          className={`tab-panel ${activeTab === "growth" ? "visible" : "hidden"}`}
        >
          {growthContent}
        </div>

        <div
          id="panel-news"
          role="tabpanel"
          aria-labelledby="tab-news"
          className={`tab-panel ${activeTab === "news" ? "visible" : "hidden"}`}
        >
          {newsContent}
        </div>
      </div>
    </div>
  );
}
