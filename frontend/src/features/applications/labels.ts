import type { ApplicationStatus, LetterJob, Sponsorship, StageKind, Tone } from "./types";

export const SPONSORSHIP_LABELS: Record<Sponsorship, string> = {
  unsure: "Unsure",
  yes: "Yes",
  no: "No",
};

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

export const STAGE_LABELS: Record<StageKind, string> = {
  online_test: "Online test",
  video: "Video interview",
  phone: "Phone screen",
  technical: "Technical interview",
  assessment_centre: "Assessment centre",
  final: "Final interview",
  other: "Other",
};

/** Short names for the chips in the sheet. */
export const STAGE_SHORT: Record<StageKind, string> = {
  online_test: "Test",
  video: "Video",
  phone: "Phone",
  technical: "Technical",
  assessment_centre: "AC",
  final: "Final",
  other: "Other",
};

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  friendly: "Friendly",
  enthusiastic: "Enthusiastic",
};

export function statusVariant(status: ApplicationStatus) {
  if (status === "offer" || status === "interview" || status === "replied")
    return "success" as const;
  if (status === "rejected" || status === "withdrawn") return "destructive" as const;
  if (status === "sent" || status === "followed_up") return "info" as const;
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
