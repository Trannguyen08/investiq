"use client";

import Link from "next/link";
import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  // Link mode via dynamic callback (for Client components)
  getPageUrl?: (page: number) => string;
  // Link mode via serializable URL template (safe across Server -> Client component boundaries, e.g. News)
  // Supports "[page]", "%page%", or "{page}" as the replacement token
  pageUrlPattern?: string;
  // Button mode (for Client state pagination, e.g. Dividends & Events)
  onPageChange?: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  prevAriaLabel?: string;
  nextAriaLabel?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Standard 7-item pagination windowing algorithm:
 * - When totalPages <= 7: shows all pages [1, 2, 3, 4, 5, 6, 7]
 * - When totalPages > 7:
 *   - Near start (p <= 4): [1, 2, 3, 4, 5, '...', totalPages]
 *   - Near end (p >= totalPages - 3): [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
 *   - In middle: [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const showLeftEllipsis = currentPage > 4;
  const showRightEllipsis = currentPage < totalPages - 3;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      1,
      "ellipsis-start",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

/**
 * Helper to encode offset cursor for market instruments endpoint.
 * Safe across both Node.js SSR and Browser/Turbopack client runtimes.
 */
export function encodeCursor(offset: number): string {
  const jsonStr = JSON.stringify({ offset });
  let base64 = "";
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(jsonStr, "utf-8").toString("base64");
  } else if (typeof btoa !== "undefined") {
    base64 = btoa(jsonStr);
  }
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "mục",
  getPageUrl,
  pageUrlPattern,
  onPageChange,
  prevLabel = "← Trước",
  nextLabel = "Sau →",
  prevAriaLabel = "Trang trước",
  nextAriaLabel = "Trang sau →",
  ariaLabel = "Phân trang",
  className = "",
}: PaginationProps) {
  if (totalItems <= 0 && totalPages <= 1) {
    return null;
  }

  const clampedPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startItem = totalItems > 0 ? (clampedPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(clampedPage * pageSize, totalItems);
  const pages = getPaginationRange(clampedPage, Math.max(1, totalPages));

  const isLinkMode = Boolean(pageUrlPattern || getPageUrl);
  const resolveUrl = (pageNumber: number): string => {
    if (pageUrlPattern) {
      return pageUrlPattern.replace(/\[page\]|%page%|\{page\}/g, String(pageNumber));
    }
    if (getPageUrl) {
      return getPageUrl(pageNumber);
    }
    return "#";
  };

  return (
    <nav
      className={`app-pagination-bar mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${className}`}
      aria-label={ariaLabel}
    >
      <div className="text-slate-400">
        Hiển thị <strong className="text-slate-200 font-bold">{startItem} - {endItem}</strong> trong tổng số <strong className="text-slate-200 font-bold">{totalItems}</strong> {itemLabel}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {/* Previous Button / Link */}
          {isLinkMode ? (
            clampedPage > 1 ? (
              <Link
                href={resolveUrl(clampedPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition font-semibold text-xs inline-flex items-center justify-center"
                aria-label={prevAriaLabel}
                prefetch={true}
              >
                {prevLabel}
              </Link>
            ) : (
              <span
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 opacity-40 cursor-not-allowed transition font-semibold text-xs inline-flex items-center justify-center select-none"
                aria-disabled="true"
                aria-label={prevAriaLabel}
              >
                {prevLabel}
              </span>
            )
          ) : (
            <button
              type="button"
              disabled={clampedPage <= 1}
              onClick={() => onPageChange?.(clampedPage - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold text-xs inline-flex items-center justify-center cursor-pointer disabled:pointer-events-none"
              aria-label={prevAriaLabel}
            >
              {prevLabel}
            </button>
          )}

          {/* Numbered Page Buttons / Links */}
          <div className="flex items-center gap-1">
            {pages.map((item, idx) => {
              if (item === "ellipsis-start" || item === "ellipsis-end") {
                return (
                  <span
                    key={`${item}-${idx}`}
                    className="text-slate-500 px-0.5 select-none"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                );
              }

              const pNum = item;
              const isActive = pNum === clampedPage;

              if (isLinkMode) {
                return (
                  <Link
                    key={pNum}
                    href={resolveUrl(pNum)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`Trang ${pNum}`}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      isActive
                        ? "bg-sky-600 text-white shadow-sm pointer-events-none"
                        : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
                    }`}
                    prefetch={true}
                  >
                    {pNum}
                  </Link>
                );
              }

              return (
                <button
                  key={pNum}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Trang ${pNum}`}
                  onClick={() => onPageChange?.(pNum)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
          </div>

          {/* Next Button / Link */}
          {isLinkMode ? (
            clampedPage < totalPages ? (
              <Link
                href={resolveUrl(clampedPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition font-semibold text-xs inline-flex items-center justify-center"
                aria-label={nextAriaLabel}
                prefetch={true}
              >
                {nextLabel}
              </Link>
            ) : (
              <span
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 opacity-40 cursor-not-allowed transition font-semibold text-xs inline-flex items-center justify-center select-none"
                aria-disabled="true"
                aria-label={nextAriaLabel}
              >
                {nextLabel}
              </span>
            )
          ) : (
            <button
              type="button"
              disabled={clampedPage >= totalPages}
              onClick={() => onPageChange?.(clampedPage + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold text-xs inline-flex items-center justify-center cursor-pointer disabled:pointer-events-none"
              aria-label={nextAriaLabel}
            >
              {nextLabel}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
