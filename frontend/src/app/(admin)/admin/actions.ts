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
  redirect("/admin/data-pipeline");
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
