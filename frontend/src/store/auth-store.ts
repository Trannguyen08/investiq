import type { AuthUser } from "@/lib/auth-types";

type AuthState = { status: "loading" | "authenticated" | "anonymous"; user: AuthUser | null };
const serverState: AuthState = { status: "loading", user: null };
let state: AuthState = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: AuthState) { state = next; for (const listener of listeners) listener(); }
export function subscribeAuth(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function authSnapshot() { return state; }
export function serverAuthSnapshot() { return serverState; }

export async function loadAuth(force = false) {
  if (loaded && !force) return;
  loaded = true;
  try {
    localStorage.removeItem("investiq_remembered_email");
    localStorage.removeItem("investiq_remember_email_after_google");
    sessionStorage.removeItem("investiq_pending_remember_email");
    const response = await fetch("/auth-api/me", { cache: "no-store" });
    if (!response.ok) { emit({ status: "anonymous", user: null }); return; }
    const data = await response.json() as { user: AuthUser };
    emit({ status: "authenticated", user: data.user });
  } catch { emit({ status: "anonymous", user: null }); }
}

export async function logoutAuth() {
  const csrfResponse = await fetch("/auth-api/csrf", { cache: "no-store" });
  const csrf = await csrfResponse.json() as { csrf_token?: string };
  const response = await fetch("/auth-api/logout", { method: "POST", headers: { "X-CSRF-Token": csrf.csrf_token ?? "" } });
  if (!response.ok) throw new Error("Chưa thể xác nhận đăng xuất. Vui lòng thử lại.");
  loaded = true;
  emit({ status: "anonymous", user: null });
  localStorage.setItem("investiq_auth_logout", String(Date.now()));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "investiq_auth_logout") { loaded = true; emit({ status: "anonymous", user: null }); }
  });
}
