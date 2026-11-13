// View: one job, its cover letters, and how well the profile matches it.
import { ArrowLeft, ExternalLink, Loader2, PenLine, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { STATUS_LABELS, TONE_LABELS, scoreLabel, statusVariant } from "./labels";
import { LetterEditorView } from "./LetterEditorView";
import type { Tone } from "./types";
import type { ApplicationDetailViewModel } from "./useApplicationDetailViewModel";

export function ApplicationDetailView({
  details,
  apply,
  tailoredCv,
  ...vm
}: ApplicationDetailViewModel & {
  details?: ReactNode;
  apply?: ReactNode;
  tailoredCv?: ReactNode;
}) {
  const [tab, setTab] = useState<"letter" | "cv" | "apply" | "details">("letter");
  if (vm.isLoading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (vm.notFound || !vm.application) {
    return (
      <div className="space-y-3">
        <p>This application wasn't found. It may have been deleted.</p>
        <Button variant="outline" asChild>
          <Link to="/applications">Back to applications</Link>
        </Button>
      </div>
    );
  }

  const a = vm.application;
  const safeLink = /^https?:\/\//i.test(a.job_url) ? a.job_url : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <Link
          to="/applications"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-4" /> Applications
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{a.role}</h1>
          <Badge variant={statusVariant(a.status)}>{STATUS_LABELS[a.status]}</Badge>
        </div>
        <p className="text-muted-foreground">
          {a.company}
          {a.location && ` · ${a.location}`}
          {a.salary && ` · ${a.salary}`}
        </p>
      </div>

      {vm.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {vm.error}
        </div>
      )}

      <div role="tablist" aria-label="Sections" className="flex gap-1 border-b">
        {(
          [
            ["letter", "Cover letter"],
            ["cv", "Tailored CV"],
            ["apply", "Apply"],
            ["details", "Details & timeline"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === value
                ? "border-primary text-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        details
      ) : tab === "cv" ? (
        tailoredCv
      ) : tab === "apply" ? (
        apply
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="text-primary size-4" />
                  {vm.letters.length ? "Write a new version" : "Write the cover letter"}
                </CardTitle>
                <CardDescription>
                  The AI uses only facts from your profile, tailored to this job's description.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!vm.aiConfigured && (
                  <p className="text-sm">
                    AI isn't set up yet.{" "}
                    <Link to="/settings" className="text-primary underline">
                      Choose a provider in Settings
                    </Link>
                    .
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <div className="w-44">
                    <NativeSelect
                      value={vm.tone}
                      aria-label="Tone"
                      onChange={(e) => vm.setTone(e.target.value as Tone)}
                    >
                      {Object.entries(TONE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label} tone
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Input
                    className="min-w-56 flex-1"
                    value={vm.instructions}
                    maxLength={500}
                    aria-label="Extra instructions"
                    placeholder="Optional: e.g. mention I can start in June"
                    onChange={(e) => vm.setInstructions(e.target.value)}
                  />
                  <Button onClick={vm.generate} disabled={vm.isGenerating || !vm.aiConfigured}>
                    {vm.isGenerating ? <Loader2 className="animate-spin" /> : <PenLine />}
                    {vm.isGenerating ? "Writing…" : "Write letter"}
                  </Button>
                </div>
                {vm.highlightOptions.length > 0 && (
                  <details className="text-sm" open={vm.highlights.length > 0}>
                    <summary className="cursor-pointer font-medium">
                      Pick what to highlight
                      <span className="text-muted-foreground font-normal">
                        {vm.highlights.length > 0
                          ? ` · ${vm.highlights.length} chosen`
                          : " (optional)"}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-muted-foreground text-xs">
                        The letter is built around what you tick. Leave it empty to let the AI
                        choose.
                      </p>
                      {vm.highlightOptions.map((group) => (
                        <fieldset key={group.group} className="space-y-1.5">
                          <legend className="text-muted-foreground mb-1 text-xs font-medium">
                            {group.group}
                          </legend>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((item) => {
                              const on = vm.highlights.includes(item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => vm.toggleHighlight(item)}
                                  className={cn(
                                    "rounded-full border px-2.5 py-1 text-xs",
                                    on
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "hover:bg-accent",
                                  )}
                                >
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>

            {vm.letter && vm.form ? (
              <LetterEditorView
                letters={vm.letters}
                letter={vm.letter}
                form={vm.form}
                isDirty={vm.isDirty}
                isSaving={vm.isSaving}
                copied={vm.copied}
                onViewVersion={vm.viewVersion}
                onEdit={vm.edit}
                onSave={vm.save}
                onDiscard={vm.discard}
                onUseVersion={vm.useVersion}
                onDeleteVersion={vm.deleteVersion}
                onCopy={vm.copyLetter}
              />
            ) : (
              <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                No cover letter yet.
              </p>
            )}
          </div>

          <div className="space-y-6">
            {vm.letter && (
              <Card>
                <CardHeader>
                  <CardTitle>How well you match</CardTitle>
                  <CardDescription>
                    The AI's view of this job. Use it to decide where to focus.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-3xl font-semibold tabular-nums">
                    {scoreLabel(vm.letter.match_score)}
                  </p>
                  {vm.letter.matches.length > 0 && (
                    <ul className="space-y-2">
                      {vm.letter.matches.map((m) => (
                        <li key={m.requirement}>
                          <span className="font-medium">{m.requirement}</span>
                          <span className="text-muted-foreground block">{m.evidence}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>The job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {safeLink && (
                  <a
                    href={safeLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary inline-flex items-center gap-1 underline"
                  >
                    Open job posting <ExternalLink className="size-3.5" />
                  </a>
                )}
                {(a.contact_name || a.contact_email) && (
                  <p>
                    Contact: {a.contact_name} {a.contact_email && `<${a.contact_email}>`}
                  </p>
                )}
                {a.job_description ? (
                  <p className="max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {a.job_description}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    No job description. Add one for a better-tailored letter.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
