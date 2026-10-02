import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm, LoginForm, RegisterForm } from "@/components/auth/auth-ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("authentication forms", () => {
  beforeEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, "", "/"); });

  it("renders login controls in the specified order and toggles password visibility", () => {
    const { container } = render(<LoginForm />);
    const controls = [...container.querySelectorAll("input, a, button")].map(
      (node) => node.getAttribute("id") ?? node.textContent?.trim(),
    );

    expect(controls.indexOf("email")).toBeLessThan(controls.indexOf("password"));
    expect(controls.indexOf("Quên mật khẩu?")).toBeGreaterThan(controls.indexOf("password"));
    expect(controls.indexOf("Đăng nhập")).toBeLessThan(controls.indexOf("Đăng nhập với Google"));

    const password = screen.getByLabelText("Mật khẩu") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(password.type).toBe("text");
  });

  it("does not ask users to store their email or choose whether to stay signed in", () => {
    const { container } = render(<RegisterForm />);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(container.textContent).not.toContain("Ghi nhớ email");
    expect(container.textContent).not.toContain("Duy trì đăng nhập");
  });

  it("confirms a successful password update on the login screen", () => {
    render(<LoginForm resetSucceeded />);

    expect(screen.getByRole("status").textContent).toContain("Mật khẩu của bạn đã được cập nhật thành công");
    expect(screen.getByRole("status").textContent).toContain("đăng nhập bằng mật khẩu mới");
  });

  it("starts password recovery with email and OTP controls in the requested order", () => {
    const { container } = render(<ForgotPasswordForm />);
    const controls = [...container.querySelectorAll("input, button")].map(
      (node) => node.getAttribute("id") ?? node.textContent?.trim(),
    );

    expect(controls.indexOf("email")).toBeLessThan(controls.indexOf("Xác nhận email"));
    expect(controls.indexOf("Xác nhận email")).toBeLessThan(controls.indexOf("otp"));
    expect(controls.indexOf("otp")).toBeLessThan(controls.indexOf("Xác nhận OTP"));
    expect(container.querySelector('button[type="button"]:last-of-type')).toHaveClass("auth-primary");
    expect(container.querySelector("#new-password")).toBeNull();
    expect(container.textContent).toContain("Nếu bạn tạo tài khoản bằng Google, hãy đăng nhập bằng Google.");
  });

  it("shows the API explanation when password recovery cannot find a password account", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf" }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: "GOOGLE_ONLY_ACCOUNT", message: "Vui lòng chọn Đăng nhập với Google." } }),
      }));
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "google@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Vui lòng chọn Đăng nhập với Google."));
    vi.unstubAllGlobals();
  });

  it("tells the user when the email is not registered", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf" }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "EMAIL_NOT_FOUND", message: "Không tìm thấy tài khoản với email này." } }),
      }));
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "missing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Không tìm thấy tài khoản với email này."));
    vi.unstubAllGlobals();
  });

  it("shows the server-provided OTP lifetime and uses the primary style for confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: "csrf" }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ accepted: true, expires_in: 90 }) }));
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));

    await waitFor(() => expect(screen.getByText(/Mã OTP có hiệu lực trong 90 giây/)).toBeTruthy());
    expect(screen.getByText(/kiểm tra mục Thư rác\/Spam/)).toBeTruthy();
    expect(screen.getByText("01:30")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xác nhận OTP" })).toHaveClass("auth-primary");
    vi.unstubAllGlobals();
  });
});
