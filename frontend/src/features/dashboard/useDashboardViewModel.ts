// ViewModel: dashboard tiles, charts and follow-ups.
import { useQuery } from "@tanstack/react-query";

import { STATUS_LABELS } from "@/features/applications/labels";
import type { ApplicationStatus } from "@/features/applications/types";
import { errorText } from "@/lib/apiClient";

import { fetchStats, type Stats } from "./api";

export interface DashboardStat {
  label: string;
  value: string;
  hint: string;
}

export interface DashboardViewModel {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  stats: DashboardStat[];
  statusChart: { status: ApplicationStatus; label: string; count: number }[];
  weeklyChart: { week: string; count: number }[];
  followUps: Stats["follow_ups_due"];
}

const percent = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);

export function buildDashboard(stats: Stats): Omit<DashboardViewModel, "isLoading" | "error"> {
  return {
    isEmpty: stats.total === 0,
    stats: [
      {
        label: "Applications",
        value: String(stats.total),
        hint: `${stats.added_this_week} added this week`,
      },
      { label: "Sent", value: String(stats.sent), hint: "Sent or further along" },
      { label: "Interviews", value: String(stats.interviews), hint: "Interviews and offers" },
      {
        label: "Response rate",
        value: percent(stats.response_rate),
        hint: stats.sent ? `${stats.responses} of ${stats.sent} heard back` : "Nothing sent yet",
      },
    ],
    statusChart: (Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: stats.by_status[status] ?? 0,
    })),
    weeklyChart: stats.added_per_week.map((w) => ({
      week: new Date(`${w.week_start}T00:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      count: w.count,
    })),
    followUps: stats.follow_ups_due,
  };
}

export function useDashboardViewModel(): DashboardViewModel {
  const query = useQuery({ queryKey: ["applications", "stats"], queryFn: fetchStats });
  const built = query.data
    ? buildDashboard(query.data)
    : { isEmpty: false, stats: [], statusChart: [], weeklyChart: [], followUps: [] };
  return {
    ...built,
    isLoading: query.isPending,
    error: query.isError ? errorText(query.error) : null,
  };
}
