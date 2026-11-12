// ViewModel: follow-up email and employer replies for one job.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getApplication, updateApplication } from "@/features/applications/api";
import { STATUS_LABELS } from "@/features/applications/labels";
import type { ApplicationStatus } from "@/features/applications/types";
import { listEmails } from "@/features/email/api";
import { errorText } from "@/lib/apiClient";

import {
  draftFollowUp,
  listReplies,
  markReplySeen,
  sendFollowUp,
  type FollowUpDraft,
  type Reply,
} from "./api";

export interface FollowUpViewModel {
  replies: Reply[];
  status: ApplicationStatus | null;
  followUpAt: string | null;
  canFollowUp: boolean;
  draft: FollowUpDraft | null;
  approved: boolean;
  isDrafting: boolean;
  isSending: boolean;
  startDraft: () => void;
  editDraft: (changes: Partial<Pick<FollowUpDraft, "subject" | "body">>) => void;
  setApproved: (value: boolean) => void;
  sendDraft: () => void;
  cancelDraft: () => void;
  setStatus: (status: ApplicationStatus) => void;
}

export function useFollowUpViewModel(applicationId: number): FollowUpViewModel {
  const queryClient = useQueryClient();
  const appQuery = useQuery({
    queryKey: ["applications", "detail", applicationId],
    queryFn: () => getApplication(applicationId),
  });
  const repliesQuery = useQuery({
    queryKey: ["replies", applicationId],
    queryFn: () => listReplies(applicationId),
  });
  const emailsQuery = useQuery({
    queryKey: ["emails", applicationId],
    queryFn: () => listEmails(applicationId),
  });
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [approved, setApproved] = useState(false);

  const replies = repliesQuery.data ?? [];
  const application = appQuery.data;
  const emails = emailsQuery.data ?? [];
  const applicationSent = emails.some(
    (e) => e.kind === "application" && (e.status === "sent" || e.status === "replied"),
  );
  const followUpWaiting = emails.some((e) => e.status === "queued");

  // Viewing the job counts as seeing its replies.
  const unseen = replies.filter((r) => !r.seen).map((r) => r.id);
  const unseenKey = unseen.join(",");
  useEffect(() => {
    if (!unseenKey) return;
    void Promise.all(unseenKey.split(",").map((id) => markReplySeen(Number(id)))).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [unseenKey, queryClient]);

  const onError = (e: unknown) => toast.error(errorText(e));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["emails", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["email-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const draftMutation = useMutation({
    mutationFn: () => draftFollowUp(applicationId),
    onSuccess: (d) => {
      setDraft(d);
      setApproved(false);
    },
    onError,
  });
  const sendMutation = useMutation({
    mutationFn: (d: FollowUpDraft) => sendFollowUp(applicationId, d.subject, d.body),
    onSuccess: (log) => {
      setDraft(null);
      setApproved(false);
      refresh();
      toast.success(
        log.is_test
          ? "Follow-up queued as a test email to you."
          : "Follow-up approved. It will be sent shortly.",
      );
    },
    onError,
  });
  const statusMutation = useMutation({
    mutationFn: (status: ApplicationStatus) => updateApplication(applicationId, { status }),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Moved to ${STATUS_LABELS[updated.status]}.`);
    },
    onError,
  });

  return {
    replies,
    status: application?.status ?? null,
    followUpAt: application?.follow_up_at ?? null,
    canFollowUp: Boolean(
      application?.contact_email &&
        applicationSent &&
        !followUpWaiting &&
        (application.status === "sent" || application.status === "followed_up"),
    ),
    draft,
    approved,
    isDrafting: draftMutation.isPending,
    isSending: sendMutation.isPending,
    startDraft: () => draftMutation.mutate(),
    editDraft: (changes) => setDraft((d) => (d ? { ...d, ...changes } : d)),
    setApproved,
    sendDraft: () => {
      if (draft && approved) sendMutation.mutate(draft);
    },
    cancelDraft: () => setDraft(null),
    setStatus: (status) => statusMutation.mutate(status),
  };
}
