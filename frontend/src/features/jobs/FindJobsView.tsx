// View: search job boards; each job opens in a side panel with an AI summary and "Apply".
// Plus a shortlist, one-click searches on sites without an API, and "add a job from any site".
import {
  BookmarkPlus,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  MapPin,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { OTHER_SITES, siteSearchUrl, type JobListing } from "./api";
import { JobSummaryView } from "./JobSummaryView";
import type { FindJobsViewModel } from "./useFindJobsViewModel";

const BOARD_NAMES = { reed: "Reed", adzuna: "Adzuna", jooble: "Jooble" } as const;

function SetupCard() {
  const boards = [
    ["Reed", "https://www.reed.co.uk/developers/jobseeker", "UK jobs with a graduate filter."],
    ["Adzuna", "https://developer.adzuna.com/signup", "UK jobs with salaries (App ID + Key)."],
    ["Jooble", "https://jooble.org/api/about", "Jobs from many UK sites. Ask for a UK key."],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="text-primary size-4" /> No job board is connected yet
        </CardTitle>
        <CardDescription>
          Searching needs a free key from at least one job board (it's how the board lets
          CareerPilot list its jobs). Open a board below, sign up, copy the key it gives you and
          paste it in Settings → Keys & passwords. You only do this once: the key is kept on this
          computer. You can also search the sites on the right without any key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="grid gap-2 sm:grid-cols-3">
          {boards.map(([name, href, hint]) => (
            <li key={name} className="rounded-xl border p-3">
              <a
                className="text-primary font-bold underline"
                href={href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {name}
              </a>
              <p className="text-muted-foreground text-xs">{hint}</p>
            </li>
          ))}
        </ul>
        <Button asChild>
          <Link to="/settings">Open Settings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OtherSites({ vm }: { vm: FindJobsViewModel }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="text-primary size-4" /> Search on other sites
        </CardTitle>
        <CardDescription className="text-xs">
          These sites have no public API, so this opens a web search of the site with your keywords.
          Found one you like? Add it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 px-4">
        {OTHER_SITES.map((site) => (
          <Button key={site.domain} size="sm" variant="outline" asChild>
            <a
              href={siteSearchUrl(site.domain, vm.form.q, vm.form.graduate)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {site.name} <ExternalLink className="size-3" />
            </a>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function PasteJob({ vm }: { vm: FindJobsViewModel }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardPaste className="text-primary size-4" /> Add a job from any site
        </CardTitle>
        <CardDescription className="text-xs">
          Gradcracker, The Trackr, a company's careers page… Paste the job's link and CareerPilot
          reads the page and fills in the company, role, salary and closing date. If a site needs a
          login (like LinkedIn), paste the ad's text too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <Input
          aria-label="Job link"
          placeholder="https://… (the job's page)"
          value={vm.paste.url}
          onChange={(e) => vm.setPaste({ url: e.target.value })}
        />
        <Textarea
          aria-label="Job ad text"
          rows={3}
          placeholder="Optional: the job ad's text (if the site can't be read)"
          value={vm.paste.text}
          onChange={(e) => vm.setPaste({ text: e.target.value })}
        />
        {!vm.aiConfigured && (
          <div className="flex gap-2">
            <Input
              aria-label="Company"
              placeholder="Company"
              value={vm.paste.company}
              onChange={(e) => vm.setPaste({ company: e.target.value })}
            />
            <Input
              aria-label="Role"
              placeholder="Role"
              value={vm.paste.role}
              onChange={(e) => vm.setPaste({ role: e.target.value })}
            />
          </div>
        )}
        <Button className="w-full" onClick={vm.addPasted} disabled={vm.isPasting}>
          {vm.isPasting ? <Loader2 className="animate-spin" /> : <Send />}
          Add and apply
        </Button>
      </CardContent>
    </Card>
  );
}

function JobRow({
  job,
  selected,
  onSelect,
  onStar,
}: {
  job: JobListing;
  selected: boolean;
  onSelect: () => void;
  onStar: () => void;
}) {
  return (
    <li
      className={cn(
        "bg-card group relative rounded-xl border shadow-card transition-all hover:-translate-y-px hover:shadow-lift",
        selected && "border-primary ring-primary/30 ring-2",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className="w-full rounded-xl p-4 pr-12 text-left text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold tracking-tight">{job.title}</span>
          {job.application_id && (
            <Badge variant="success">
              <CheckCircle2 /> In tracker
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground font-medium">
          {job.company}
          {job.location && ` · ${job.location}`}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {job.salary && <Badge variant="info">{job.salary}</Badge>}
          {job.closes && <span className="text-muted-foreground">Closes {job.closes}</span>}
          {job.posted && <span className="text-muted-foreground">Posted {job.posted}</span>}
          <span className="text-muted-foreground">via {BOARD_NAMES[job.source]}</span>
        </p>
        {job.snippet && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">{job.snippet}</p>
        )}
      </button>
      <button
        type="button"
        onClick={onStar}
        aria-pressed={job.shortlisted}
        aria-label={
          job.shortlisted ? `Remove ${job.title} from shortlist` : `Shortlist ${job.title}`
        }
        title={job.shortlisted ? "Remove from shortlist" : "Save to look at later"}
        className="hover:bg-accent absolute top-3 right-3 rounded-lg p-1.5"
      >
        <Star
          className={cn(
            "size-5",
            job.shortlisted ? "fill-warning-border text-warning-border" : "text-muted-foreground",
          )}
        />
      </button>
    </li>
  );
}

function DetailsPanel({ vm }: { vm: FindJobsViewModel }) {
  const d = vm.details;
  return (
    <Card className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{d?.title ?? "Loading…"}</CardTitle>
            {d && (
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-sm font-medium">
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
              <Button variant="outline" onClick={() => vm.toggleStar(d)}>
                <Star className={cn(d.shortlisted && "fill-warning-border text-warning-border")} />
                {d.shortlisted ? "Shortlisted" : "Shortlist"}
              </Button>
              {!d.application_id && (
                <Button variant="outline" onClick={vm.saveOnly} disabled={vm.isSaving}>
                  <BookmarkPlus /> Add to tracker
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
              Apply adds this job to your tracker and opens your tailored CV and cover letter.
            </p>

            {d.summary ? (
              <JobSummaryView summary={d.summary} />
            ) : vm.isSummarizing ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Summarising with AI…
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {d.salary && <p className="font-semibold">{d.salary}</p>}
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
              <summary className="cursor-pointer font-semibold">Full job description</summary>
              <p className="text-muted-foreground mt-2 max-h-72 overflow-y-auto rounded-lg border p-3 whitespace-pre-wrap">
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
  const list = vm.tab === "shortlist" ? vm.shortlist : (result?.jobs ?? []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find jobs</h1>
        <p className="text-muted-foreground mt-1">
          Jobs from UK job boards, summarised for you. Pick one to get a tailored CV and cover
          letter, then apply on the employer's site.
        </p>
      </div>

      <form
        className="bg-card shadow-card flex flex-wrap items-center gap-2 rounded-2xl border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          vm.search();
        }}
      >
        <div className="relative min-w-56 flex-[2]">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            aria-label="Job title or keywords"
            placeholder="e.g. Software engineer"
            value={vm.form.q}
            onChange={(e) => vm.setForm({ q: e.target.value })}
          />
        </div>
        <div className="relative min-w-40 flex-1 border-l">
          <MapPin className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            aria-label="Location"
            placeholder="Anywhere in the UK"
            value={vm.form.location}
            onChange={(e) => vm.setForm({ location: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 px-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="accent-primary size-4"
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
        <p role="alert" className="text-destructive text-sm font-medium">
          {vm.error}
        </p>
      )}
      {result && result.problems.length > 0 && (
        <div
          role="status"
          className="border-warning-border bg-warning text-warning-foreground rounded-lg border px-4 py-2.5 text-sm"
        >
          {result.problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {result.jobs.length > 0 && <p>The jobs below are from the boards that did answer.</p>}
        </div>
      )}

      <div
        className={cn(
          "grid items-start gap-6",
          !vm.selectedId && "xl:grid-cols-[minmax(0,1fr)_340px]",
        )}
      >
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Jobs" className="flex gap-1 border-b">
            {(
              [
                ["results", "Search results"],
                ["shortlist", `Shortlist (${vm.shortlist.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={vm.tab === value}
                onClick={() => vm.setTab(value)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
                  vm.tab === value
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {vm.tab === "results" && result?.needs_setup ? (
            <SetupCard />
          ) : vm.tab === "results" && !result ? (
            <p className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
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
                {vm.tab === "results" && result && (
                  <p className="text-muted-foreground text-sm">
                    {result.jobs.length} jobs from {result.boards.join(", ")}
                    {vm.submitted && vm.submitted.page > 1 && ` · page ${vm.submitted.page}`}
                  </p>
                )}
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {vm.tab === "shortlist"
                      ? "Nothing shortlisted yet. Star a job to keep it here."
                      : "No jobs found. Try other keywords or another location."}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {list.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        selected={vm.selectedId === job.id}
                        onSelect={() => vm.select(job.id)}
                        onStar={() => vm.toggleStar(job)}
                      />
                    ))}
                  </ul>
                )}
                {vm.tab === "results" && list.length > 0 && (
                  <Button variant="outline" onClick={vm.nextPage} disabled={vm.isSearching}>
                    Next page
                  </Button>
                )}
              </div>
              {vm.selectedId && <DetailsPanel vm={vm} />}
            </div>
          )}
        </div>

        {/* Hidden while a job is open, so the list and its summary get the room. */}
        <aside className={cn("space-y-4", vm.selectedId && "hidden")}>
          <OtherSites vm={vm} />
          <PasteJob vm={vm} />
        </aside>
      </div>
    </div>
  );
}
