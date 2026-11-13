// View: the job tracker, laid out like a job-hunt spreadsheet, with a side panel per job.
import {
  Columns3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BoardView } from "@/features/applications/BoardView";
import { ASSESSMENT_LABELS, STATUS_LABELS, statusVariant } from "@/features/applications/labels";
import type { Application, ApplicationStatus, Assessment } from "@/features/applications/types";
import { JobSummaryView } from "@/features/jobs/JobSummaryView";
import { API_BASE } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { jobLink } from "./jobLink";
import type { TrackerViewModel } from "./useTrackerViewModel";

const STATUSES = Object.entries(STATUS_LABELS) as [ApplicationStatus, string][];

function statusTone(status: ApplicationStatus): string {
  if (status === "rejected" || status === "withdrawn") return "bg-destructive/10 text-destructive";
  if (status === "interview" || status === "offer" || status === "replied")
    return "bg-success/15 text-success";
  return "";
}

function assessmentTone(value: Assessment): string {
  if (value === "done") return "bg-success/15 text-success";
  if (value === "pending") return "bg-warning text-warning-foreground";
  return "";
}

function Totals({ vm }: { vm: TrackerViewModel }) {
  const s = vm.summary;
  const tiles = [
    ["Total applications", s?.total],
    ["Applied", s?.applied],
    ["Rejected", s?.rejected],
    ["Assessments done", s?.assessments_done],
    ["In progress", s?.in_progress],
    ["Interviews", s?.interviews],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-muted/60 rounded-lg px-3 py-2">
          <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
          <dd className="text-xl font-semibold tabular-nums">{value ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrackerTable({ vm }: { vm: TrackerViewModel }) {
  const cell = "px-2 py-1.5 align-middle";
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-primary/90 text-primary-foreground text-left">
          <tr>
            <th className={cn(cell, "pl-4 font-medium")}>Company</th>
            <th className={cn(cell, "font-medium")}>Role</th>
            <th className={cn(cell, "w-36 font-medium")}>Application deadline</th>
            <th className={cn(cell, "w-36 font-medium")}>Status</th>
            <th className={cn(cell, "w-32 font-medium")}>Pre-assessment</th>
            <th className={cn(cell, "w-40 font-medium")}>Assessment deadline</th>
            <th className={cn(cell, "pr-4 font-medium")}>Next step</th>
          </tr>
        </thead>
        <tbody>
          {vm.items.map((a) => (
            <tr
              key={a.id}
              onClick={() => vm.select(a.id)}
              aria-selected={vm.selected?.id === a.id}
              className={cn(
                "hover:bg-accent/50 cursor-pointer border-t",
                vm.selected?.id === a.id && "bg-accent",
              )}
            >
              <td className={cn(cell, "pl-4 font-medium")}>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => vm.select(a.id)}
                >
                  {a.company}
                </button>
              </td>
              <td className={cell}>{a.role}</td>
              <td className={cell} onClick={(e) => e.stopPropagation()}>
                <Input
                  key={a.application_deadline}
                  aria-label={`Application deadline for ${a.company} – ${a.role}`}
                  className="h-8"
                  defaultValue={a.application_deadline}
                  placeholder="Rolling"
                  onBlur={(e) => {
                    if (e.target.value.trim() !== a.application_deadline)
                      vm.update(a.id, { application_deadline: e.target.value.trim() });
                  }}
                />
              </td>
              <td className={cell} onClick={(e) => e.stopPropagation()}>
                <NativeSelect
                  aria-label={`Status for ${a.company} – ${a.role}`}
                  className={cn("h-8", statusTone(a.status))}
                  value={a.status}
                  onChange={(e) => vm.update(a.id, { status: e.target.value as ApplicationStatus })}
                >
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </td>
              <td className={cell} onClick={(e) => e.stopPropagation()}>
                <NativeSelect
                  aria-label={`Pre-assessment for ${a.company} – ${a.role}`}
                  className={cn("h-8", assessmentTone(a.assessment))}
                  value={a.assessment}
                  onChange={(e) => vm.update(a.id, { assessment: e.target.value as Assessment })}
                >
                  {Object.entries(ASSESSMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </td>
              <td className={cell} onClick={(e) => e.stopPropagation()}>
                <Input
                  type="date"
                  aria-label={`Assessment deadline for ${a.company} – ${a.role}`}
                  className="h-8"
                  value={a.assessment_due ?? ""}
                  onChange={(e) => vm.update(a.id, { assessment_due: e.target.value || null })}
                />
              </td>
              <td className={cn(cell, "pr-4")}>{a.next_step || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SidePanel({ vm, job }: { vm: TrackerViewModel; job: Application }) {
  const summary = job.job_summary ?? {};
  const hasSummary = Boolean(summary.summary);
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{job.role}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {job.company}
              {job.location && ` · ${job.location}`}
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={() => vm.select(null)}>
            <X />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant={statusVariant(job.status)}>{STATUS_LABELS[job.status]}</Badge>
          {job.salary && <Badge variant="outline">{job.salary}</Badge>}
        </div>
        {job.next_step && (
          <p className="pt-1 text-sm">
            <span className="text-muted-foreground">Next step: </span>
            {job.next_step}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={`/applications/${job.id}/apply`}>
              <Send /> Apply
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={jobLink(job)} target="_blank" rel="noreferrer noopener">
              <ExternalLink /> {/^https?:/i.test(job.job_url) ? "Job page" : "Find the job"}
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <Link to={`/applications/${job.id}`}>All details</Link>
          </Button>
        </div>

        {hasSummary ? (
          <JobSummaryView summary={summary} />
        ) : job.job_description.trim() ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground line-clamp-6 whitespace-pre-wrap">
              {job.job_description}
            </p>
            <Button variant="outline" onClick={vm.summarize} disabled={vm.isSummarizing}>
              {vm.isSummarizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Summarise with AI
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No job description yet. Paste the job ad in{" "}
            <Link to={`/applications/${job.id}`} className="text-primary underline">
              All details
            </Link>{" "}
            to get a summary and a tailored CV and letter.
          </p>
        )}
        {hasSummary && job.job_description.trim() && (
          <Button size="sm" variant="ghost" onClick={vm.summarize} disabled={vm.isSummarizing}>
            {vm.isSummarizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Summarise again
          </Button>
        )}

        {job.notes && (
          <section className="text-sm">
            <h3 className="mb-1 font-medium">Notes</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{job.notes}</p>
          </section>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => vm.remove(job.id)}
        >
          <Trash2 /> Remove from tracker
        </Button>
      </CardContent>
    </Card>
  );
}

export function TrackerView(vm: TrackerViewModel) {
  const empty = !vm.isLoading && vm.items.length === 0 && !vm.search && !vm.status;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Your job tracker. Change any cell and it saves straight away.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/jobs">
              <Search /> Find jobs
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/applications/new">
              <Plus /> Add job
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/import">
              <FileSpreadsheet /> Import
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`${API_BASE}/applications/export`} download>
              <Download /> Export
            </a>
          </Button>
        </div>
      </div>

      <Totals vm={vm} />

      {vm.error && (
        <p role="alert" className="text-destructive text-sm">
          {vm.error}
        </p>
      )}

      {empty ? (
        <div className="space-y-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Your tracker is empty.</p>
          <p className="text-muted-foreground text-sm">
            Find jobs to apply for, import your own spreadsheet, or add a job by hand.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input
                className="pl-8"
                placeholder="Search company or role"
                aria-label="Search applications"
                value={vm.search}
                onChange={(e) => vm.setSearch(e.target.value)}
              />
            </div>
            <div className="w-40">
              <NativeSelect
                aria-label="Filter by status"
                value={vm.status}
                onChange={(e) => vm.setStatus(e.target.value as ApplicationStatus | "")}
              >
                <option value="">All statuses</option>
                {STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44">
              <NativeSelect
                aria-label="Sort"
                value={vm.sort}
                onChange={(e) => vm.setSort(e.target.value as typeof vm.sort)}
              >
                <option value="created_at">Order added</option>
                <option value="-created_at">Newest first</option>
                <option value="company">Company A–Z</option>
                <option value="status">Status</option>
              </NativeSelect>
            </div>
            <div role="radiogroup" aria-label="View" className="bg-muted flex rounded-lg p-0.5">
              {(
                [
                  ["table", "Sheet", Table2],
                  ["board", "Board", Columns3],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={vm.view === value}
                  onClick={() => vm.setView(value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                    vm.view === value
                      ? "bg-background font-medium shadow-xs"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "grid items-start gap-5",
              vm.selected && "lg:grid-cols-[minmax(0,1fr)_380px]",
            )}
          >
            <div className="min-w-0">
              {vm.isLoading ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </p>
              ) : vm.items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No jobs match your search.</p>
              ) : vm.view === "board" ? (
                <BoardView
                  items={vm.items}
                  truncated={vm.total > vm.items.length}
                  onMove={(id, status) => vm.update(id, { status })}
                />
              ) : (
                <TrackerTable vm={vm} />
              )}
            </div>
            {vm.selected && <SidePanel vm={vm} job={vm.selected} />}
          </div>
        </>
      )}
    </div>
  );
}
