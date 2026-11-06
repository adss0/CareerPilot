import type { ImportIssue } from "./types";

const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number): string {
  let text = String(value);
  // Stop spreadsheet apps from running cell text as a formula.
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildIssuesCsv(issues: ImportIssue[]): string {
  const rows: (string | number)[][] = [
    ["Row", "Type", "Company", "Role", "Problem"],
    ...issues.map((i) => [i.row, i.kind, i.company, i.role, i.message]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/csv"): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
