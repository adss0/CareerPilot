// ViewModel: the applications list/board, selection and bulk actions.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getQueueStatus, sendMany, type QueueStatus } from "@/features/email/api";
import { errorText } from "@/lib/apiClient";

import {
  bulkApplications,
  cancelLetterJob,
  getLetterJob,
  listApplications,
  startBulkLetters,
  updateApplication,
  type Sort,
  type SortKey,
} from "./api";
import { STATUS_LABELS, isJobActive } from "./labels";
import type { Application, ApplicationPage, ApplicationStatus, LetterJob, Tone } from "./types";

export const PAGE_SIZE = 25;
export const BOARD_LIMIT = 200;
const VIEW_KEY = "careerpilot.applicationsView";

export type ViewMode = "table" | "board";

export interface ApplicationsViewModel {
  view: ViewMode;
  items: Application[];
  boardItems: Application[];
  boardTruncated: boolean;
  total: number;
  page: number;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  status: ApplicationStatus | "";
  sort: Sort;
  selected: Set<number>;
  allOnPageSelected: boolean;
  tone: Tone;
  skipExisting: boolean;
  job: LetterJob | null;
  isStarting: boolean;
  isBulkBusy: boolean;
  queue: QueueStatus | null;
  isSending: boolean;
  setView: (view: ViewMode) => void;
  setSearch: (value: string) => void;
  setStatus: (value: ApplicationStatus | "") => void;
  sortBy: (key: SortKey) => void;
  setPage: (page: number) => void;
  toggle: (id: number) => void;
  togglePage: () => void;
  clearSelection: () => void;
  setTone: (tone: Tone) => void;
  setSkipExisting: (value: boolean) => void;
  writeLetters: () => void;
  setSelectedStatus: (status: ApplicationStatus) => void;
  deleteSelected: () => void;
  sendSelected: () => void;
  moveCard: (id: number, status: ApplicationStatus) => void;
  cancelJob: () => void;
  dismissJob: () => void;
}

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table";
  } catch {
    return "table";
  }
}

export function useApplicationsViewModel(): ApplicationsViewModel {
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<ViewMode>(readView);
  const [search, setSearchValue] = useState("");
  const [status, setStatusValue] = useState<ApplicationStatus | "">("");
  const [sort, setSort] = useState<Sort>("-created_at");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tone, setTone] = useState<Tone>("formal");
  const [skipExisting, setSkipExisting] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["applications", "list", { search, status, sort, page }],
    queryFn: () =>
      listApplications({ search, status, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: view === "table",
  });

  // The board shows every status at once, so it ignores the status filter.
  const boardKey = ["applications", "board", { search }] as const;
  const boardQuery = useQuery({
    queryKey: boardKey,
    queryFn: () => listApplications({ search, sort: "-updated_at", limit: BOARD_LIMIT, offset: 0 }),
    placeholderData: keepPreviousData,
    enabled: view === "board",
  });

  const jobQuery = useQuery({
    queryKey: ["letter-job", jobId],
    queryFn: () => getLetterJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => (isJobActive(query.state.data) ? 1500 : false),
  });
  const job = jobQuery.data ?? null;

  const processed = job?.processed ?? 0;
  useEffect(() => {
    if (processed > 0) void queryClient.invalidateQueries({ queryKey: ["applications"] });
  }, [processed, job?.status, queryClient]);

  const onError = (e: unknown) => {
    setError(errorText(e));
    toast.error(errorText(e));
  };

  const startMutation = useMutation({
    mutationFn: startBulkLetters,
    onSuccess: (started) => {
      setError(null);
      setJobId(started.id);
      queryClient.setQueryData(["letter-job", started.id], started);
      setSelected(new Set());
      toast.success(`Writing ${started.total} cover letters in the background.`);
    },
    onError,
  });

  const bulkMutation = useMutation({
    mutationFn: bulkApplications,
    onSuccess: (result, body) => {
      setError(null);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(
        body.action === "delete"
          ? `Deleted ${result.affected} ${result.affected === 1 ? "job" : "jobs"}.`
          : `Moved ${result.affected} to ${STATUS_LABELS[body.status]}.`,
      );
    },
    onError,
  });

  const queueQuery = useQuery({
    queryKey: ["email-queue"],
    queryFn: getQueueStatus,
    refetchInterval: (q) => ((q.state.data?.queued ?? 0) > 0 ? 10_000 : false),
  });

  const sendMutation = useMutation({
    mutationFn: sendMany,
    onSuccess: (result) => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      if (result.queued) {
        const noun = result.queued === 1 ? "email" : "emails";
        toast.success(`Approved ${result.queued} ${noun}. They'll be sent one at a time.`);
      }
      if (result.skipped.length) {
        toast.warning(`Skipped ${result.skipped.length}: ${result.skipped[0].reason}`);
      }
    },
    onError,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status: next }: { id: number; status: ApplicationStatus }) =>
      updateApplication(id, { status: next }),
    onMutate: async ({ id, status: next }) => {
      // Move the card straight away; roll back if the server says no.
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData<ApplicationPage>(boardKey);
      queryClient.setQueryData<ApplicationPage>(boardKey, (old) =>
        old
          ? { ...old, items: old.items.map((a) => (a.id === id ? { ...a, status: next } : a)) }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      queryClient.setQueryData(boardKey, context?.previous);
      onError(e);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const items = listQuery.data?.items ?? [];
  const total = (view === "table" ? listQuery.data?.total : boardQuery.data?.total) ?? 0;
  const allOnPageSelected = items.length > 0 && items.every((a) => selected.has(a.id));
  const ids = [...selected];

  return {
    view,
    items,
    boardItems: boardQuery.data?.items ?? [],
    boardTruncated: (boardQuery.data?.total ?? 0) > BOARD_LIMIT,
    total,
    page,
    pageCount: Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / PAGE_SIZE)),
    isLoading: view === "table" ? listQuery.isPending : boardQuery.isPending,
    error: error ?? (listQuery.isError ? errorText(listQuery.error) : null),
    search,
    status,
    sort,
    selected,
    allOnPageSelected,
    tone,
    skipExisting,
    job,
    isStarting: startMutation.isPending,
    isBulkBusy: bulkMutation.isPending,
    queue: queueQuery.data ?? null,
    isSending: sendMutation.isPending,
    setView: (next) => {
      setViewState(next);
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        // not remembered; fine
      }
    },
    setSearch: (value) => {
      setSearchValue(value);
      setPage(0);
    },
    setStatus: (value) => {
      setStatusValue(value);
      setPage(0);
    },
    sortBy: (key) => {
      setSort((current) => (current === key ? `-${key}` : key));
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
      if (ids.length === 0 || isJobActive(job)) return;
      startMutation.mutate({
        application_ids: ids,
        tone,
        instructions: "",
        skip_existing: skipExisting,
      });
    },
    setSelectedStatus: (next) => {
      if (ids.length)
        bulkMutation.mutate({ application_ids: ids, action: "set_status", status: next });
    },
    deleteSelected: () => {
      if (ids.length) bulkMutation.mutate({ application_ids: ids, action: "delete" });
    },
    sendSelected: () => {
      if (ids.length) sendMutation.mutate(ids);
    },
    moveCard: (id, next) => moveMutation.mutate({ id, status: next }),
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
