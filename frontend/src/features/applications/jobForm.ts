import { parseServerDate } from "@/lib/dates";

import type { ApplicationInput } from "./api";
import type { Application, ApplicationStatus } from "./types";

export interface JobFormValues {
  company: string;
  role: string;
  job_url: string;
  location: string;
  salary: string;
  contact_name: string;
  contact_email: string;
  job_description: string;
  notes: string;
  status: ApplicationStatus;
  priority: number;
  cv_id: string; // "" = use the default CV
  interview_at: string; // datetime-local value, "" = none
}

export const EMPTY_JOB: JobFormValues = {
  company: "",
  role: "",
  job_url: "",
  location: "",
  salary: "",
  contact_name: "",
  contact_email: "",
  job_description: "",
  notes: "",
  status: "imported",
  priority: 0,
  cv_id: "",
  interview_at: "",
};

/** Server UTC time → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
export function toLocalInput(value: string): string {
  const d = parseServerDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toJobValues(a: Application): JobFormValues {
  return {
    company: a.company,
    role: a.role,
    job_url: a.job_url,
    location: a.location,
    salary: a.salary,
    contact_name: a.contact_name,
    contact_email: a.contact_email,
    job_description: a.job_description,
    notes: a.notes,
    status: a.status,
    priority: a.priority,
    cv_id: a.cv_id === null ? "" : String(a.cv_id),
    interview_at: a.interview_at ? toLocalInput(a.interview_at) : "",
  };
}

export function toJobInput(values: JobFormValues): ApplicationInput {
  return {
    ...values,
    company: values.company.trim(),
    role: values.role.trim(),
    job_url: values.job_url.trim(),
    contact_email: values.contact_email.trim(),
    cv_id: values.cv_id ? Number(values.cv_id) : null,
    interview_at: values.interview_at ? new Date(values.interview_at).toISOString() : null,
  };
}

/** Problems to fix before saving, keyed by field. Empty = valid. */
export function validateJob(values: JobFormValues): Partial<Record<keyof JobFormValues, string>> {
  const problems: Partial<Record<keyof JobFormValues, string>> = {};
  if (!values.company.trim()) problems.company = "Company is required.";
  if (!values.role.trim()) problems.role = "Role is required.";
  if (
    values.contact_email.trim() &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.contact_email.trim())
  ) {
    problems.contact_email = "This doesn't look like an email address.";
  }
  if (values.job_url.trim() && !/^https?:\/\/\S+$/i.test(values.job_url.trim())) {
    problems.job_url = "Links must start with http:// or https://";
  }
  return problems;
}
