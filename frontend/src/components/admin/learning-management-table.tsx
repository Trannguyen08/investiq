"use client";

import { useMemo, useState } from "react";
import type { LearningTopicDetail, LearningLevel } from "@/types/learning";
import { AdminDetailModal } from "@/components/admin/admin-detail-modal";
import {
  createLearningTopicAction,
  updateLearningTopicAction,
  deleteLearningTopicAction,
  toggleLearningTopicStatusAction,
} from "@/app/(admin)/admin/actions";
import { IconView, IconTrash, IconCheck, IconRefresh } from "@/components/admin/admin-icons";

interface Props {
  topics: LearningTopicDetail[];
  initialSearch?: string;
  initialLevel?: string;
}

export function LearningManagementTable({ topics, initialSearch = "", initialLevel = "" }: Props) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [levelFilter, setLevelFilter] = useState(initialLevel);
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [viewingTopic, setViewingTopic] = useState<LearningTopicDetail | null>(null);
  const [editingTopic, setEditingTopic] = useState<LearningTopicDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchSearch =
        !searchTerm.trim() ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.summary.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLevel = !levelFilter || t.level === levelFilter;
      const matchStatus = !statusFilter || t.status === statusFilter;
      return matchSearch && matchLevel && matchStatus;
    });
  }, [topics, searchTerm, levelFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = topics.length;
    const beginner = topics.filter((t) => t.level === "beginner").length;
    const intermediate = topics.filter((t) => t.level === "intermediate").length;
    const advanced = topics.filter((t) => t.level === "advanced").length;
    const published = topics.filter((t) => t.status === "published").length;
    return { total, beginner, intermediate, advanced, published };
  }, [topics]);

  const levelLabels: Record<LearningLevel, { text: string; bg: string; color: string }> = {
    beginner: { text: "Cơ bản (Dễ)", bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
    intermediate: { text: "Trung cấp", bg: "rgba(14, 165, 233, 0.15)", color: "#0ea5e9" },
    advanced: { text: "Nâng cao", bg: "rgba(168, 85, 247, 0.15)", color: "#c084fc" },
  };

  return (
    <div className="admin-learning-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Stats KPI Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <div className="admin-card" style={{ padding: "1.2rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Tổng số bài học</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc" }}>{stats.total}</div>
        </div>
        <div className="admin-card" style={{ padding: "1.2rem", textAlign: "center", borderLeft: "3px solid #10b981" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Số bài Cơ bản</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981" }}>{stats.beginner}</div>
        </div>
        <div className="admin-card" style={{ padding: "1.2rem", textAlign: "center", borderLeft: "3px solid #0ea5e9" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Số bài Trung cấp</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0ea5e9" }}>{stats.intermediate}</div>
        </div>
        <div className="admin-card" style={{ padding: "1.2rem", textAlign: "center", borderLeft: "3px solid #c084fc" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Số bài Nâng cao</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#c084fc" }}>{stats.advanced}</div>
        </div>
        <div className="admin-card" style={{ padding: "1.2rem", textAlign: "center", borderLeft: "3px solid #38bdf8" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Đã xuất bản</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#38bdf8" }}>{stats.published} / {stats.total}</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-card">
        {/* Header & Controls */}
        <div className="admin-card-header" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <h2 className="admin-card-title">Quản lý Khóa học & Lộ trình Chứng khoán</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Soạn thảo lý thuyết, ví dụ thực tế và bộ câu hỏi trắc nghiệm kiểm tra kiến thức
            </span>
          </div>
          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => setIsCreating(true)}
            style={{
              padding: "0.6rem 1.2rem",
              background: "#0284c7",
              color: "#ffffff",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            + Thêm bài học mới
          </button>
        </div>

        {/* Filters strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            type="search"
            placeholder="Tìm theo tiêu đề, slug, tóm tắt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: "1 1 240px",
              padding: "0.55rem 0.85rem",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "0.375rem",
              color: "#f8fafc",
              fontSize: "0.85rem",
            }}
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              padding: "0.55rem 0.85rem",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "0.375rem",
              color: "#f8fafc",
              fontSize: "0.85rem",
            }}
          >
            <option value="">Tất cả cấp độ</option>
            <option value="beginner">Cơ bản (Dễ)</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "0.55rem 0.85rem",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "0.375rem",
              color: "#f8fafc",
              fontSize: "0.85rem",
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
          </select>
        </div>

        {/* Table Unified */}
        <div className="admin-table-container">
          <table className="admin-table-unified">
            <thead>
              <tr>
                <th style={{ width: "65px", textAlign: "center" }}>Thứ tự</th>
                <th style={{ width: "120px" }}>Cấp độ</th>
                <th>Tiêu đề bài học & Đường dẫn</th>
                <th style={{ width: "100px", textAlign: "center" }}>Thời lượng</th>
                <th style={{ width: "100px", textAlign: "center" }}>Trắc nghiệm</th>
                <th style={{ width: "130px" }}>Trạng thái</th>
                <th style={{ textAlign: "right", width: "180px" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTopics.length > 0 ? (
                filteredTopics.map((item) => {
                  const lvl = levelLabels[item.level] || levelLabels.beginner;
                  return (
                    <tr key={item.id}>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#94a3b8" }}>
                        #{item.stage}.{item.sort_order}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.65rem",
                            borderRadius: "0.35rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: lvl.bg,
                            color: lvl.color,
                          }}
                        >
                          {lvl.text}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.92rem", marginBottom: "0.2rem" }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                            slug: {item.slug} {item.practical_example?.ticker ? `· Mã: ${item.practical_example.ticker}` : ""}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", color: "#cbd5e1", fontSize: "0.85rem" }}>
                        {item.estimated_minutes} phút
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                          }}
                        >
                          {item.quizzes?.length ?? 0} câu
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.6rem",
                            borderRadius: "0.3rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            background: item.status === "published" ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                            color: item.status === "published" ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {item.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                          {/* View Detail */}
                          <button
                            type="button"
                            className="admin-action-btn view"
                            title="Xem chi tiết nội dung"
                            onClick={() => setViewingTopic(item)}
                          >
                            <IconView size={15} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            className="admin-action-btn"
                            title="Chỉnh sửa bài học"
                            onClick={() => setEditingTopic(item)}
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              color: "#38bdf8",
                              border: "none",
                              borderRadius: "0.3rem",
                              padding: "0.4rem 0.5rem",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>Sửa</span>
                          </button>

                          {/* Toggle Status */}
                          <form action={toggleLearningTopicStatusAction} style={{ display: "inline" }}>
                            <input type="hidden" name="topic_id" value={item.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={item.status === "published" ? "draft" : "published"}
                            />
                            <button
                              type="submit"
                              className="admin-action-btn"
                              title={item.status === "published" ? "Chuyển thành bản nháp" : "Xuất bản bài học"}
                              style={{
                                background: item.status === "published" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                color: item.status === "published" ? "#f59e0b" : "#10b981",
                                border: "none",
                                borderRadius: "0.3rem",
                                padding: "0.4rem 0.5rem",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              <IconRefresh size={14} />
                            </button>
                          </form>

                          {/* Delete */}
                          <form
                            action={deleteLearningTopicAction}
                            style={{ display: "inline" }}
                            onSubmit={(e) => {
                              if (!confirm(`Bạn có chắc chắn muốn xóa bài học "${item.title}"?`)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="topic_id" value={item.id} />
                            <button type="submit" className="admin-action-btn reject" title="Xóa bài học">
                              <IconTrash size={15} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    Không tìm thấy bài học nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Topic Detail */}
      {viewingTopic && (
        <AdminDetailModal
          isOpen={true}
          title={`Chi tiết bài học: ${viewingTopic.title}`}
          onClose={() => setViewingTopic(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", color: "#e2e8f0", fontSize: "0.88rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#38bdf8" }}>#{viewingTopic.stage}.{viewingTopic.sort_order}</span>
              <span>Cấp độ: <strong>{levelLabels[viewingTopic.level]?.text}</strong></span>
              <span>Thời lượng: <strong>{viewingTopic.estimated_minutes} phút</strong></span>
              <span>Trạng thái: <strong>{viewingTopic.status === "published" ? "Đã xuất bản" : "Bản nháp"}</strong></span>
            </div>

            <div>
              <h4 style={{ color: "#38bdf8", marginBottom: "0.4rem" }}>Tóm tắt mục tiêu</h4>
              <p style={{ background: "rgba(15,23,42,0.5)", padding: "0.75rem", borderRadius: "0.375rem" }}>
                {viewingTopic.summary}
              </p>
            </div>

            <div>
              <h4 style={{ color: "#38bdf8", marginBottom: "0.4rem" }}>Nội dung lý thuyết</h4>
              <div style={{ background: "rgba(15,23,42,0.5)", padding: "1rem", borderRadius: "0.375rem", whiteSpace: "pre-line", maxHeight: "250px", overflowY: "auto" }}>
                {viewingTopic.theory_content}
              </div>
            </div>

            {viewingTopic.practical_example && (
              <div>
                <h4 style={{ color: "#10b981", marginBottom: "0.4rem" }}>
                  Ví dụ thực tế thị trường: {viewingTopic.practical_example.title}
                  {viewingTopic.practical_example.ticker ? ` (${viewingTopic.practical_example.ticker})` : ""}
                </h4>
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: "0.85rem", borderRadius: "0.375rem" }}>
                  <p><strong>Tình huống:</strong> {viewingTopic.practical_example.scenario}</p>
                  <p style={{ marginTop: "0.5rem" }}><strong>Phân tích:</strong> {viewingTopic.practical_example.analysis}</p>
                  <p style={{ marginTop: "0.5rem", color: "#38e1b0" }}>
                    <strong>Bài học mấu chốt:</strong> {viewingTopic.practical_example.key_takeaway}
                  </p>
                </div>
              </div>
            )}

            {viewingTopic.quizzes && viewingTopic.quizzes.length > 0 && (
              <div>
                <h4 style={{ color: "#c084fc", marginBottom: "0.4rem" }}>
                  Bộ câu hỏi trắc nghiệm ({viewingTopic.quizzes.length} câu)
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {viewingTopic.quizzes.map((q, idx) => (
                    <div key={q.id || idx} style={{ background: "rgba(15,23,42,0.5)", padding: "0.75rem", borderRadius: "0.375rem" }}>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                        Câu {idx + 1}: {q.prompt}
                      </div>
                      <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem", fontSize: "0.82rem" }}>
                        {q.options.map((opt) => (
                          <li key={opt.id} style={{ color: opt.correct ? "#10b981" : "#94a3b8", marginBottom: "0.2rem" }}>
                            {opt.correct ? "✓ " : "• "} {opt.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AdminDetailModal>
      )}

      {/* Modal: Create or Edit Topic */}
      {(isCreating || editingTopic) && (
        <TopicFormModal
          topic={editingTopic}
          isCreating={isCreating}
          onClose={() => {
            setIsCreating(false);
            setEditingTopic(null);
          }}
        />
      )}
    </div>
  );
}

function TopicFormModal({
  topic,
  isCreating,
  onClose,
}: {
  topic: LearningTopicDetail | null;
  isCreating: boolean;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(topic?.slug ?? "");
  const [level, setLevel] = useState<LearningLevel>(topic?.level ?? "beginner");
  const [stage, setStage] = useState(topic?.stage ?? 1);
  const [sortOrder, setSortOrder] = useState(topic?.sort_order ?? 1);
  const [title, setTitle] = useState(topic?.title ?? "");
  const [eyebrow, setEyebrow] = useState(topic?.eyebrow ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(topic?.estimated_minutes ?? 5);
  const [summary, setSummary] = useState(topic?.summary ?? "");
  const [theoryContent, setTheoryContent] = useState(topic?.theory_content ?? "");
  const [status, setStatus] = useState(topic?.status ?? "published");

  // Practical example fields
  const [exampleTitle, setExampleTitle] = useState(topic?.practical_example?.title ?? "");
  const [exampleTicker, setExampleTicker] = useState(topic?.practical_example?.ticker ?? "");
  const [exampleScenario, setExampleScenario] = useState(topic?.practical_example?.scenario ?? "");
  const [exampleAnalysis, setExampleAnalysis] = useState(topic?.practical_example?.analysis ?? "");
  const [exampleTakeaway, setExampleTakeaway] = useState(topic?.practical_example?.key_takeaway ?? "");

  // Quizzes state
  const [quizzes] = useState(
    topic?.quizzes ?? [
      {
        id: "q1",
        prompt: "Nội dung câu hỏi trắc nghiệm số 1?",
        options: [
          { id: "opt1", label: "Lựa chọn A", correct: true, feedback: "Chính xác!" },
          { id: "opt2", label: "Lựa chọn B", correct: false, feedback: "Chưa đúng." },
        ],
      },
    ]
  );

  const payload = {
    slug,
    level,
    stage: Number(stage),
    sort_order: Number(sortOrder),
    title,
    eyebrow,
    estimated_minutes: Number(estimatedMinutes),
    summary,
    theory_content: theoryContent,
    practical_example: {
      title: exampleTitle,
      ticker: exampleTicker || null,
      scenario: exampleScenario,
      analysis: exampleAnalysis,
      key_takeaway: exampleTakeaway,
    },
    quizzes,
    glossary: topic?.glossary ?? [],
    practice_action: topic?.practice_action ?? {
      href: "/portfolio",
      label: "Xem danh mục mô phỏng",
      description: "Thực hành ngay với tiền giả lập",
    },
    status,
  };

  return (
    <AdminDetailModal
      isOpen={true}
      title={isCreating ? "Thêm bài học chứng khoán mới" : `Chỉnh sửa bài học: ${title}`}
      onClose={onClose}
    >
      <form
        action={isCreating ? createLearningTopicAction : updateLearningTopicAction}
        style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#e2e8f0" }}
      >
        {!isCreating && topic && <input type="hidden" name="topic_id" value={topic.id} />}
        <input type="hidden" name="payload_json" value={JSON.stringify(payload)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label htmlFor="topic-title-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Tiêu đề bài học *
            </label>
            <input
              id="topic-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            />
          </div>
          <div>
            <label htmlFor="topic-slug-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Đường dẫn Slug (Duy nhất) *
            </label>
            <input
              id="topic-slug-input"
              type="text"
              required
              disabled={!isCreating}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ width: "100%", padding: "0.55rem", background: isCreating ? "rgba(15,23,42,0.8)" : "rgba(30,41,59,0.5)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
          <div>
            <label htmlFor="topic-level-select" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Cấp độ
            </label>
            <select
              id="topic-level-select"
              value={level}
              onChange={(e) => setLevel(e.target.value as LearningLevel)}
              style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            >
              <option value="beginner">Cơ bản (Dễ)</option>
              <option value="intermediate">Trung cấp</option>
              <option value="advanced">Nâng cao</option>
            </select>
          </div>
          <div>
            <label htmlFor="topic-stage-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Giai đoạn (Stage)
            </label>
            <input
              id="topic-stage-input"
              type="number"
              min={1}
              max={10}
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
              style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            />
          </div>
          <div>
            <label htmlFor="topic-order-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Thứ tự (Sort)
            </label>
            <input
              id="topic-order-input"
              type="number"
              min={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            />
          </div>
          <div>
            <label htmlFor="topic-minutes-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
              Thời lượng (phút)
            </label>
            <input
              id="topic-minutes-input"
              type="number"
              min={1}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="topic-summary-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
            Tóm tắt bài học *
          </label>
          <textarea
            id="topic-summary-input"
            required
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
          />
        </div>

        <div>
          <label htmlFor="topic-theory-input" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
            Nội dung lý thuyết cốt lõi *
          </label>
          <textarea
            id="topic-theory-input"
            required
            rows={6}
            value={theoryContent}
            onChange={(e) => setTheoryContent(e.target.value)}
            style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff", fontFamily: "monospace" }}
          />
        </div>

        {/* Practical Example Box */}
        <div style={{ border: "1px solid rgba(16,185,129,0.3)", borderRadius: "0.5rem", padding: "1rem", background: "rgba(16,185,129,0.04)" }}>
          <h4 style={{ color: "#10b981", marginBottom: "0.6rem" }}>Ví dụ minh họa thực tế thị trường</h4>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div>
              <label htmlFor="example-title-input" style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Tiêu đề ví dụ *</label>
              <input
                id="example-title-input"
                type="text"
                required
                value={exampleTitle}
                onChange={(e) => setExampleTitle(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.3rem", color: "#fff" }}
              />
            </div>
            <div>
              <label htmlFor="example-ticker-input" style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Mã cổ phiếu</label>
              <input
                id="example-ticker-input"
                type="text"
                placeholder="vd: HPG, VCB"
                value={exampleTicker}
                onChange={(e) => setExampleTicker(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.3rem", color: "#fff" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: "0.6rem" }}>
            <label htmlFor="example-scenario-input" style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Tình huống thực tế *</label>
            <textarea
              id="example-scenario-input"
              required
              rows={2}
              value={exampleScenario}
              onChange={(e) => setExampleScenario(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.3rem", color: "#fff" }}
            />
          </div>
          <div style={{ marginBottom: "0.6rem" }}>
            <label htmlFor="example-analysis-input" style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Phân tích *</label>
            <textarea
              id="example-analysis-input"
              required
              rows={2}
              value={exampleAnalysis}
              onChange={(e) => setExampleAnalysis(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.3rem", color: "#fff" }}
            />
          </div>
          <div>
            <label htmlFor="example-takeaway-input" style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Bài học mấu chốt *</label>
            <input
              id="example-takeaway-input"
              type="text"
              required
              value={exampleTakeaway}
              onChange={(e) => setExampleTakeaway(e.target.value)}
              style={{ width: "100%", padding: "0.45rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.3rem", color: "#fff" }}
            />
          </div>
        </div>

        {/* Status selection */}
        <div>
          <label htmlFor="topic-status-select" style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
            Trạng thái xuất bản
          </label>
          <select
            id="topic-status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: "100%", padding: "0.55rem", background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: "0.375rem", color: "#fff" }}
          >
            <option value="published">Xuất bản ngay (Hiển thị cho người dùng)</option>
            <option value="draft">Lưu bản nháp (Ẩn khỏi lộ trình)</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "0.6rem 1.2rem", background: "#334155", border: "none", borderRadius: "0.375rem", color: "#fff", cursor: "pointer" }}
          >
            Hủy
          </button>
          <button
            type="submit"
            style={{ padding: "0.6rem 1.4rem", background: "#0284c7", border: "none", borderRadius: "0.375rem", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            {isCreating ? "Lưu bài học mới" : "Cập nhật thay đổi"}
          </button>
        </div>
      </form>
    </AdminDetailModal>
  );
}
