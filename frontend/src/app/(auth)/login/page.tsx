import { AuthShell, LoginForm } from "@/components/auth/auth-ui";

export default function LoginPage() {
  return <AuthShell eyebrow="Tài khoản" title="Đăng nhập" description="Tiếp tục vào không gian đầu tư của bạn."><LoginForm /></AuthShell>;
}
