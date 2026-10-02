import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import type { Challenge } from "@/lib/auth-types";
import {
  UserAuthError, authConfigured, authenticatedSession, backendJson, clearBrowserSession,
  createBrowserSession, currentUser, fetchChallenge, getOrCreatePreAuth, logoutBackend,
  savePreAuth, verifyCsrf, type BackendCredentials,
} from "@/lib/server/user-auth";

type Context = { params: Promise<{ path: string[] }> };

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function googleCallbackRedirect(path: string) {
  const callbackUri = process.env.AUTH_GOOGLE_REDIRECT_URI;
  if (!callbackUri) throw new UserAuthError(503, "GOOGLE_NOT_CONFIGURED", "Đăng nhập Google chưa được cấu hình.");
  return NextResponse.redirect(new URL(path, callbackUri));
}

function errorResponse(error: unknown) {
  if (error instanceof UserAuthError) return json({ error: { code: error.code, message: error.message } }, error.status);
  return json({ error: { code: "AUTH_UNAVAILABLE", message: "Dịch vụ xác thực tạm thời chưa sẵn sàng." } }, 503);
}

async function body(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 16_384) throw new UserAuthError(413, "REQUEST_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new UserAuthError(400, "INVALID_JSON", "Dữ liệu gửi lên không hợp lệ.");
  }
}

export async function GET(request: Request, context: Context) {
  try {
    if (!authConfigured()) throw new UserAuthError(503, "AUTH_NOT_CONFIGURED", "Tính năng đăng nhập chưa được cấu hình.");
    const path = (await context.params).path.join("/");
    if (path === "csrf") {
      const preauth = await getOrCreatePreAuth();
      return json({ csrf_token: preauth.value.csrf });
    }
    if (path === "me") return json({ user: await currentUser() });
    if (path === "challenge") return json({ challenge: await fetchChallenge(await getOrCreatePreAuth()) });
    if (path === "google/start") {
      const clientId = process.env.AUTH_GOOGLE_CLIENT_ID;
      const redirectUri = process.env.AUTH_GOOGLE_REDIRECT_URI;
      if (!clientId || !redirectUri) throw new UserAuthError(503, "GOOGLE_NOT_CONFIGURED", "Đăng nhập Google chưa được cấu hình.");
      const preauth = await getOrCreatePreAuth();
      const state = randomBytes(32).toString("base64url");
      const nonce = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      await savePreAuth(preauth.raw, { ...preauth.value, googleState: state, googleNonce: nonce, googleVerifier: verifier });
      const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorize.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile",
        state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
      }).toString();
      return NextResponse.redirect(authorize);
    }
    if (path === "google/callback") {
      const url = new URL(request.url);
      const preauth = await getOrCreatePreAuth();
      if (!preauth.value.googleState || url.searchParams.get("state") !== preauth.value.googleState || !preauth.value.googleNonce || !preauth.value.googleVerifier) {
        throw new UserAuthError(401, "GOOGLE_STATE_INVALID", "Phiên đăng nhập Google không hợp lệ.");
      }
      const code = url.searchParams.get("code");
      if (!code || url.searchParams.has("error")) throw new UserAuthError(401, "GOOGLE_CANCELLED", "Đăng nhập Google đã bị hủy.");
      const credentials = await backendJson<BackendCredentials>("/google/exchange", {
        code, code_verifier: preauth.value.googleVerifier, nonce: preauth.value.googleNonce,
      });
      await createBrowserSession(credentials);
      return googleCallbackRedirect("/?auth=login-success");
    }
    return json({ error: { code: "NOT_FOUND", message: "Không tìm thấy endpoint." } }, 404);
  } catch (error) {
    if ((await context.params).path.join("/") === "google/callback") {
      return googleCallbackRedirect(`/login?error=${encodeURIComponent(error instanceof UserAuthError ? error.code : "GOOGLE_AUTH_FAILED")}`);
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    if (!authConfigured()) throw new UserAuthError(503, "AUTH_NOT_CONFIGURED", "Tính năng đăng nhập chưa được cấu hình.");
    await verifyCsrf(request);
    const path = (await context.params).path.join("/");
    const data = await body(request);
    if (path === "login") {
      const credentials = await backendJson<BackendCredentials>("/login", {
        email: data.email, password: data.password,
      });
      await createBrowserSession(credentials);
      return json({ user: credentials.user });
    }
    if (path === "register") {
      const preauth = await getOrCreatePreAuth();
      const challenge = await backendJson<{ challenge_id: string }>("/register", {
        pre_auth_id: preauth.value.id, email: data.email, display_name: data.display_name,
        password: data.password, password_confirmation: data.password_confirmation,
      });
      await savePreAuth(preauth.raw, { ...preauth.value, challengeId: challenge.challenge_id, purpose: "registration" });
      return json({ next: "/verify-email" }, 202);
    }
    if (path === "verify-email") {
      const preauth = await getOrCreatePreAuth();
      if (!preauth.value.challengeId) throw new UserAuthError(404, "CHALLENGE_NOT_FOUND", "Không tìm thấy yêu cầu xác thực.");
      const credentials = await backendJson<BackendCredentials>("/email-verification/verify", {
        pre_auth_id: preauth.value.id, challenge_id: preauth.value.challengeId, otp: data.otp,
      });
      await createBrowserSession(credentials);
      return json({ user: credentials.user }, 201);
    }
    if (path === "resend") {
      const preauth = await getOrCreatePreAuth();
      if (!preauth.value.challengeId || !preauth.value.purpose) throw new UserAuthError(404, "CHALLENGE_NOT_FOUND", "Không tìm thấy yêu cầu xác thực.");
      await backendJson("/challenges/resend", { pre_auth_id: preauth.value.id, challenge_id: preauth.value.challengeId, purpose: preauth.value.purpose });
      return json({ accepted: true }, 202);
    }
    if (path === "password-reset/request") {
      const preauth = await getOrCreatePreAuth();
      const challenge = await backendJson<{ challenge_id: string; expires_in: number }>("/password-reset/request", { pre_auth_id: preauth.value.id, email: data.email });
      await savePreAuth(preauth.raw, { ...preauth.value, challengeId: challenge.challenge_id, purpose: "password_reset" });
      return json({ accepted: true, expires_in: challenge.expires_in }, 202);
    }
    if (path === "password-reset/verify") {
      const preauth = await getOrCreatePreAuth();
      if (!preauth.value.challengeId) throw new UserAuthError(404, "CHALLENGE_NOT_FOUND", "Không tìm thấy yêu cầu xác thực.");
      const grant = await backendJson<{ reset_grant: string }>("/password-reset/verify", {
        pre_auth_id: preauth.value.id, challenge_id: preauth.value.challengeId, otp: data.otp,
      });
      await savePreAuth(preauth.raw, { ...preauth.value, resetGrant: grant.reset_grant });
      return json({ verified: true });
    }
    if (path === "password-reset/complete") {
      const preauth = await getOrCreatePreAuth();
      if (!preauth.value.resetGrant) throw new UserAuthError(401, "INVALID_RESET_GRANT", "Bạn cần xác minh OTP trước.");
      await backendJson("/password-reset/complete", { reset_grant: preauth.value.resetGrant, password: data.password, password_confirmation: data.password_confirmation });
      await clearBrowserSession();
      return new Response(null, { status: 204 });
    }
    if (path === "logout") {
      await logoutBackend();
      return new Response(null, { status: 204 });
    }
    if (path === "refresh") {
      const session = await authenticatedSession();
      return json({ user: session.value.credentials.user });
    }
    return json({ error: { code: "NOT_FOUND", message: "Không tìm thấy endpoint." } }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
