// ViewModel: email (SMTP/IMAP) settings and the connection test.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { errorText } from "@/lib/apiClient";

import {
  getEmailSettings,
  testEmailConnection,
  updateEmailSettings,
  type EmailSettings,
  type EmailSettingsRead,
} from "./api";

export const PRESETS: Record<string, Partial<EmailSettings>> = {
  Gmail: {
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_security: "starttls",
    imap_host: "imap.gmail.com",
    imap_port: 993,
  },
  Outlook: {
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: 587,
    smtp_security: "starttls",
    imap_host: "outlook.office365.com",
    imap_port: 993,
  },
};

export interface EmailSettingsViewModel {
  saved: EmailSettingsRead | null;
  form: EmailSettings | null;
  isDirty: boolean;
  isSaving: boolean;
  isTesting: boolean;
  testResult: { ok: boolean; message: string } | null;
  change: (changes: Partial<EmailSettings>) => void;
  save: () => void;
  discard: () => void;
  test: () => void;
}

const SETTING_KEYS: (keyof EmailSettings)[] = [
  "from_name",
  "from_address",
  "smtp_host",
  "smtp_port",
  "smtp_security",
  "username",
  "imap_host",
  "imap_port",
  "daily_limit",
  "min_gap_seconds",
  "max_gap_seconds",
  "signature",
  "test_mode",
  "test_address",
  "follow_up_days",
];

/** Just the editable settings (drops password_set, ready, problems). */
function editable(s: EmailSettingsRead): EmailSettings {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) as unknown as EmailSettings;
}

export function useEmailSettingsViewModel(): EmailSettingsViewModel {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "email"], queryFn: getEmailSettings });
  const [draft, setDraft] = useState<EmailSettings | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const saved = query.data ?? null;
  const form = draft ?? (saved ? editable(saved) : null);
  const isDirty = Boolean(
    draft && saved && JSON.stringify(draft) !== JSON.stringify(editable(saved)),
  );

  const saveMutation = useMutation({
    mutationFn: (changes: EmailSettings) =>
      updateEmailSettings({
        ...changes,
        from_address: changes.from_address || null,
        test_address: changes.test_address || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings", "email"], updated);
      void queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      setDraft(null);
      setTestResult(null);
      toast.success("Email settings saved.");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const testMutation = useMutation({
    mutationFn: testEmailConnection,
    onSuccess: setTestResult,
    onError: (e) => toast.error(errorText(e)),
  });

  return {
    saved,
    form,
    isDirty,
    isSaving: saveMutation.isPending,
    isTesting: testMutation.isPending,
    testResult,
    change: (changes) => {
      if (form) setDraft({ ...form, ...changes });
    },
    save: () => {
      if (draft) saveMutation.mutate(draft);
    },
    discard: () => setDraft(null),
    test: () => {
      setTestResult(null);
      testMutation.mutate();
    },
  };
}
