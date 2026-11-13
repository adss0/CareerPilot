// The link to open for a job: its own page, or a web search when there isn't one.
import type { Application } from "@/features/applications/types";

/** A job link that's safe to open, or a web search for the job when there's no link. */
export function jobLink(job: Pick<Application, "job_url" | "company" | "role">): string {
  if (/^https?:\/\//i.test(job.job_url)) return job.job_url;
  const query = `${job.company} ${job.role} graduate job apply`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
