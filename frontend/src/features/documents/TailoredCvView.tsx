// View: the CV tailored to this job. Reworded and reordered by AI, never invented.
import {
  AlertTriangle,
  Eye,
  FileDown,
  FolderOpen,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { PreviewDialog } from "@/features/apply/PreviewDialog";

import { CV_STYLE_LABELS, tailoredCvExportUrl, type CvStyle } from "./api";
import { AtsReportView } from "./AtsReportView";
import type { TailoredCvViewModel } from "./useTailoredCvViewModel";

const lines = (text: string) => Math.min(8, Math.max(2, text.split("\n").length + 1));

/** Which uploaded CV to build from, and which layout to use. */
export function CvChoices({ vm, disabled }: { vm: TailoredCvViewModel; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium">
        Based on
        <NativeSelect
          aria-label="CV to base it on"
          disabled={disabled}
          value={vm.sourceCvId ?? ""}
          onChange={(e) => vm.setSourceCvId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">My main CV (my profile)</option>
          {vm.cvs
            .filter((cv) => !cv.is_default && cv.has_text)
            .map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.label}
              </option>
            ))}
        </NativeSelect>
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Layout
        <NativeSelect
          aria-label="CV layout"
          disabled={disabled}
          value={vm.style}
          onChange={(e) => vm.setStyle(e.target.value as CvStyle)}
        >
          {Object.entries(CV_STYLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  );
}

export function TailoredCvView(vm: TailoredCvViewModel) {
  const [previewing, setPreviewing] = useState(false);
  if (vm.isLoading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    );
  }
  const { cv, form } = vm;

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            {cv ? "Tailored CV" : "Tailor your CV to this job"}
          </CardTitle>
          <CardDescription>
            The AI rewrites your summary and bullet points and puts the most relevant skills,
            experience and projects first, and keeps it to one page. It only uses what's in your
            profile: it never adds jobs, skills or results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!vm.aiConfigured && (
            <p className="text-sm">
              AI isn't set up yet.{" "}
              <Link to="/settings" className="text-primary underline">
                Add your Gemini key in Settings
              </Link>
              .
            </p>
          )}
          {vm.error && (
            <p role="alert" className="text-destructive text-sm">
              {vm.error}
            </p>
          )}
          <div className="max-w-xl">
            <CvChoices vm={vm} disabled={vm.isTailoring || vm.isSaving} />
          </div>
          {cv && cv.pages > 1 && (
            <p role="alert" className="text-warning-foreground text-sm font-medium">
              This CV runs to {cv.pages} pages. Shorten or remove a few bullet points to get it back
              to one.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={vm.tailor} disabled={vm.isTailoring || !vm.aiConfigured}>
              {vm.isTailoring ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {vm.isTailoring ? "Tailoring…" : cv ? "Tailor again" : "Tailor my CV"}
            </Button>
            {cv && (
              <>
                <Button variant="outline" onClick={() => setPreviewing(true)}>
                  <Eye /> Preview
                </Button>
                <Button variant="outline" asChild>
                  <a href={tailoredCvExportUrl(vm.applicationId, "pdf")} download>
                    <FileDown /> PDF
                  </a>
                </Button>
                <Button variant="outline" onClick={vm.saveToFolder}>
                  <Save /> Save to folder
                </Button>
                <Button variant="ghost" onClick={vm.openFolder}>
                  <FolderOpen /> Open folder
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {cv && form && (
        <>
          {cv.ats && <AtsReportView report={cv.ats} />}
          {(cv.changes.length > 0 || cv.flags.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {cv.changes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">What changed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {cv.changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {cv.flags.length > 0 && (
                <div
                  role="alert"
                  className="border-warning-border bg-warning text-warning-foreground rounded-xl border px-4 py-3 text-sm"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="size-4" /> Check these before sending
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-6">
                    {cv.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Edit</CardTitle>
              <CardDescription>
                {cv.model_used}
                {cv.edited && " · edited by you"} · one bullet point per line
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <label className="grid gap-1.5">
                <span className="font-medium">Profile summary</span>
                <span className="text-muted-foreground text-xs">
                  Shown only if your main CV has a Profile section and the layout follows it. Jake's
                  Resume has no profile paragraph.
                </span>
                <Textarea
                  rows={4}
                  value={form.summary}
                  onChange={(e) => vm.edit({ summary: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="font-medium">Skills (most relevant first, comma separated)</span>
                <Input
                  value={form.skills.join(", ")}
                  onChange={(e) =>
                    vm.edit({
                      skills: e.target.value
                        .split(",")
                        .map((s) => s.trimStart())
                        .filter((s, i, all) => s || i === all.length - 1),
                    })
                  }
                />
              </label>

              {form.experience.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-medium">Experience</h3>
                  {form.experience.map((e, i) => (
                    <label key={`${e.title}-${e.company}-${i}`} className="grid gap-1.5">
                      <span>
                        <span className="font-medium">{e.title}</span>
                        <span className="text-muted-foreground">
                          {e.company && ` · ${e.company}`}
                          {(e.start || e.end) &&
                            ` · ${[e.start, e.end].filter(Boolean).join(" – ")}`}
                        </span>
                      </span>
                      <Textarea
                        rows={lines(e.summary)}
                        value={e.summary}
                        onChange={(ev) => vm.editExperience(i, ev.target.value)}
                      />
                    </label>
                  ))}
                </section>
              )}

              {form.projects.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-medium">Projects</h3>
                  {form.projects.map((p, i) => (
                    <label key={`${p.name}-${i}`} className="grid gap-1.5">
                      <span className="font-medium">{p.name}</span>
                      <Textarea
                        rows={lines(p.summary)}
                        value={p.summary}
                        onChange={(ev) => vm.editProject(i, ev.target.value)}
                      />
                    </label>
                  ))}
                </section>
              )}

              {form.education.length > 0 && (
                <p className="text-muted-foreground">
                  Education is copied from your profile as it is:{" "}
                  {form.education.map((e) => e.qualification).join(", ")}.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {vm.isDirty && (
                  <>
                    <Button onClick={vm.save} disabled={vm.isSaving}>
                      {vm.isSaving && <Loader2 className="animate-spin" />}
                      Save changes
                    </Button>
                    <Button variant="outline" onClick={vm.discard} disabled={vm.isSaving}>
                      Discard
                    </Button>
                  </>
                )}
                <Button variant="ghost" className="ml-auto" onClick={vm.remove}>
                  <Trash2 /> Delete tailored CV
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {previewing && form && (
        <PreviewDialog
          title="CV preview"
          kind="cv"
          content={form}
          style={vm.style}
          onClose={() => setPreviewing(false)}
        />
      )}
    </div>
  );
}
