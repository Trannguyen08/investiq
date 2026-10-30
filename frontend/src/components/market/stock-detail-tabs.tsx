"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

export type StockTabId = "chart" | "growth" | "dividend" | "forensics" | "news";

type StockDetailTabsProps = {
  symbol: string;
  initialTab?: string;
  newsCount?: number;
  chartContent: ReactNode;
  growthContent: ReactNode;
  dividendContent?: ReactNode;
  newsContent: ReactNode;
  forensicsContent?: ReactNode;
};

function resolveTab(tabParam: string | null | undefined): StockTabId {
  if (
    tabParam === "growth" ||
    tabParam === "dividend" ||
    tabParam === "news" ||
    tabParam === "chart" ||
    tabParam === "forensics"
  ) {
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
  dividendContent,
  newsContent,
  forensicsContent,
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
      label: "Báo cáo tài chính & Tăng trưởng",
      badge: "BCTC",
    },
    {
      id: "dividend",
      label: "Lịch sử Cổ tức",
      badge: "Real",
    },
    {
      id: "forensics",
      label: "Rủi ro BCTC & Altman Z",
      badge: "Forensics",
    },
    {
      id: "news",
      label: "Tin tức doanh nghiệp",
      count: newsCount,
    },
  ];

  return (
    <div className="stock-detail-tabs-container w-full my-4">
      {/* Tab Navigation */}
      <nav
        className="stock-tabs-nav flex items-center gap-1.5 sm:gap-2 overflow-x-auto border-b border-slate-800 pb-2.5 mb-5 scrollbar-none"
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
              className={`stock-tab-button group relative flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "active bg-sky-500/15 text-sky-300 border border-sky-500/35 shadow-sm shadow-sky-950/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
              onClick={() => handleSelectTab(tab.id)}
              type="button"
            >
              <span className="tab-label">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="tab-count-badge inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                  aria-label={`${tab.count} bài tin`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span
                  className="tab-new-badge inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  aria-hidden="true"
                >
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
          className={`tab-panel ${activeTab === "chart" ? "visible block" : "hidden"}`}
        >
          {chartContent}
        </div>

        <div
          id="panel-growth"
          role="tabpanel"
          aria-labelledby="tab-growth"
          className={`tab-panel ${activeTab === "growth" ? "visible block" : "hidden"}`}
        >
          {growthContent}
        </div>

        <div
          id="panel-dividend"
          role="tabpanel"
          aria-labelledby="tab-dividend"
          className={`tab-panel ${activeTab === "dividend" ? "visible block" : "hidden"}`}
        >
          {dividendContent}
        </div>

        <div
          id="panel-forensics"
          role="tabpanel"
          aria-labelledby="tab-forensics"
          className={`tab-panel ${activeTab === "forensics" ? "visible block" : "hidden"}`}
        >
          {forensicsContent}
        </div>

        <div
          id="panel-news"
          role="tabpanel"
          aria-labelledby="tab-news"
          className={`tab-panel ${activeTab === "news" ? "visible block" : "hidden"}`}
        >
          {newsContent}
        </div>
      </div>
    </div>
  );
}
