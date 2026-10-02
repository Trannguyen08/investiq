import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "investiq_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function secret(name: "ADMIN_UI_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret("ADMIN_SESSION_SECRET")).update(payload).digest("base64url");
}

function equal(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function adminAuthConfigured() {
  return Boolean(
    process.env.ADMIN_UI_PASSWORD &&
      process.env.ADMIN_SESSION_SECRET &&
      process.env.ADMIN_SESSION_SECRET.length >= 32,
  );
}

export function verifyAdminPassword(candidate: string) {
  if (!adminAuthConfigured()) return false;
  return equal(candidate, secret("ADMIN_UI_PASSWORD"));
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString("base64url");
  const value = `${payload}.${signature(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    maxAge: SESSION_SECONDS,
    path: "/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function hasAdminSession() {
  if (!adminAuthConfigured()) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [payload, suppliedSignature] = value.split(".", 2);
  if (!payload || !suppliedSignature || !equal(suppliedSignature, signature(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { expiresAt?: unknown };
    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) redirect("/admin-login");
}
