// Model: talks to the backend and returns typed data.
import { apiGet } from "@/lib/apiClient";

import type { HealthResponse } from "./types";

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}

/** The one health query: every screen that needs the version or AI status shares it. */
export const healthQueryOptions = {
  queryKey: ["health"],
  queryFn: fetchHealth,
  retry: false,
} as const;
