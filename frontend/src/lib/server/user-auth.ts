import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { createClient, type RedisClientType } from "redis";

import type { AuthErrorBody, AuthUser, Challenge } from "@/lib/auth-types";

type BackendCredentials = {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  session_id: string;
  user: AuthUser;
};

type BrowserSession = { credentials: BackendCredentials; csrf: string };
type PreAuth = {
  id: string;
  csrf: string;
  challengeId?: string;
  purpose?: "registration" | "password_reset";
  resetGrant?: string;
  googleState?: string;
  googleNonce?: string;
  googleVerifier?: string;
};

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-investiq-session" : "investiq_session";
const PREAUTH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-investiq-preauth" : "investiq_preauth";
const CSRF_COOKIE = "investiq_csrf";
let redisClient: RedisClientType | undefined;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encryptionKey() {
  const value = Buffer.from(required("AUTH_SESSION_ENCRYPTION_KEY"), "base64url");
  if (value.length !== 32) throw new Error("AUTH_SESSION_ENCRYPTION_KEY must decode to 32 bytes");
  return value;
}

async function redis() {
  if (!redisClient) {
    redisClient = createClient({ url: required("AUTH_SESSION_REDIS_URL"), socket: { connectTimeout: 1500 } });
    redisClient.on("error", () => undefined);
  }
  if (!redisClient.isOpen) await redisClient.connect();
  return redisClient;
}

function key(prefix: string, raw: string) {
  return `${prefix}:${createHash("sha256").update(raw).digest("hex")}`;
}

function encrypt(value: object) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decrypt<T>(value: string): T {
  const data = Buffer.from(value, "base64url");
  if (data.length < 29) throw new Error("Stored session is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()) as T;
}

async function backend(path: string, init: RequestInit = {}) {
  const base = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000/api";
  return fetch(`${base}/v1/auth${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Secret": required("AUTH_BFF_SECRET"),
      ...(init.headers ?? {}),
    },
  });
}

export async function backendJson<T>(path: string, body?: object, method = "POST"): Promise<T> {
  const response = await backend(path, { method, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as AuthErrorBody;
    throw new UserAuthError(response.status, data.error?.code ?? "AUTH_FAILED", data.error?.message ?? "Không thể xử lý yêu cầu.");
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export class UserAuthError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function authConfigured() {
  return Boolean(
    process.env.AUTH_BFF_SECRET && process.env.AUTH_SESSION_REDIS_URL && process.env.AUTH_SESSION_ENCRYPTION_KEY,
  );
}

async function setPreAuth(value: PreAuth) {
  const raw = randomBytes(32).toString("base64url");
  await (await redis()).set(key("preauth", raw), encrypt(value), { EX: 15 * 60 });
  const store = await cookies();
  store.set(PREAUTH_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
  store.set(CSRF_COOKIE, value.csrf, { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
  return raw;
}

export async function getOrCreatePreAuth() {
  const store = await cookies();
  const raw = store.get(PREAUTH_COOKIE)?.value;
  if (raw) {
    const stored = await (await redis()).get(key("preauth", raw));
    if (stored) {
      const value = decrypt<PreAuth>(stored);
      // Keep the readable double-submit cookie aligned with the active pre-auth session.
      store.set(CSRF_COOKIE, value.csrf, { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
      return { raw, value };
    }
  }
  const value: PreAuth = { id: crypto.randomUUID(), csrf: randomBytes(32).toString("base64url") };
  const created = await setPreAuth(value);
  return { raw: created, value };
}

export async function savePreAuth(raw: string, value: PreAuth) {
  await (await redis()).set(key("preauth", raw), encrypt(value), { EX: 15 * 60 });
}

export async function verifyCsrf(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // The incoming request URL can be the internal frontend address behind Nginx.
  const publicOrigin = new URL(process.env.AUTH_GOOGLE_REDIRECT_URI ?? request.url).origin;
  if (origin && origin !== publicOrigin) {
    throw new UserAuthError(403, "CSRF_REJECTED", "Yêu cầu không hợp lệ.");
  }
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new UserAuthError(403, "CSRF_REJECTED", "Yêu cầu không hợp lệ.");
  }
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const supplied = request.headers.get("x-csrf-token");
  const preauthRaw = store.get(PREAUTH_COOKIE)?.value;
  const sessionRaw = store.get(SESSION_COOKIE)?.value;
  if (!cookieToken || !supplied || !preauthRaw && !sessionRaw) throw new UserAuthError(403, "CSRF_REJECTED", "Yêu cầu không hợp lệ.");
  const left = Buffer.from(cookieToken);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UserAuthError(403, "CSRF_REJECTED", "Yêu cầu không hợp lệ.");
  if (preauthRaw) {
    const stored = await (await redis()).get(key("preauth", preauthRaw));
    if (stored && decrypt<PreAuth>(stored).csrf === cookieToken) return;
  }
  if (sessionRaw) {
    const stored = await (await redis()).get(key("session", sessionRaw));
    if (stored && decrypt<BrowserSession>(stored).csrf === cookieToken) return;
  }
  throw new UserAuthError(403, "CSRF_REJECTED", "Yêu cầu không hợp lệ.");
}

const sessionDays = Number(process.env.AUTH_SESSION_DAYS ?? "30");
if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
  throw new Error("AUTH_SESSION_DAYS must be between 1 and 90");
}
const SESSION_TTL_SECONDS = sessionDays * 24 * 60 * 60;

export async function createBrowserSession(credentials: BackendCredentials) {
  const raw = randomBytes(32).toString("base64url");
  const csrf = randomBytes(32).toString("base64url");
  await (await redis()).set(key("session", raw), encrypt({ credentials, csrf } satisfies BrowserSession), { EX: SESSION_TTL_SECONDS });
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  store.set(CSRF_COOKIE, csrf, { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS });
  const preauth = store.get(PREAUTH_COOKIE)?.value;
  if (preauth) await (await redis()).del(key("preauth", preauth));
  store.delete(PREAUTH_COOKIE);
}

async function loadSession() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const stored = await (await redis()).get(key("session", raw));
  if (!stored) return null;
  return { raw, value: decrypt<BrowserSession>(stored) };
}

async function refreshSession(raw: string, session: BrowserSession) {
  if (new Date(session.credentials.access_expires_at).getTime() > Date.now() + 15_000) return session;
  const client = await redis();
  const lockKey = key("refresh-lock", raw);
  const owner = randomBytes(16).toString("hex");
  const acquired = await client.set(lockKey, owner, { NX: true, PX: 3000 });
  if (!acquired) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const newer = await client.get(key("session", raw));
      if (!newer) throw new UserAuthError(401, "INVALID_SESSION", "Phiên đăng nhập đã hết hạn.");
      const value = decrypt<BrowserSession>(newer);
      if (new Date(value.credentials.access_expires_at).getTime() > Date.now() + 15_000) return value;
    }
    throw new UserAuthError(503, "REFRESH_BUSY", "Phiên đang được làm mới. Vui lòng thử lại.");
  }
  try {
    const current = await client.get(key("session", raw));
    const latest = current ? decrypt<BrowserSession>(current) : session;
    if (new Date(latest.credentials.access_expires_at).getTime() > Date.now() + 15_000) return latest;
    const credentials = await backendJson<BackendCredentials>("/refresh", { refresh_token: latest.credentials.refresh_token });
    const updated = { ...latest, credentials };
    await client.set(key("session", raw), encrypt(updated), { EX: SESSION_TTL_SECONDS });
    return updated;
  } finally {
    await client.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", { keys: [lockKey], arguments: [owner] });
  }
}

export async function authenticatedSession() {
  const loaded = await loadSession();
  if (!loaded) throw new UserAuthError(401, "INVALID_SESSION", "Bạn chưa đăng nhập.");
  try {
    return { raw: loaded.raw, value: await refreshSession(loaded.raw, loaded.value) };
  } catch (error) {
    if (error instanceof UserAuthError && error.status === 401) {
      await clearBrowserSession(loaded.raw);
    }
    throw error;
  }
}

export async function currentUser() {
  const session = await authenticatedSession();
  const response = await backend("/me", { headers: { Authorization: `Bearer ${session.value.credentials.access_token}` } });
  if (!response.ok) {
    if (response.status === 401) await clearBrowserSession(session.raw);
    throw new UserAuthError(response.status, "INVALID_SESSION", "Phiên đăng nhập đã hết hạn.");
  }
  return (await response.json()) as AuthUser;
}

export async function clearBrowserSession(raw?: string) {
  const store = await cookies();
  const value = raw ?? store.get(SESSION_COOKIE)?.value;
  if (value) await (await redis()).del(key("session", value));
  store.delete(SESSION_COOKIE);
  store.delete(PREAUTH_COOKIE);
  store.delete(CSRF_COOKIE);
}

export async function logoutBackend() {
  const loaded = await loadSession();
  if (!loaded) { await clearBrowserSession(); return; }
  try {
    const session = await refreshSession(loaded.raw, loaded.value);
    await backend("/logout", { method: "POST", headers: { Authorization: `Bearer ${session.credentials.access_token}` } });
  } finally {
    await clearBrowserSession(loaded.raw);
  }
}

export async function fetchChallenge(preAuth: { raw: string; value: PreAuth }) {
  if (!preAuth.value.challengeId) throw new UserAuthError(404, "CHALLENGE_NOT_FOUND", "Không tìm thấy yêu cầu xác thực.");
  const query = new URLSearchParams({ pre_auth_id: preAuth.value.id, challenge_id: preAuth.value.challengeId });
  return backendJson<Challenge>(`/challenges/current?${query}`, undefined, "GET");
}

export type { BackendCredentials, PreAuth };
