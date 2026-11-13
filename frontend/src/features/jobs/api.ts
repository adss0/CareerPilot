// Model: find jobs on job boards (Reed, Adzuna), get an AI summary, save to the tracker.
import type { Application, JobSummary } from "@/features/applications/types";
import { apiGet, apiSend } from "@/lib/apiClient";

export interface JobListing {
  id: string; // "reed:123"
  source: "reed" | "adzuna";
  title: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  closes: string;
  snippet: string;
  url: string;
  application_id: number | null; // already in the tracker
}

export interface JobSearchResult {
  jobs: JobListing[];
  boards: string[];
  problems: string[];
  needs_setup: boolean;
}

export interface JobDetails extends JobListing {
  description: string;
  work_type: string;
  summary: JobSummary | null;
}

export function searchJobs(params: {
  q: string;
  location: string;
  graduate: boolean;
  page: number;
}): Promise<JobSearchResult> {
  const query = new URLSearchParams({
    q: params.q.trim(),
    location: params.location.trim(),
    graduate: String(params.graduate),
    page: String(params.page),
  });
  return apiGet<JobSearchResult>(`/jobs/search?${query}`);
}

const idQuery = (id: string) => `id=${encodeURIComponent(id)}`;

export const getJobDetails = (id: string) => apiGet<JobDetails>(`/jobs/details?${idQuery(id)}`);

export const summarizeJob = (id: string) =>
  apiSend<JobDetails>("POST", `/jobs/summary?${idQuery(id)}`);

export const saveJob = (id: string) => apiSend<Application>("POST", `/jobs/save?${idQuery(id)}`);
