// Model: email settings, approve-then-send, the send queue and assisted apply.
import { apiGet, apiSend } from "@/lib/apiClient";

export interface EmailSettings {
  from_name: string;
  from_address: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_security: "starttls" | "ssl" | "none";
  username: string;
  imap_host: string;
  imap_port: number;
  daily_limit: number;
  min_gap_seconds: number;
  max_gap_seconds: number;
  signature: string;
  test_mode: boolean;
  test_address: string | null;
  follow_up_days: number;
}

export interface EmailSettingsRead extends EmailSettings {
  password_set: boolean;
  ready: boolean;
  problems: string[];
}

export interface EmailPreview {
  to: string;
  deliver_to: string;
  test_mode: boolean;
  subject: string;
  body: string;
  attachments: { name: string; size_bytes: number | null }[];
  can_send: boolean;
  problems: string[];
  warnings: string[];
}

export interface EmailLog {
  id: number;
  application_id: number;
  kind: string;
  to_address: string;
  subject: string;
  body: string;
  attachments: string[];
  status: "queued" | "sent" | "failed" | "replied" | "cancelled";
  is_test: boolean;
  error: string;
  sent_at: string | null;
  created_at: string;
}

export interface QueueStatus {
  ready: boolean;
  problems: string[];
  queued: number;
  sent_today: number;
  daily_limit: number;
  test_mode: boolean;
  next_send_at: string | null;
}

export const getEmailSettings = () => apiGet<EmailSettingsRead>("/settings/email");
export const updateEmailSettings = (changes: Partial<EmailSettings>) =>
  apiSend<EmailSettingsRead>("PUT", "/settings/email", changes);
export const testEmailConnection = () =>
  apiSend<{ ok: boolean; message: string }>("POST", "/settings/email/test");

export const previewEmail = (applicationId: number) =>
  apiGet<EmailPreview>(`/applications/${applicationId}/email/preview`);
export const sendEmail = (applicationId: number) =>
  apiSend<EmailLog>("POST", `/applications/${applicationId}/email/send`, { confirm: true });
export const markApplied = (applicationId: number) =>
  apiSend<null>("POST", `/applications/${applicationId}/mark-applied`);
export const sendMany = (applicationIds: number[]) =>
  apiSend<{ queued: number; skipped: { application_id: number; reason: string }[] }>(
    "POST",
    "/emails/bulk",
    { application_ids: applicationIds, confirm: true },
  );

export const listEmails = (applicationId?: number) =>
  apiGet<EmailLog[]>(applicationId ? `/emails?application_id=${applicationId}` : "/emails");
export const getQueueStatus = () => apiGet<QueueStatus>("/emails/queue");
export const cancelEmail = (id: number) => apiSend<EmailLog>("POST", `/emails/${id}/cancel`);
export const retryEmail = (id: number) => apiSend<EmailLog>("POST", `/emails/${id}/retry`);
