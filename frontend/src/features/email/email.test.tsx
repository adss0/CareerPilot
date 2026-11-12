import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { EmailPreview, EmailSettingsRead } from "./api";
import { ApplyView } from "./ApplyView";
import { EmailSettingsView } from "./EmailSettingsView";
import { QueueBannerView } from "./QueueBannerView";
import type { ApplyViewModel } from "./useApplyViewModel";

const preview: EmailPreview = {
  to: "hiring@example.org",
  deliver_to: "me@example.com",
  test_mode: true,
  subject: "Junior Developer application",
  body: "Hello, my CV and cover letter are attached.",
  attachments: [{ name: "Cover letter - Acme Ltd - Developer.pdf", size_bytes: null }],
  can_send: true,
  problems: [],
  warnings: ["Test mode is on: this will go to me@example.com, not the employer."],
};

const applyVm = (overrides: Partial<ApplyViewModel> = {}): ApplyViewModel => ({
  preview,
  logs: [],
  hasContactEmail: true,
  jobUrl: "https://example.com/jobs/1",
  cvUrl: "/api/cvs/1/file",
  cvName: "cv.pdf",
  hasLetter: true,
  approved: false,
  isSending: false,
  isMarking: false,
  alreadyApplied: false,
  setApproved: vi.fn(),
  send: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  copyLetter: vi.fn(),
  markApplied: vi.fn(),
  ...overrides,
});

describe("ApplyView", () => {
  it("shows where a test email really goes and needs approval", () => {
    const vm = applyVm();
    render(<ApplyView {...vm} />);
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.getByText(/instead of hiring@example.org/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve & send" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(vm.setApproved).toHaveBeenCalledWith(true);
  });

  it("enables sending once approved", () => {
    const vm = applyVm({ approved: true });
    render(<ApplyView {...vm} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve & send" }));
    expect(vm.send).toHaveBeenCalled();
  });

  it("explains what blocks sending", () => {
    render(
      <ApplyView
        {...applyVm({
          preview: { ...preview, can_send: false, problems: ["Write a cover letter first."] },
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Write a cover letter first.");
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("offers assisted apply for website-only jobs", () => {
    const vm = applyVm({ hasContactEmail: false });
    render(<ApplyView {...vm} />);
    expect(screen.queryByText("Send by email")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the job posting/ })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
    fireEvent.click(screen.getByRole("button", { name: /I've submitted it/ }));
    expect(vm.markApplied).toHaveBeenCalled();
  });

  it("lists sent and failed emails with retry", () => {
    const vm = applyVm({
      logs: [
        {
          id: 2,
          application_id: 1,
          kind: "application",
          to_address: "me@example.com",
          subject: "Hi",
          body: "",
          attachments: [],
          status: "failed",
          is_test: true,
          error: "Couldn't connect.",
          sent_at: null,
          created_at: "2026-11-11T10:00:00",
        },
      ],
    });
    render(<ApplyView {...vm} />);
    expect(screen.getByText("Couldn't connect.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(vm.retry).toHaveBeenCalledWith(2);
  });
});

describe("QueueBannerView", () => {
  it("shows queue progress and the daily limit", () => {
    render(
      <MemoryRouter>
        <QueueBannerView
          status={{
            ready: true,
            problems: [],
            queued: 3,
            sent_today: 20,
            daily_limit: 20,
            test_mode: true,
            next_send_at: null,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("3 emails waiting to send");
    expect(screen.getByRole("status")).toHaveTextContent("daily limit reached");
    expect(screen.getByRole("status")).toHaveTextContent("Test mode");
  });

  it("is hidden when nothing is queued", () => {
    const { container } = render(
      <QueueBannerView
        status={{
          ready: true,
          problems: [],
          queued: 0,
          sent_today: 0,
          daily_limit: 20,
          test_mode: true,
          next_send_at: null,
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("EmailSettingsView", () => {
  const saved: EmailSettingsRead = {
    from_name: "Jane Example",
    from_address: "jane@example.com",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_security: "starttls",
    username: "",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    daily_limit: 20,
    min_gap_seconds: 60,
    max_gap_seconds: 180,
    signature: "",
    test_mode: true,
    test_address: null,
    follow_up_days: 7,
    password_set: false,
    ready: false,
    problems: ["Add EMAIL_PASSWORD to backend/.env (for Gmail, an App Password)."],
  };

  it("shows setup problems and test mode, and never a password field", () => {
    const change = vi.fn();
    render(
      <EmailSettingsView
        saved={saved}
        form={saved}
        isDirty={false}
        isSaving={false}
        isTesting={false}
        testResult={null}
        change={change}
        save={vi.fn()}
        discard={vi.fn()}
        test={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add EMAIL_PASSWORD/)).toBeInTheDocument();
    expect(screen.getByText("Not set up")).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Test mode/ }));
    expect(change).toHaveBeenCalledWith({ test_mode: false });
  });
});
