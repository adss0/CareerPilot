// ViewModel: applying for one job, by approved email or by assisted apply on the job's website.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { getApplication, listLetters } from "@/features/applications/api";
import { cvFileUrl, listCvs } from "@/features/profile/api";
import { errorText } from "@/lib/apiClient";

import {
  cancelEmail,
  listEmails,
  markApplied,
  previewEmail,
  retryEmail,
  sendEmail,
  type EmailLog,
  type EmailPreview,
} from "./api";

export interface ApplyViewModel {
  preview: EmailPreview | null;
  logs: EmailLog[];
  hasContactEmail: boolean;
  jobUrl: string | null; // only http(s) links
  cvUrl: string | null;
  cvName: string | null;
  hasLetter: boolean;
  approved: boolean;
  isSending: boolean;
  isMarking: boolean;
  alreadyApplied: boolean;
  setApproved: (value: boolean) => void;
  send: () => void;
  cancel: (id: number) => void;
  retry: (id: number) => void;
  copyLetter: () => void;
  markApplied: () => void;
}

const APPLIED = new Set(["sent", "followed_up", "interview", "offer", "rejected"]);

export function useApplyViewModel(applicationId: number): ApplyViewModel {
  const queryClient = useQueryClient();
  const appQuery = useQuery({
    queryKey: ["applications", "detail", applicationId],
    queryFn: () => getApplication(applicationId),
  });
  const previewQuery = useQuery({
    queryKey: ["email-preview", applicationId],
    queryFn: () => previewEmail(applicationId),
  });
  const logsQuery = useQuery({
    queryKey: ["emails", applicationId],
    queryFn: () => listEmails(applicationId),
    refetchInterval: (q) => (q.state.data?.some((l) => l.status === "queued") ? 5000 : false),
  });
  const lettersQuery = useQuery({
    queryKey: ["letters", applicationId],
    queryFn: () => listLetters(applicationId),
  });
  const cvsQuery = useQuery({ queryKey: ["cvs"], queryFn: listCvs });
  const [approved, setApproved] = useState(false);

  const application = appQuery.data;
  const letters = lettersQuery.data ?? [];
  const letter = letters.find((l) => l.is_selected) ?? letters[0];
  const cvs = cvsQuery.data ?? [];
  const cv = cvs.find((c) => c.id === application?.cv_id) ?? cvs.find((c) => c.is_default) ?? null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["emails", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["email-preview", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["email-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };
  const onError = (e: unknown) => toast.error(errorText(e));

  const sendMutation = useMutation({
    mutationFn: () => sendEmail(applicationId),
    onSuccess: (log) => {
      setApproved(false);
      refresh();
      toast.success(
        log.is_test ? "Queued as a test email to you." : "Approved. It will be sent shortly.",
      );
    },
    onError,
  });
  const logMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "cancel" | "retry" }) =>
      action === "cancel" ? cancelEmail(id) : retryEmail(id),
    onSuccess: refresh,
    onError,
  });
  const markMutation = useMutation({
    mutationFn: () => markApplied(applicationId),
    onSuccess: () => {
      refresh();
      toast.success("Marked as applied.");
    },
    onError,
  });

  return {
    preview: previewQuery.data ?? null,
    logs: logsQuery.data ?? [],
    hasContactEmail: Boolean(application?.contact_email),
    jobUrl: application && /^https?:\/\//i.test(application.job_url) ? application.job_url : null,
    cvUrl: cv ? cvFileUrl(cv.id) : null,
    cvName: cv?.original_filename ?? null,
    hasLetter: Boolean(letter),
    approved,
    isSending: sendMutation.isPending,
    isMarking: markMutation.isPending,
    alreadyApplied: Boolean(application && APPLIED.has(application.status)),
    setApproved,
    send: () => {
      if (approved) sendMutation.mutate();
    },
    cancel: (id) => logMutation.mutate({ id, action: "cancel" }),
    retry: (id) => logMutation.mutate({ id, action: "retry" }),
    copyLetter: () => {
      if (!letter) return;
      void navigator.clipboard.writeText(letter.content).then(
        () => toast.success("Letter copied. Paste it into the application form."),
        () => toast.error("Couldn't copy. Open the Cover letter tab and copy it from there."),
      );
    },
    markApplied: () => markMutation.mutate(),
  };
}
