import { redirect } from "next/navigation";
import { AuthShell, LoginForm } from "@/components/auth/auth-ui";
import { currentUser } from "@/lib/server/user-auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await currentUser().catch(() => null);
  if (user?.role === "admin") {
    redirect("/admin");
  }
  const { reset } = await searchParams;
  return (
    <AuthShell
      eyebrow="Tài khoản"
      hideEyebrow
      title="Đăng nhập"
      description="Tiếp tục vào không gian đầu tư của bạn."
    >
      <LoginForm resetSucceeded={reset === "success"} />
    </AuthShell>
  );
}
