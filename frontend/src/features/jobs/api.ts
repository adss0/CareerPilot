// Model: find jobs on job boards (Reed, Adzuna), get an AI summary, save to the tracker.
import type { Application, JobSummary } from "@/features/applications/types";
import { apiGet, apiSend } from "@/lib/apiClient";

export interface JobListing {
  id: string; // "reed:123"
  source: "reed" | "adzuna" | "jooble";
  title: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  closes: string;
  snippet: string;
  url: string;
  application_id: number | null; // already in the tracker
  shortlisted: boolean; // starred to look at later
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

// ---------- shortlist: jobs starred to look at later ----------

export const getShortlist = () => apiGet<JobListing[]>("/jobs/shortlist");

export const addToShortlist = (id: string) =>
  apiSend<JobListing>("POST", `/jobs/shortlist?${idQuery(id)}`);

export const removeFromShortlist = (id: string) =>
  apiSend<null>("DELETE", `/jobs/shortlist?${idQuery(id)}`);

// ---------- a job from any website (Gradcracker, The Trackr, a careers page...) ----------

export interface PastedJob {
  url: string;
  text: string;
  company: string;
  role: string;
}

export const addPastedJob = (job: PastedJob) => apiSend<Application>("POST", "/jobs/paste", job);

/** Sites without a public API: open a web search limited to that site, with your keywords. */
export const OTHER_SITES = [
  { name: "Gradcracker", domain: "gradcracker.com" },
  { name: "The Trackr", domain: "the-trackr.com" },
  { name: "Bright Network", domain: "brightnetwork.co.uk" },
  { name: "Prospects", domain: "prospects.ac.uk" },
  { name: "TARGETjobs", domain: "targetjobs.co.uk" },
] as const;

export function siteSearchUrl(domain: string, keywords: string, graduate: boolean): string {
  const words = [keywords.trim() || "software engineer", graduate ? "graduate" : ""]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${words}`)}`;
}
