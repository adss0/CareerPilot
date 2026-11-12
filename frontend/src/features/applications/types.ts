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
