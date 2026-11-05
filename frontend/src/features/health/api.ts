// Model: talks to the backend and returns typed data.
import { apiGet } from "@/lib/apiClient";

import type { HealthResponse } from "./types";

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}
