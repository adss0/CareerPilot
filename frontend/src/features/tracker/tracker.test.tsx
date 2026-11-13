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
  assessment: "pending",
  assessment_due: "2026-11-25",
  external_id: "",
  job_summary: {},
  next_step: "Do the assessment by 25 Nov",
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
    sort: "created_at",
    selected: null,
    isSummarizing: false,
    setView: vi.fn(),
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setSort: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    summarize: vi.fn(),
    remove: vi.fn(),
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
    for (const header of ["Company", "Application deadline", "Pre-assessment", "Next step"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText("Do the assessment by 25 Nov")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Pre-assessment for Acme Ltd – Graduate Developer"), {
      target: { value: "done" },
    });
    expect(vm.update).toHaveBeenCalledWith(1, { assessment: "done" });
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
    expect(screen.getByText("Connect a job board (free)")).toBeInTheDocument();
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
