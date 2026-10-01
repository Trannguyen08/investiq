import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UsersTable } from "@/components/admin/users-table";
import type { AdminUser } from "@/lib/server/admin-user-api";

const user: AdminUser = {
  id: "eb7240ac-1fa4-4af7-a57e-a85e74a454a3",
  email: "linh@example.com",
  display_name: "Linh Nguyen",
  role: "user",
  status: "active",
  provider: "google",
  email_verified_at: "2026-09-30T10:00:00Z",
  created_at: "2026-09-29T10:00:00Z",
};

describe("UsersTable", () => {
  it("renders account information and empty-state copy", () => {
    render(<UsersTable users={[user]} changeUser={vi.fn(async () => undefined)} />);

    expect(screen.getByRole("heading", { name: "Danh sách tài khoản" })).toBeInTheDocument();
    expect(screen.getByText("linh@example.com")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Đã xác minh")).toBeInTheDocument();
  });

  it("asks for confirmation before submitting account changes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const changeUser = vi.fn(async () => undefined);
    render(<UsersTable users={[user]} changeUser={changeUser} />);

    fireEvent.change(screen.getByLabelText("Vai trò mới của linh@example.com"), { target: { value: "admin" } });
    fireEvent.submit(screen.getAllByRole("button", { name: "Lưu" })[0].closest("form")!);

    expect(confirm).toHaveBeenCalledWith("Xác nhận đổi vai trò quản trị viên cho tài khoản này?");
    expect(changeUser).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("shows an empty result message", () => {
    render(<UsersTable users={[]} changeUser={vi.fn(async () => undefined)} />);
    expect(screen.getByText("Không tìm thấy tài khoản phù hợp.")).toBeInTheDocument();
  });
});
