import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";

import type { MappedPreview } from "./useImportViewModel";
import type { ImportPreview, Mapping } from "./types";

interface MappingStepViewProps {
  preview: ImportPreview;
  mapping: Mapping;
  mappedPreview: MappedPreview;
  missingRequired: string[];
  duplicateColumns: string[];
  canImport: boolean;
  isImporting: boolean;
  isPreviewing: boolean;
  onChangeSheet: (sheet: string) => void;
  onSetFieldColumn: (fieldKey: string, header: string | null) => void;
  onImport: () => void;
  onBack: () => void;
}

const NONE = "";

export function MappingStepView({
  preview,
  mapping,
  mappedPreview,
  missingRequired,
  duplicateColumns,
  canImport,
  isImporting,
  isPreviewing,
  onChangeSheet,
  onSetFieldColumn,
  onImport,
  onBack,
}: MappingStepViewProps) {
  const firstRow = preview.sample_rows[0] ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Match your columns</CardTitle>
          <CardDescription>
            <span className="text-foreground font-medium">{preview.filename}</span> has{" "}
            {preview.total_rows} {preview.total_rows === 1 ? "row" : "rows"}. We've guessed which
            column is which. Check them and fix any that are wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {preview.sheets.length > 1 && (
            <label className="grid max-w-xs gap-1.5 text-sm font-medium">
              Sheet
              <NativeSelect
                value={preview.sheet ?? ""}
                disabled={isPreviewing}
                onChange={(e) => onChangeSheet(e.target.value)}
              >
                {preview.sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}

          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.fields.map((field) => {
              const header = mapping[field.key] ?? NONE;
              const example = header ? firstRow[preview.headers.indexOf(header)] : "";
              const invalid =
                (field.required && !header) ||
                (header !== NONE && duplicateColumns.includes(header));
              return (
                <label key={field.key} className="grid gap-1.5 text-sm">
                  <span className="font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </span>
                  <NativeSelect
                    value={header}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => onSetFieldColumn(field.key, e.target.value || null)}
                  >
                    <option value={NONE}>Don't import</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </NativeSelect>
                  <span className="text-muted-foreground truncate text-xs">
                    {example ? `e.g. ${example}` : " "}
                  </span>
                </label>
              );
            })}
          </div>

          {(missingRequired.length > 0 || duplicateColumns.length > 0) && (
            <div role="alert" className="text-destructive space-y-1 text-sm">
              {missingRequired.length > 0 && (
                <p>Choose a column for: {missingRequired.join(", ")}.</p>
              )}
              {duplicateColumns.length > 0 && (
                <p>Each column can only be used once: {duplicateColumns.join(", ")}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {mappedPreview.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>The first rows as they'll be imported.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  {mappedPreview.fields.map((f) => (
                    <th key={f.key} className="py-2 pr-4 font-medium whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedPreview.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-56 truncate py-2 pr-4" title={cell}>
                        {cell || <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          <ArrowLeft />
          Choose another file
        </Button>
        <Button onClick={onImport} disabled={!canImport}>
          {isImporting && <Loader2 className="animate-spin" />}
          Import {preview.total_rows} {preview.total_rows === 1 ? "row" : "rows"}
        </Button>
      </div>
    </div>
  );
}
