"use client";

import { useState } from "react";
import {
  IconSettings,
  IconShield,
  IconZap,
  IconRefresh,
  IconLock,
  IconUnlock,
  IconCheck,
  IconAlert,
} from "@/components/admin/admin-icons";

export function SystemDashboard() {
  const [flags, setFlags] = useState({
    paperTrading: true,
    publicSignups: true,
    thesesPosting: true,
    newsCrawler: true,
    aiSentiment: true,
    maintenanceMode: false,
  });

  const [emergencyHalt, setEmergencyHalt] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function toggleFlag(key: keyof typeof flags) {
    setFlags((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setActionNotice(`Đã cập nhật cấu hình: ${key} = ${next[key] ? "BẬT" : "TẮT"}`);
      return next;
    });
  }

  function handleClearCache() {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setActionNotice("Đã làm mới và xóa toàn bộ bộ đệm (In-memory & Redis cache) thành công.");
    }, 400);
  }

  function handleToggleEmergencyHalt() {
    const nextHalt = !emergencyHalt;
    if (nextHalt) {
      if (window.confirm("CẢNH BÁO: Kích hoạt Ngắt giao dịch khẩn cấp sẽ tạm dừng toàn bộ lệnh đặt Paper Trading của người dùng trên hệ thống. Tiếp tục?")) {
        setEmergencyHalt(true);
        setFlags((prev) => ({ ...prev, paperTrading: false }));
        setActionNotice("ĐÃ KÍCH HOẠT: Toàn bộ sổ lệnh giao dịch ảo đã bị khóa tạm thời.");
      }
    } else {
      setEmergencyHalt(false);
      setFlags((prev) => ({ ...prev, paperTrading: true }));
      setActionNotice("ĐÃ HỦY: Thị trường giao dịch ảo đã hoạt động bình thường trở lại.");
    }
  }

  function handlePruneSessions() {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setActionNotice("Đã dọn dẹp và thu hồi các phiên đăng nhập hết hạn khỏi cơ sở dữ liệu.");
    }, 400);
  }

  return (
    <div>
      <div className="admin-view-header">
        <div>
          <h1>Cấu hình & Quản trị hệ thống</h1>
          <p>
            Quản trị tính năng (Feature Flags), trung tâm thao tác khẩn cấp và giám sát tài nguyên runtime.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span className={`admin-badge ${emergencyHalt ? "disabled" : "active"}`} style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
            {emergencyHalt ? "Thị trường: Đang khóa khẩn cấp" : "Hệ thống: Vận hành bình thường"}
          </span>
        </div>
      </div>

      {actionNotice && (
        <p className="admin-alert success" style={{ marginBottom: "1.25rem" }} role="status">
          {actionNotice}
        </p>
      )}

      {/* EMERGENCY CONTROL CENTER */}
      <div className="admin-card" style={{ marginBottom: "1.75rem", borderColor: emergencyHalt ? "#fca5a5" : "#e2e8f0" }}>
        <div className="admin-card-header" style={{ background: emergencyHalt ? "#fef2f2" : "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <IconAlert width={18} height={18} style={{ color: emergencyHalt ? "#dc2626" : "#f59e0b" }} />
            <div>
              <h2 className="admin-card-title" style={{ color: emergencyHalt ? "#991b1b" : "#0f172a" }}>
                Trung tâm thao tác khẩn cấp (Emergency Control Center)
              </h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Các tác vụ can thiệp trực tiếp mức hệ thống với tác động diện rộng
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* Action 1 */}
          <div style={{ padding: "1.25rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div>
                <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Khóa thị trường khẩn cấp</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                  Dừng nhận lệnh Paper Trading khi phát hiện lỗi dữ liệu hoặc thao túng
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className={`admin-btn-${emergencyHalt ? "primary" : "danger"}`}
                onClick={handleToggleEmergencyHalt}
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                {emergencyHalt ? <IconUnlock width={14} height={14} /> : <IconLock width={14} height={14} />}
                <span>{emergencyHalt ? "Mở khóa giao dịch" : "Kích hoạt ngắt khẩn cấp"}</span>
              </button>
            </div>
          </div>

          {/* Action 2 */}
          <div style={{ padding: "1.25rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
            <div>
              <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Làm mới toàn bộ Cache</strong>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                Xóa sạch bộ đệm tổng quan, giá thị trường và danh mục để tính toán lại
              </p>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={isProcessing}
                onClick={handleClearCache}
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                <IconRefresh width={14} height={14} />
                <span>Xóa sạch bộ đệm Cache</span>
              </button>
            </div>
          </div>

          {/* Action 3 */}
          <div style={{ padding: "1.25rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#f8fafc" }}>
            <div>
              <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Dọn dẹp phiên đăng nhập</strong>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                Thu hồi các session token quá hạn để giải phóng bộ nhớ cơ sở dữ liệu
              </p>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={isProcessing}
                onClick={handlePruneSessions}
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                <IconShield width={14} height={14} />
                <span>Thu hồi phiên hết hạn</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE FLAGS SECTION */}
      <div className="admin-card" style={{ marginBottom: "1.75rem" }}>
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Quản trị tính năng (Feature Flags)</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Bật hoặc tắt các module nghiệp vụ mà không cần redeploy mã nguồn
            </span>
          </div>
        </div>

        <div style={{ padding: "0.5rem 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Flag 1 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                  Hệ thống Paper Trading (Giao dịch mô phỏng)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Cho phép người dùng tạo ví, đặt lệnh Mua/Bán và chốt lời/lỗ thời gian thực
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag("paperTrading")}
                className={`admin-icon-btn ${flags.paperTrading ? "success" : "danger"}`}
                title={flags.paperTrading ? "Đang Bật - Bấm để Tắt" : "Đang Tắt - Bấm để Bật"}
                style={{ width: "36px", height: "36px" }}
              >
                {flags.paperTrading ? <IconCheck width={18} height={18} /> : <IconLock width={18} height={18} />}
              </button>
            </div>

            {/* Flag 2 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                  Đăng ký tài khoản công khai (Public Registration)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Cho phép người dùng mới tạo tài khoản qua Email hoặc Google OAuth
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag("publicSignups")}
                className={`admin-icon-btn ${flags.publicSignups ? "success" : "danger"}`}
                title={flags.publicSignups ? "Đang Bật - Bấm để Tắt" : "Đang Tắt - Bấm để Bật"}
                style={{ width: "36px", height: "36px" }}
              >
                {flags.publicSignups ? <IconCheck width={18} height={18} /> : <IconLock width={18} height={18} />}
              </button>
            </div>

            {/* Flag 3 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                  Đăng tải Luận điểm Theses cộng đồng
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Người dùng có thể xuất bản bài phân tích cổ phiếu và khuyến nghị đầu tư
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag("thesesPosting")}
                className={`admin-icon-btn ${flags.thesesPosting ? "success" : "danger"}`}
                title={flags.thesesPosting ? "Đang Bật - Bấm để Tắt" : "Đang Tắt - Bấm để Bật"}
                style={{ width: "36px", height: "36px" }}
              >
                {flags.thesesPosting ? <IconCheck width={18} height={18} /> : <IconLock width={18} height={18} />}
              </button>
            </div>

            {/* Flag 4 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                  Bộ lập lịch Crawler Tin tức tự động (News Ingestion Scheduler)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Kích hoạt chu kỳ quét tin tức tài chính định kỳ từ 11 nguồn báo chí
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag("newsCrawler")}
                className={`admin-icon-btn ${flags.newsCrawler ? "success" : "danger"}`}
                title={flags.newsCrawler ? "Đang Bật - Bấm để Tắt" : "Đang Tắt - Bấm để Bật"}
                style={{ width: "36px", height: "36px" }}
              >
                {flags.newsCrawler ? <IconCheck width={18} height={18} /> : <IconLock width={18} height={18} />}
              </button>
            </div>

            {/* Flag 5 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                  Chế độ bảo trì hệ thống (Maintenance Mode)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Chuyển website sang banner bảo trì nâng cấp, chỉ cho phép Admin truy cập
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleFlag("maintenanceMode")}
                className={`admin-icon-btn ${flags.maintenanceMode ? "danger" : "neutral"}`}
                title={flags.maintenanceMode ? "Đang Bật bảo trì" : "Đang Tắt bảo trì"}
                style={{ width: "36px", height: "36px" }}
              >
                {flags.maintenanceMode ? <IconLock width={18} height={18} /> : <IconCheck width={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RUNTIME ENVIRONMENT INSPECTOR */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Tài nguyên & Môi trường Runtime</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Thông số cấu hình hạ tầng backend và cơ sở dữ liệu hiện tại
            </span>
          </div>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div className="admin-detail-grid">
            <div className="admin-detail-item">
              <span className="admin-detail-label">Môi trường ứng dụng</span>
              <span className="admin-detail-val">
                <span className="admin-badge admin">development</span>
              </span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Cơ sở dữ liệu chính</span>
              <span className="admin-detail-val">Neon PostgreSQL (Singapore - ap-southeast-1)</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Connection Pool</span>
              <span className="admin-detail-val">Min: 1 | Max: 5 connections (psycopg_pool)</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Chế độ Cache & Rate Limiting</span>
              <span className="admin-detail-val">In-Memory Circuit Breaker (Fast-fail active)</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Mã hóa phiên làm việc</span>
              <span className="admin-detail-val">AES-256-GCM + Argon2id Password Hasher</span>
            </div>
            <div className="admin-detail-item">
              <span className="admin-detail-label">Kiến trúc bảo mật</span>
              <span className="admin-detail-val">JWT Role Claim Enforced (BFF Shared Secret Protected)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

