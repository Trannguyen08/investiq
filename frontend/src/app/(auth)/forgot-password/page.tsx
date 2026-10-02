import { AuthShell, ForgotPasswordForm } from "@/components/auth/auth-ui";

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="Khôi phục tài khoản" title="Quên mật khẩu" description="Xác nhận email và mã OTP trước khi đặt mật khẩu mới."><ForgotPasswordForm /></AuthShell>;
}
