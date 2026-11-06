// Connects the ViewModel to the View.
import { DashboardView } from "./DashboardView";
import { useDashboardViewModel } from "./useDashboardViewModel";

export function DashboardPage() {
  const vm = useDashboardViewModel();
  return <DashboardView {...vm} />;
}
