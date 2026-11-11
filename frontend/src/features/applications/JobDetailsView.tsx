// View: edit a job's details and notes, see its status timeline, or delete it.
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDateTime } from "@/lib/dates";

import { JobFormView } from "./JobFormView";
import { STATUS_LABELS } from "./labels";
import type { JobDetailsViewModel } from "./useJobDetailsViewModel";

export function JobDetailsView(vm: JobDetailsViewModel) {
  if (!vm.values) return null;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Job details & notes</CardTitle>
          <CardDescription>Changing the status here is recorded in the timeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <JobFormView
            values={vm.values}
            problems={vm.problems}
            cvs={vm.cvs}
            onChange={vm.change}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={vm.save} disabled={!vm.isDirty || vm.isSaving}>
              Save details
            </Button>
            {vm.isDirty && (
              <Button variant="outline" onClick={vm.discard}>
                Discard
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive ml-auto"
              onClick={() => {
                if (
                  window.confirm("Delete this job and all its cover letters? This can't be undone.")
                ) {
                  vm.remove();
                }
              }}
            >
              <Trash2 />
              Delete job
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l pl-4" aria-label="Status history">
            {[...vm.history].reverse().map((entry, index) => (
              <li key={index} className="text-sm">
                <span
                  className="bg-primary absolute -left-[5px] mt-1.5 size-2.5 rounded-full"
                  aria-hidden
                />
                <p className="font-medium">
                  {entry.from_status
                    ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                    : `Added as ${STATUS_LABELS[entry.to_status]}`}
                </p>
                <p className="text-muted-foreground text-xs">{formatDateTime(entry.changed_at)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
