// ViewModel: pasting API keys and the email password. They're saved to the .env file only,
// and the app never shows them again (it only knows whether each one is set).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  getSecrets,
  setSecret,
  type SecretName,
  type SecretsStatus,
} from "@/features/documents/api";
import { errorText } from "@/lib/apiClient";

export interface KeysViewModel {
  status: SecretsStatus | null;
  drafts: Record<SecretName, string>;
  saving: SecretName | null;
  error: string | null;
  setDraft: (name: SecretName, value: string) => void;
  save: (name: SecretName) => void;
  remove: (name: SecretName) => void;
}

const LABELS: Record<SecretName, string> = {
  gemini: "Gemini key",
  groq: "Groq key",
  email: "Email password",
};

export function useKeysViewModel(): KeysViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "secrets"], queryFn: getSecrets });
  const [drafts, setDrafts] = useState<Record<SecretName, string>>({
    gemini: "",
    groq: "",
    email: "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ name, value }: { name: SecretName; value: string }) => setSecret(name, value),
    onSuccess: (status, { name, value }) => {
      setError(null);
      setDrafts((d) => ({ ...d, [name]: "" })); // never keep a key on screen
      queryClient.setQueryData(["settings", "secrets"], status);
      // AI and email settings show whether they're set up.
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      toast.success(value ? `${LABELS[name]} saved.` : `${LABELS[name]} removed.`);
    },
    onError: (e) => setError(errorText(e)),
  });

  return {
    status: query.data ?? null,
    drafts,
    saving: mutation.isPending ? (mutation.variables?.name ?? null) : null,
    error,
    setDraft: (name, value) => setDrafts((d) => ({ ...d, [name]: value })),
    save: (name) => {
      if (drafts[name].trim()) mutation.mutate({ name, value: drafts[name] });
    },
    remove: (name) => {
      if (window.confirm(`Remove your ${LABELS[name].toLowerCase()}?`)) {
        mutation.mutate({ name, value: "" });
      }
    },
  };
}
