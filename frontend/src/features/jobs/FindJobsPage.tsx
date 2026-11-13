// Connects the ViewModel to the View.
import { FindJobsView } from "./FindJobsView";
import { useFindJobsViewModel } from "./useFindJobsViewModel";

export function FindJobsPage() {
  const vm = useFindJobsViewModel();
  return <FindJobsView {...vm} />;
}
