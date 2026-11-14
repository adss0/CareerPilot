// ViewModel: adding a single job by hand.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { listCvs } from "@/features/profile/api";
import { errorText } from "@/lib/apiClient";

import { createApplication } from "./api";
import { EMPTY_JOB, toJobInput, validateJob, type JobFormValues } from "./jobForm";

export interface NewApplicationViewModel {
  values: JobFormValues;
  problems: Partial<Record<keyof JobFormValues, string>>;
  cvs: { id: number; label: string; is_default: boolean }[];
  isSaving: boolean;
  change: (changes: Partial<JobFormValues>) => void;
  submit: () => void;
}

export function useNewApplicationViewModel(): NewApplicationViewModel {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cvsQuery = useQuery({ queryKey: ["cvs"], queryFn: listCvs });
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB);
  const [showProblems, setShowProblems] = useState(false);

  const mutation = useMutation({
    mutationFn: (v: JobFormValues) => createApplication(toJobInput(v)),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(`Added ${created.company}.`);
      navigate("/applications");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return {
    values,
    problems: showProblems ? validateJob(values) : {},
    cvs: cvsQuery.data ?? [],
    isSaving: mutation.isPending,
    change: (changes) => setValues((current) => ({ ...current, ...changes })),
    submit: () => {
      if (Object.keys(validateJob(values)).length) {
        setShowProblems(true);
        return;
      }
      mutation.mutate(values);
    },
  };
}
