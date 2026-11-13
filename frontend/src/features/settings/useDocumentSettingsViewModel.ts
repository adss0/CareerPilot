// ViewModel: where tailored CVs and cover letters are saved, and whether that's automatic.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  getDocumentSettings,
  openDocumentsFolder,
  updateDocumentSettings,
  type DocumentSettings,
} from "@/features/documents/api";
import { errorText } from "@/lib/apiClient";

export interface DocumentSettingsViewModel {
  settings: DocumentSettings | null;
  folder: string;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  setFolder: (value: string) => void;
  saveFolder: () => void;
  useDefault: () => void;
  setAutoSave: (on: boolean) => void;
  openFolder: () => void;
}

export function useDocumentSettingsViewModel(): DocumentSettingsViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "documents"], queryFn: getDocumentSettings });
  const settings = query.data ?? null;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const folder = draft ?? settings?.folder ?? "";

  const mutation = useMutation({
    mutationFn: updateDocumentSettings,
    onSuccess: (saved) => {
      setError(null);
      setDraft(null);
      queryClient.setQueryData(["settings", "documents"], saved);
      toast.success("Documents settings saved.");
    },
    onError: (e) => setError(errorText(e)),
  });

  return {
    settings,
    folder,
    isDirty: draft !== null && draft.trim() !== settings?.folder,
    isSaving: mutation.isPending,
    error,
    setFolder: setDraft,
    saveFolder: () => mutation.mutate({ folder: folder.trim() }),
    useDefault: () => mutation.mutate({ folder: "" }),
    setAutoSave: (on) => mutation.mutate({ auto_save: on }),
    openFolder: () => {
      openDocumentsFolder().catch((e: unknown) => setError(errorText(e)));
    },
  };
}
