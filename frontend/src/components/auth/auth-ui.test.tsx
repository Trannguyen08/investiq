import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm, LoginForm, RegisterForm } from "@/components/auth/auth-ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("authentication forms", () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

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

  it("keeps email and persistent-login choices independent", () => {
    render(<RegisterForm />);
    const rememberEmail = screen.getByRole("checkbox", { name: "Ghi nhớ email" });
    const rememberSession = screen.getByRole("checkbox", { name: "Duy trì đăng nhập" });

    fireEvent.click(rememberEmail);
    expect(rememberEmail).toBeChecked();
    expect(rememberSession).not.toBeChecked();
  });

  it("starts password recovery with email and OTP controls in the requested order", () => {
    const { container } = render(<ForgotPasswordForm />);
    const controls = [...container.querySelectorAll("input, button")].map(
      (node) => node.getAttribute("id") ?? node.textContent?.trim(),
    );

    expect(controls.indexOf("email")).toBeLessThan(controls.indexOf("Xác nhận email"));
    expect(controls.indexOf("Xác nhận email")).toBeLessThan(controls.indexOf("otp"));
    expect(controls.indexOf("otp")).toBeLessThan(controls.indexOf("Xác nhận OTP"));
    expect(container.querySelector("#new-password")).toBeNull();
  });
});
