// ViewModel: the job tracker. A simple sheet you keep up to date yourself, with a side panel.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteApplication,
  getTrackerSummary,
  listApplications,
  summarizeApplication,
  updateApplication,
  type ApplicationInput,
  type Sort,
} from "@/features/applications/api";
import type { Application, ApplicationStatus, TrackerSummary } from "@/features/applications/types";
import { errorText } from "@/lib/apiClient";

export const TRACKER_LIMIT = 200;
const VIEW_KEY = "careerpilot.trackerView";
const HIDE_KEY = "careerpilot.hideClosed";

export type TrackerViewMode = "table" | "board";

export interface TrackerViewModel {
  view: TrackerViewMode;
  items: Application[];
  total: number;
  summary: TrackerSummary | null;
  isLoading: boolean;
  error: string | null;
  search: string;
  status: ApplicationStatus | "";
  sort: Sort;
  hideClosed: boolean;
  selected: Application | null;
  isSummarizing: boolean;
  setView: (view: TrackerViewMode) => void;
  setSearch: (value: string) => void;
  setStatus: (value: ApplicationStatus | "") => void;
  setSort: (value: Sort) => void;
  setHideClosed: (value: boolean) => void;
  select: (id: number | null) => void;
  update: (id: number, changes: ApplicationInput) => void;
  summarize: () => void;
  remove: (id: number) => void;
}

function readHide(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function readView(): TrackerViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table";
  } catch {
    return "table";
  }
}

export function useTrackerViewModel(): TrackerViewModel {
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<TrackerViewMode>(readView);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [sort, setSort] = useState<Sort>("created_at"); // the order you added them, like a sheet
  const [hideClosed, setHideClosedState] = useState(readHide);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["applications", "tracker", { search, status, sort, hideClosed }],
    queryFn: () =>
      listApplications({ search, status, sort, hideClosed, limit: TRACKER_LIMIT, offset: 0 }),
    placeholderData: keepPreviousData,
  });
  const summaryQuery = useQuery({
    queryKey: ["applications", "summary"],
    queryFn: getTrackerSummary,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ApplicationInput }) =>
      updateApplication(id, changes),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(errorText(e)),
  });

  const summarizeMutation = useMutation({
    mutationFn: (id: number) => summarizeApplication(id),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => setError(errorText(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteApplication(id),
    onSuccess: () => {
      setSelectedId(null);
      refresh();
      toast.success("Job removed from your tracker.");
    },
    onError: (e) => setError(errorText(e)),
  });

  const items = listQuery.data?.items ?? [];
  return {
    view,
    items,
    total: listQuery.data?.total ?? 0,
    summary: summaryQuery.data ?? null,
    isLoading: listQuery.isPending,
    error: error ?? (listQuery.error ? errorText(listQuery.error) : null),
    search,
    status,
    sort,
    hideClosed,
    selected: items.find((a) => a.id === selectedId) ?? null,
    isSummarizing: summarizeMutation.isPending,
    setView: (next) => {
      setViewState(next);
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        // storage blocked: the choice just isn't remembered
      }
    },
    setSearch,
    setStatus,
    setSort,
    setHideClosed: (value) => {
      setHideClosedState(value);
      try {
        localStorage.setItem(HIDE_KEY, value ? "1" : "0");
      } catch {
        // not remembered
      }
    },
    select: setSelectedId,
    update: (id, changes) => updateMutation.mutate({ id, changes }),
    summarize: () => {
      if (selectedId !== null) summarizeMutation.mutate(selectedId);
    },
    remove: (id) => {
      const job = items.find((a) => a.id === id);
      if (job && window.confirm(`Remove ${job.role} at ${job.company} from your tracker?`)) {
        deleteMutation.mutate(id);
      }
    },
  };
}
