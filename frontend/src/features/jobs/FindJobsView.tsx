// View: search job boards; each job opens in a side panel with an AI summary and "Apply".
import {
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { JobListing } from "./api";
import { JobSummaryView } from "./JobSummaryView";
import type { FindJobsViewModel } from "./useFindJobsViewModel";

const BOARD_NAMES = { reed: "Reed", adzuna: "Adzuna" } as const;

function SetupCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Connect a job board (free)
        </CardTitle>
        <CardDescription>
          CareerPilot lists jobs from job boards' official free APIs. Get a key from one or both,
          then paste it in Settings → Keys & passwords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a
              className="text-primary underline"
              href="https://www.reed.co.uk/developers/jobseeker"
              target="_blank"
              rel="noreferrer noopener"
            >
              Reed
            </a>{" "}
            : UK jobs with a graduate filter. Sign up and copy your API key.
          </li>
          <li>
            <a
              className="text-primary underline"
              href="https://developer.adzuna.com/signup"
              target="_blank"
              rel="noreferrer noopener"
            >
              Adzuna
            </a>{" "}
            : UK jobs with salaries. Sign up and copy your App ID and App Key.
          </li>
        </ul>
        <Button asChild>
          <Link to="/settings">Open Settings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function JobRow({
  job,
  selected,
  onSelect,
}: {
  job: JobListing;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={cn(
          "hover:bg-accent/60 w-full rounded-lg border p-3 text-left text-sm transition-colors",
          selected && "border-primary bg-accent",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{job.title}</span>
          {job.application_id && (
            <Badge variant="success" className="shrink-0">
              <CheckCircle2 /> In tracker
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {job.company}
          {job.location && ` · ${job.location}`}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
          {job.salary && <span className="font-medium">{job.salary}</span>}
          {job.posted && <span className="text-muted-foreground">Posted {job.posted}</span>}
          {job.closes && <span className="text-muted-foreground">Closes {job.closes}</span>}
        </p>
        {job.snippet && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{job.snippet}</p>
        )}
      </button>
    </li>
  );
}

function DetailsPanel({ vm }: { vm: FindJobsViewModel }) {
  const d = vm.details;
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{d?.title ?? "Loading…"}</CardTitle>
            {d && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                {d.company}
                {d.location && (
                  <>
                    {" "}
                    · <MapPin className="size-3.5" /> {d.location}
                  </>
                )}
              </p>
            )}
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={() => vm.select(null)}>
            <X />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vm.isLoadingDetails || !d ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading the job…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={vm.apply} disabled={vm.isSaving}>
                {vm.isSaving ? <Loader2 className="animate-spin" /> : <Send />}
                Apply
              </Button>
              {!d.application_id && (
                <Button variant="outline" onClick={vm.saveOnly} disabled={vm.isSaving}>
                  <BookmarkPlus /> Save to tracker
                </Button>
              )}
              {/^https?:\/\//i.test(d.url) && (
                <Button variant="ghost" asChild>
                  <a href={d.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink /> View on {BOARD_NAMES[d.source]}
                  </a>
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Apply saves this job to your tracker and opens your tailored CV and cover letter.
            </p>

            {d.summary ? (
              <JobSummaryView summary={d.summary} />
            ) : vm.isSummarizing ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Summarising with AI…
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {d.salary && <p className="font-medium">{d.salary}</p>}
                {vm.aiConfigured ? (
                  <Button variant="outline" onClick={vm.summarize}>
                    <Sparkles /> Summarise with AI
                  </Button>
                ) : (
                  <p className="text-muted-foreground">
                    <Link to="/settings" className="text-primary underline">
                      Add your Gemini key
                    </Link>{" "}
                    to get a plain-English summary and see how well you match.
                  </p>
                )}
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Full job description</summary>
              <p className="text-muted-foreground mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap">
                {d.description || "The board didn't share a description."}
              </p>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function FindJobsView(vm: FindJobsViewModel) {
  const result = vm.result;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find jobs</h1>
        <p className="text-muted-foreground">
          Jobs from UK job boards, summarised for you. Pick one to get a tailored CV and cover
          letter, then apply on the employer's site.
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          vm.search();
        }}
      >
        <Input
          className="min-w-56 flex-[2]"
          aria-label="Job title or keywords"
          placeholder="e.g. Software engineer"
          value={vm.form.q}
          onChange={(e) => vm.setForm({ q: e.target.value })}
        />
        <Input
          className="min-w-40 flex-1"
          aria-label="Location"
          placeholder="Location (e.g. Manchester)"
          value={vm.form.location}
          onChange={(e) => vm.setForm({ location: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={vm.form.graduate}
            onChange={(e) => vm.setForm({ graduate: e.target.checked })}
          />
          Graduate roles
        </label>
        <Button type="submit" disabled={vm.isSearching}>
          {vm.isSearching ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>

      {vm.error && (
        <p role="alert" className="text-destructive text-sm">
          {vm.error}
        </p>
      )}
      {result?.problems.map((p) => (
        <p key={p} role="status" className="text-warning-foreground text-sm">
          {p}
        </p>
      ))}

      {result?.needs_setup ? (
        <SetupCard />
      ) : !result ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Search for a role to see jobs.
        </p>
      ) : (
        <div
          className={cn(
            "grid items-start gap-5",
            vm.selectedId && "lg:grid-cols-[minmax(0,1fr)_420px]",
          )}
        >
          <div className="min-w-0 space-y-3">
            <p className="text-muted-foreground text-sm">
              {result.jobs.length} jobs from {result.boards.join(" and ")}
              {vm.submitted && vm.submitted.page > 1 && ` · page ${vm.submitted.page}`}
            </p>
            {result.jobs.length === 0 ? (
              <p className="text-sm">No jobs found. Try other keywords or another location.</p>
            ) : (
              <ul className="space-y-2">
                {result.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    selected={vm.selectedId === job.id}
                    onSelect={() => vm.select(job.id)}
                  />
                ))}
              </ul>
            )}
            {result.jobs.length > 0 && (
              <Button variant="outline" onClick={vm.nextPage} disabled={vm.isSearching}>
                Next page
              </Button>
            )}
          </div>
          {vm.selectedId && <DetailsPanel vm={vm} />}
        </div>
      )}
    </div>
  );
}
