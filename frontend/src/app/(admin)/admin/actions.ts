"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  requireAdminSession,
  verifyAdminPassword,
} from "@/lib/server/admin-auth";
import {
  runAdminRetention,
  triggerAdminCrawl,
  updateAdminSource,
} from "@/lib/server/admin-news-api";
import {
  clearAdminMarketDataCache,
  createAdminLearningTopic,
  deleteAdminLearningTopic,
  deleteAdminThesis,
  invalidateAdminCache,
  syncAdminDividends,
  toggleAdminLearningTopicStatus,
  updateAdminAlert,
  updateAdminLearningTopic,
  updateAdminMarketInstrument,
  updateAdminThesis,
  createAdminAssessmentQuestion,
  updateAdminAssessmentQuestion,
  deleteAdminAssessmentQuestion,
  toggleAdminAssessmentQuestionStatus,
  updateAdminPersona,
} from "@/lib/server/admin-ops-api";
import { updateAdminUser } from "@/lib/server/admin-user-api";

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function integerField(formData: FormData, name: string, minimum: number, maximum: number) {
  const value = Number(stringField(formData, name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function message(value: string) {
  return encodeURIComponent(value.slice(0, 180));
}

export async function loginAdmin(formData: FormData) {
  if (!verifyAdminPassword(stringField(formData, "password"))) {
    redirect("/admin-login?error=invalid");
  }
  await createAdminSession();
  try {
    const { backendJson, createBrowserSession } = await import("@/lib/server/user-auth");
    const credentials = await backendJson<any>("/login", {
      email: "admin@investiq.vn",
      password: process.env.ADMIN_UI_PASSWORD || "Admin@InvestIQ2026!",
    });
    await createBrowserSession(credentials);
  } catch {
    // ignore
  }
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin-login");
}

export async function changeSourceStatus(formData: FormData) {
  await requireAdminSession();
  try {
    const slug = stringField(formData, "slug");
    const status = stringField(formData, "status");
    if (!/^[a-z0-9-]{1,64}$/.test(slug) || !["active", "paused"].includes(status)) {
      throw new Error("Yêu cầu cập nhật nguồn không hợp lệ");
    }
    await updateAdminSource(
      slug,
      status as "active" | "paused",
      integerField(formData, "row_version", 1, Number.MAX_SAFE_INTEGER),
    );
  } catch (error) {
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Không thể cập nhật nguồn")}`);
  }
  revalidatePath("/admin/data-pipeline");
  redirect("/admin/data-pipeline?notice=Đã cập nhật trạng thái nguồn");
}

export async function startManualCrawl(formData: FormData) {
  await requireAdminSession();
  try {
    const slug = stringField(formData, "slug");
    if (!/^[a-z0-9-]{1,64}$/.test(slug)) throw new Error("Nguồn crawl không hợp lệ");
    await triggerAdminCrawl(slug, integerField(formData, "limit", 1, 100));
  } catch (error) {
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Không thể chạy crawl")}`);
  }
  revalidatePath("/admin/data-pipeline");
  redirect("/admin/data-pipeline?notice=Đã đưa crawl vào hàng đợi");
}

export async function previewRetention(formData: FormData) {
  await requireAdminSession();
  let matched = 0;
  try {
    const result = await runAdminRetention(
      integerField(formData, "retention_days", 7, 3650),
      true,
      false,
    );
    matched = result.matched ?? 0;
  } catch (error) {
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Không thể chạy dry-run")}`);
  }
  redirect(`/admin/data-pipeline?notice=${message(`Dry-run: ${matched} bài sẽ bị xóa`)}`);
}

export async function deleteExpiredNews(formData: FormData) {
  await requireAdminSession();
  let deleted = 0;
  try {
    if (stringField(formData, "confirmation") !== "DELETE") {
      throw new Error("Nhập DELETE để xác nhận xóa dữ liệu");
    }
    const result = await runAdminRetention(
      integerField(formData, "retention_days", 7, 3650),
      false,
      true,
    );
    deleted = result.deleted ?? 0;
  } catch (error) {
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Không thể xóa dữ liệu")}`);
  }
  redirect(`/admin/data-pipeline?notice=${message(`Đã xóa ${deleted} bài quá hạn`)}`);
}

export async function changeAdminUser(formData: FormData) {
  await requireAdminSession();
  try {
    const id = stringField(formData, "user_id");
    const role = stringField(formData, "role");
    const status = stringField(formData, "status");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Tài khoản không hợp lệ");
    if (!(["user", "admin"].includes(role) || ["active", "disabled"].includes(status))) {
      throw new Error("Cần chọn vai trò hoặc trạng thái hợp lệ");
    }
    await updateAdminUser(id, {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    });
  } catch (error) {
    redirect(`/admin/users?error=${message(error instanceof Error ? error.message : "Không thể cập nhật tài khoản")}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?notice=Đã cập nhật tài khoản");
}

export async function changeThesisStatus(formData: FormData) {
  await requireAdminSession();
  try {
    const id = stringField(formData, "thesis_id");
    const status = stringField(formData, "status");
    const note = stringField(formData, "note");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Khuyến nghị không hợp lệ");
    if (!["active", "hit_target", "stopped_out", "expired"].includes(status)) {
      throw new Error("Trạng thái không hợp lệ");
    }
    await updateAdminThesis(id, { status, note });
  } catch (error) {
    redirect(`/admin/theses?error=${message(error instanceof Error ? error.message : "Không thể cập nhật khuyến nghị")}`);
  }
  revalidatePath("/admin/theses");
  redirect("/admin/theses?notice=Đã cập nhật trạng thái khuyến nghị");
}

export async function removeThesisAction(formData: FormData) {
  await requireAdminSession();
  try {
    const id = stringField(formData, "thesis_id");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Khuyến nghị không hợp lệ");
    await deleteAdminThesis(id);
  } catch (error) {
    redirect(`/admin/theses?error=${message(error instanceof Error ? error.message : "Không thể xóa khuyến nghị")}`);
  }
  revalidatePath("/admin/theses");
  redirect("/admin/theses?notice=Đã xóa khuyến nghị thành công");
}

export async function refreshAdminCacheAction() {
  await requireAdminSession();
  await invalidateAdminCache();
  revalidatePath("/admin");
  redirect("/admin?notice=Đã làm mới dữ liệu thống kê");
}

export async function changeInstrumentStatusAction(formData: FormData) {
  await requireAdminSession();
  try {
    const symbol = stringField(formData, "symbol");
    const tradingStatus = stringField(formData, "trading_status");
    const ptEnabledRaw = stringField(formData, "paper_trading_enabled");

    if (!symbol) throw new Error("Mã chứng khoán không hợp lệ");

    const payload: { trading_status?: string; paper_trading_enabled?: boolean } = {};
    if (["normal", "warning", "halted"].includes(tradingStatus)) {
      payload.trading_status = tradingStatus;
    }
    if (ptEnabledRaw === "true" || ptEnabledRaw === "false") {
      payload.paper_trading_enabled = ptEnabledRaw === "true";
    }

    await updateAdminMarketInstrument(symbol, payload);
  } catch (error) {
    redirect(`/admin/market?error=${message(error instanceof Error ? error.message : "Không thể cập nhật mã cổ phiếu")}`);
  }
  revalidatePath("/admin/market");
  redirect("/admin/market?notice=Đã cập nhật trạng thái cổ phiếu thành công");
}

export async function changeAlertStatusAction(formData: FormData) {
  await requireAdminSession();
  try {
    const alertId = stringField(formData, "alert_id");
    const status = stringField(formData, "status") as "resolved" | "dismissed";
    const note = stringField(formData, "note");

    if (!alertId || !["resolved", "dismissed"].includes(status)) {
      throw new Error("Yêu cầu xử lý cảnh báo không hợp lệ");
    }

    await updateAdminAlert(alertId, { status, note });
  } catch (error) {
    redirect(`/admin/alerts?error=${message(error instanceof Error ? error.message : "Không thể cập nhật cảnh báo")}`);
  }
  revalidatePath("/admin/alerts");
  redirect("/admin/alerts?notice=Đã cập nhật trạng thái cảnh báo");
}

export async function syncMarketDividendsAction() {
  await requireAdminSession();
  try {
    const result = await syncAdminDividends();
    revalidatePath("/admin/data-pipeline");
    redirect(`/admin/data-pipeline?notice=${message(result.message || "Đã đồng bộ lịch cổ tức thị trường")}`);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Đồng bộ cổ tức thất bại")}`);
  }
}

export async function clearMarketDataCacheAction() {
  await requireAdminSession();
  try {
    const result = await clearAdminMarketDataCache();
    revalidatePath("/admin/data-pipeline");
    redirect(`/admin/data-pipeline?notice=${message(result.message || "Đã xóa bộ nhớ đệm dữ liệu thị trường")}`);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/data-pipeline?error=${message(error instanceof Error ? error.message : "Không thể xóa bộ nhớ đệm")}`);
  }
}

export async function createLearningTopicAction(formData: FormData) {
  await requireAdminSession();
  try {
    const rawPayload = stringField(formData, "payload_json");
    const payload = rawPayload ? JSON.parse(rawPayload) : {};
    await createAdminLearningTopic(payload);
    revalidatePath("/admin/learning");
    redirect("/admin/learning?notice=Đã thêm bài học mới thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/learning?error=${message(error instanceof Error ? error.message : "Không thể tạo bài học")}`);
  }
}

export async function updateLearningTopicAction(formData: FormData) {
  await requireAdminSession();
  try {
    const topicId = stringField(formData, "topic_id");
    const rawPayload = stringField(formData, "payload_json");
    const payload = rawPayload ? JSON.parse(rawPayload) : {};
    await updateAdminLearningTopic(topicId, payload);
    revalidatePath("/admin/learning");
    redirect("/admin/learning?notice=Đã cập nhật bài học thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/learning?error=${message(error instanceof Error ? error.message : "Không thể cập nhật bài học")}`);
  }
}

export async function deleteLearningTopicAction(formData: FormData) {
  await requireAdminSession();
  try {
    const topicId = stringField(formData, "topic_id");
    await deleteAdminLearningTopic(topicId);
    revalidatePath("/admin/learning");
    redirect("/admin/learning?notice=Đã xóa bài học thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/learning?error=${message(error instanceof Error ? error.message : "Không thể xóa bài học")}`);
  }
}

export async function toggleLearningTopicStatusAction(formData: FormData) {
  await requireAdminSession();
  try {
    const topicId = stringField(formData, "topic_id");
    const newStatus = stringField(formData, "status") as "published" | "draft";
    await toggleAdminLearningTopicStatus(topicId, newStatus);
    revalidatePath("/admin/learning");
    redirect(`/admin/learning?notice=${message(`Đã chuyển trạng thái sang ${newStatus === "published" ? "Đã xuất bản" : "Bản nháp"}`)}`);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/learning?error=${message(error instanceof Error ? error.message : "Không thể chuyển trạng thái bài học")}`);
  }
}


export async function createAssessmentQuestionAction(formData: FormData) {
  await requireAdminSession();
  try {
    const prompt = stringField(formData, "prompt");
    const category = stringField(formData, "category");
    const subtext = stringField(formData, "subtext");
    const sortOrder = parseInt(stringField(formData, "sort_order") || "1", 10);
    const optionsRaw = stringField(formData, "options_json");
    const status = (stringField(formData, "status") || "published") as "published" | "draft";

    let options = [];
    try {
      options = JSON.parse(optionsRaw);
    } catch {
      throw new Error("Dữ liệu các lựa chọn không đúng định dạng JSON");
    }

    await createAdminAssessmentQuestion({
      prompt,
      category,
      subtext: subtext || null,
      sort_order: sortOrder,
      options,
      status,
    });
    revalidatePath("/admin/assessment");
    redirect("/admin/assessment?notice=Đã tạo câu hỏi trắc nghiệm thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/assessment?error=${message(error instanceof Error ? error.message : "Không thể tạo câu hỏi")}`);
  }
}

export async function updateAssessmentQuestionAction(formData: FormData) {
  await requireAdminSession();
  try {
    const questionId = stringField(formData, "question_id");
    const prompt = stringField(formData, "prompt");
    const category = stringField(formData, "category");
    const subtext = stringField(formData, "subtext");
    const sortOrder = parseInt(stringField(formData, "sort_order") || "1", 10);
    const optionsRaw = stringField(formData, "options_json");
    const status = (stringField(formData, "status") || "published") as "published" | "draft";

    let options = [];
    try {
      options = JSON.parse(optionsRaw);
    } catch {
      throw new Error("Dữ liệu các lựa chọn không đúng định dạng JSON");
    }

    await updateAdminAssessmentQuestion(questionId, {
      prompt,
      category,
      subtext: subtext || null,
      sort_order: sortOrder,
      options,
      status,
    });
    revalidatePath("/admin/assessment");
    redirect("/admin/assessment?notice=Đã cập nhật câu hỏi thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/assessment?error=${message(error instanceof Error ? error.message : "Không thể cập nhật câu hỏi")}`);
  }
}

export async function deleteAssessmentQuestionAction(formData: FormData) {
  await requireAdminSession();
  try {
    const questionId = stringField(formData, "question_id");
    await deleteAdminAssessmentQuestion(questionId);
    revalidatePath("/admin/assessment");
    redirect("/admin/assessment?notice=Đã xóa câu hỏi thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/assessment?error=${message(error instanceof Error ? error.message : "Không thể xóa câu hỏi")}`);
  }
}

export async function toggleAssessmentQuestionStatusAction(formData: FormData) {
  await requireAdminSession();
  try {
    const questionId = stringField(formData, "question_id");
    const newStatus = stringField(formData, "status") as "published" | "draft";
    await toggleAdminAssessmentQuestionStatus(questionId, newStatus);
    revalidatePath("/admin/assessment");
    redirect(`/admin/assessment?notice=${message(`Đã chuyển trạng thái câu hỏi sang ${newStatus === "published" ? "Đã xuất bản" : "Bản nháp"}`)}`);
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/assessment?error=${message(error instanceof Error ? error.message : "Không thể đổi trạng thái")}`);
  }
}

export async function updatePersonaAction(formData: FormData) {
  await requireAdminSession();
  try {
    const code = stringField(formData, "code");
    const title = stringField(formData, "title");
    const tagline = stringField(formData, "tagline");
    const description = stringField(formData, "description");
    const strategy = stringField(formData, "recommended_strategy");
    const idealHours = parseInt(stringField(formData, "ideal_time_hours_per_week") || "3", 10);

    const payload: Record<string, unknown> = {
      title,
      tagline,
      description,
      recommended_strategy: strategy,
      ideal_time_hours_per_week: idealHours,
    };

    const allocationRaw = stringField(formData, "asset_allocation_json");
    if (allocationRaw) {
      try {
        payload.asset_allocation = JSON.parse(allocationRaw);
      } catch {
        // ignore allocation parse error
      }
    }

    await updateAdminPersona(code, payload);
    revalidatePath("/admin/assessment");
    redirect("/admin/assessment?notice=Đã cập nhật thông tin Persona thành công");
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || ("digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")))) {
      throw error;
    }
    redirect(`/admin/assessment?error=${message(error instanceof Error ? error.message : "Không thể cập nhật Persona")}`);
  }
}
