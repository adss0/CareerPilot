// Connects the ViewModel to the View.
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { rememberApplying } from "./applying";
import { ApplyView } from "./ApplyView";
import { useApplyViewModel } from "./useApplyViewModel";

export function ApplyPage() {
  const { id } = useParams();
  const vm = useApplyViewModel(Number(id));
  const job = vm.letters.application;

  // Remember this page until the job is applied for, so the sidebar can bring you back.
  const applied = job ? !["imported", "drafted", "ready"].includes(job.status) : null;
  useEffect(() => {
    if (job && applied === false) {
      rememberApplying({ id: job.id, role: job.role, company: job.company });
    } else if (applied) {
      rememberApplying(null);
    }
  }, [job, applied]);

  return <ApplyView {...vm} />;
}
