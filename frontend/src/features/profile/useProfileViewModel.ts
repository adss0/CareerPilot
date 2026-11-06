// ViewModel: the profile form, the user's CVs, and filling the form from a CV.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchHealth } from "@/features/health/api";
import { errorText } from "@/lib/apiClient";

import {
  CV_EXTENSIONS,
  MAX_CV_BYTES,
  deleteCv,
  getProfile,
  listCvs,
  parseCv,
  saveProfile,
  updateCv,
  uploadCv,
} from "./api";
import { EMPTY_ITEMS, mergeDetails, sameDetails, toDetails } from "./profileDraft";
import type { Cv, CvParseResult, ListItem, ListName, ProfileDetails, TextField } from "./types";

export interface ParseNotice {
  cvLabel: string;
  parser: CvParseResult["parser"];
  warnings: string[];
}

export interface ProfileViewModel {
  isLoading: boolean;
  loadError: string | null;
  form: ProfileDetails | null;
  isDirty: boolean;
  isSaving: boolean;
  savedAt: number | null;
  error: string | null;
  cvs: Cv[];
  isUploading: boolean;
  busyCvId: number | null;
  parseNotice: ParseNotice | null;
  aiConfigured: boolean;
  useAi: boolean;
  setUseAi: (value: boolean) => void;
  setField: (field: TextField, value: string) => void;
  addSkill: (skill: string) => void;
  removeSkill: (skill: string) => void;
  addItem: (list: ListName) => void;
  updateItem: <L extends ListName>(list: L, index: number, changes: Partial<ListItem<L>>) => void;
  removeItem: (list: ListName, index: number) => void;
  save: () => void;
  discard: () => void;
  uploadCv: (file: File) => void;
  readCvAgain: (id: number) => void;
  makeDefault: (id: number) => void;
  renameCv: (id: number, label: string) => void;
  removeCv: (id: number) => void;
  dismissNotice: () => void;
}

export function validateCvFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!CV_EXTENSIONS.some((ext) => name.endsWith(ext))) return "Choose a .pdf, .docx or .txt file.";
  if (file.size > MAX_CV_BYTES) return "The file is over 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

export function useProfileViewModel(): ProfileViewModel {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const cvsQuery = useQuery({ queryKey: ["cvs"], queryFn: listCvs });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });

  // null = no unsaved edits; the form then shows the saved profile.
  const [draft, setDraft] = useState<ProfileDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [parseNotice, setParseNotice] = useState<ParseNotice | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [busyCvId, setBusyCvId] = useState<number | null>(null);

  const profile = profileQuery.data;
  const form = draft ?? (profile ? toDetails(profile) : null);
  const isDirty = Boolean(draft && profile && !sameDetails(draft, profile));

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const edit = (change: (current: ProfileDetails) => ProfileDetails) => {
    if (!form) return;
    setDraft(change(form));
    setSavedAt(null);
  };

  const applyParse = (result: CvParseResult) => {
    edit((current) => mergeDetails(current, result.details));
    setParseNotice({ cvLabel: result.cv.label, parser: result.parser, warnings: result.warnings });
    void queryClient.invalidateQueries({ queryKey: ["cvs"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const onError = (e: unknown) => setError(errorText(e));

  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (saved) => {
      queryClient.setQueryData(["profile"], saved);
      setDraft(null);
      setError(null);
      setParseNotice(null);
      setSavedAt(Date.now());
    },
    onError,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCv(file, useAi),
    onSuccess: (result) => {
      setError(null);
      applyParse(result);
    },
    onError,
  });

  const cvMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["cvs"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError,
    onSettled: () => setBusyCvId(null),
  });

  const runCvAction = (id: number, action: () => Promise<unknown>) => {
    setBusyCvId(id);
    cvMutation.mutate(action);
  };

  return {
    isLoading: profileQuery.isPending,
    loadError: profileQuery.isError ? errorText(profileQuery.error) : null,
    form,
    isDirty,
    isSaving: saveMutation.isPending,
    savedAt,
    error,
    cvs: cvsQuery.data ?? [],
    isUploading: uploadMutation.isPending,
    busyCvId,
    parseNotice,
    aiConfigured: healthQuery.data?.ai_configured ?? false,
    useAi,
    setUseAi,
    setField: (field, value) => edit((current) => ({ ...current, [field]: value })),
    addSkill: (skill) =>
      edit((current) => {
        const additions = skill
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && !current.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
        return { ...current, skills: [...current.skills, ...new Set(additions)] };
      }),
    removeSkill: (skill) =>
      edit((current) => ({ ...current, skills: current.skills.filter((s) => s !== skill) })),
    addItem: (list) =>
      edit((current) => ({ ...current, [list]: [...current[list], { ...EMPTY_ITEMS[list] }] })),
    updateItem: (list, index, changes) =>
      edit((current) => ({
        ...current,
        [list]: current[list].map((item, i) => (i === index ? { ...item, ...changes } : item)),
      })),
    removeItem: (list, index) =>
      edit((current) => ({ ...current, [list]: current[list].filter((_, i) => i !== index) })),
    save: () => {
      if (form) saveMutation.mutate(form);
    },
    discard: () => {
      setDraft(null);
      setParseNotice(null);
      setError(null);
    },
    uploadCv: (file) => {
      const problem = validateCvFile(file);
      if (problem) {
        setError(problem);
        return;
      }
      uploadMutation.mutate(file);
    },
    readCvAgain: (id) => {
      setBusyCvId(id);
      parseCv(id, useAi)
        .then((result) => {
          setError(null);
          applyParse(result);
        })
        .catch(onError)
        .finally(() => setBusyCvId(null));
    },
    makeDefault: (id) => runCvAction(id, () => updateCv(id, { is_default: true })),
    renameCv: (id, label) => {
      if (label.trim()) runCvAction(id, () => updateCv(id, { label: label.trim() }));
    },
    removeCv: (id) => runCvAction(id, () => deleteCv(id)),
    dismissNotice: () => setParseNotice(null),
  };
}
