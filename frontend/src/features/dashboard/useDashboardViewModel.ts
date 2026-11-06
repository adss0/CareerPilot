// ViewModel: dashboard stat tiles.
import { useQuery } from "@tanstack/react-query";

import { fetchApplicationCount } from "./api";

export interface DashboardStat {
  label: string;
  value: number | null; // null while loading or unavailable
  hint: string;
}

export interface DashboardViewModel {
  stats: DashboardStat[];
}

function useCount(status?: string) {
  return useQuery({
    queryKey: ["applications", "count", status ?? "all"],
    queryFn: () => fetchApplicationCount(status),
    retry: false,
  });
}

export function useDashboardViewModel(): DashboardViewModel {
  const total = useCount();
  const sent = useCount("sent");
  const interviews = useCount("interview");

  return {
    stats: [
      { label: "Applications", value: total.data ?? null, hint: "In your tracker" },
      { label: "Sent", value: sent.data ?? null, hint: "Email sending in Phase 6" },
      { label: "Interviews", value: interviews.data ?? null, hint: "Tracking in Phase 7" },
      { label: "Response rate", value: null, hint: "Stats in Phase 7" },
    ],
  };
}
