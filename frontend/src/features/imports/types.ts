// Mirrors backend/app/schemas/imports.py
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
}

export type Mapping = Record<string, string | null>;

export interface ImportPreview {
  filename: string;
  sheets: string[];
  sheet: string | null;
  headers: string[];
  sample_rows: string[][];
  total_rows: number;
  fields: ImportField[];
  suggested_mapping: Mapping;
}

export interface ImportIssue {
  row: number;
  kind: "invalid" | "duplicate" | "warning";
  message: string;
  company: string;
  role: string;
}

export interface ImportResult {
  batch_id: number;
  filename: string;
  rows_total: number;
  imported: number;
  duplicates: number;
  invalid: number;
  empty: number;
  warnings: number;
  issues: ImportIssue[];
}

export type ImportStep = "upload" | "map" | "result";
