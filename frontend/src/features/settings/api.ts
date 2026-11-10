// Model: AI provider settings. API keys are never sent or shown: they stay in backend/.env.
import { apiGet, apiSend } from "@/lib/apiClient";

export type ProviderName = "gemini" | "groq" | "ollama";

export interface ProviderStatus {
  name: ProviderName;
  label: string;
  configured: boolean;
  model: string;
  default_model: string;
  setup: string;
  privacy: string;
}

export interface AiSettings {
  provider: ProviderName;
  model: string;
  request_gap_seconds: number;
  providers: ProviderStatus[];
}

export interface AiTestResult {
  ok: boolean;
  message: string;
  provider: ProviderName;
  model: string;
}

export const getAiSettings = () => apiGet<AiSettings>("/settings/ai");

export const updateAiSettings = (changes: {
  provider?: ProviderName;
  model?: string;
  request_gap_seconds?: number;
}) => apiSend<AiSettings>("PUT", "/settings/ai", changes);

export const testAiConnection = () => apiSend<AiTestResult>("POST", "/settings/ai/test");
