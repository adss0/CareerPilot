// Model: applications and cover letters.
import { API_BASE, apiGet, apiSend } from "@/lib/apiClient";

import type {
  Application,
  ApplicationPage,
  ApplicationStatus,
  Letter,
  LetterJob,
  Tone,
} from "./types";

export function listApplications(params: {
  status?: ApplicationStatus | "";
  search?: string;
  limit: number;
  offset: number;
}): Promise<ApplicationPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiGet<ApplicationPage>(`/applications?${query}`);
}

export const getApplication = (id: number) => apiGet<Application>(`/applications/${id}`);

export const listLetters = (applicationId: number) =>
  apiGet<Letter[]>(`/applications/${applicationId}/letters`);

export const generateLetter = (applicationId: number, tone: Tone, instructions: string) =>
  apiSend<Letter>("POST", `/applications/${applicationId}/letters`, { tone, instructions });

export const updateLetter = (
  id: number,
  changes: Partial<Pick<Letter, "content" | "email_subject" | "email_body">> & {
    is_selected?: true;
  },
) => apiSend<Letter>("PATCH", `/letters/${id}`, changes);

export const deleteLetter = (id: number) => apiSend<null>("DELETE", `/letters/${id}`);

export const letterExportUrl = (id: number, format: "pdf" | "docx") =>
  `${API_BASE}/letters/${id}/export?format=${format}`;

export const startBulkLetters = (body: {
  application_ids: number[];
  tone: Tone;
  instructions: string;
  skip_existing: boolean;
}) => apiSend<LetterJob>("POST", "/letters/bulk", body);

export const getLetterJob = (id: string) => apiGet<LetterJob>(`/letters/jobs/${id}`);

export const cancelLetterJob = (id: string) =>
  apiSend<LetterJob>("POST", `/letters/jobs/${id}/cancel`);
