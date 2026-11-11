import { STATUS_LABELS } from "./labels";
import type { Application, ApplicationStatus } from "./types";

export const COLUMNS = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export function groupByStatus(items: Application[]): Record<ApplicationStatus, Application[]> {
  const groups = Object.fromEntries(COLUMNS.map((s) => [s, [] as Application[]])) as Record<
    ApplicationStatus,
    Application[]
  >;
  for (const item of items) groups[item.status].push(item);
  return groups;
}
