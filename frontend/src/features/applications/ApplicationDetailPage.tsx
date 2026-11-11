// Connects the ViewModel to the View.
import { useParams } from "react-router-dom";

import { ApplicationDetailView } from "./ApplicationDetailView";
import { useApplicationDetailViewModel } from "./useApplicationDetailViewModel";

export function ApplicationDetailPage() {
  const { id } = useParams();
  const vm = useApplicationDetailViewModel(Number(id));
  return <ApplicationDetailView {...vm} />;
}
