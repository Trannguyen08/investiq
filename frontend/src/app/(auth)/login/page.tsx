import { AuthShell, LoginForm } from "@/components/auth/auth-ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return <AuthShell eyebrow="Tài khoản" hideEyebrow title="Đăng nhập" description="Tiếp tục vào không gian đầu tư của bạn."><LoginForm resetSucceeded={reset === "success"} /></AuthShell>;
}
