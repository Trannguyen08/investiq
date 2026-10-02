"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import type { Challenge } from "@/lib/auth-types";
import { loadAuth } from "@/store/auth-store";

type ApiFailure = { error?: { message?: string } };

async function csrfToken() {
  const response = await fetch("/auth-api/csrf", { cache: "no-store", credentials: "same-origin" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Không thể khởi tạo phiên bảo mật.");
  return data.csrf_token as string;
}

async function post(path: string, body: object) {
  const csrf = await csrfToken();
  const response = await fetch(`/auth-api/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(body), cache: "no-store", credentials: "same-origin",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    throw new Error(data.error?.message ?? "Không thể xử lý yêu cầu.");
  }
  return response.status === 204 ? null : response.json();
}

export function AuthShell({ eyebrow, title, description, children, hideEyebrow = false }: { eyebrow: string; title: string; description: string; children: ReactNode; hideEyebrow?: boolean }) {
  return <main className="auth-page" id="main-content"><section className="auth-card"><Link className="auth-brand" href="/"><img src="/investiq-logo.svg" width="164" height="46" alt="InvestIQ" /></Link><header className="auth-heading">{!hideEyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="auth-description">{description}</p></header>{children}</section></main>;
}

function PasswordField({ id, label, value, onChange, autoComplete = "current-password" }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field" htmlFor={id}><span>{label}</span><span className="password-wrap"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required minLength={15} maxLength={128} /><button className="password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`} aria-pressed={visible}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" />{visible && <path d="m4 4 16 16" />}</svg></button></span></label>;
}

function Notice({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="auth-notice error" role="alert">{error}</p>;
  if (success) return <p className="auth-notice success" role="status">{success}</p>;
  return null;
}

export function LoginForm({ resetSucceeded = false }: { resetSucceeded?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await post("login", { email, password }); await loadAuth(true); router.push("/?auth=login-success"); router.refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : "Đăng nhập thất bại."); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={320} /></label><PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} /><div className="forgot-row"><Link href="/forgot-password">Quên mật khẩu?</Link></div><Notice error={error} success={resetSucceeded ? "Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới." : ""} /><button className="auth-primary" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button><Link className="google-button" href="/auth-api/google/start"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.9-.4-4.3H24v8.2h11a9.5 9.5 0 0 1-4.1 6.2v5.4h6.7c3.9-3.6 6-8.9 6-15.5Z" /><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.4c-1.9 1.3-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.5A20 20 0 0 0 24 44Z" /><path fill="#FBBC05" d="M12.8 27.5a12 12 0 0 1 0-7v-5.6H5.9a20 20 0 0 0 0 18.2l6.9-5.6Z" /><path fill="#EA4335" d="M24 12.3c3 0 5.7 1 7.8 3.1l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.9 14.9l6.9 5.6c1.6-4.7 6-8.2 11.2-8.2Z" /></svg>Đăng nhập với Google</Link><p className="auth-switch">Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link></p></form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await post("register", { email, display_name: name, password, password_confirmation: confirmation }); router.push("/verify-email"); } catch (value) { setError(value instanceof Error ? value.message : "Đăng ký thất bại."); } finally { setBusy(false); } }
  return <form className="auth-form" onSubmit={submit}><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={320} /></label><label className="auth-field" htmlFor="display-name"><span>Tên hiển thị</span><input id="display-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={80} /></label><PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} autoComplete="new-password" /><PasswordField id="confirmation" label="Nhập lại mật khẩu" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /><p className="password-hint">Dùng từ 15 đến 128 ký tự. Bạn có thể dùng trình quản lý mật khẩu.</p><Notice error={error} /><button className="auth-primary" disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Đăng ký"}</button><p className="auth-switch">Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p></form>;
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
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await post("verify-email", { otp }); await loadAuth(true); router.push("/?auth=register-success"); router.refresh(); } catch (value) { setError(value instanceof Error ? value.message : "Mã OTP không hợp lệ."); } finally { setBusy(false); } }
  async function resend() { setBusy(true); setError(""); try { await post("resend", {}); await reload(); } catch (value) { setError(value instanceof Error ? value.message : "Không thể gửi lại mã."); } finally { setBusy(false); } }
  return <form className="auth-form" onSubmit={submit}><p className="masked-email">Mã đã gửi tới <strong>{challenge?.masked_email ?? "email của bạn"}</strong></p><p className="masked-email">Nếu chưa thấy thư, hãy kiểm tra mục Thư rác/Spam. Với Gmail, chọn “Không phải thư rác” để thư sau dễ vào hộp thư đến hơn.</p>{challenge && <Countdown expiresAt={challenge.expires_at} />}<label className="auth-field" htmlFor="otp"><span>Mã OTP</span><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required /></label><Notice error={error} /><button className="auth-primary" disabled={busy || otp.length !== 6}>{busy ? "Đang xác nhận…" : "Xác nhận"}</button><button className="auth-secondary" type="button" onClick={resend} disabled={busy}>Gửi lại mã</button><Link className="auth-text-link" href="/register">Đổi email</Link></form>;
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "otp" | "password">("email"); const [email, setEmail] = useState(""); const [otp, setOtp] = useState(""); const [expiresAt, setExpiresAt] = useState<string | null>(null); const [otpExpired, setOtpExpired] = useState(false); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const router = useRouter();
  useEffect(() => { if (!expiresAt) return; const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now()); const timer = window.setTimeout(() => setOtpExpired(true), delay); return () => window.clearTimeout(timer); }, [expiresAt]);
  async function sendEmail() { setBusy(true); setError(""); try { const result = await post("password-reset/request", { email }) as { expires_in: number }; setExpiresAt(new Date(Date.now() + result.expires_in * 1000).toISOString()); setOtpExpired(false); setOtp(""); setStep("otp"); setSuccess("Nếu tài khoản đủ điều kiện, mã khôi phục đã được gửi tới email."); } catch (value) { setError(value instanceof Error ? value.message : "Không thể gửi yêu cầu."); } finally { setBusy(false); } }
  async function verifyOtp() { setBusy(true); setError(""); try { await post("password-reset/verify", { otp }); setStep("password"); setSuccess("OTP hợp lệ. Hãy đặt mật khẩu mới."); } catch (value) { setError(value instanceof Error ? value.message : "OTP không hợp lệ."); } finally { setBusy(false); } }
  async function changePassword() { setBusy(true); setError(""); try { await post("password-reset/complete", { password, password_confirmation: confirmation }); router.push("/login?reset=success"); } catch (value) { setError(value instanceof Error ? value.message : "Không thể đổi mật khẩu."); } finally { setBusy(false); } }
  async function submit(event: FormEvent) { event.preventDefault(); if (step === "email") await sendEmail(); else if (step === "otp") await verifyOtp(); else await changePassword(); }
  return <form className="auth-form" onSubmit={submit}><p className="masked-email">Nếu bạn tạo tài khoản bằng Google, hãy đăng nhập bằng Google. Khôi phục mật khẩu chỉ áp dụng cho tài khoản có mật khẩu.</p><label className="auth-field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={step === "password"} /></label><button className="auth-primary" type="button" onClick={sendEmail} disabled={busy || step === "password"}>{step === "otp" ? "Gửi lại mã OTP" : "Xác nhận email"}</button>{step === "otp" && expiresAt && <><p className="masked-email">{otpExpired ? "Mã OTP đã hết hạn. Hãy gửi lại mã để tiếp tục." : "Mã OTP có hiệu lực trong 90 giây. Vui lòng xác nhận trước khi hết hạn."}</p><p className="masked-email">Nếu chưa thấy email, hãy kiểm tra mục Thư rác/Spam. Với Gmail, chọn “Không phải thư rác” để thư sau dễ vào hộp thư đến hơn.</p><Countdown expiresAt={expiresAt} /></>}<label className="auth-field" htmlFor="otp"><span>Mã OTP</span><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} disabled={step !== "otp"} /></label><button className="auth-primary" type="button" onClick={verifyOtp} disabled={busy || step !== "otp" || otp.length !== 6 || otpExpired}>Xác nhận OTP</button>{step === "password" && <div className="reset-password-fields"><PasswordField id="new-password" label="Mật khẩu mới" value={password} onChange={setPassword} autoComplete="new-password" /><PasswordField id="new-confirmation" label="Nhập lại mật khẩu mới" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /><button className="auth-primary" disabled={busy}>Đổi mật khẩu</button></div>}<Notice error={error} success={success} /><p className="auth-switch"><Link href="/login">Quay lại đăng nhập</Link></p></form>;
}
