import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { buildDashboard } from "@/features/dashboard/useDashboardViewModel";
import { parseServerDate } from "@/lib/dates";

import { groupByStatus } from "./board";
import { BoardView } from "./BoardView";
import { EMPTY_JOB, toJobInput, validateJob } from "./jobForm";
import { JobDetailsView } from "./JobDetailsView";
import type { Application } from "./types";

const app = (
  id: number,
  status: Application["status"],
  company = `Company ${id}`,
): Application => ({
  id,
  company,
  role: "Developer",
  job_url: "",
  job_description: "",
  contact_name: "",
  contact_email: "",
  location: "",
  salary: "",
  source: "manual",
  status,
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
  application_deadline: "",
  stages: [],
  external_id: "",
  job_summary: {},
  sponsorship: "unsure",
  next_step: "",
  due_label: "",
  due_level: "",
});

describe("board", () => {
  it("groups applications into every status column", () => {
    const groups = groupByStatus([app(1, "sent"), app(2, "sent"), app(3, "offer")]);
    expect(groups.sent.map((a) => a.id)).toEqual([1, 2]);
    expect(groups.offer).toHaveLength(1);
    expect(groups.imported).toEqual([]);
    expect(Object.keys(groups)).toHaveLength(10);
  });

  it("renders a column per status with counts and draggable cards", () => {
    render(
      <MemoryRouter>
        <BoardView items={[app(1, "sent", "Acme Ltd")]} truncated={false} onMove={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("region", { name: "Applied column" })).toHaveTextContent("Acme Ltd");
    expect(screen.getByRole("button", { name: /Move Acme Ltd/ })).toBeInTheDocument();
  });
});

describe("job form", () => {
  it("validates required fields, emails and links", () => {
    expect(validateJob(EMPTY_JOB)).toMatchObject({
      company: expect.any(String),
      role: expect.any(String),
    });
    const problems = validateJob({
      ...EMPTY_JOB,
      company: "Acme",
      role: "Dev",
      contact_email: "nope",
      job_url: "javascript:alert(1)",
    });
    expect(Object.keys(problems).sort()).toEqual(["contact_email", "job_url"]);
    expect(
      validateJob({ ...EMPTY_JOB, company: "Acme", role: "Dev", job_url: "https://example.com" }),
    ).toEqual({});
  });

  it("converts the CV choice and trims text", () => {
    expect(toJobInput({ ...EMPTY_JOB, company: " Acme ", cv_id: "4" })).toMatchObject({
      company: "Acme",
      cv_id: 4,
    });
    expect(toJobInput(EMPTY_JOB).cv_id).toBeNull();
  });
});

describe("JobDetailsView", () => {
  it("shows the status timeline newest first", () => {
    render(
      <JobDetailsView
        values={EMPTY_JOB}
        problems={{}}
        isDirty={false}
        isSaving={false}
        cvs={[]}
        history={[
          { from_status: null, to_status: "imported", changed_at: "2026-11-01T10:00:00" },
          { from_status: "imported", to_status: "sent", changed_at: "2026-11-02T10:00:00" },
        ]}
        change={vi.fn()}
        save={vi.fn()}
        discard={vi.fn()}
        remove={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("To apply → Applied");
    expect(items[1]).toContain("Added as To apply");
  });
});

describe("dashboard", () => {
  it("builds tiles and charts from stats", () => {
    const vm = buildDashboard({
      total: 10,
      by_status: {
        imported: 4,
        drafted: 1,
        ready: 0,
        sent: 3,
        followed_up: 0,
        replied: 0,
        interview: 1,
        offer: 0,
        rejected: 1,
        withdrawn: 0,
      },
      added_this_week: 2,
      sent: 5,
      responses: 2,
      interviews: 1,
      response_rate: 0.4,
      added_per_week: [{ week_start: "2026-11-09", count: 2 }],
      follow_ups_due: [],
      avg_days_to_reply: 3.5,
      by_tone: [{ label: "Friendly", sent: 2, responses: 1, rate: 0.5 }],
      by_cv: [],
    });
    expect(vm.stats.map((s) => s.value)).toEqual(["10", "5", "1", "40%"]);
    expect(vm.statusChart.find((c) => c.status === "sent")?.count).toBe(3);
    expect(vm.weeklyChart).toHaveLength(1);
    expect(vm.avgDaysToReply).toBe(3.5);
    expect(vm.byTone[0].label).toBe("Friendly");
  });
});

describe("parseServerDate", () => {
  it("reads zone-less server times as UTC", () => {
    expect(parseServerDate("2026-11-10T09:00:00").toISOString()).toBe("2026-11-10T09:00:00.000Z");
    expect(parseServerDate("2026-11-10T09:00:00+01:00").toISOString()).toBe(
      "2026-11-10T08:00:00.000Z",
    );
  });
});

describe("theme toggle", () => {
  it("is part of the layout", async () => {
    const { ThemeProvider } = await import("@/app/theme");
    const { AppLayout } = await import("@/app/layout/AppLayout");
    window.matchMedia ??= vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <MemoryRouter>
            <AppLayout />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getAllByRole("radio", { name: "Dark theme" })[0]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getAllByRole("radio", { name: "Light theme" })[0]);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
