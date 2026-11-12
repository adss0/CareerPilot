// Connects the ViewModels (AI provider, email) to their Views.
import { EmailSettingsView } from "@/features/email/EmailSettingsView";
import { useEmailSettingsViewModel } from "@/features/email/useEmailSettingsViewModel";

import { SettingsView } from "./SettingsView";
import { useSettingsViewModel } from "./useSettingsViewModel";

export function SettingsPage() {
  const vm = useSettingsViewModel();
  const email = useEmailSettingsViewModel();
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsView {...vm} />
      <EmailSettingsView {...email} />
    </div>
  );
}
