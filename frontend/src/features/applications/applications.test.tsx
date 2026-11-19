import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { scoreLabel, statusVariant } from "./labels";
import { LetterEditorView } from "./LetterEditorView";
import type { Letter } from "./types";

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

describe("labels", () => {
  it("formats scores, statuses and progress", () => {
    expect(scoreLabel(null)).toBe("-");
    expect(scoreLabel(82)).toBe("82 · strong");
    expect(scoreLabel(40)).toBe("40 · weak");
    expect(statusVariant("offer")).toBe("success");
    expect(statusVariant("rejected")).toBe("destructive");
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
