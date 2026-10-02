import "server-only";

import { authenticatedSession } from "@/lib/server/user-auth";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  provider: "password" | "google";
  email_verified_at: string | null;
  created_at: string;
};

export type AdminUserPage = {
  items: AdminUser[];
  total: number;
  limit: number;
  page: number;
  next_cursor: string | null;
  previous_cursor: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await authenticatedSession();
  const base = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";
  const response = await fetch(`${base}/v1/admin/users${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Secret": process.env.AUTH_BFF_SECRET ?? "",
      Authorization: `Bearer ${session.value.credentials.access_token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string }; detail?: string }
      | null;
    throw new Error(body?.error?.message ?? body?.detail ?? `Không thể quản lý tài khoản (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getAdminUsers(filters: {
  q?: string;
  role?: string;
  status?: string;
  provider?: string;
  limit?: number;
  cursor?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return request<AdminUserPage>(`?${query.toString()}`);
}

export function updateAdminUser(id: string, update: { role?: string; status?: string }) {
  return request<AdminUser>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}
