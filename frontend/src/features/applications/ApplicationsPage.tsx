// Connects the ViewModel to the View.
import { ApplicationsView } from "./ApplicationsView";
import { useApplicationsViewModel } from "./useApplicationsViewModel";

export function ApplicationsPage() {
  const vm = useApplicationsViewModel();
  return <ApplicationsView {...vm} />;
}
