"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import type { Challenge } from "@/lib/auth-types";
import { loadAuth } from "@/store/auth-store";

type ApiFailure = { error?: { message?: string } };

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Không thể khởi tạo phiên bảo mật.");
  return data.csrf_token as string;
}

async function post(path: string, body: object) {
  const csrf = await csrfToken();
  const response = await fetch(`/auth-api/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(body), cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    throw new Error(data.error?.message ?? "Không thể xử lý yêu cầu.");
  }
  return response.status === 204 ? null : response.json();
}

function rememberEmail(email: string, enabled: boolean) {
  if (!enabled) { localStorage.removeItem("investiq_remembered_email"); return; }
  localStorage.setItem("investiq_remembered_email", JSON.stringify({ email, expiresAt: Date.now() + 30 * 86400_000 }));
}

function recalledEmail() {
  if (typeof window === "undefined") return "";
  try {
    const value = JSON.parse(localStorage.getItem("investiq_remembered_email") ?? "null") as { email?: unknown; expiresAt?: unknown } | null;
    if (!value || typeof value.email !== "string" || typeof value.expiresAt !== "number" || value.expiresAt <= Date.now()) {
      localStorage.removeItem("investiq_remembered_email"); return "";
    }
    return value.email;
  } catch { return ""; }
}

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="auth-page" id="main-content"><section className="auth-card"><Link className="auth-brand" href="/"><img src="/investiq-logo.svg" width="132" height="36" alt="InvestIQ" /></Link><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section></main>;
}

function PasswordField({ id, label, value, onChange, autoComplete = "current-password" }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field" htmlFor={id}><span>{label}</span><span className="password-wrap"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required minLength={15} maxLength={128} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}>{visible ? "Ẩn" : "Hiện"}</button></span></label>;
}

function Notice({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="auth-notice error" role="alert">{error}</p>;
  if (success) return <p className="auth-notice success" role="status">{success}</p>;
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(recalledEmail); const [password, setPassword] = useState("");
  const [rememberEmailChoice, setRememberEmailChoice] = useState(() => Boolean(recalledEmail())); const [rememberSession, setRememberSession] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await post("login", { email, password, remember_session: rememberSession }); rememberEmail(email, rememberEmailChoice); localStorage.removeItem("investiq_remember_email_after_google"); await loadAuth(true); router.push("/?auth=login-success"); router.refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : "Đăng nhập thất bại."); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={320} /></label><PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} /><div className="forgot-row"><Link href="/forgot-password">Quên mật khẩu?</Link></div><div className="auth-options"><label><input type="checkbox" checked={rememberEmailChoice} onChange={(event) => setRememberEmailChoice(event.target.checked)} /> Ghi nhớ email</label><label><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /> Duy trì đăng nhập</label></div><Notice error={error} /><button className="auth-primary" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button><a className="google-button" href={`/auth-api/google/start?rememberSession=${rememberSession}`} onClick={() => { if (rememberEmailChoice) localStorage.setItem("investiq_remember_email_after_google", "true"); else localStorage.removeItem("investiq_remember_email_after_google"); }}>Đăng nhập với Google</a><p className="auth-switch">Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link></p></form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [rememberEmailChoice, setRememberEmailChoice] = useState(false); const [rememberSession, setRememberSession] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await post("register", { email, display_name: name, password, password_confirmation: confirmation, remember_session: rememberSession }); sessionStorage.setItem("investiq_pending_remember_email", JSON.stringify({ email, enabled: rememberEmailChoice })); router.push("/verify-email"); } catch (value) { setError(value instanceof Error ? value.message : "Đăng ký thất bại."); } finally { setBusy(false); } }
  return <form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={320} /></label><label className="auth-field" htmlFor="display-name"><span>Tên hiển thị</span><input id="display-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={80} /></label><PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} autoComplete="new-password" /><PasswordField id="confirmation" label="Nhập lại mật khẩu" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /><p className="password-hint">Dùng từ 15 đến 128 ký tự. Bạn có thể dùng trình quản lý mật khẩu.</p><div className="auth-options"><label><input type="checkbox" checked={rememberEmailChoice} onChange={(event) => setRememberEmailChoice(event.target.checked)} /> Ghi nhớ email</label><label><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /> Duy trì đăng nhập</label></div><Notice error={error} /><button className="auth-primary" disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Đăng ký"}</button><p className="auth-switch">Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p></form>;
}

function useChallenge() {
  const [challenge, setChallenge] = useState<Challenge | null>(null); const [error, setError] = useState("");
  async function load() { const response = await fetch("/auth-api/challenge", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? "Không tìm thấy yêu cầu xác thực."); setChallenge(data.challenge); }
  useEffect(() => { void fetch("/auth-api/challenge", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? "Không tìm thấy yêu cầu xác thực."); return data.challenge as Challenge; }).then(setChallenge).catch((value) => setError(value instanceof Error ? value.message : "Không thể tải yêu cầu.")); }, []);
  return { challenge, error, setError, reload: load };
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => { const update = () => setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))); update(); const timer = window.setInterval(update, 1000); return () => clearInterval(timer); }, [expiresAt]);
  return <span className="otp-countdown" aria-live="polite">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</span>;
}

export function VerifyEmailForm() {
  const router = useRouter(); const { challenge, error, setError, reload } = useChallenge();
  const [otp, setOtp] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await post("verify-email", { otp }); const pending = JSON.parse(sessionStorage.getItem("investiq_pending_remember_email") ?? "null") as { email?: unknown; enabled?: unknown } | null; if (pending && typeof pending.email === "string") rememberEmail(pending.email, pending.enabled === true); sessionStorage.removeItem("investiq_pending_remember_email"); localStorage.removeItem("investiq_remember_email_after_google"); await loadAuth(true); router.push("/?auth=register-success"); router.refresh(); } catch (value) { setError(value instanceof Error ? value.message : "Mã OTP không hợp lệ."); } finally { setBusy(false); } }
  async function resend() { setBusy(true); setError(""); try { await post("resend", {}); await reload(); } catch (value) { setError(value instanceof Error ? value.message : "Không thể gửi lại mã."); } finally { setBusy(false); } }
  return <form className="auth-form" onSubmit={submit}><p className="masked-email">Mã đã gửi tới <strong>{challenge?.masked_email ?? "email của bạn"}</strong></p>{challenge && <Countdown expiresAt={challenge.expires_at} />}<label className="auth-field" htmlFor="otp"><span>Mã OTP</span><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required /></label><Notice error={error} /><button className="auth-primary" disabled={busy || otp.length !== 6}>{busy ? "Đang xác nhận…" : "Xác nhận"}</button><button className="auth-secondary" type="button" onClick={resend} disabled={busy}>Gửi lại mã</button><Link className="auth-text-link" href="/register">Đổi email</Link></form>;
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "otp" | "password">("email"); const [email, setEmail] = useState(""); const [otp, setOtp] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const router = useRouter();
  async function sendEmail() { setBusy(true); setError(""); try { await post("password-reset/request", { email }); setStep("otp"); setSuccess("Nếu tài khoản đủ điều kiện, mã khôi phục đã được gửi tới email."); } catch (value) { setError(value instanceof Error ? value.message : "Không thể gửi yêu cầu."); } finally { setBusy(false); } }
  async function verifyOtp() { setBusy(true); setError(""); try { await post("password-reset/verify", { otp }); setStep("password"); setSuccess("OTP hợp lệ. Hãy đặt mật khẩu mới."); } catch (value) { setError(value instanceof Error ? value.message : "OTP không hợp lệ."); } finally { setBusy(false); } }
  async function changePassword() { setBusy(true); setError(""); try { await post("password-reset/complete", { password, password_confirmation: confirmation }); router.push("/login?reset=success"); } catch (value) { setError(value instanceof Error ? value.message : "Không thể đổi mật khẩu."); } finally { setBusy(false); } }
  async function submit(event: FormEvent) { event.preventDefault(); if (step === "email") await sendEmail(); else if (step === "otp") await verifyOtp(); else await changePassword(); }
  return <form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={step !== "email"} /></label><button className="auth-primary" type="button" onClick={sendEmail} disabled={busy || step !== "email"}>Xác nhận email</button><label className="auth-field" htmlFor="otp"><span>Mã OTP</span><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} disabled={step !== "otp"} /></label><button className="auth-secondary" type="button" onClick={verifyOtp} disabled={busy || step !== "otp" || otp.length !== 6}>Xác nhận OTP</button>{step === "password" && <div className="reset-password-fields"><PasswordField id="new-password" label="Mật khẩu mới" value={password} onChange={setPassword} autoComplete="new-password" /><PasswordField id="new-confirmation" label="Nhập lại mật khẩu mới" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /><button className="auth-primary" disabled={busy}>Đổi mật khẩu</button></div>}<Notice error={error} success={success} /><p className="auth-switch"><Link href="/login">Quay lại đăng nhập</Link></p></form>;
}
