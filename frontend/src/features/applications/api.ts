// Model: applications and cover letters.
import { API_BASE, apiGet, apiSend } from "@/lib/apiClient";

import type {
  Application,
  ApplicationPage,
  ApplicationStatus,
  BinItem,
  DueItem,
  Letter,
  LetterJob,
  Tone,
  TrackerGroup,
  TrackerSummary,
} from "./types";

export type SortKey = "created_at" | "updated_at" | "company" | "role" | "status" | "priority";
export type Sort = SortKey | `-${SortKey}`;

export function listApplications(params: {
  status?: ApplicationStatus | "";
  search?: string;
  sort?: Sort;
  limit: number;
  offset: number;
  hideClosed?: boolean;
  group?: TrackerGroup | "";
}): Promise<ApplicationPage> {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.hideClosed) query.set("hide_closed", "true");
  if (params.status) query.set("status", params.status);
  if (params.group) query.set("group", params.group);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sort) query.set("sort", params.sort);
  return apiGet<ApplicationPage>(`/applications?${query}`);
}

export const getApplication = (id: number) => apiGet<Application>(`/applications/${id}`);

export type ApplicationInput = Partial<
  Pick<
    Application,
    | "company"
    | "role"
    | "job_url"
    | "job_description"
    | "contact_name"
    | "contact_email"
    | "location"
    | "salary"
    | "priority"
    | "notes"
    | "status"
    | "cv_id"
    | "interview_at"
    | "application_deadline"
    | "stages"
    | "sponsorship"
  >
>;

export const getDue = (days = 7) => apiGet<DueItem[]>(`/applications/due?days=${days}`);

// ---------- deleting: the recycle bin ----------

export const listBin = () => apiGet<BinItem[]>("/bin");

export const restoreFromBin = (id: number) => apiSend<Application>("POST", `/bin/${id}/restore`);

export const deleteFromBin = (id: number) => apiSend<null>("DELETE", `/bin/${id}`);

export const emptyBin = () => apiSend<null>("DELETE", "/bin");

export const deleteAllApplications = () =>
  apiSend<{ deleted: number; backup: string }>("POST", "/applications/delete-all", {
    confirm: "DELETE",
  });

export const getTrackerSummary = () => apiGet<TrackerSummary>("/applications/summary");

export const summarizeApplication = (id: number) =>
  apiSend<Application>("POST", `/applications/${id}/summary`);

export const createApplication = (data: ApplicationInput) =>
  apiSend<Application>("POST", "/applications", { source: "manual", ...data });

export const updateApplication = (id: number, changes: ApplicationInput) =>
  apiSend<Application>("PATCH", `/applications/${id}`, changes);

export const deleteApplication = (id: number) => apiSend<null>("DELETE", `/applications/${id}`);

export const bulkApplications = (
  body:
    | { application_ids: number[]; action: "delete" }
    | { application_ids: number[]; action: "set_status"; status: ApplicationStatus },
) => apiSend<{ affected: number; missing: number[] }>("POST", "/applications/bulk", body);

export interface HistoryEntry {
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_at: string;
}

export const getHistory = (id: number) => apiGet<HistoryEntry[]>(`/applications/${id}/history`);

export const listLetters = (applicationId: number) =>
  apiGet<Letter[]>(`/applications/${applicationId}/letters`);

export const generateLetter = (
  applicationId: number,
  tone: Tone,
  instructions: string,
  highlights: string[] = [],
) =>
  apiSend<Letter>("POST", `/applications/${applicationId}/letters`, {
    tone,
    instructions,
    highlights,
  });

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
