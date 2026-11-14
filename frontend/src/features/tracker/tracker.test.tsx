import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Application } from "@/features/applications/types";
import { FindJobsView } from "@/features/jobs/FindJobsView";
import type { FindJobsViewModel } from "@/features/jobs/useFindJobsViewModel";

import { jobLink } from "./jobLink";
import { TrackerView } from "./TrackerView";
import type { TrackerViewModel } from "./useTrackerViewModel";

const job = (overrides: Partial<Application> = {}): Application => ({
  id: 1,
  company: "Acme Ltd",
  role: "Graduate Developer",
  job_url: "",
  job_description: "",
  contact_name: "",
  contact_email: "",
  location: "Manchester",
  salary: "£30,000",
  source: "excel",
  status: "sent",
  priority: 0,
  notes: "",
  cv_id: null,
  interview_at: null,
  follow_up_at: null,
  applied_at: null,
  created_at: "2026-11-10T09:00:00",
  updated_at: "2026-11-10T09:00:00",
  letter_count: 0,
  match_score: null,
  application_deadline: "Rolling",
  stages: [{ kind: "online_test", date: "2026-11-25", result: "upcoming", note: "" }],
  external_id: "",
  job_summary: {},
  sponsorship: "unsure",
  next_step: "Do the assessment by 25 Nov",
  due_label: "",
  due_level: "",
  ...overrides,
});

function trackerVm(overrides: Partial<TrackerViewModel> = {}): TrackerViewModel {
  return {
    view: "table",
    items: [job()],
    total: 1,
    summary: {
      total: 27,
      to_apply: 0,
      applied: 26,
      in_progress: 3,
      assessments_done: 5,
      interviews: 0,
      offers: 0,
      rejected: 14,
    },
    isLoading: false,
    error: null,
    search: "",
    status: "",
    group: "",
    setGroup: vi.fn(),
    sort: "created_at",
    hideClosed: false,
    selected: null,
    isSummarizing: false,
    setView: vi.fn(),
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setSort: vi.fn(),
    setHideClosed: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    summarize: vi.fn(),
    remove: vi.fn(),
    checked: new Set(),
    toggleChecked: vi.fn(),
    toggleAllChecked: vi.fn(),
    clearChecked: vi.fn(),
    deleteChecked: vi.fn(),
    deleteEverything: vi.fn(async () => true),
    bin: [],
    showBin: false,
    setShowBin: vi.fn(),
    restore: vi.fn(),
    deleteForever: vi.fn(),
    emptyTheBin: vi.fn(),
    ...overrides,
  };
}

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("jobLink", () => {
  it("uses the job's own page, or a web search when there isn't one", () => {
    expect(jobLink({ job_url: "https://example.com/1", company: "A", role: "B" })).toBe(
      "https://example.com/1",
    );
    expect(jobLink({ job_url: "javascript:alert(1)", company: "Acme", role: "Dev" })).toBe(
      "https://www.google.com/search?q=Acme%20Dev%20graduate%20job%20apply",
    );
  });
});

describe("TrackerView", () => {
  it("shows the totals and the spreadsheet columns, and saves edits", () => {
    const vm = trackerVm();
    renderIn(<TrackerView {...vm} />);
    expect(screen.getByText("Total applications").nextSibling).toHaveTextContent("27");
    expect(screen.getByText("Assessments done").nextSibling).toHaveTextContent("5");
    for (const header of ["Company", "Application deadline", "Stages", "Next step"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText("Do the assessment by 25 Nov")).toBeInTheDocument();

    // The online test chip opens its editor; marking it passed saves the stages.
    fireEvent.click(screen.getByRole("button", { name: /Online test, upcoming/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Passed" }));
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(vm.update).toHaveBeenCalledWith(1, {
      stages: [{ kind: "online_test", date: "2026-11-25", result: "passed", note: "" }],
    });
    // + adds the next stage most people have: a video interview.
    fireEvent.click(screen.getByRole("button", { name: /Add a stage for Acme Ltd/ }));
    expect(screen.getByLabelText("Stage")).toHaveValue("video");
    fireEvent.change(screen.getByLabelText("Stage date"), { target: { value: "2026-12-02" } });
    fireEvent.click(screen.getByRole("button", { name: /Add$/ }));
    expect(vm.update).toHaveBeenLastCalledWith(1, {
      stages: [
        { kind: "online_test", date: "2026-11-25", result: "upcoming", note: "" },
        { kind: "video", date: "2026-12-02", result: "upcoming", note: "" },
      ],
    });
    fireEvent.change(screen.getByLabelText("Status for Acme Ltd – Graduate Developer"), {
      target: { value: "rejected" },
    });
    expect(vm.update).toHaveBeenCalledWith(1, { status: "rejected" });
    fireEvent.click(screen.getByRole("button", { name: "Acme Ltd" }));
    expect(vm.select).toHaveBeenCalledWith(1);
  });

  it("opens a side panel with the summary and an Apply button", () => {
    const selected = job({
      job_summary: { summary: "A graduate scheme.", requirements: ["Python"], match_score: 70 },
    });
    renderIn(<TrackerView {...trackerVm({ items: [selected], selected })} />);
    expect(screen.getByText("A graduate scheme.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apply/ })).toHaveAttribute(
      "href",
      "/applications/1/apply",
    );
    expect(screen.getByRole("link", { name: /Find the job/ })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/search"),
    );
  });

  it("asks for a job description before it can summarise", () => {
    const selected = job();
    renderIn(<TrackerView {...trackerVm({ items: [selected], selected })} />);
    expect(screen.getByText(/No job description yet/)).toBeInTheDocument();
  });
});

describe("totals and sponsorship", () => {
  it("filters by a total when it's clicked, and clears it when clicked again", () => {
    const vm = trackerVm();
    const { rerender } = renderIn(<TrackerView {...vm} />);
    fireEvent.click(screen.getByRole("button", { name: /Rejected/ }));
    expect(vm.setGroup).toHaveBeenLastCalledWith("rejected");
    expect(vm.setStatus).toHaveBeenLastCalledWith("");

    const filtered = trackerVm({ group: "rejected" });
    rerender(
      <MemoryRouter>
        <TrackerView {...filtered} />
      </MemoryRouter>,
    );
    const tile = screen.getByRole("button", { name: /Rejected/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tile);
    expect(filtered.setGroup).toHaveBeenLastCalledWith("");
  });

  it("has a sponsorship column that saves straight away", () => {
    const vm = trackerVm();
    renderIn(<TrackerView {...vm} />);
    const select = screen.getByLabelText("Visa sponsorship for Acme Ltd – Graduate Developer");
    expect(select).toHaveValue("unsure");
    fireEvent.change(select, { target: { value: "yes" } });
    expect(vm.update).toHaveBeenCalledWith(1, { sponsorship: "yes" });
  });
});

describe("deleting", () => {
  it("deletes selected rows", () => {
    const vm = trackerVm({ checked: new Set([1]) });
    renderIn(<TrackerView {...vm} />);
    fireEvent.click(screen.getByLabelText("Select Acme Ltd – Graduate Developer"));
    expect(vm.toggleChecked).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(vm.toggleAllChecked).toHaveBeenCalled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Delete selected/ }));
    expect(vm.deleteChecked).toHaveBeenCalled();
  });

  it("only deletes everything after typing DELETE", () => {
    const vm = trackerVm();
    renderIn(<TrackerView {...vm} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete all/ }));
    const go = screen.getByRole("button", { name: /Delete everything/ });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    expect(go).toBeEnabled();
    fireEvent.click(go);
    expect(vm.deleteEverything).toHaveBeenCalledWith("DELETE");
  });

  it("restores from the recycle bin", () => {
    const vm = trackerVm({
      showBin: true,
      bin: [
        {
          id: 9,
          company: "Globex",
          role: "Analyst",
          status: "rejected",
          deleted_at: "2026-11-13T10:00:00Z",
          expires_at: "2026-12-13T10:00:00Z",
        },
      ],
    });
    renderIn(<TrackerView {...vm} />);
    const bin = screen.getByRole("region", { name: "Recycle bin" });
    expect(bin).toHaveTextContent("Globex");
    expect(bin).toHaveTextContent("13/12/2026");
    fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
    expect(vm.restore).toHaveBeenCalledWith(9);
    fireEvent.click(screen.getByRole("button", { name: "Delete Globex – Analyst for good" }));
    expect(vm.deleteForever).toHaveBeenCalledWith(9);
  });
});

describe("FindJobsView", () => {
  const findVm = (overrides: Partial<FindJobsViewModel> = {}): FindJobsViewModel => ({
    form: { q: "software engineer", location: "", graduate: true },
    submitted: null,
    result: null,
    isSearching: false,
    selectedId: null,
    details: null,
    isLoadingDetails: false,
    aiConfigured: true,
    isSummarizing: false,
    isSaving: false,
    error: null,
    tab: "results",
    shortlist: [],
    paste: { url: "", text: "", company: "", role: "" },
    isPasting: false,
    setTab: vi.fn(),
    toggleStar: vi.fn(),
    setPaste: vi.fn(),
    addPasted: vi.fn(),
    setForm: vi.fn(),
    search: vi.fn(),
    nextPage: vi.fn(),
    select: vi.fn(),
    summarize: vi.fn(),
    apply: vi.fn(),
    saveOnly: vi.fn(),
    ...overrides,
  });

  it("explains how to connect a job board", () => {
    renderIn(
      <FindJobsView
        {...findVm({ result: { jobs: [], boards: [], problems: [], needs_setup: true } })}
      />,
    );
    expect(screen.getByText("No job board is connected yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jooble" })).toBeInTheDocument();
  });

  it("lists jobs and applies from the side panel", () => {
    const listing = {
      id: "reed:1",
      source: "reed" as const,
      title: "Graduate Developer",
      company: "Acme Ltd",
      location: "Leeds",
      salary: "£28,000 a year",
      posted: "10/11/2026",
      closes: "",
      snippet: "Build things",
      url: "https://example.com/1",
      application_id: null,
      shortlisted: false,
    };
    const vm = findVm({
      result: { jobs: [listing], boards: ["Reed"], problems: [], needs_setup: false },
      selectedId: "reed:1",
      details: {
        ...listing,
        description: "Full text",
        work_type: "",
        summary: {
          summary: "A dev job.",
          salary: "£28,000",
          location: "Leeds",
          work_type: "",
          requirements: [],
          nice_to_have: [],
          match_score: 64,
          strengths: [],
          gaps: ["Docker"],
        },
      },
    });
    renderIn(<FindJobsView {...vm} />);
    expect(screen.getByText("1 jobs from Reed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Shortlist Graduate Developer" }));
    expect(vm.toggleStar).toHaveBeenCalledWith(listing);
    expect(screen.getByRole("link", { name: /Gradcracker/ })).toHaveAttribute(
      "href",
      "https://www.google.com/search?q=site%3Agradcracker.com%20software%20engineer%20graduate",
    );
    fireEvent.click(screen.getByRole("button", { name: /Add and apply/ }));
    expect(vm.addPasted).toHaveBeenCalled();
    expect(screen.getByText("A dev job.")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(vm.apply).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /View on Reed/ })).toHaveAttribute(
      "href",
      "https://example.com/1",
    );
  });
});
