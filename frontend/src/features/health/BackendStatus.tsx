// Connects the ViewModel to the View.
import { BackendStatusView } from "./BackendStatusView";
import { useHealthViewModel } from "./useHealthViewModel";

export function BackendStatus() {
  const vm = useHealthViewModel();
  return <BackendStatusView {...vm} />;
}
