// View: the job tracker, laid out like a job-hunt spreadsheet, with a side panel per job.
import {
  ArchiveRestore,
  Clock,
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
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BoardView } from "@/features/applications/BoardView";
import { SPONSORSHIP_LABELS, STATUS_LABELS, statusVariant } from "@/features/applications/labels";
import type {
  Application,
  ApplicationStatus,
  Sponsorship,
  TrackerGroup,
} from "@/features/applications/types";
import { JobSummaryView } from "@/features/jobs/JobSummaryView";
import { API_BASE } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { jobLink } from "./jobLink";
import { QuickAddJob } from "./QuickAddJob";
import { StagesCell } from "./StagesCell";
import type { TrackerViewModel } from "./useTrackerViewModel";

const STATUSES = Object.entries(STATUS_LABELS) as [ApplicationStatus, string][];

function statusTone(status: ApplicationStatus): string {
  if (status === "rejected" || status === "withdrawn")
    return "bg-destructive/10 text-destructive border-destructive/25 font-semibold";
  if (status === "interview" || status === "offer" || status === "replied")
    return "bg-success/12 text-success border-success/30 font-semibold";
  if (status === "sent" || status === "followed_up")
    return "bg-info/10 text-info border-info/25 font-semibold";
  return "";
}

function Totals({ vm }: { vm: TrackerViewModel }) {
  const s = vm.summary;
  const tiles: [string, number | undefined, string, TrackerGroup | ""][] = [
    ["Total applications", s?.total, "bg-foreground/70", ""],
    ["Applied", s?.applied, "bg-info", "applied"],
    ["Rejected", s?.rejected, "bg-destructive", "rejected"],
    ["Assessments done", s?.assessments_done, "bg-success", "assessments_done"],
    ["In progress", s?.in_progress, "bg-warning-border", "in_progress"],
    ["Interviews", s?.interviews, "bg-primary", "interviews"],
  ];
  // Each total is a button: click it to see just those jobs, click again for all of them.
  return (
    <div
      role="group"
      aria-label="Totals: click one to filter"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {tiles.map(([label, value, bar, group]) => {
        const active = vm.group === group && (group !== "" || !vm.status);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            title={group ? `Show only: ${label}` : "Show every job"}
            onClick={() => {
              vm.setStatus("");
              vm.setGroup(vm.group === group ? "" : group);
            }}
            className={cn(
              "bg-card shadow-card hover:border-primary/50 relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors",
              active && group !== "" && "border-primary ring-primary/30 ring-2",
            )}
          >
            <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
            <span className="text-muted-foreground block text-xs font-semibold">{label}</span>
            <span className="block text-2xl font-bold tracking-tight tabular-nums">
              {value ?? "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrackerTable({ vm }: { vm: TrackerViewModel }) {
  const cell = "px-2 py-1.5 align-middle";
  return (
    <div className="bg-card shadow-card overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-muted text-muted-foreground text-left text-xs tracking-wide uppercase">
          <tr>
            <th className={cn(cell, "w-10 pl-4")}>
              <input
                type="checkbox"
                className="accent-primary size-4"
                aria-label="Select all"
                checked={vm.items.length > 0 && vm.items.every((a) => vm.checked.has(a.id))}
                onChange={vm.toggleAllChecked}
              />
            </th>
            <th className={cn(cell, "font-medium")}>Company</th>
            <th className={cn(cell, "font-medium")}>Role</th>
            <th className={cn(cell, "w-36 font-medium")}>Application deadline</th>
            <th className={cn(cell, "w-36 font-medium")}>Status</th>
            <th className={cn(cell, "w-28 font-medium")}>Sponsorship</th>
            <th className={cn(cell, "min-w-56 font-medium")}>Stages</th>
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
              <td className={cn(cell, "pl-4")} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  aria-label={`Select ${a.company} – ${a.role}`}
                  checked={vm.checked.has(a.id)}
                  onChange={() => vm.toggleChecked(a.id)}
                />
              </td>
              <td className={cn(cell, "font-medium")}>
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
                  aria-label={`Visa sponsorship for ${a.company} – ${a.role}`}
                  className={cn(
                    "h-8",
                    a.sponsorship === "yes" && "text-success font-semibold",
                    a.sponsorship === "no" && "text-destructive font-semibold",
                    a.sponsorship === "unsure" && "text-muted-foreground",
                  )}
                  value={a.sponsorship}
                  onChange={(e) => vm.update(a.id, { sponsorship: e.target.value as Sponsorship })}
                >
                  {Object.entries(SPONSORSHIP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </td>
              <td className={cell} onClick={(e) => e.stopPropagation()}>
                <StagesCell
                  stages={a.stages}
                  label={`${a.company} – ${a.role}`}
                  onChange={(stages) => vm.update(a.id, { stages })}
                />
              </td>
              <td className={cn(cell, "pr-4")}>
                <span className="block">{a.next_step || "–"}</span>
                {a.due_label && (
                  <Badge
                    variant={a.due_level === "overdue" ? "destructive" : "warning"}
                    className="mt-1"
                  >
                    <Clock /> {a.due_label}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectionBar({ vm }: { vm: TrackerViewModel }) {
  if (vm.checked.size === 0) return null;
  return (
    <div className="bg-card shadow-lift sticky top-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm">
      <span className="font-semibold">{vm.checked.size} selected</span>
      <Button size="sm" variant="destructive" onClick={vm.deleteChecked}>
        <Trash2 /> Delete selected
      </Button>
      <Button size="sm" variant="ghost" onClick={vm.clearChecked}>
        Clear
      </Button>
    </div>
  );
}

function DeleteEverything({ vm, onClose }: { vm: TrackerViewModel; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="border-destructive/40" role="dialog" aria-label="Delete everything">
      <CardHeader>
        <CardTitle className="text-destructive">Delete every job in your tracker?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          A full backup is saved first, and the jobs go to the recycle bin, so you can restore them
          for 30 days. Type <span className="font-mono font-bold">DELETE</span> to confirm.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-48"
            aria-label="Type DELETE to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={typed !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await vm.deleteEverything(typed);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete everything
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecycleBin({ vm }: { vm: TrackerViewModel }) {
  return (
    <Card role="region" aria-label="Recycle bin">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="text-muted-foreground size-4" /> Recycle bin
        </CardTitle>
        <div className="flex gap-2">
          {vm.bin.length > 0 && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={vm.emptyTheBin}>
              Empty the bin
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => vm.setShowBin(false)} aria-label="Close">
            <X />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {vm.bin.length === 0 ? (
          <p className="text-muted-foreground">Nothing here. Deleted jobs stay for 30 days.</p>
        ) : (
          <ul className="divide-y">
            {vm.bin.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{item.company}</span>
                  <span className="text-muted-foreground"> · {item.role}</span>
                  <span className="text-muted-foreground block text-xs">
                    Deleted {new Date(item.deleted_at).toLocaleDateString("en-GB")} · gone for good
                    on {new Date(item.expires_at).toLocaleDateString("en-GB")}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => vm.restore(item.id)}>
                  <Undo2 /> Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => vm.deleteForever(item.id)}
                  aria-label={`Delete ${item.company} – ${item.role} for good`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SidePanel({ vm, job }: { vm: TrackerViewModel; job: Application }) {
  const summary = job.job_summary ?? {};
  const hasSummary = Boolean(summary.summary);
  return (
    <Card className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
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
          <Badge variant="outline">Sponsorship: {SPONSORSHIP_LABELS[job.sponsorship]}</Badge>
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
  const [confirmAll, setConfirmAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const empty =
    !vm.isLoading &&
    vm.items.length === 0 &&
    !vm.search &&
    !vm.status &&
    !vm.group &&
    !vm.hideClosed;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
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
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Add job
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

      {adding && <QuickAddJob onClose={() => setAdding(false)} />}
      {/* Always on screen, however far down a long list you are. */}
      <Button
        className="shadow-lift fixed right-6 bottom-6 z-30 rounded-full"
        size="lg"
        onClick={() => setAdding(true)}
      >
        <Plus /> Add job
      </Button>

      {vm.showBin && <RecycleBin vm={vm} />}
      {confirmAll && <DeleteEverything vm={vm} onClose={() => setConfirmAll(false)} />}

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
                onChange={(e) => {
                  vm.setGroup("");
                  vm.setStatus(e.target.value as ApplicationStatus | "");
                }}
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => vm.setShowBin(!vm.showBin)}
              aria-pressed={vm.showBin}
            >
              <ArchiveRestore /> Bin{vm.bin.length > 0 && ` (${vm.bin.length})`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmAll(true)}
            >
              <Trash2 /> Delete all
            </Button>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={vm.hideClosed}
                onChange={(e) => vm.setHideClosed(e.target.checked)}
              />
              Hide closed
            </label>
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
            <div className="min-w-0 space-y-3">
              <SelectionBar vm={vm} />
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
