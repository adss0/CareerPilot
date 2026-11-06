import { CheckCircle2, Download, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ImportIssue, ImportResult } from "./types";

interface ResultStepViewProps {
  result: ImportResult;
  onDownloadIssues: () => void;
  onImportAnother: () => void;
}

const issueBadge: Record<
  ImportIssue["kind"],
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  duplicate: { label: "Duplicate", variant: "secondary" },
  invalid: { label: "Skipped", variant: "destructive" },
  warning: { label: "Fixed", variant: "outline" },
};

export function ResultStepView({ result, onDownloadIssues, onImportAnother }: ResultStepViewProps) {
  const stats = [
    { label: "Imported", value: result.imported },
    { label: "Duplicates skipped", value: result.duplicates },
    { label: "Invalid rows skipped", value: result.invalid },
    { label: "Values fixed", value: result.warnings },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-success size-5" />
            Import finished
          </CardTitle>
          <CardDescription>
            {result.imported} of {result.rows_total} rows from{" "}
            <span className="text-foreground font-medium">{result.filename}</span> were added to
            your tracker.
            {result.empty > 0 && ` ${result.empty} empty rows were ignored.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-muted rounded-lg p-3">
                <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                <dd className="text-2xl font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {result.issues.length > 0 && (
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1.5">
              <CardTitle>Rows that need a look</CardTitle>
              <CardDescription>
                Fix these in your spreadsheet and import it again. Rows already imported won't be
                added twice.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onDownloadIssues}>
              <Download />
              Download as CSV
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Row</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 font-medium">Problem</th>
                </tr>
              </thead>
              <tbody>
                {result.issues.map((issue, i) => (
                  <tr key={`${issue.row}-${i}`} className="border-b align-top last:border-0">
                    <td className="py-2 pr-4 tabular-nums">{issue.row}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={issueBadge[issue.kind].variant}>
                        {issueBadge[issue.kind].label}
                      </Badge>
                    </td>
                    <td className="max-w-40 truncate py-2 pr-4">{issue.company || "-"}</td>
                    <td className="max-w-40 truncate py-2 pr-4">{issue.role || "-"}</td>
                    <td className="py-2">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Button onClick={onImportAnother}>
        <RotateCcw />
        Import another file
      </Button>
    </div>
  );
}
