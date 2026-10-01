import { AuthShell, VerifyEmailForm } from "@/components/auth/auth-ui";

export default function VerifyEmailPage() {
  return <AuthShell eyebrow="Xác minh email" title="Nhập mã OTP" description="Mã gồm 6 chữ số và có hiệu lực trong 1 phút 30 giây."><VerifyEmailForm /></AuthShell>;
}
