// ViewModel: the CV tailored to one job (write with AI, edit, download, save to the folder).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { fetchHealth } from "@/features/health/api";
import { listCvs } from "@/features/profile/api";
import type { Cv } from "@/features/profile/types";
import { errorText } from "@/lib/apiClient";

import {
  deleteTailoredCv,
  getTailoredCv,
  openDocumentsFolder,
  saveDocuments,
  tailorCv,
  updateTailoredCv,
  type CvStyle,
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
  /** Your uploaded CVs: the tailored CV can be based on any of them. */
  cvs: Cv[];
  sourceCvId: number | null; // null = your main CV (your profile)
  style: CvStyle;
  setSourceCvId: (id: number | null) => void;
  setStyle: (style: CvStyle) => void;
  tailor: () => void;
  tailorAsync: () => Promise<unknown>;
  edit: (changes: Partial<TailoredContent>) => void;
  editExperience: (index: number, summary: string) => void;
  editProject: (index: number, summary: string) => void;
  save: () => void;
  discard: () => void;
  remove: () => void;
  saveToFolder: () => void;
  openFolder: () => void;
}

export function useTailoredCvViewModel(applicationId: number): TailoredCvViewModel {
  const queryClient = useQueryClient();
  const key = ["tailored-cv", applicationId];
  const query = useQuery({ queryKey: key, queryFn: () => getTailoredCv(applicationId) });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });
  const cvsQuery = useQuery({ queryKey: ["cvs"], queryFn: listCvs });
  const [draft, setDraft] = useState<TailoredContent | null>(null);
  // What to use the next time it's tailored (until then, what this CV was built with).
  const [chosenCv, setChosenCv] = useState<number | null | undefined>(undefined);
  const [chosenStyle, setChosenStyle] = useState<CvStyle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cv = query.data ?? null;
  const form = draft ?? cv?.content ?? null;
  const sourceCvId = chosenCv !== undefined ? chosenCv : (cv?.source_cv_id ?? null);
  const style = chosenStyle ?? cv?.style ?? "own";

  const onSaved = (saved: TailoredCv, message: string) => {
    setError(null);
    setDraft(null);
    queryClient.setQueryData(key, saved);
    // The Apply tab lists the attachments: the tailored CV replaces the uploaded one.
    void queryClient.invalidateQueries({ queryKey: ["email-preview", applicationId] });
    setChosenStyle(null);
    toast.success(message);
  };
  const onError = (e: unknown) => setError(errorText(e));

  const tailorMutation = useMutation({
    mutationFn: () => tailorCv(applicationId, { cv_id: sourceCvId, style }),
    onSuccess: (saved) => onSaved(saved, "CV tailored to this job."),
    onError,
  });
  const saveMutation = useMutation({
    mutationFn: (changes: { content: TailoredContent; style?: CvStyle }) =>
      updateTailoredCv(applicationId, changes.content, changes.style),
    onSuccess: (saved, changes) => onSaved(saved, changes.style ? "Layout changed." : "CV saved."),
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
    cvs: cvsQuery.data ?? [],
    sourceCvId,
    style,
    setSourceCvId: setChosenCv,
    setStyle: (next) => {
      setChosenStyle(next);
      // The layout doesn't need the AI: an existing CV is laid out again straight away.
      if (cv) saveMutation.mutate({ content: draft ?? cv.content, style: next });
    },
    tailor: () => {
      if (!draft || window.confirm("Tailoring again replaces your edits. Continue?")) {
        tailorMutation.mutate();
      }
    },
    tailorAsync: () => tailorMutation.mutateAsync(),
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
        saveMutation.mutate({ content: { ...draft, skills } });
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
          toast.success("Saved as PDF in your documents folder.", {
            description: result.files.join("\n"),
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
