import { redirect } from "next/navigation";
import { AuthShell, LoginForm } from "@/components/auth/auth-ui";
import { currentUser } from "@/lib/server/user-auth";

function resolveAuthErrorMessage(code?: string): string {
  if (!code) return "";
  switch (code) {
    case "AUTH_FAILED":
    case "BACKEND_UNAVAILABLE":
    case "BACKEND_TIMEOUT":
      return "Máy chủ dịch vụ đang khởi động lại hoặc phiên xác thực đã hết hạn. Vui lòng bấm Đăng nhập lại.";
    case "GOOGLE_AUTH_FAILED":
      return "Không thể xác minh tài khoản Google. Vui lòng thử lại.";
    case "GOOGLE_CANCELLED":
      return "Bạn đã hủy quá trình đăng nhập với Google.";
    case "GOOGLE_STATE_INVALID":
      return "Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.";
    case "ACCOUNT_METHOD_CONFLICT":
      return "Email này đã được đăng ký bằng mật khẩu. Vui lòng đăng nhập bằng email và mật khẩu.";
    case "RATE_LIMIT_EXCEEDED":
      return "Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau ít phút.";
    case "INVALID_CREDENTIALS":
      return "Thông tin đăng nhập không hợp lệ hoặc tài khoản bị khóa.";
    default:
      return "Không thể hoàn tất đăng nhập. Vui lòng thử lại.";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const user = await currentUser().catch(() => null);
  if (user?.role === "admin") {
    redirect("/admin");
  }
  const { reset, error } = await searchParams;
  const initialError = resolveAuthErrorMessage(error);
  return (
    <AuthShell
      eyebrow="Tài khoản"
      hideEyebrow
      title="Đăng nhập"
      description="Tiếp tục vào không gian đầu tư của bạn."
    >
      <LoginForm resetSucceeded={reset === "success"} initialError={initialError} />
    </AuthShell>
  );
}
