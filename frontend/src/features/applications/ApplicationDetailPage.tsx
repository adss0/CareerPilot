// Connects the two ViewModels (letters, job details) to the View.
import { useParams } from "react-router-dom";

import { ApplicationDetailView } from "./ApplicationDetailView";
import { JobDetailsView } from "./JobDetailsView";
import { useApplicationDetailViewModel } from "./useApplicationDetailViewModel";
import { useJobDetailsViewModel } from "./useJobDetailsViewModel";

export function ApplicationDetailPage() {
  const { id } = useParams();
  const applicationId = Number(id);
  const vm = useApplicationDetailViewModel(applicationId);
  const details = useJobDetailsViewModel(applicationId);
  return <ApplicationDetailView {...vm} details={<JobDetailsView {...details} />} />;
}
