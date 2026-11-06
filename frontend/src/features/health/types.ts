// Mirrors backend/app/schemas/health.py
export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  ai_provider: string;
  ai_configured: boolean;
}

export type BackendStatus = "checking" | "online" | "offline";
