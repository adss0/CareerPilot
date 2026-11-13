// ViewModel: dashboard tiles, charts and follow-ups.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { STATUS_LABELS } from "@/features/applications/labels";
import type { ApplicationStatus } from "@/features/applications/types";
import { checkReplies, getNotifications } from "@/features/tracking/api";
import { errorText } from "@/lib/apiClient";

import { fetchStats, type Breakdown, type Stats } from "./api";

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
  avgDaysToReply: number | null;
  byTone: Breakdown[];
  byCv: Breakdown[];
  lastReplyCheck: string | null;
  isChecking: boolean;
  checkReplies: () => void;
}

const percent = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);

export function buildDashboard(
  stats: Stats,
): Omit<
  DashboardViewModel,
  "isLoading" | "error" | "lastReplyCheck" | "isChecking" | "checkReplies"
> {
  return {
    isEmpty: stats.total === 0,
    stats: [
      {
        label: "Applications",
        value: String(stats.total),
        hint: `${stats.added_this_week} added this week`,
      },
      { label: "Applied", value: String(stats.sent), hint: "Applied or further along" },
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
    avgDaysToReply: stats.avg_days_to_reply,
    byTone: stats.by_tone,
    byCv: stats.by_cv,
  };
}

export function useDashboardViewModel(): DashboardViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["applications", "stats"], queryFn: fetchStats });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const check = useMutation({
    mutationFn: checkReplies,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["replies"] });
      if (result.checked) toast.success(result.message);
      else toast.error(result.message, { duration: 10_000 });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const empty = {
    isEmpty: false,
    stats: [],
    statusChart: [],
    weeklyChart: [],
    followUps: [],
    avgDaysToReply: null,
    byTone: [],
    byCv: [],
  };
  return {
    ...(query.data ? buildDashboard(query.data) : empty),
    isLoading: query.isPending,
    error: query.isError ? errorText(query.error) : null,
    lastReplyCheck: notifications.data?.last_reply_check ?? null,
    isChecking: check.isPending,
    checkReplies: () => check.mutate(),
  };
}
