// Remembers the user's column choices so the same spreadsheet layout maps itself next time.
// Stored only in this browser; it holds column names, never spreadsheet contents.
import type { Mapping } from "./types";

const STORAGE_KEY = "careerpilot.importMappings";
const MAX_SAVED = 20;

function layoutKey(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join("|");
}

function readAll(): Record<string, Mapping> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Saved choices win over suggestions, but only for columns that still exist. */
export function mergeMapping(
  suggested: Mapping,
  saved: Mapping | undefined,
  headers: string[],
): Mapping {
  if (!saved) return { ...suggested };
  const merged: Mapping = { ...suggested };
  for (const key of Object.keys(suggested)) {
    if (!(key in saved)) continue;
    const header = saved[key];
    if (header === null || headers.includes(header)) merged[key] = header;
  }
  return merged;
}

export function loadMapping(headers: string[], suggested: Mapping): Mapping {
  return mergeMapping(suggested, readAll()[layoutKey(headers)], headers);
}

export function saveMapping(headers: string[], mapping: Mapping): void {
  try {
    const all = readAll();
    delete all[layoutKey(headers)];
    const entries = [...Object.entries(all), [layoutKey(headers), mapping] as const];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries.slice(-MAX_SAVED))),
    );
  } catch {
    // Storage unavailable (private window etc.): the import still works.
  }
}
