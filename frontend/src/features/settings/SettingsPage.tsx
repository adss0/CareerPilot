// Connects the ViewModels (AI provider, email, backup) to their Views.
import { EmailSettingsView } from "@/features/email/EmailSettingsView";
import { useEmailSettingsViewModel } from "@/features/email/useEmailSettingsViewModel";
import { NotificationSettingsView } from "@/features/tracking/NotificationSettingsView";

import { BackupView } from "./BackupView";
import { SettingsView } from "./SettingsView";
import { useBackupViewModel } from "./useBackupViewModel";
import { useSettingsViewModel } from "./useSettingsViewModel";

export function SettingsPage() {
  const vm = useSettingsViewModel();
  const email = useEmailSettingsViewModel();
  const backup = useBackupViewModel();
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsView {...vm} />
      <EmailSettingsView {...email} />
      <NotificationSettingsView />
      <BackupView {...backup} />
    </div>
  );
}
