"use client";

import { useState } from "react";
import type {
  AdminAssessmentPage,
  AdminAssessmentStats,
  AssessmentQuestion,
  InvestorPersona,
} from "@/types/assessment";
import {
  createAssessmentQuestionAction,
  deleteAssessmentQuestionAction,
  toggleAssessmentQuestionStatusAction,
  updateAssessmentQuestionAction,
  updatePersonaAction,
} from "@/app/(admin)/admin/actions";

interface Props {
  stats: AdminAssessmentStats;
  questions: AssessmentQuestion[];
  personas: InvestorPersona[];
  submissionsPage: AdminAssessmentPage;
}

export function AssessmentManagementTable({
  stats,
  questions,
  personas,
  submissionsPage,
}: Props) {
  const [activeTab, setActiveTab] = useState<"questions" | "personas" | "submissions">("questions");

  // Modal states
  const [viewingQuestion, setViewingQuestion] = useState<AssessmentQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [editingPersona, setEditingPersona] = useState<InvestorPersona | null>(null);

  return (
    <div className="admin-assessment-wrap" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 4 Core KPI Cards */}
      <div className="admin-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="admin-card">
          <div className="admin-card-label" style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>TỔNG LƯỢT KHẢO SÁT</div>
          <div className="admin-card-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
            {stats.total_assessments.toLocaleString("vi-VN")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#2563eb", marginTop: "0.25rem" }}>Lượt làm bài đã ghi nhận</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-label" style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>ĐIỂM SẴN SÀNG TRUNG BÌNH</div>
          <div className="admin-card-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: stats.average_readiness_score >= 65 ? "#10b981" : "#f59e0b", marginTop: "0.25rem" }}>
            {stats.average_readiness_score.toFixed(1)} / 100
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Toàn bộ học viên & khách</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-label" style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>TỶ LỆ ĐỦ ĐIỀU KIỆN ĐẦU TƯ THẬT</div>
          <div className="admin-card-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981", marginTop: "0.25rem" }}>
            {stats.ready_percentage.toFixed(1)}%
          </div>
          <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem" }}>Điểm tổng thể &gt;= 65/100</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-label" style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>NHÓM PERSONA PHỔ BIẾN NHẤT</div>
          <div className="admin-card-value" style={{ fontSize: "1.2rem", fontWeight: 700, color: "#2563eb", marginTop: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {stats.top_persona_title}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Chiếm tỷ trọng cao nhất</div>
        </div>
      </div>

      {/* Tab Switcher & Action Strip */}
      <div className="admin-card" style={{ padding: "0.75rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setActiveTab("questions")}
            className={`admin-filter-pill ${activeTab === "questions" ? "active" : ""}`}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              border: activeTab === "questions" ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: activeTab === "questions" ? "#eff6ff" : "#ffffff",
              color: activeTab === "questions" ? "#2563eb" : "#475569",
              cursor: "pointer",
            }}
          >
            Ngân hàng câu hỏi ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("personas")}
            className={`admin-filter-pill ${activeTab === "personas" ? "active" : ""}`}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              border: activeTab === "personas" ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: activeTab === "personas" ? "#eff6ff" : "#ffffff",
              color: activeTab === "personas" ? "#2563eb" : "#475569",
              cursor: "pointer",
            }}
          >
            Hồ sơ Nhóm Persona ({personas.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("submissions")}
            className={`admin-filter-pill ${activeTab === "submissions" ? "active" : ""}`}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              border: activeTab === "submissions" ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: activeTab === "submissions" ? "#eff6ff" : "#ffffff",
              color: activeTab === "submissions" ? "#2563eb" : "#475569",
              cursor: "pointer",
            }}
          >
            Lịch sử khảo sát người dùng ({submissionsPage.total})
          </button>
        </div>

        {activeTab === "questions" && (
          <button
            type="button"
            onClick={() => setIsCreatingQuestion(true)}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Thêm câu hỏi mới
          </button>
        )}
      </div>

      {/* TAB 1: QUESTIONS TABLE */}
      {activeTab === "questions" && (
        <div className="admin-card" style={{ padding: "0" }}>
          <div className="admin-table-container">
            <table className="admin-table-unified">
              <thead>
                <tr>
                  <th style={{ width: "60px", textAlign: "center" }}>Thứ tự</th>
                  <th>Nội dung câu hỏi</th>
                  <th style={{ width: "160px" }}>Danh mục</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Số lựa chọn</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ width: "200px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#64748b" }}>{q.sort_order}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{q.prompt}</div>
                      {q.subtext && <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>{q.subtext}</div>}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {q.category}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{q.options.length}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "1rem",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: q.status === "published" ? "#dcfce7" : "#fef3c7",
                          color: q.status === "published" ? "#15803d" : "#b45309",
                        }}
                      >
                        {q.status === "published" ? "Xuất bản" : "Bản nháp"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                        <button
                          type="button"
                          className="admin-btn-detail"
                          onClick={() => setViewingQuestion(q)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="admin-btn-detail"
                          onClick={() => setEditingQuestion(q)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          Sửa
                        </button>
                        <form action={toggleAssessmentQuestionStatusAction} style={{ display: "inline" }}>
                          <input type="hidden" name="question_id" value={q.id} />
                          <input type="hidden" name="status" value={q.status === "published" ? "draft" : "published"} />
                          <button
                            type="submit"
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              borderRadius: "0.375rem",
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            {q.status === "published" ? "Ẩn" : "Hiện"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERSONAS CARDS */}
      {activeTab === "personas" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {personas.map((p) => (
            <div key={p.code} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>{p.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "#2563eb", fontWeight: 600, marginTop: "0.2rem" }}>{p.tagline}</div>
                </div>
                <button
                  type="button"
                  className="admin-btn-detail"
                  onClick={() => setEditingPersona(p)}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                >
                  Chỉnh sửa
                </button>
              </div>

              <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
                {p.description}
              </div>

              {/* Asset Allocation Pill */}
              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Phân bổ tài sản khuyến nghị</div>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.4rem", fontSize: "0.85rem", fontWeight: 600 }}>
                  <span style={{ color: "#2563eb" }}>Cổ phiếu: {p.asset_allocation.stocks}%</span>
                  <span style={{ color: "#d97706" }}>Vàng: {p.asset_allocation.gold}%</span>
                  <span style={{ color: "#16a34a" }}>Tiết kiệm: {p.asset_allocation.savings}%</span>
                </div>
              </div>

              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Thời gian lý tưởng: <strong style={{ color: "#0f172a" }}>{p.ideal_time_hours_per_week} giờ / tuần</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: SUBMISSIONS TABLE */}
      {activeTab === "submissions" && (
        <div className="admin-card" style={{ padding: "0" }}>
          <div className="admin-table-container">
            <table className="admin-table-unified">
              <thead>
                <tr>
                  <th style={{ width: "140px" }}>Thời gian</th>
                  <th>Nhóm Persona</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Rủi ro</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Kiến thức</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Kỷ luật</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Điểm sẵn sàng</th>
                  <th style={{ width: "140px", textAlign: "center" }}>Đánh giá</th>
                  <th style={{ width: "140px", textAlign: "center" }}>Đầu tư thật</th>
                </tr>
              </thead>
              <tbody>
                {submissionsPage.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                      Chưa có lượt nộp bài khảo sát nào.
                    </td>
                  </tr>
                ) : (
                  submissionsPage.items.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {new Date(sub.created_at).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td style={{ fontWeight: 600, color: "#0f172a" }}>{sub.persona_title}</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{sub.risk_score}</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{sub.knowledge_score}</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{sub.discipline_score}</td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: sub.readiness_score >= 65 ? "#10b981" : "#f59e0b" }}>
                        {sub.readiness_score} / 100
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "1rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: sub.can_trade_real_money ? "#dcfce7" : "#fee2e2",
                            color: sub.can_trade_real_money ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {sub.readiness_label}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: sub.can_trade_real_money ? "#16a34a" : "#dc2626" }}>
                        {sub.can_trade_real_money ? "Được phép" : "Chưa nên"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW QUESTION MODAL */}
      {viewingQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => setViewingQuestion(null)}
        >
          <div
            className="admin-card"
            style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh", overflowY: "auto", background: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Chi tiết Câu hỏi #{viewingQuestion.sort_order}</div>
              <button
                type="button"
                onClick={() => setViewingQuestion(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>NỘI DUNG CÂU HỎI</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>{viewingQuestion.prompt}</div>
                {viewingQuestion.subtext && <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>{viewingQuestion.subtext}</div>}
              </div>

              <div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "0.4rem" }}>CÁC PHƯƠNG ÁN LỰA CHỌN & TRỌNG SỐ</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {viewingQuestion.options.map((opt, idx) => (
                    <div key={opt.id} style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{String.fromCharCode(65 + idx)}. {opt.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Điểm rủi ro: <strong>{opt.risk_weight}/100</strong> · Trọng số Persona: {JSON.stringify(opt.persona_weights)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT QUESTION MODAL */}
      {(isCreatingQuestion || editingQuestion) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => {
            setIsCreatingQuestion(false);
            setEditingQuestion(null);
          }}
        >
          <div
            className="admin-card"
            style={{ width: "100%", maxWidth: "640px", maxHeight: "90vh", overflowY: "auto", background: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {isCreatingQuestion ? "Tạo câu hỏi trắc nghiệm mới" : `Sửa câu hỏi #${editingQuestion?.sort_order}`}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingQuestion(false);
                  setEditingQuestion(null);
                }}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form
              action={isCreatingQuestion ? createAssessmentQuestionAction : updateAssessmentQuestionAction}
              style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {editingQuestion && <input type="hidden" name="question_id" value={editingQuestion.id} />}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="q-sort-order" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Thứ tự</label>
                  <input
                    id="q-sort-order"
                    type="number"
                    name="sort_order"
                    defaultValue={editingQuestion?.sort_order ?? questions.length + 1}
                    required
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label htmlFor="q-category" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Danh mục</label>
                  <select
                    id="q-category"
                    name="category"
                    defaultValue={editingQuestion?.category ?? "risk_tolerance"}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                  >
                    <option value="risk_tolerance">Khẩu vị rủi ro (risk_tolerance)</option>
                    <option value="time_commitment">Thời gian cam kết (time_commitment)</option>
                    <option value="financial_situation">Tình hình tài chính (financial_situation)</option>
                    <option value="investment_knowledge">Kiến thức đầu tư (investment_knowledge)</option>
                    <option value="market_psychology">Tâm lý thị trường (market_psychology)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="q-prompt" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Tiêu đề câu hỏi</label>
                <textarea
                  id="q-prompt"
                  name="prompt"
                  rows={3}
                  defaultValue={editingQuestion?.prompt ?? ""}
                  required
                  placeholder="Nhập nội dung câu hỏi..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </div>

              <div>
                <label htmlFor="q-subtext" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Mô tả phụ</label>
                <input
                  id="q-subtext"
                  type="text"
                  name="subtext"
                  defaultValue={editingQuestion?.subtext ?? ""}
                  placeholder="Ý nghĩa của câu hỏi..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label htmlFor="q-options" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Các lựa chọn &amp; Trọng số (JSON Array)</label>
                <textarea
                  id="q-options"
                  name="options_json"
                  rows={6}
                  defaultValue={
                    editingQuestion
                      ? JSON.stringify(editingQuestion.options, null, 2)
                      : JSON.stringify(
                          [
                            {
                              id: "opt1",
                              label: "Phương án 1",
                              risk_weight: 40,
                              persona_weights: { dca_accumulator: 8, value_growth: 4 },
                            },
                            {
                              id: "opt2",
                              label: "Phương án 2",
                              risk_weight: 80,
                              persona_weights: { active_swing: 9, conservative_fund: 1 },
                            },
                          ],
                          null,
                          2
                        )
                  }
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontFamily: "monospace", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                <div>
                  <label htmlFor="q-status" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Trạng thái</label>
                  <select
                    id="q-status"
                    name="status"
                    defaultValue={editingQuestion?.status ?? "published"}
                    style={{ padding: "0.45rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                  >
                    <option value="published">Xuất bản</option>
                    <option value="draft">Bản nháp</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingQuestion(false);
                      setEditingQuestion(null);
                    }}
                    style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", background: "#2563eb", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                  >
                    {isCreatingQuestion ? "Tạo câu hỏi" : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PERSONA MODAL */}
      {editingPersona && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => setEditingPersona(null)}
        >
          <div
            className="admin-card"
            style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh", overflowY: "auto", background: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Chỉnh sửa Persona: {editingPersona.title}</div>
              <button
                type="button"
                onClick={() => setEditingPersona(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form action={updatePersonaAction} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="hidden" name="code" value={editingPersona.code} />

              <div>
                <label htmlFor="p-title" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Tên nhóm</label>
                <input
                  id="p-title"
                  type="text"
                  name="title"
                  defaultValue={editingPersona.title}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label htmlFor="p-tagline" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Khẩu hiệu (Tagline)</label>
                <input
                  id="p-tagline"
                  type="text"
                  name="tagline"
                  defaultValue={editingPersona.tagline}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label htmlFor="p-desc" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Mô tả đặc điểm</label>
                <textarea
                  id="p-desc"
                  name="description"
                  rows={3}
                  defaultValue={editingPersona.description}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label htmlFor="p-strat" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Chiến lược khuyến nghị</label>
                <textarea
                  id="p-strat"
                  name="recommended_strategy"
                  rows={3}
                  defaultValue={editingPersona.recommended_strategy}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="p-hours" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Thời gian lý tưởng (giờ/tuần)</label>
                  <input
                    id="p-hours"
                    type="number"
                    name="ideal_time_hours_per_week"
                    defaultValue={editingPersona.ideal_time_hours_per_week}
                    required
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label htmlFor="p-alloc" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Phân bổ tài sản (JSON)</label>
                  <input
                    id="p-alloc"
                    type="text"
                    name="asset_allocation_json"
                    defaultValue={JSON.stringify(editingPersona.asset_allocation)}
                    required
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontFamily: "monospace" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingPersona(null)}
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", background: "#2563eb", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu thông tin Persona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
