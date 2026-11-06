// Model: talks to the backend's import/export endpoints.
import { API_BASE, apiPostForm } from "@/lib/apiClient";

import type { ImportPreview, ImportResult, Mapping } from "./types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export const templateUrl = `${API_BASE}/imports/template`;
export const exportUrl = `${API_BASE}/applications/export`;

export function previewImport(file: File, sheet: string | null): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  if (sheet) form.append("sheet", sheet);
  return apiPostForm<ImportPreview>("/imports/preview", form);
}

export function commitImport(
  file: File,
  sheet: string | null,
  mapping: Mapping,
): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("mapping", JSON.stringify(mapping));
  if (sheet) form.append("sheet", sheet);
  return apiPostForm<ImportResult>("/imports/commit", form);
}
