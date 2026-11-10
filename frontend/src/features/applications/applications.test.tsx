import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulkJobView } from "./BulkJobView";
import { jobPercent, scoreLabel, statusVariant } from "./labels";
import { LetterEditorView } from "./LetterEditorView";
import type { Letter, LetterJob } from "./types";

const letter: Letter = {
  id: 7,
  application_id: 1,
  version: 2,
  tone: "friendly",
  model_used: "gemini/gemini-flash-latest",
  content: "Dear Hiring Manager,\n\nI built things.\n\nKind regards,\nJane Example",
  email_subject: "Application",
  email_body: "Please find attached.",
  match_score: 80,
  requirements: ["Python"],
  matches: [{ requirement: "Python", evidence: "FastAPI service" }],
  flags: ["'AWS' isn't in your profile or the job. Check it's true."],
  is_selected: false,
  edited: false,
  created_at: "2026-11-10T10:00:00",
  updated_at: null,
};

const job: LetterJob = {
  id: "abc",
  status: "running",
  total: 4,
  processed: 1,
  succeeded: [1],
  skipped: [],
  failed: [],
  current: "Acme Ltd: Developer",
  message: null,
  created_at: "2026-11-10T10:00:00",
};

describe("labels", () => {
  it("formats scores, statuses and progress", () => {
    expect(scoreLabel(null)).toBe("-");
    expect(scoreLabel(82)).toBe("82 · strong");
    expect(scoreLabel(40)).toBe("40 · weak");
    expect(statusVariant("offer")).toBe("success");
    expect(statusVariant("rejected")).toBe("destructive");
    expect(jobPercent({ processed: 1, total: 4 })).toBe(25);
    expect(jobPercent({ processed: 0, total: 0 })).toBe(0);
  });
});

describe("LetterEditorView", () => {
  const props = {
    letters: [letter, { ...letter, id: 6, version: 1, is_selected: true }],
    letter,
    form: {
      content: letter.content,
      email_subject: letter.email_subject,
      email_body: letter.email_body,
    },
    isDirty: false,
    isSaving: false,
    copied: false,
    onViewVersion: vi.fn(),
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    onUseVersion: vi.fn(),
    onDeleteVersion: vi.fn(),
    onCopy: vi.fn(),
  };

  it("shows guardrail flags, exports and version actions", () => {
    render(<LetterEditorView {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("'AWS' isn't in your profile");
    expect(screen.getByRole("link", { name: "PDF" })).toHaveAttribute(
      "href",
      "/api/letters/7/export?format=pdf",
    );
    fireEvent.click(screen.getByRole("button", { name: "Use this version" }));
    expect(props.onUseVersion).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "v1" }));
    expect(props.onViewVersion).toHaveBeenCalledWith(6);
  });

  it("switches to save/discard while editing", () => {
    render(<LetterEditorView {...props} isDirty />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PDF" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Email subject/), { target: { value: "New" } });
    expect(props.onEdit).toHaveBeenCalledWith({ email_subject: "New" });
  });
});

describe("BulkJobView", () => {
  it("shows progress and lets you cancel a running job", () => {
    const onCancel = vi.fn();
    render(<BulkJobView job={job} onCancel={onCancel} onDismiss={vi.fn()} />);
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("Now: Acme Ltd: Developer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("lists failures when finished", () => {
    render(
      <BulkJobView
        job={{
          ...job,
          status: "done",
          processed: 4,
          failed: [{ application_id: 3, company: "Globex", error: "Rate limit" }],
        }}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Finished: 1 written/)).toBeInTheDocument();
    expect(screen.getByText("Globex: Rate limit")).toBeInTheDocument();
  });
});
