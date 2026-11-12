import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { NotificationSummary } from "./api";
import { buildDays, monthGrid } from "./calendar";
import { CalendarView } from "./CalendarPage";
import { FollowUpView } from "./FollowUpView";
import { newsSince } from "./useDesktopNotifications";
import type { FollowUpViewModel } from "./useFollowUpViewModel";

const summary = (unseen: number, due: number): NotificationSummary => ({
  unseen_replies: unseen,
  follow_ups_due: due,
  interviews_soon: 0,
  last_reply_check: null,
});

describe("calendar", () => {
  it("builds a Monday-first 6-week grid", () => {
    const { start, end } = monthGrid(new Date(2026, 10, 1)); // November 2026 starts on a Sunday
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(26); // Monday 26 October
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(42);
  });

  it("puts events on their local day", () => {
    const days = buildDays(
      new Date(2026, 10, 1),
      [
        {
          date: "2026-11-12T10:00:00",
          kind: "interview",
          application_id: 1,
          company: "Acme",
          role: "Dev",
        },
      ],
      new Date(2026, 10, 12),
    );
    const day = days.find((d) => d.events.length)!;
    expect(day.date.getDate()).toBe(new Date("2026-11-12T10:00:00Z").getDate());
    expect(days.filter((d) => d.inMonth)).toHaveLength(30);
    expect(days.find((d) => d.isToday)?.date.getDate()).toBe(12);
  });

  it("renders events as links to the job", () => {
    render(
      <MemoryRouter>
        <CalendarView
          month={new Date(2026, 10, 1)}
          days={buildDays(new Date(2026, 10, 1), [
            {
              date: "2026-11-20T09:00:00",
              kind: "follow_up",
              application_id: 7,
              company: "Globex",
              role: "Dev",
            },
          ])}
          events={[
            {
              date: "2026-11-20T09:00:00",
              kind: "follow_up",
              application_id: 7,
              company: "Globex",
              role: "Dev",
            },
          ]}
          isLoading={false}
          previous={vi.fn()}
          next={vi.fn()}
          today={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link", { name: /Globex/ })[0]).toHaveAttribute(
      "href",
      "/applications/7",
    );
  });
});

describe("desktop notifications", () => {
  it("announces only what's new since the last check", () => {
    expect(newsSince(null, summary(3, 1))).toEqual([]);
    expect(newsSince(summary(1, 0), summary(3, 1))).toEqual([
      "2 new replies to your applications",
      "1 follow-up is due",
    ]);
    expect(newsSince(summary(3, 1), summary(2, 1))).toEqual([]);
  });
});

describe("FollowUpView", () => {
  const vm = (overrides: Partial<FollowUpViewModel> = {}): FollowUpViewModel => ({
    replies: [],
    status: "sent",
    followUpAt: "2026-11-01T09:00:00",
    canFollowUp: true,
    draft: null,
    approved: false,
    isDrafting: false,
    isSending: false,
    startDraft: vi.fn(),
    editDraft: vi.fn(),
    setApproved: vi.fn(),
    sendDraft: vi.fn(),
    cancelDraft: vi.fn(),
    setStatus: vi.fn(),
    ...overrides,
  });

  it("offers a follow-up once the date has passed", () => {
    const model = vm();
    render(<FollowUpView {...model} />);
    expect(screen.getByText(/follow-up date has passed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Draft a follow-up/ }));
    expect(model.startDraft).toHaveBeenCalled();
  });

  it("needs approval to send a draft, and shows test mode", () => {
    const model = vm({
      draft: {
        subject: "Re: Dev",
        body: "Hello",
        source: "template",
        to: "hr@example.org",
        deliver_to: "me@example.com",
        test_mode: true,
      },
    });
    render(<FollowUpView {...model} />);
    expect(screen.getByText(/instead of hr@example.org/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve & send/ })).toBeDisabled();
  });

  it("shows replies with their guessed type and lets you set the status", () => {
    const model = vm({
      canFollowUp: false,
      status: "replied",
      replies: [
        {
          id: 1,
          application_id: 1,
          from_address: "hr@example.org",
          subject: "Interview",
          snippet: "Can you do Tuesday?",
          received_at: "2026-11-10T09:00:00",
          classification: "interview",
          seen: false,
        },
      ],
    });
    render(<FollowUpView {...model} />);
    expect(screen.getByText("Looks like an interview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as interview" }));
    expect(model.setStatus).toHaveBeenCalledWith("interview");
  });
});
