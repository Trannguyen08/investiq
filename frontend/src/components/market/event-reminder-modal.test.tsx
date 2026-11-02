import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { EventReminderModal, type ReminderTargetEvent } from "./event-reminder-modal";
import * as apiClient from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  createEventReminder: vi.fn(),
}));

const mockEvent: ReminderTargetEvent = {
  id: "HPG-2026-11-20",
  symbol: "HPG",
  title: "Đại hội cổ đông bất thường năm 2026",
  date: "2026-11-20",
  type: "shareholder_meeting",
};

describe("EventReminderModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders event details when open", () => {
    render(
      <EventReminderModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
      />
    );

    expect(screen.getByText("Đặt nhắc nhở sự kiện qua Email")).toBeInTheDocument();
    expect(screen.getByText("HPG")).toBeInTheDocument();
    expect(screen.getByText("Đại hội cổ đông bất thường năm 2026")).toBeInTheDocument();
    expect(screen.getByText("2026-11-20")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <EventReminderModal
        isOpen={false}
        onClose={vi.fn()}
        event={mockEvent}
      />
    );

    expect(screen.queryByText("Đặt nhắc nhở sự kiện qua Email")).not.toBeInTheDocument();
  });

  it("submits reminder and stores email in localStorage", async () => {
    vi.mocked(apiClient.createEventReminder).mockResolvedValue({
      data: {
        id: "rem-123",
        email: "investor@example.com",
        event_id: "HPG-2026-11-20",
        symbol: "HPG",
        event_title: "Đại hội cổ đông bất thường năm 2026",
        event_date: "2026-11-20",
        event_type: "shareholder_meeting",
        remind_days_before: 1,
        target_date: "2026-11-19",
        is_sent: false,
        sent_at: null,
        created_at: new Date().toISOString(),
      },
      message: "Success",
    });

    render(
      <EventReminderModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
      />
    );

    const emailInput = screen.getByLabelText(/Email nhận thông báo/i);
    fireEvent.change(emailInput, { target: { value: "investor@example.com" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận nhắc nhở/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.createEventReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "investor@example.com",
          symbol: "HPG",
          event_id: "HPG-2026-11-20",
        })
      );
      expect(localStorage.getItem("investiq_user_email")).toBe("investor@example.com");
    });
  });
});

