// Connects the ViewModels (letters, applying, job details) to the View.
import { useParams } from "react-router-dom";

import { ApplyView } from "@/features/email/ApplyView";
import { useApplyViewModel } from "@/features/email/useApplyViewModel";

import { ApplicationDetailView } from "./ApplicationDetailView";
import { JobDetailsView } from "./JobDetailsView";
import { useApplicationDetailViewModel } from "./useApplicationDetailViewModel";
import { useJobDetailsViewModel } from "./useJobDetailsViewModel";

export function ApplicationDetailPage() {
  const { id } = useParams();
  const applicationId = Number(id);
  const vm = useApplicationDetailViewModel(applicationId);
  const details = useJobDetailsViewModel(applicationId);
  const apply = useApplyViewModel(applicationId);
  return (
    <ApplicationDetailView
      {...vm}
      details={<JobDetailsView {...details} />}
      apply={<ApplyView {...apply} />}
    />
  );
}
