import { AuthShell, RegisterForm } from "@/components/auth/auth-ui";

function safeNextPath(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  if (value.startsWith("/login") || value.startsWith("/register")) return "";
  return value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell eyebrow="Tài khoản mới" hideEyebrow title="Đăng ký InvestIQ" description="Tạo tài khoản và xác minh email bằng mã OTP.">
      <RegisterForm nextPath={safeNextPath(next)} />
    </AuthShell>
  );
}
