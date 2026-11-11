import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import { isJobActive, jobPercent } from "./labels";
import type { LetterJob } from "./types";

interface BulkJobViewProps {
  job: LetterJob;
  onCancel: () => void;
  onDismiss: () => void;
}

export function BulkJobView({ job, onCancel, onDismiss }: BulkJobViewProps) {
  const active = isJobActive(job);
  const percent = jobPercent(job);

  return (
    <div role="status" className="bg-card space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          {active ? (
            <Loader2 className="text-primary size-4 animate-spin" />
          ) : job.status === "done" ? (
            <CheckCircle2 className="text-success size-4" />
          ) : (
            <XCircle className="text-destructive size-4" />
          )}
          {active
            ? `Writing cover letters… ${job.processed} of ${job.total}`
            : job.status === "done"
              ? `Finished: ${job.succeeded.length} written`
              : job.status === "cancelled"
                ? `Cancelled after ${job.processed} of ${job.total}`
                : "Stopped"}
          {job.skipped.length > 0 && `, ${job.skipped.length} skipped (already had a letter)`}
        </p>
        {active ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss}>
            <X />
          </Button>
        )}
      </div>

      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bg-primary h-full transition-all" style={{ width: `${percent}%` }} />
      </div>

      {active && job.current && <p className="text-muted-foreground text-sm">Now: {job.current}</p>}
      {job.message && <p className="text-sm">{job.message}</p>}
      {active && (
        <p className="text-muted-foreground text-xs">
          Letters are written one at a time with a short pause between each, to stay inside the free
          AI limits. You can leave this page; it carries on in the background.
        </p>
      )}
      {job.failed.length > 0 && (
        <ul className="text-destructive space-y-1 text-sm">
          {job.failed.map((f) => (
            <li key={f.application_id}>
              {f.company || `Application ${f.application_id}`}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
