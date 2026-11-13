import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DocumentSettingsView } from "@/features/settings/DocumentSettingsView";
import { KeysView } from "@/features/settings/KeysView";
import type { DocumentSettingsViewModel } from "@/features/settings/useDocumentSettingsViewModel";
import type { KeysViewModel } from "@/features/settings/useKeysViewModel";

import type { TailoredCv } from "./api";
import { TailoredCvView } from "./TailoredCvView";
import type { TailoredCvViewModel } from "./useTailoredCvViewModel";

const cv: TailoredCv = {
  application_id: 7,
  content: {
    summary: "Graduate developer who builds Python APIs.",
    skills: ["Python", "SQL"],
    experience: [
      {
        title: "Software Developer Intern",
        company: "Example Ltd",
        start: "2024",
        end: "2024",
        summary: "Built a FastAPI service\nWrote tests",
      },
    ],
    education: [
      {
        qualification: "BSc Computer Science",
        institution: "Example Uni",
        start: "",
        end: "",
        details: "",
      },
    ],
    projects: [{ name: "Job tracker", summary: "Tracks applications", link: "" }],
  },
  changes: ["Put Python first"],
  flags: ["'99' isn't in your profile."],
  model_used: "gemini/gemini-flash-latest",
  edited: false,
  created_at: "2026-11-13T10:00:00Z",
  updated_at: null,
  saved_to: null,
};

function cvVm(overrides: Partial<TailoredCvViewModel> = {}): TailoredCvViewModel {
  return {
    applicationId: 7,
    cv: null,
    form: null,
    isLoading: false,
    isDirty: false,
    aiConfigured: true,
    isTailoring: false,
    isSaving: false,
    error: null,
    tailor: vi.fn(),
    tailorAsync: vi.fn(async () => undefined),
    edit: vi.fn(),
    editExperience: vi.fn(),
    editProject: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    remove: vi.fn(),
    saveToFolder: vi.fn(),
    openFolder: vi.fn(),
    ...overrides,
  };
}

const renderCv = (vm: TailoredCvViewModel) =>
  render(
    <MemoryRouter>
      <TailoredCvView {...vm} />
    </MemoryRouter>,
  );

describe("TailoredCvView", () => {
  it("offers to tailor the CV, or explains how to set up AI", () => {
    const vm = cvVm();
    renderCv(vm);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my CV" }));
    expect(vm.tailor).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Save to folder/ })).not.toBeInTheDocument();
  });

  it("is disabled without AI", () => {
    renderCv(cvVm({ aiConfigured: false }));
    expect(screen.getByRole("button", { name: "Tailor my CV" })).toBeDisabled();
    expect(screen.getByText("Add your Gemini key in Settings")).toBeInTheDocument();
  });

  it("shows the tailored CV for editing, with changes, flags and downloads", () => {
    const vm = cvVm({ cv, form: cv.content });
    renderCv(vm);
    expect(screen.getByText("Put Python first")).toBeInTheDocument();
    expect(screen.getByText("'99' isn't in your profile.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PDF/ })).toHaveAttribute(
      "href",
      "/api/applications/7/tailored-cv/export?format=pdf",
    );
    expect(screen.getByLabelText(/Software Developer Intern/)).toHaveValue(
      "Built a FastAPI service\nWrote tests",
    );
    fireEvent.change(screen.getByLabelText(/Software Developer Intern/), {
      target: { value: "Built a FastAPI service" },
    });
    expect(vm.editExperience).toHaveBeenCalledWith(0, "Built a FastAPI service");
    fireEvent.click(screen.getByRole("button", { name: /Save to folder/ }));
    expect(vm.saveToFolder).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tailor again" })).toBeInTheDocument();
  });
});

describe("KeysView", () => {
  const keys = (overrides: Partial<KeysViewModel> = {}): KeysViewModel => ({
    status: {
      gemini: false,
      groq: false,
      email: true,
      reed: false,
      adzuna_id: false,
      adzuna_key: false,
      jooble: false,
    },
    drafts: {
      gemini: "",
      groq: "",
      email: "",
      reed: "",
      adzuna_id: "",
      adzuna_key: "",
      jooble: "",
    },
    saving: null,
    error: null,
    setDraft: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  });

  it("shows which keys are saved without ever showing them", () => {
    render(<KeysView {...keys()} />);
    expect(screen.getAllByText("Not set")).toHaveLength(6);
    expect(screen.getByLabelText("Reed API key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("heading", { name: "Job boards" })).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Gemini API key")).toHaveAttribute("type", "password");
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("saves a pasted key", () => {
    const vm = keys({
      drafts: {
        gemini: "AIza-test",
        groq: "",
        email: "",
        reed: "",
        adzuna_id: "",
        adzuna_key: "",
        jooble: "",
      },
    });
    render(<KeysView {...vm} />);
    fireEvent.change(screen.getByLabelText("Gemini API key"), { target: { value: "AIza-x" } });
    expect(vm.setDraft).toHaveBeenCalledWith("gemini", "AIza-x");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(vm.save).toHaveBeenCalledWith("gemini");
  });
});

describe("DocumentSettingsView", () => {
  const docs = (overrides: Partial<DocumentSettingsViewModel> = {}): DocumentSettingsViewModel => ({
    settings: {
      folder: "C:\\Users\\me\\Documents\\CareerPilot",
      default_folder: "C:\\Users\\me\\Documents\\CareerPilot",
      auto_save: true,
    },
    folder: "C:\\Users\\me\\Documents\\CareerPilot",
    isDirty: false,
    isSaving: false,
    error: null,
    setFolder: vi.fn(),
    saveFolder: vi.fn(),
    useDefault: vi.fn(),
    setAutoSave: vi.fn(),
    openFolder: vi.fn(),
    ...overrides,
  });

  it("opens the folder and turns auto-save off", () => {
    const vm = docs();
    render(<DocumentSettingsView {...vm} />);
    fireEvent.click(screen.getByRole("button", { name: /Open/ }));
    expect(vm.openFolder).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(vm.setAutoSave).toHaveBeenCalledWith(false);
  });

  it("saves a changed folder and offers the default back", () => {
    const vm = docs({
      folder: "D:\\Jobs",
      isDirty: true,
      settings: { folder: "D:\\Old", default_folder: "C:\\Docs\\CareerPilot", auto_save: true },
    });
    render(<DocumentSettingsView {...vm} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(vm.saveFolder).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Use the default/ }));
    expect(vm.useDefault).toHaveBeenCalled();
  });
});
