// Model: dashboard numbers come from the applications list totals.
import { apiGet } from "@/lib/apiClient";

interface ApplicationPage {
  total: number;
}

export async function fetchApplicationCount(status?: string): Promise<number> {
  const params = new URLSearchParams({ limit: "1" });
  if (status) params.set("status", status);
  const page = await apiGet<ApplicationPage>(`/applications?${params}`);
  return page.total;
}
