// ViewModel: the applications list, selection and bulk cover-letter writing.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { errorText } from "@/lib/apiClient";

import { cancelLetterJob, getLetterJob, listApplications, startBulkLetters } from "./api";
import { isJobActive } from "./labels";
import type { Application, ApplicationStatus, LetterJob, Tone } from "./types";

export const PAGE_SIZE = 25;

export interface ApplicationsViewModel {
  items: Application[];
  total: number;
  page: number;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  status: ApplicationStatus | "";
  selected: Set<number>;
  allOnPageSelected: boolean;
  tone: Tone;
  skipExisting: boolean;
  job: LetterJob | null;
  isStarting: boolean;
  setSearch: (value: string) => void;
  setStatus: (value: ApplicationStatus | "") => void;
  setPage: (page: number) => void;
  toggle: (id: number) => void;
  togglePage: () => void;
  clearSelection: () => void;
  setTone: (tone: Tone) => void;
  setSkipExisting: (value: boolean) => void;
  writeLetters: () => void;
  cancelJob: () => void;
  dismissJob: () => void;
}

export function useApplicationsViewModel(): ApplicationsViewModel {
  const queryClient = useQueryClient();
  const [search, setSearchValue] = useState("");
  const [status, setStatusValue] = useState<ApplicationStatus | "">("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tone, setTone] = useState<Tone>("formal");
  const [skipExisting, setSkipExisting] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["applications", "list", { search, status, page }],
    queryFn: () => listApplications({ search, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const jobQuery = useQuery({
    queryKey: ["letter-job", jobId],
    queryFn: () => getLetterJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => (isJobActive(query.state.data) ? 1500 : false),
  });
  const job = jobQuery.data ?? null;

  // Refresh the table as letters get written, and once more when the job ends.
  const processed = job?.processed ?? 0;
  useEffect(() => {
    if (processed > 0) void queryClient.invalidateQueries({ queryKey: ["applications"] });
  }, [processed, job?.status, queryClient]);

  const startMutation = useMutation({
    mutationFn: startBulkLetters,
    onSuccess: (started) => {
      setError(null);
      setJobId(started.id);
      queryClient.setQueryData(["letter-job", started.id], started);
      setSelected(new Set());
    },
    onError: (e) => setError(errorText(e)),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const allOnPageSelected = items.length > 0 && items.every((a) => selected.has(a.id));

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    isLoading: listQuery.isPending,
    error: error ?? (listQuery.isError ? errorText(listQuery.error) : null),
    search,
    status,
    selected,
    allOnPageSelected,
    tone,
    skipExisting,
    job,
    isStarting: startMutation.isPending,
    setSearch: (value) => {
      setSearchValue(value);
      setPage(0);
    },
    setStatus: (value) => {
      setStatusValue(value);
      setPage(0);
    },
    setPage,
    toggle: (id) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    togglePage: () =>
      setSelected((current) => {
        const next = new Set(current);
        for (const a of items) {
          if (allOnPageSelected) next.delete(a.id);
          else next.add(a.id);
        }
        return next;
      }),
    clearSelection: () => setSelected(new Set()),
    setTone,
    setSkipExisting,
    writeLetters: () => {
      if (selected.size === 0 || isJobActive(job)) return;
      startMutation.mutate({
        application_ids: [...selected],
        tone,
        instructions: "",
        skip_existing: skipExisting,
      });
    },
    cancelJob: () => {
      if (jobId) {
        void cancelLetterJob(jobId).then((updated) =>
          queryClient.setQueryData(["letter-job", jobId], updated),
        );
      }
    },
    dismissJob: () => setJobId(null),
  };
}
