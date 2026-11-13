// View: the "Stages" cell of the sheet. Each hiring stage is a small chip
// (green ✓ passed, red ✗ failed, amber upcoming with its date); + adds one.
// Clicking a chip opens a small editor: kind, date, result and a note.
import { Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { STAGE_LABELS, STAGE_SHORT } from "@/features/applications/labels";
import type { Stage, StageKind, StageResult } from "@/features/applications/types";
import { cn } from "@/lib/utils";

const RESULTS: [StageResult, string][] = [
  ["upcoming", "Upcoming"],
  ["passed", "Passed"],
  ["failed", "Didn't pass"],
];

/** The kind most people have next, given what's already there. */
function nextKind(stages: Stage[]): StageKind {
  const order: StageKind[] = ["online_test", "video", "assessment_centre", "final"];
  return order.find((kind) => !stages.some((s) => s.kind === kind)) ?? "other";
}

function shortDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stageName(stage: Stage): string {
  return stage.kind === "other" && stage.note.trim() ? stage.note.trim() : STAGE_LABELS[stage.kind];
}

function chipTone(result: StageResult): string {
  if (result === "passed") return "border-success/30 bg-success/12 text-success";
  if (result === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning-border bg-warning text-warning-foreground";
}

const EDITOR_WIDTH = 288; // w-72
const EDITOR_HEIGHT = 230;

/** Where to show the editor: under the cell, or above it near the bottom of the window. It's
 * positioned on the window, so the sheet's horizontal scrolling can't cut it off. */
function editorPosition(anchor: DOMRect): { top: number; left: number } {
  const below = window.innerHeight - anchor.bottom > EDITOR_HEIGHT + 8;
  return {
    top: below ? anchor.bottom + 4 : Math.max(8, anchor.top - EDITOR_HEIGHT - 4),
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - EDITOR_WIDTH - 8)),
  };
}

function StageEditor({
  initial,
  isNew,
  label,
  anchor,
  onSave,
  onRemove,
  onClose,
}: {
  initial: Stage;
  isNew: boolean;
  label: string;
  anchor: DOMRect | null;
  onSave: (stage: Stage) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true); // it's fixed: close rather than drift
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={anchor ? editorPosition(anchor) : undefined}
      className={cn(
        "bg-card shadow-lift z-50 w-72 space-y-2 rounded-xl border p-3 text-sm",
        anchor ? "fixed" : "absolute top-full left-0 mt-1",
      )}
    >
      <NativeSelect
        aria-label="Stage"
        value={stage.kind}
        onChange={(e) => setStage({ ...stage, kind: e.target.value as StageKind })}
      >
        {Object.entries(STAGE_LABELS).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </NativeSelect>
      {stage.kind === "other" && (
        <Input
          aria-label="Stage name"
          placeholder="e.g. Case study"
          maxLength={100}
          value={stage.note}
          onChange={(e) => setStage({ ...stage, note: e.target.value })}
        />
      )}
      <Input
        type="date"
        aria-label="Stage date"
        value={stage.date ?? ""}
        onChange={(e) => setStage({ ...stage, date: e.target.value || null })}
      />
      <div role="radiogroup" aria-label="Result" className="bg-muted flex rounded-lg p-0.5">
        {RESULTS.map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={stage.result === value}
            onClick={() => setStage({ ...stage, result: value })}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-semibold",
              stage.result === value ? "bg-card shadow-xs" : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave(stage)}>
          <Check /> {isNew ? "Add" : "Save"}
        </Button>
        {!isNew && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose} aria-label="Cancel">
          <X />
        </Button>
      </div>
    </div>
  );
}

export function StagesCell({
  stages,
  label,
  onChange,
}: {
  stages: Stage[];
  label: string; // "Acme Ltd – Developer", for screen readers
  onChange: (stages: Stage[]) => void;
}) {
  // null = closed, -1 = adding a new stage, otherwise the index being edited
  const [editing, setEditing] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const open = (index: number, target: HTMLElement) => {
    setAnchor(target.getBoundingClientRect());
    setEditing(index);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      {stages.map((stage, index) => (
        <button
          key={`${stage.kind}-${index}`}
          type="button"
          onClick={(e) => open(index, e.currentTarget)}
          title={`${stageName(stage)}${stage.date ? ` · ${shortDate(stage.date)}` : ""}`}
          aria-label={`${stageName(stage)}, ${stage.result}${stage.date ? `, ${shortDate(stage.date)}` : ""}. Edit`}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
            chipTone(stage.result),
          )}
        >
          {stage.kind === "other" && stage.note.trim()
            ? stage.note.trim().slice(0, 12)
            : STAGE_SHORT[stage.kind]}
          {stage.result === "passed" && " ✓"}
          {stage.result === "failed" && " ✗"}
          {stage.result === "upcoming" && stage.date && ` ${shortDate(stage.date)}`}
        </button>
      ))}
      <button
        type="button"
        onClick={(e) => open(-1, e.currentTarget)}
        aria-label={`Add a stage for ${label}`}
        title="Add a stage"
        className="text-muted-foreground hover:border-primary hover:text-primary inline-flex size-6 items-center justify-center rounded-full border border-dashed"
      >
        <Plus className="size-3.5" />
      </button>
      {editing !== null && (
        <StageEditor
          key={editing}
          isNew={editing === -1}
          anchor={anchor}
          label={editing === -1 ? `Add a stage for ${label}` : `Edit stage for ${label}`}
          initial={
            editing === -1
              ? { kind: nextKind(stages), date: null, result: "upcoming", note: "" }
              : stages[editing]
          }
          onClose={close}
          onSave={(stage) => {
            onChange(
              editing === -1
                ? [...stages, stage]
                : stages.map((s, i) => (i === editing ? stage : s)),
            );
            close();
          }}
          onRemove={() => {
            onChange(stages.filter((_, i) => i !== editing));
            close();
          }}
        />
      )}
    </div>
  );
}
