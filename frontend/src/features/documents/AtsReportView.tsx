// View: the ATS check that runs on every tailored CV (score, checklist and keywords).
import { CheckCircle2, CircleAlert, CircleX, ScanSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { AtsReport } from "./api";

const LEVEL = {
  good: { label: "Ready for ATS", tone: "text-success", ring: "border-success" },
  ok: { label: "Mostly ready", tone: "text-warning-foreground", ring: "border-warning-border" },
  needs_work: { label: "Needs work", tone: "text-destructive", ring: "border-destructive" },
} as const;

const ICON = {
  pass: <CheckCircle2 className="text-success size-4 shrink-0" />,
  warn: <CircleAlert className="text-warning-foreground size-4 shrink-0" />,
  fail: <CircleX className="text-destructive size-4 shrink-0" />,
};

export function AtsScore({ report }: { report: AtsReport }) {
  const level = LEVEL[report.level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", level.tone)}>
      <ScanSearch className="size-4" /> ATS {report.score}/100 · {level.label}
    </span>
  );
}

export function AtsReportView({ report }: { report: AtsReport }) {
  const level = LEVEL[report.level];
  return (
    <Card role="region" aria-label="ATS check">
      <CardHeader className="flex flex-row flex-wrap items-center gap-4">
        <div
          className={cn(
            "flex size-16 shrink-0 flex-col items-center justify-center rounded-full border-4",
            level.ring,
          )}
        >
          <span className={cn("text-xl leading-none font-extrabold", level.tone)}>
            {report.score}
          </span>
          <span className="text-muted-foreground text-[10px]">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2">
            <ScanSearch className="text-primary size-4" /> ATS check:{" "}
            <span className={level.tone}>{level.label}</span>
          </CardTitle>
          <CardDescription>
            How applicant-tracking systems will read this CV. Checked again every time you tailor or
            save it.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-2">
          {report.checks.map((check) => (
            <li key={check.id} className="flex gap-2">
              {ICON[check.status]}
              <span>
                <span className="font-semibold">{check.label}:</span>{" "}
                <span className="text-muted-foreground">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {(report.matched_keywords.length > 0 ||
          report.missing_in_profile.length > 0 ||
          report.missing_gaps.length > 0) && (
          <div className="space-y-2 border-t pt-3">
            {report.matched_keywords.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground mr-1 text-xs font-semibold">In your CV</span>
                {report.matched_keywords.map((k) => (
                  <Badge key={k} variant="success">
                    {k}
                  </Badge>
                ))}
              </p>
            )}
            {report.missing_in_profile.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground mr-1 text-xs font-semibold">
                  Add these (they're in your profile)
                </span>
                {report.missing_in_profile.map((k) => (
                  <Badge key={k} variant="warning">
                    {k}
                  </Badge>
                ))}
              </p>
            )}
            {report.missing_gaps.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground mr-1 text-xs font-semibold">
                  The job wants (only add if true)
                </span>
                {report.missing_gaps.map((k) => (
                  <Badge key={k} variant="outline">
                    {k}
                  </Badge>
                ))}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
