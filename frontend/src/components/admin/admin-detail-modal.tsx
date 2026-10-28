"use client";

import { useEffect, type ReactNode } from "react";

export type AdminDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footerActions?: ReactNode;
  isLarge?: boolean;
};

export function AdminDetailModal({
  isOpen,
  onClose,
  title,
  children,
  footerActions,
  isLarge = false,
}: AdminDetailModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className={`admin-modal-panel ${isLarge ? "large" : ""}`}>
        <div className="admin-modal-header">
          <h2 id="admin-modal-title" className="admin-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
          >
            ✕
          </button>
        </div>

        <div className="admin-modal-body">{children}</div>

        <div className="admin-modal-footer">
          {footerActions}
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

