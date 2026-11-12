// ViewModel: one application and its cover letters (write, edit, versions, export).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { fetchHealth } from "@/features/health/api";
import { errorText } from "@/lib/apiClient";

import { deleteLetter, generateLetter, getApplication, listLetters, updateLetter } from "./api";
import type { Application, Letter, Tone } from "./types";

export interface LetterDraft {
  content: string;
  email_subject: string;
  email_body: string;
}

export interface ApplicationDetailViewModel {
  application: Application | null;
  isLoading: boolean;
  notFound: boolean;
  letters: Letter[];
  letter: Letter | null; // the version being viewed
  form: LetterDraft | null;
  isDirty: boolean;
  aiConfigured: boolean;
  tone: Tone;
  instructions: string;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
  copied: boolean;
  setTone: (tone: Tone) => void;
  setInstructions: (value: string) => void;
  generate: () => void;
  viewVersion: (letterId: number) => void;
  edit: (changes: Partial<LetterDraft>) => void;
  save: () => void;
  discard: () => void;
  useVersion: () => void;
  deleteVersion: () => void;
  copyLetter: () => void;
}

const toDraft = (letter: Letter): LetterDraft => ({
  content: letter.content,
  email_subject: letter.email_subject,
  email_body: letter.email_body,
});

export function useApplicationDetailViewModel(applicationId: number): ApplicationDetailViewModel {
  const queryClient = useQueryClient();
  const appQuery = useQuery({
    queryKey: ["applications", "detail", applicationId],
    queryFn: () => getApplication(applicationId),
    retry: false,
  });
  const lettersQuery = useQuery({
    queryKey: ["letters", applicationId],
    queryFn: () => listLetters(applicationId),
  });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });

  const [viewingId, setViewingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [tone, setTone] = useState<Tone>("formal");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const letters = lettersQuery.data ?? [];
  const letter =
    letters.find((l) => l.id === viewingId) ??
    letters.find((l) => l.is_selected) ??
    letters[0] ??
    null;
  const form = draft ?? (letter ? toDraft(letter) : null);
  const isDirty = Boolean(
    draft && letter && JSON.stringify(draft) !== JSON.stringify(toDraft(letter)),
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["letters", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };
  const onError = (e: unknown) => setError(errorText(e));

  const generateMutation = useMutation({
    mutationFn: () => generateLetter(applicationId, tone, instructions),
    onSuccess: (created) => {
      setError(null);
      setDraft(null);
      setViewingId(created.id);
      refresh();
      toast.success(`Version ${created.version} written.`);
    },
    onError,
  });

  const saveMutation = useMutation({
    mutationFn: (changes: Parameters<typeof updateLetter>[1]) => updateLetter(letter!.id, changes),
    onSuccess: () => {
      setError(null);
      setDraft(null);
      refresh();
      toast.success("Letter saved.");
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLetter(id),
    onSuccess: () => {
      setViewingId(null);
      setDraft(null);
      refresh();
    },
    onError,
  });

  return {
    application: appQuery.data ?? null,
    isLoading: appQuery.isPending,
    notFound: appQuery.isError,
    letters,
    letter,
    form,
    isDirty,
    aiConfigured: healthQuery.data?.ai_configured ?? false,
    tone,
    instructions,
    isGenerating: generateMutation.isPending,
    isSaving: saveMutation.isPending,
    error,
    copied,
    setTone,
    setInstructions,
    generate: () => generateMutation.mutate(),
    viewVersion: (id) => {
      setViewingId(id);
      setDraft(null);
    },
    edit: (changes) => {
      if (form) setDraft({ ...form, ...changes });
    },
    save: () => {
      if (draft && letter) saveMutation.mutate(draft);
    },
    discard: () => setDraft(null),
    useVersion: () => {
      if (letter && !letter.is_selected) saveMutation.mutate({ is_selected: true });
    },
    deleteVersion: () => {
      if (letter) deleteMutation.mutate(letter.id);
    },
    copyLetter: () => {
      if (form) {
        void navigator.clipboard.writeText(form.content).then(
          () => setCopied(true),
          () => setError("Couldn't copy. Select the text and copy it manually."),
        );
      }
    },
  };
}
