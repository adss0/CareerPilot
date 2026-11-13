// Connects the tracker ViewModel to its View.
import { TrackerView } from "@/features/tracker/TrackerView";
import { useTrackerViewModel } from "@/features/tracker/useTrackerViewModel";

export function ApplicationsPage() {
  const vm = useTrackerViewModel();
  return <TrackerView {...vm} />;
}
