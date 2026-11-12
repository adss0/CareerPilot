// Connects the ViewModels (letters, applying, job details) to the View.
import { useParams } from "react-router-dom";

import { ApplyView } from "@/features/email/ApplyView";
import { useApplyViewModel } from "@/features/email/useApplyViewModel";
import { FollowUpView } from "@/features/tracking/FollowUpView";
import { useFollowUpViewModel } from "@/features/tracking/useFollowUpViewModel";

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
  const followUp = useFollowUpViewModel(applicationId);
  return (
    <ApplicationDetailView
      {...vm}
      details={<JobDetailsView {...details} />}
      apply={
        <div className="space-y-6">
          <FollowUpView {...followUp} />
          <ApplyView {...apply} />
        </div>
      }
    />
  );
}
