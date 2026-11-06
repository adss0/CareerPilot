// ViewModel: all state and actions for the import wizard (upload → map columns → result).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { errorText } from "@/lib/apiClient";

import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES, commitImport, previewImport } from "./api";
import { buildIssuesCsv, downloadText } from "./issuesCsv";
import { loadMapping, saveMapping } from "./mappingMemory";
import type { ImportField, ImportPreview, ImportResult, ImportStep, Mapping } from "./types";

export interface MappedPreview {
  fields: ImportField[];
  rows: string[][];
}

export interface ImportViewModel {
  step: ImportStep;
  fileName: string | null;
  preview: ImportPreview | null;
  mapping: Mapping;
  result: ImportResult | null;
  error: string | null;
  isPreviewing: boolean;
  isImporting: boolean;
  missingRequired: string[];
  duplicateColumns: string[];
  canImport: boolean;
  mappedPreview: MappedPreview;
  selectFile: (file: File) => void;
  changeSheet: (sheet: string) => void;
  setFieldColumn: (fieldKey: string, header: string | null) => void;
  startImport: () => void;
  reset: () => void;
  downloadIssues: () => void;
}

export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Choose a .xlsx, .xls or .csv file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "The file is over 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

export function useImportViewModel(): ImportViewModel {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: ({ file, sheet }: { file: File; sheet: string | null }) =>
      previewImport(file, sheet),
    onSuccess: (data) => {
      setPreview(data);
      setMapping(loadMapping(data.headers, data.suggested_mapping));
      setError(null);
    },
    onError: (e) => setError(errorText(e)),
  });

  const commitMutation = useMutation({
    mutationFn: () => commitImport(file!, preview!.sheet, mapping),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      saveMapping(preview!.headers, mapping);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => setError(errorText(e)),
  });

  const fields = useMemo(() => preview?.fields ?? [], [preview]);

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);

  const duplicateColumns = useMemo(() => {
    const chosen = Object.values(mapping).filter((h): h is string => Boolean(h));
    return [...new Set(chosen.filter((h, i) => chosen.indexOf(h) !== i))];
  }, [mapping]);

  const mappedPreview = useMemo<MappedPreview>(() => {
    if (!preview) return { fields: [], rows: [] };
    const mapped = fields.filter((f) => mapping[f.key]);
    return {
      fields: mapped,
      rows: preview.sample_rows
        .slice(0, 5)
        .map((row) => mapped.map((f) => row[preview.headers.indexOf(mapping[f.key]!)] ?? "")),
    };
  }, [preview, fields, mapping]);

  const step: ImportStep = result ? "result" : preview ? "map" : "upload";

  return {
    step,
    fileName: file?.name ?? null,
    preview,
    mapping,
    result,
    error,
    isPreviewing: previewMutation.isPending,
    isImporting: commitMutation.isPending,
    missingRequired,
    duplicateColumns,
    canImport:
      missingRequired.length === 0 && duplicateColumns.length === 0 && !commitMutation.isPending,
    mappedPreview,
    selectFile: (selected) => {
      const problem = validateFile(selected);
      if (problem) {
        setError(problem);
        return;
      }
      setFile(selected);
      setPreview(null);
      setResult(null);
      previewMutation.mutate({ file: selected, sheet: null });
    },
    changeSheet: (sheet) => {
      if (file) previewMutation.mutate({ file, sheet });
    },
    setFieldColumn: (fieldKey, header) => setMapping((m) => ({ ...m, [fieldKey]: header })),
    startImport: () => {
      if (file && preview) commitMutation.mutate();
    },
    reset: () => {
      setFile(null);
      setPreview(null);
      setMapping({});
      setResult(null);
      setError(null);
    },
    downloadIssues: () => {
      if (result?.issues.length) {
        downloadText(`import-issues-${result.batch_id}.csv`, buildIssuesCsv(result.issues));
      }
    },
  };
}
