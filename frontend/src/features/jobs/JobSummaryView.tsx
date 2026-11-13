// View: a job's AI summary (what it is, salary, must-haves, and how well you fit).
import { Banknote, CheckCircle2, CircleAlert, MapPin, Briefcase } from "lucide-react";

import { scoreLabel } from "@/features/applications/labels";
import type { JobSummary } from "@/features/applications/types";

export function JobSummaryView({ summary }: { summary: Partial<JobSummary> }) {
  const facts = [
    { icon: Banknote, label: "Salary", value: summary.salary },
    { icon: MapPin, label: "Location", value: summary.location },
    { icon: Briefcase, label: "Type", value: summary.work_type },
  ].filter((f) => f.value);
  return (
    <div className="space-y-4 text-sm">
      {summary.summary && <p className="leading-relaxed">{summary.summary}</p>}
      {facts.length > 0 && (
        <dl className="grid gap-1.5">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <dt className="sr-only">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {summary.match_score !== undefined && summary.match_score !== null && (
        <p>
          <span className="text-muted-foreground">Your match: </span>
          <span className="font-semibold">{scoreLabel(summary.match_score)}</span>
        </p>
      )}
      {!!summary.requirements?.length && (
        <section>
          <h3 className="mb-1 font-medium">Must-haves</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {summary.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      {!!summary.nice_to_have?.length && (
        <section>
          <h3 className="mb-1 font-medium">Nice to have</h3>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
            {summary.nice_to_have.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      {!!summary.strengths?.length && (
        <section>
          <h3 className="mb-1 font-medium">Why you fit</h3>
          <ul className="space-y-0.5">
            {summary.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" /> {s}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!summary.gaps?.length && (
        <section>
          <h3 className="mb-1 font-medium">Gaps to address</h3>
          <ul className="space-y-0.5">
            {summary.gaps.map((g) => (
              <li key={g} className="flex gap-2">
                <CircleAlert className="text-warning-foreground mt-0.5 size-4 shrink-0" /> {g}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
