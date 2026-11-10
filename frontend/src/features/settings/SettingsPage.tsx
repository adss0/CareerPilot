// Connects the ViewModel to the View.
import { SettingsView } from "./SettingsView";
import { useSettingsViewModel } from "./useSettingsViewModel";

export function SettingsPage() {
  const vm = useSettingsViewModel();
  return <SettingsView {...vm} />;
}
