// Model: dashboard numbers (backend/app/schemas/stats.py).
import type { ApplicationStatus } from "@/features/applications/types";
import { apiGet } from "@/lib/apiClient";

export interface Breakdown {
  label: string;
  sent: number;
  responses: number;
  rate: number | null;
}

export interface Stats {
  total: number;
  by_status: Record<ApplicationStatus, number>;
  added_this_week: number;
  sent: number;
  responses: number;
  interviews: number;
  response_rate: number | null;
  added_per_week: { week_start: string; count: number }[];
  follow_ups_due: {
    id: number;
    company: string;
    role: string;
    follow_up_at: string;
    overdue: boolean;
  }[];
  avg_days_to_reply: number | null;
  by_tone: Breakdown[];
  by_cv: Breakdown[];
}

export const fetchStats = () => apiGet<Stats>("/stats");
