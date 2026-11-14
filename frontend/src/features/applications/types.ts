// Mirrors backend/app/schemas/application.py and letters.py
export type ApplicationStatus =
  | "imported"
  | "drafted"
  | "ready"
  | "sent"
  | "followed_up"
  | "replied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type Sponsorship = "yes" | "no" | "unsure";

/** One of the totals above the tracker; each is also a filter. */
export type TrackerGroup =
  | "to_apply"
  | "applied"
  | "in_progress"
  | "assessments_done"
  | "interviews"
  | "offers"
  | "rejected";

export interface Application {
  id: number;
  company: string;
  role: string;
  job_url: string;
  job_description: string;
  contact_name: string;
  contact_email: string;
  location: string;
  salary: string;
  source: string;
  status: ApplicationStatus;
  priority: number;
  notes: string;
  cv_id: number | null;
  interview_at: string | null;
  follow_up_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  letter_count: number;
  match_score: number | null;
  application_deadline: string;
  stages: Stage[];
  external_id: string;
  job_summary: Partial<JobSummary>;
  sponsorship: Sponsorship;
  next_step: string;
  due_label: string; // e.g. "Closes in 3 days"
  due_level: "" | "soon" | "overdue";
}

export interface DueItem {
  application_id: number;
  company: string;
  role: string;
  kind: "deadline" | "stage";
  date: string;
  days_left: number;
  label: string;
}

export type StageKind =
  | "online_test"
  | "video"
  | "phone"
  | "technical"
  | "assessment_centre"
  | "final"
  | "other";
export type StageResult = "upcoming" | "passed" | "failed";

/** One step of the hiring process (backend/app/schemas/application.py). */
export interface Stage {
  kind: StageKind;
  date: string | null; // yyyy-mm-dd
  result: StageResult;
  note: string;
}

export interface BinItem {
  id: number;
  company: string;
  role: string;
  status: string;
  deleted_at: string;
  expires_at: string;
}

// The AI's plain-English summary of a job (backend/app/schemas/jobs.py).
export interface JobSummary {
  summary: string;
  salary: string;
  location: string;
  work_type: string;
  requirements: string[];
  nice_to_have: string[];
  match_score: number | null;
  strengths: string[];
  gaps: string[];
}

export interface TrackerSummary {
  total: number;
  to_apply: number;
  applied: number;
  in_progress: number;
  assessments_done: number;
  interviews: number;
  offers: number;
  rejected: number;
}

export interface ApplicationPage {
  items: Application[];
  total: number;
  limit: number;
  offset: number;
}

export type Tone = "formal" | "friendly" | "enthusiastic";

export interface Letter {
  id: number;
  application_id: number;
  version: number;
  tone: Tone;
  model_used: string;
  content: string;
  email_subject: string;
  email_body: string;
  match_score: number | null;
  requirements: string[];
  matches: { requirement: string; evidence: string }[];
  flags: string[];
  is_selected: boolean;
  edited: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface LetterJob {
  id: string;
  status: "queued" | "running" | "done" | "cancelled" | "failed";
  total: number;
  processed: number;
  succeeded: number[];
  skipped: number[];
  failed: { application_id: number; company: string; error: string }[];
  current: string | null;
  message: string | null;
  created_at: string;
}
