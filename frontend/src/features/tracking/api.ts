// Model: follow-ups, inbox replies, notifications and the calendar.
import { apiGet, apiSend } from "@/lib/apiClient";

import type { EmailLog } from "@/features/email/api";

export interface FollowUpDraft {
  subject: string;
  body: string;
  source: "ai" | "template";
  to: string;
  deliver_to: string;
  test_mode: boolean;
}

export interface Reply {
  id: number;
  application_id: number;
  from_address: string;
  subject: string;
  snippet: string;
  received_at: string;
  classification: "interview" | "rejection" | "other";
  seen: boolean;
}

export interface ReplyCheckResult {
  checked: boolean;
  message: string;
  new_replies: number;
  checked_at: string | null;
}

export interface NotificationSummary {
  unseen_replies: number;
  follow_ups_due: number;
  interviews_soon: number;
  last_reply_check: string | null;
}

export interface CalendarEvent {
  date: string;
  kind: "follow_up" | "interview";
  application_id: number;
  company: string;
  role: string;
}

export const draftFollowUp = (applicationId: number) =>
  apiSend<FollowUpDraft>("POST", `/applications/${applicationId}/follow-up/draft`);
export const sendFollowUp = (applicationId: number, subject: string, body: string) =>
  apiSend<EmailLog>("POST", `/applications/${applicationId}/follow-up/send`, {
    subject,
    body,
    confirm: true,
  });

export const listReplies = (applicationId?: number) =>
  apiGet<Reply[]>(applicationId ? `/replies?application_id=${applicationId}` : "/replies");
export const checkReplies = () => apiSend<ReplyCheckResult>("POST", "/replies/check");
export const markReplySeen = (id: number) => apiSend<null>("POST", `/replies/${id}/seen`);

export const getNotifications = () => apiGet<NotificationSummary>("/notifications");

export const getCalendar = (start: Date, end: Date) =>
  apiGet<CalendarEvent[]>(
    `/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
  );
