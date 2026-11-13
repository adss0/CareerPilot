import type { ApplicationStatus, LetterJob, Tone } from "./types";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  imported: "To apply",
  drafted: "Drafted",
  ready: "Ready",
  sent: "Applied",
  followed_up: "Followed up",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const ASSESSMENT_LABELS = { "": "-", pending: "Pending", done: "Done" } as const;

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  friendly: "Friendly",
  enthusiastic: "Enthusiastic",
};

export function statusVariant(status: ApplicationStatus) {
  if (status === "offer" || status === "interview" || status === "replied")
    return "success" as const;
  if (status === "rejected" || status === "withdrawn") return "destructive" as const;
  if (status === "imported") return "outline" as const;
  return "secondary" as const;
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "-";
  if (score >= 75) return `${score} · strong`;
  if (score >= 50) return `${score} · fair`;
  return `${score} · weak`;
}

export function jobPercent(job: Pick<LetterJob, "processed" | "total">): number {
  return job.total ? Math.round((job.processed / job.total) * 100) : 0;
}

export const isJobActive = (job: LetterJob | undefined | null) =>
  job?.status === "queued" || job?.status === "running";
