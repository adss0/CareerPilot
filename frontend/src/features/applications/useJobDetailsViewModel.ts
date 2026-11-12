// ViewModel: a job's details, notes, CV choice, status timeline and deletion.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { listCvs } from "@/features/profile/api";
import { errorText } from "@/lib/apiClient";

import {
  deleteApplication,
  getApplication,
  getHistory,
  updateApplication,
  type HistoryEntry,
} from "./api";
import { toJobInput, toJobValues, validateJob, type JobFormValues } from "./jobForm";

export interface JobDetailsViewModel {
  values: JobFormValues | null;
  problems: Partial<Record<keyof JobFormValues, string>>;
  isDirty: boolean;
  isSaving: boolean;
  cvs: { id: number; label: string; is_default: boolean }[];
  history: HistoryEntry[];
  change: (changes: Partial<JobFormValues>) => void;
  save: () => void;
  discard: () => void;
  remove: () => void;
}

export function useJobDetailsViewModel(applicationId: number): JobDetailsViewModel {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const appQuery = useQuery({
    queryKey: ["applications", "detail", applicationId],
    queryFn: () => getApplication(applicationId),
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["applications", "history", applicationId],
    queryFn: () => getHistory(applicationId),
  });
  const cvsQuery = useQuery({ queryKey: ["cvs"], queryFn: listCvs });

  const [draft, setDraft] = useState<JobFormValues | null>(null);
  const [showProblems, setShowProblems] = useState(false);

  const saved = appQuery.data ? toJobValues(appQuery.data) : null;
  const values = draft ?? saved;
  const problems = values && showProblems ? validateJob(values) : {};
  const isDirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));

  const saveMutation = useMutation({
    mutationFn: (v: JobFormValues) => updateApplication(applicationId, toJobInput(v)),
    onSuccess: () => {
      setDraft(null);
      setShowProblems(false);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      // The contact email and chosen CV change what the Apply tab will send.
      void queryClient.invalidateQueries({ queryKey: ["email-preview", applicationId] });
      toast.success("Job details saved.");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteApplication(applicationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Job deleted.");
      navigate("/applications");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return {
    values,
    problems,
    isDirty,
    isSaving: saveMutation.isPending,
    cvs: cvsQuery.data ?? [],
    history: historyQuery.data ?? [],
    change: (changes) => {
      if (values) setDraft({ ...values, ...changes });
    },
    save: () => {
      if (!draft) return;
      if (Object.keys(validateJob(draft)).length) {
        setShowProblems(true);
        return;
      }
      saveMutation.mutate(draft);
    },
    discard: () => {
      setDraft(null);
      setShowProblems(false);
    },
    remove: () => deleteMutation.mutate(),
  };
}
