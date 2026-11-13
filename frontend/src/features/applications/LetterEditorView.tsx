import { AlertTriangle, Check, Copy, Eye, FileDown, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { PreviewDialog } from "@/features/apply/PreviewDialog";

import { letterExportUrl } from "./api";
import { TONE_LABELS } from "./labels";
import type { Letter } from "./types";
import type { LetterDraft } from "./useApplicationDetailViewModel";

interface LetterEditorViewProps {
  letters: Letter[];
  letter: Letter;
  form: LetterDraft;
  isDirty: boolean;
  isSaving: boolean;
  copied: boolean;
  onViewVersion: (id: number) => void;
  onEdit: (changes: Partial<LetterDraft>) => void;
  onSave: () => void;
  onDiscard: () => void;
  onUseVersion: () => void;
  onDeleteVersion: () => void;
  onCopy: () => void;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function LetterEditorView({
  letters,
  letter,
  form,
  isDirty,
  isSaving,
  copied,
  onViewVersion,
  onEdit,
  onSave,
  onDiscard,
  onUseVersion,
  onDeleteVersion,
  onCopy,
}: LetterEditorViewProps) {
  const [previewing, setPreviewing] = useState(false);
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Cover letter</CardTitle>
          <div role="tablist" aria-label="Letter versions" className="flex flex-wrap gap-1">
            {letters.map((l) => (
              <button
                key={l.id}
                role="tab"
                type="button"
                aria-selected={l.id === letter.id}
                onClick={() => {
                  if (!isDirty || window.confirm("Discard your unsaved edits?"))
                    onViewVersion(l.id);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium",
                  l.id === letter.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent",
                )}
              >
                {l.is_selected && <Star className="size-3 fill-current" />}v{l.version}
              </button>
            ))}
          </div>
        </div>
        <CardDescription>
          {TONE_LABELS[letter.tone]} tone · {letter.model_used}
          {letter.edited && " · edited by you"}
          {letter.is_selected ? " · this version will be sent" : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {letter.flags.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-warning-border bg-warning text-warning-foreground px-4 py-3 text-sm"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              Check these before sending
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-6">
              {letter.flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="flex items-center justify-between font-medium">
            Letter
            <span className="text-muted-foreground text-xs font-normal">
              {wordCount(form.content)} words
            </span>
          </span>
          <Textarea
            rows={18}
            value={form.content}
            onChange={(e) => onEdit({ content: e.target.value })}
            className="font-[inherit] leading-relaxed"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email subject</span>
          <Input
            value={form.email_subject}
            onChange={(e) => onEdit({ email_subject: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email message</span>
          <Textarea
            rows={4}
            value={form.email_body}
            onChange={(e) => onEdit({ email_body: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <>
              <Button onClick={onSave} disabled={isSaving}>
                Save changes
              </Button>
              <Button variant="outline" onClick={onDiscard} disabled={isSaving}>
                Discard
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreviewing(true)}>
                <Eye /> Preview
              </Button>
              <Button variant="outline" onClick={onCopy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy letter"}
              </Button>
              <Button variant="outline" asChild>
                <a href={letterExportUrl(letter.id, "pdf")} download>
                  <FileDown />
                  PDF
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={letterExportUrl(letter.id, "docx")} download>
                  <FileDown />
                  Word
                </a>
              </Button>
              {!letter.is_selected && (
                <Button variant="outline" onClick={onUseVersion} disabled={isSaving}>
                  <Star />
                  Use this version
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive ml-auto"
                onClick={() => {
                  if (window.confirm(`Delete version ${letter.version}?`)) onDeleteVersion();
                }}
              >
                <Trash2 />
                Delete version
              </Button>
            </>
          )}
        </div>
        {letter.is_selected === false && !isDirty && (
          <p className="text-muted-foreground text-xs">
            <Badge variant="outline">Note</Badge> Exports and emails use the starred version.
          </p>
        )}
      </CardContent>
      {previewing && (
        <PreviewDialog
          title="Cover letter preview"
          kind="letter"
          content={form.content}
          onClose={() => setPreviewing(false)}
        />
      )}
    </Card>
  );
}
