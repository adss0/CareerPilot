// Connects the ViewModels (keys, AI provider, email, documents, backup) to their Views.
import { EmailSettingsView } from "@/features/email/EmailSettingsView";
import { useEmailSettingsViewModel } from "@/features/email/useEmailSettingsViewModel";
import { NotificationSettingsView } from "@/features/tracking/NotificationSettingsView";

import { BackupView } from "./BackupView";
import { DocumentSettingsView } from "./DocumentSettingsView";
import { KeysView } from "./KeysView";
import { SettingsView } from "./SettingsView";
import { useBackupViewModel } from "./useBackupViewModel";
import { useDocumentSettingsViewModel } from "./useDocumentSettingsViewModel";
import { useKeysViewModel } from "./useKeysViewModel";
import { useSettingsViewModel } from "./useSettingsViewModel";

export function SettingsPage() {
  const vm = useSettingsViewModel();
  const keys = useKeysViewModel();
  const email = useEmailSettingsViewModel();
  const documents = useDocumentSettingsViewModel();
  const backup = useBackupViewModel();
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsView {...vm} />
      <KeysView {...keys} />
      <EmailSettingsView {...email} />
      <DocumentSettingsView {...documents} />
      <NotificationSettingsView />
      <BackupView {...backup} />
    </div>
  );
}
