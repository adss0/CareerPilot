// Model: API keys (write-only), tailored CVs, and the folder where documents are saved.
import { API_BASE, ApiError, apiGet, apiSend } from "@/lib/apiClient";

import type { EducationItem, ExperienceItem, ProjectItem } from "@/features/profile/types";

// ---------- keys and passwords (saved to .env; never sent back) ----------

export type SecretName =
  | "gemini"
  | "groq"
  | "email"
  | "reed"
  | "adzuna_id"
  | "adzuna_key"
  | "jooble";
export type SecretsStatus = Record<SecretName, boolean>;

export const getSecrets = () => apiGet<SecretsStatus>("/settings/secrets");

export const setSecret = (name: SecretName, value: string) =>
  apiSend<SecretsStatus>("PUT", `/settings/secrets/${name}`, { value });

// ---------- documents folder ----------

export interface DocumentSettings {
  folder: string;
  default_folder: string;
  auto_save: boolean;
}

export const getDocumentSettings = () => apiGet<DocumentSettings>("/settings/documents");

export const updateDocumentSettings = (changes: { folder?: string; auto_save?: boolean }) =>
  apiSend<DocumentSettings>("PUT", "/settings/documents", changes);

export const openDocumentsFolder = (applicationId?: number) =>
  apiSend<{ folder: string }>(
    "POST",
    applicationId ? `/documents/open?application_id=${applicationId}` : "/documents/open",
  );

export const saveDocuments = (applicationId: number) =>
  apiSend<{ folders: string[] }>("POST", `/applications/${applicationId}/documents/save`);

// ---------- tailored CV ----------

export interface TailoredContent {
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
}

export interface TailoredCv {
  application_id: number;
  content: TailoredContent;
  changes: string[];
  flags: string[];
  model_used: string;
  edited: boolean;
  created_at: string;
  updated_at: string | null;
  saved_to: string | null;
}

const cvPath = (applicationId: number) => `/applications/${applicationId}/tailored-cv`;

/** The tailored CV, or null if this job doesn't have one yet. */
export async function getTailoredCv(applicationId: number): Promise<TailoredCv | null> {
  try {
    return await apiGet<TailoredCv>(cvPath(applicationId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const tailorCv = (applicationId: number) =>
  apiSend<TailoredCv>("POST", cvPath(applicationId));

export const updateTailoredCv = (applicationId: number, content: TailoredContent) =>
  apiSend<TailoredCv>("PUT", cvPath(applicationId), { content });

export const deleteTailoredCv = (applicationId: number) =>
  apiSend<null>("DELETE", cvPath(applicationId));

export const tailoredCvExportUrl = (applicationId: number, format: "pdf" | "docx") =>
  `${API_BASE}${cvPath(applicationId)}/export?format=${format}`;
