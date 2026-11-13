// ViewModel: the CV tailored to one job (write with AI, edit, download, save to the folder).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { fetchHealth } from "@/features/health/api";
import { errorText } from "@/lib/apiClient";

import {
  deleteTailoredCv,
  getTailoredCv,
  openDocumentsFolder,
  saveDocuments,
  tailorCv,
  updateTailoredCv,
  type TailoredContent,
  type TailoredCv,
} from "./api";

export interface TailoredCvViewModel {
  applicationId: number;
  cv: TailoredCv | null;
  form: TailoredContent | null;
  isLoading: boolean;
  isDirty: boolean;
  aiConfigured: boolean;
  isTailoring: boolean;
  isSaving: boolean;
  error: string | null;
  tailor: () => void;
  edit: (changes: Partial<TailoredContent>) => void;
  editExperience: (index: number, summary: string) => void;
  editProject: (index: number, summary: string) => void;
  save: () => void;
  discard: () => void;
  remove: () => void;
  saveToFolder: () => void;
  openFolder: () => void;
}

export function savedToast(message: string, applicationId: number, savedTo: string | null) {
  if (!savedTo) {
    toast.success(message);
    return;
  }
  toast.success(message, {
    description: `Word and PDF copies saved in ${savedTo}`,
    action: {
      label: "Open folder",
      onClick: () => void openDocumentsFolder(applicationId).catch(() => undefined),
    },
  });
}

export function useTailoredCvViewModel(applicationId: number): TailoredCvViewModel {
  const queryClient = useQueryClient();
  const key = ["tailored-cv", applicationId];
  const query = useQuery({ queryKey: key, queryFn: () => getTailoredCv(applicationId) });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });
  const [draft, setDraft] = useState<TailoredContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cv = query.data ?? null;
  const form = draft ?? cv?.content ?? null;

  const onSaved = (saved: TailoredCv, message: string) => {
    setError(null);
    setDraft(null);
    queryClient.setQueryData(key, saved);
    // The Apply tab lists the attachments: the tailored CV replaces the uploaded one.
    void queryClient.invalidateQueries({ queryKey: ["email-preview", applicationId] });
    savedToast(message, applicationId, saved.saved_to);
  };
  const onError = (e: unknown) => setError(errorText(e));

  const tailorMutation = useMutation({
    mutationFn: () => tailorCv(applicationId),
    onSuccess: (saved) => onSaved(saved, "CV tailored to this job."),
    onError,
  });
  const saveMutation = useMutation({
    mutationFn: (content: TailoredContent) => updateTailoredCv(applicationId, content),
    onSuccess: (saved) => onSaved(saved, "CV saved."),
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteTailoredCv(applicationId),
    onSuccess: () => {
      setDraft(null);
      queryClient.setQueryData(key, null);
      void queryClient.invalidateQueries({ queryKey: ["email-preview", applicationId] });
    },
    onError,
  });

  const edit = (changes: Partial<TailoredContent>) => {
    if (form) setDraft({ ...form, ...changes });
  };

  return {
    applicationId,
    cv,
    form,
    isLoading: query.isPending,
    isDirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(cv?.content),
    aiConfigured: healthQuery.data?.ai_configured ?? false,
    isTailoring: tailorMutation.isPending,
    isSaving: saveMutation.isPending,
    error,
    tailor: () => {
      if (!draft || window.confirm("Tailoring again replaces your edits. Continue?")) {
        tailorMutation.mutate();
      }
    },
    edit,
    editExperience: (index, summary) =>
      form &&
      edit({ experience: form.experience.map((e, i) => (i === index ? { ...e, summary } : e)) }),
    editProject: (index, summary) =>
      form &&
      edit({ projects: form.projects.map((p, i) => (i === index ? { ...p, summary } : p)) }),
    save: () => {
      if (draft) {
        const skills = draft.skills.map((s) => s.trim()).filter(Boolean);
        saveMutation.mutate({ ...draft, skills });
      }
    },
    discard: () => setDraft(null),
    remove: () => {
      if (window.confirm("Delete the tailored CV? Your uploaded CV will be sent instead.")) {
        deleteMutation.mutate();
      }
    },
    saveToFolder: () => {
      saveDocuments(applicationId).then(
        (result) =>
          toast.success("Saved to your documents folder.", {
            description: result.folders.join("\n"),
            action: {
              label: "Open folder",
              onClick: () => void openDocumentsFolder(applicationId).catch(() => undefined),
            },
          }),
        onError,
      );
    },
    openFolder: () => {
      openDocumentsFolder(applicationId).catch(onError);
    },
  };
}
