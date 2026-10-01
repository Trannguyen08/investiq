import { AuthShell, RegisterForm } from "@/components/auth/auth-ui";

export default function RegisterPage() {
  return <AuthShell eyebrow="Tài khoản mới" title="Đăng ký InvestIQ" description="Tạo tài khoản và xác minh email bằng mã OTP."><RegisterForm /></AuthShell>;
}
