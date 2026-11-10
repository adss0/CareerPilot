// Model: talks to the backend's profile and CV endpoints.
import { API_BASE, apiGet, apiPostForm, apiSend } from "@/lib/apiClient";

import type { Cv, CvParseResult, Profile, ProfileDetails } from "./types";

export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_EXTENSIONS = [".pdf", ".docx", ".txt"];

export const getProfile = () => apiGet<Profile>("/profile");

export const saveProfile = (details: ProfileDetails) =>
  apiSend<Profile>("PUT", "/profile", details);

export const listCvs = () => apiGet<Cv[]>("/cvs");

export function uploadCv(file: File, useAi: boolean): Promise<CvParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("use_ai", String(useAi));
  return apiPostForm<CvParseResult>("/cvs", form);
}

export function parseCv(id: number, useAi: boolean): Promise<CvParseResult> {
  const form = new FormData();
  form.append("use_ai", String(useAi));
  return apiPostForm<CvParseResult>(`/cvs/${id}/parse`, form);
}

export const updateCv = (id: number, changes: { label?: string; is_default?: true }) =>
  apiSend<Cv>("PATCH", `/cvs/${id}`, changes);

export const deleteCv = (id: number) => apiSend<null>("DELETE", `/cvs/${id}`);

export const cvFileUrl = (id: number) => `${API_BASE}/cvs/${id}/file`;
