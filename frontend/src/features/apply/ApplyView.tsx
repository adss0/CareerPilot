// View: apply for one job. Build the tailored CV and cover letter with AI, preview them,
// download or save them, then open the employer's site with your details ready to copy.
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  FileDown,
  FolderOpen,
  Loader2,
  PenLine,
  Save,
  Send,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { STATUS_LABELS, TONE_LABELS, statusVariant } from "@/features/applications/labels";
import type { Tone } from "@/features/applications/types";
import { tailoredCvExportUrl } from "@/features/documents/api";
import { jobLink } from "@/features/tracker/jobLink";
import { cn } from "@/lib/utils";

import { PdfPreview } from "./PdfPreview";
import type { ApplyViewModel } from "./useApplyViewModel";

function Step({
  number,
  title,
  done,
  description,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs",
              done ? "bg-success text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {done ? <CheckCircle2 className="size-4" /> : number}
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (label: string, text: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 border-t py-1.5 first:border-t-0">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onCopy(label, value)}
        aria-label={`Copy ${label}`}
      >
        <Copy />
      </Button>
    </div>
  );
}

export function ApplyView(vm: ApplyViewModel) {
  const { letters, cv, profile } = vm;
  const job = letters.application;
  if (letters.isLoading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (!job) {
    return (
      <div className="space-y-3">
        <p>This job wasn't found. It may have been removed from your tracker.</p>
        <Button variant="outline" asChild>
          <Link to="/applications">Back to applications</Link>
        </Button>
      </div>
    );
  }

  const letter = letters.letters.find((l) => l.is_selected) ?? letters.letters[0] ?? null;
  const ready = Boolean(cv.cv && letter);
  const applied = !["imported", "drafted", "ready"].includes(job.status);
  const busy = vm.isBuildingBoth || cv.isTailoring || letters.isGenerating;
  const hasLink = /^https?:\/\//i.test(job.job_url);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link
          to="/applications"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-4" /> Applications
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Apply: {job.role}</h1>
          <Badge variant={statusVariant(job.status)}>{STATUS_LABELS[job.status]}</Badge>
        </div>
        <p className="text-muted-foreground">
          {job.company}
          {job.location && ` · ${job.location}`}
          {job.salary && ` · ${job.salary}`}
        </p>
      </div>

      {!letters.aiConfigured && (
        <p className="border-warning-border bg-warning text-warning-foreground rounded-lg border px-4 py-3 text-sm">
          AI isn't set up yet.{" "}
          <Link to="/settings" className="underline">
            Add your Gemini key in Settings
          </Link>{" "}
          to build your CV and cover letter.
        </p>
      )}
      {!job.job_description.trim() && (
        <p className="text-muted-foreground text-sm">
          Tip: this job has no description, so the CV and letter can only be general.{" "}
          <Link to={`/applications/${job.id}`} className="text-primary underline">
            Paste the job ad
          </Link>{" "}
          for a much better match.
        </p>
      )}

      <Step
        number={1}
        title="Build your CV and cover letter"
        done={ready}
        description="Gemini tailors both to this job using only facts from your profile."
      >
        {!ready && (
          <Button onClick={vm.buildBoth} disabled={busy || !letters.aiConfigured}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Building…" : "Build both with Gemini"}
          </Button>
        )}
        {(cv.error || letters.error) && (
          <p role="alert" className="text-destructive">
            {cv.error ?? letters.error}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center justify-between font-medium">
              Tailored CV
              {cv.cv ? (
                <Badge variant="success">Ready</Badge>
              ) : (
                <Badge variant="outline">Not built</Badge>
              )}
            </p>
            {cv.cv?.changes.length ? (
              <ul className="text-muted-foreground list-disc pl-5 text-xs">
                {cv.cv.changes.slice(0, 3).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={cv.tailor}
                disabled={busy || !letters.aiConfigured}
              >
                {cv.isTailoring ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {cv.cv ? "Rebuild" : "Build CV"}
              </Button>
              {cv.cv && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/applications/${job.id}?tab=cv`}>
                    <PenLine /> Edit
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center justify-between font-medium">
              Cover letter
              {letter ? (
                <Badge variant="success">
                  <Star className="fill-current" /> v{letter.version}
                </Badge>
              ) : (
                <Badge variant="outline">Not written</Badge>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="w-36">
                <NativeSelect
                  aria-label="Tone"
                  value={letters.tone}
                  onChange={(e) => letters.setTone(e.target.value as Tone)}
                >
                  {Object.entries(TONE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} tone
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={letters.generate}
                disabled={busy || !letters.aiConfigured}
              >
                {letters.isGenerating ? <Loader2 className="animate-spin" /> : <PenLine />}
                {letter ? "Write again" : "Write letter"}
              </Button>
              {letter && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/applications/${job.id}?tab=letter`}>
                    <PenLine /> Edit
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Step>

      <Step
        number={2}
        title="Check what you're sending"
        done={false}
        description="This is exactly the file you'll upload."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant={vm.preview === "cv" ? "default" : "outline"}
            disabled={!cv.cv}
            onClick={() => vm.setPreview(vm.preview === "cv" ? null : "cv")}
          >
            <Eye /> Preview CV
          </Button>
          <Button
            variant={vm.preview === "letter" ? "default" : "outline"}
            disabled={!letter}
            onClick={() => vm.setPreview(vm.preview === "letter" ? null : "letter")}
          >
            <Eye /> Preview cover letter
          </Button>
        </div>
        {vm.preview === "cv" && cv.cv && (
          <PdfPreview
            title="Tailored CV preview"
            url={vm.cvPdfUrl}
            version={cv.cv.updated_at ?? cv.cv.created_at}
          />
        )}
        {vm.preview === "letter" && letter && vm.letterPdfUrl && (
          <PdfPreview
            title="Cover letter preview"
            url={vm.letterPdfUrl}
            version={`${letter.id}-${letter.updated_at ?? letter.created_at}`}
          />
        )}
      </Step>

      <Step number={3} title="Download or save" done={false}>
        <div className="flex flex-wrap gap-2">
          {!cv.cv && !letter && (
            <p className="text-muted-foreground">Build your CV and cover letter first.</p>
          )}
          {cv.cv && (
            <>
              <Button variant="outline" asChild>
                <a href={tailoredCvExportUrl(job.id, "pdf")} download>
                  <FileDown /> CV (PDF)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={tailoredCvExportUrl(job.id, "docx")} download>
                  <FileDown /> CV (Word)
                </a>
              </Button>
            </>
          )}
          {letter && (
            <>
              <Button variant="outline" asChild>
                <a href={`${vm.letterPdfUrl}`} download>
                  <FileDown /> Letter (PDF)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={vm.letterPdfUrl!.replace("format=pdf", "format=docx")} download>
                  <FileDown /> Letter (Word)
                </a>
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={vm.saveToFolder} disabled={vm.isSaving || (!cv.cv && !letter)}>
            {vm.isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Save to my documents folder
          </Button>
          <Button variant="outline" onClick={vm.useAsMainCv} disabled={!cv.cv}>
            <Star /> Use as my main CV
          </Button>
          <Button variant="ghost" onClick={vm.openFolder}>
            <FolderOpen /> Open folder
          </Button>
        </div>
      </Step>

      <Step
        number={4}
        title="Apply on the employer's site"
        done={applied}
        description={
          <>
            Opens the job in your browser. Websites don't let other apps type into their forms, so
            your details are below with copy buttons: one click each.
          </>
        }
      >
        <Button asChild size="lg">
          <a href={jobLink(job)} target="_blank" rel="noreferrer noopener">
            <Send /> {hasLink ? "Open the application page" : "Search for this job"}
          </a>
        </Button>
        {!hasLink && (
          <p className="text-muted-foreground text-xs">
            This job has no link, so this opens a web search for it.
          </p>
        )}
        <div className="rounded-lg border px-3 py-1">
          <CopyRow label="Full name" value={profile?.full_name ?? ""} onCopy={vm.copy} />
          <CopyRow label="Email" value={profile?.email ?? ""} onCopy={vm.copy} />
          <CopyRow label="Phone" value={profile?.phone ?? ""} onCopy={vm.copy} />
          <CopyRow label="Location" value={profile?.location ?? ""} onCopy={vm.copy} />
          <CopyRow label="LinkedIn" value={profile?.linkedin_url ?? ""} onCopy={vm.copy} />
          <CopyRow label="GitHub" value={profile?.github_url ?? ""} onCopy={vm.copy} />
          <CopyRow label="Portfolio" value={profile?.portfolio_url ?? ""} onCopy={vm.copy} />
          {profile?.education[0] && (
            <CopyRow
              label="Degree"
              value={[profile.education[0].qualification, profile.education[0].institution]
                .filter(Boolean)
                .join(", ")}
              onCopy={vm.copy}
            />
          )}
          {letter && <CopyRow label="Cover letter" value={letter.content} onCopy={vm.copy} />}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {applied ? (
            <p className="text-success flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4" /> Marked as applied
            </p>
          ) : (
            <Button variant="outline" onClick={vm.markApplied} disabled={vm.isMarking}>
              <CheckCircle2 /> I've applied
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/applications">Back to tracker</Link>
          </Button>
        </div>
      </Step>
    </div>
  );
}
