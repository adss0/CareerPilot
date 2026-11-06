import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CvPanelView } from "./CvPanelView";
import { EMPTY_DETAILS, mergeDetails, sameDetails } from "./profileDraft";
import { ProfileFormView } from "./ProfileFormView";
import type { ProfileDetails } from "./types";
import { validateCvFile } from "./useProfileViewModel";

const current: ProfileDetails = {
  ...EMPTY_DETAILS,
  full_name: "Jane Example",
  phone: "07700 900123",
  skills: ["Python", "SQL"],
  projects: [{ name: "CareerPilot", summary: "", link: "" }],
};

describe("mergeDetails", () => {
  it("fills from the CV without throwing away the user's own work", () => {
    const parsed: ProfileDetails = {
      ...EMPTY_DETAILS,
      full_name: "Jane E.",
      email: "jane@example.com",
      skills: ["python", "React"],
      experience: [{ title: "Developer", company: "Example Ltd", start: "", end: "", summary: "" }],
    };
    const merged = mergeDetails(current, parsed);

    expect(merged.full_name).toBe("Jane E."); // CV value wins when present
    expect(merged.phone).toBe("07700 900123"); // kept: the CV had no phone
    expect(merged.email).toBe("jane@example.com");
    expect(merged.skills).toEqual(["Python", "SQL", "React"]); // combined, no duplicates
    expect(merged.experience).toHaveLength(1);
    expect(merged.projects).toEqual(current.projects); // kept: the CV had none
  });

  it("detects unsaved changes", () => {
    expect(sameDetails(current, { ...current })).toBe(true);
    expect(sameDetails(current, { ...current, location: "Leeds" })).toBe(false);
  });
});

describe("validateCvFile", () => {
  it("accepts CV formats only", () => {
    expect(validateCvFile(new File(["x"], "cv.PDF"))).toBeNull();
    expect(validateCvFile(new File(["x"], "cv.doc"))).toMatch(/\.pdf/);
    expect(validateCvFile(new File([], "cv.txt"))).toMatch(/empty/);
  });
});

describe("ProfileFormView", () => {
  const handlers = {
    onSetField: vi.fn(),
    onAddSkill: vi.fn(),
    onRemoveSkill: vi.fn(),
    onAddItem: vi.fn(),
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
  };

  it("edits fields, skills and list items", () => {
    render(<ProfileFormView form={current} {...handlers} />);

    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Leeds, UK" } });
    expect(handlers.onSetField).toHaveBeenCalledWith("location", "Leeds, UK");

    fireEvent.change(screen.getByLabelText("New skill"), { target: { value: "Docker, Git" } });
    fireEvent.keyDown(screen.getByLabelText("New skill"), { key: "Enter" });
    expect(handlers.onAddSkill).toHaveBeenCalledWith("Docker, Git");

    fireEvent.click(screen.getByRole("button", { name: "Remove SQL" }));
    expect(handlers.onRemoveSkill).toHaveBeenCalledWith("SQL");

    fireEvent.change(screen.getByDisplayValue("CareerPilot"), {
      target: { value: "CareerPilot 2" },
    });
    expect(handlers.onUpdateItem).toHaveBeenCalledWith("projects", 0, { name: "CareerPilot 2" });

    fireEvent.click(screen.getByRole("button", { name: "Add job" }));
    expect(handlers.onAddItem).toHaveBeenCalledWith("experience");
  });
});

describe("CvPanelView", () => {
  const baseProps = {
    cvs: [],
    isUploading: false,
    busyCvId: null,
    useAi: false,
    onUseAiChange: vi.fn(),
    onUpload: vi.fn(),
    onReadAgain: vi.fn(),
    onMakeDefault: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
  };

  it("disables the AI option and explains setup when AI isn't configured", () => {
    render(<CvPanelView {...baseProps} aiConfigured={false} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText(/add GEMINI_API_KEY/)).toBeInTheDocument();
  });

  it("warns that AI sends the CV to Google when it is configured", () => {
    render(<CvPanelView {...baseProps} aiConfigured />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.getByText(/Sends your CV's text to Google/)).toBeInTheDocument();
  });
});
