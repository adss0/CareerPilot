// Mirrors backend/app/schemas/health.py
export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  ai_provider: string;
}

export type BackendStatus = "checking" | "online" | "offline";
