// ViewModel: choosing the AI provider and model, and testing the connection.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorText } from "@/lib/apiClient";

import {
  getAiSettings,
  testAiConnection,
  updateAiSettings,
  type AiSettings,
  type AiTestResult,
  type ProviderName,
} from "./api";

export interface SettingsViewModel {
  settings: AiSettings | null;
  isLoading: boolean;
  error: string | null;
  provider: ProviderName | null;
  model: string;
  gap: string;
  isDirty: boolean;
  isSaving: boolean;
  isTesting: boolean;
  testResult: AiTestResult | null;
  chooseProvider: (provider: ProviderName) => void;
  setModel: (model: string) => void;
  setGap: (gap: string) => void;
  save: () => void;
  test: () => void;
}

export function useSettingsViewModel(): SettingsViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "ai"], queryFn: getAiSettings });
  const settings = query.data ?? null;

  // null = unchanged from the saved settings
  const [provider, setProvider] = useState<ProviderName | null>(null);
  const [modelDraft, setModelDraft] = useState<Partial<Record<ProviderName, string>>>({});
  const [gapDraft, setGapDraft] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = provider ?? settings?.provider ?? null;
  const saved = settings?.providers.find((p) => p.name === current);
  const model = current ? (modelDraft[current] ?? saved?.model ?? "") : "";
  const gap = gapDraft ?? String(settings?.request_gap_seconds ?? "");
  const isDirty = Boolean(
    settings &&
      (current !== settings.provider ||
        (current && modelDraft[current] !== undefined && modelDraft[current] !== saved?.model) ||
        (gapDraft !== null && Number(gapDraft) !== settings.request_gap_seconds)),
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAiSettings({
        provider: current ?? undefined,
        model: model.trim() === saved?.default_model ? "" : model.trim(),
        request_gap_seconds: gap === "" ? undefined : Number(gap),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings", "ai"], updated);
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      setProvider(null);
      setModelDraft({});
      setGapDraft(null);
      setError(null);
      setTestResult(null);
    },
    onError: (e) => setError(errorText(e)),
  });

  const testMutation = useMutation({
    mutationFn: testAiConnection,
    onSuccess: (result) => setTestResult(result),
    onError: (e) => setError(errorText(e)),
  });

  return {
    settings,
    isLoading: query.isPending,
    error: error ?? (query.isError ? errorText(query.error) : null),
    provider: current,
    model,
    gap,
    isDirty,
    isSaving: saveMutation.isPending,
    isTesting: testMutation.isPending,
    testResult,
    chooseProvider: (name) => {
      setProvider(name);
      setTestResult(null);
    },
    setModel: (value) => {
      if (current) setModelDraft((drafts) => ({ ...drafts, [current]: value }));
    },
    setGap: setGapDraft,
    save: () => saveMutation.mutate(),
    test: () => {
      setTestResult(null);
      testMutation.mutate();
    },
  };
}
