// ViewModel: the job tracker. A simple sheet you keep up to date yourself, with a side panel.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  bulkApplications,
  deleteAllApplications,
  deleteApplication,
  deleteFromBin,
  emptyBin,
  listBin,
  restoreFromBin,
  getTrackerSummary,
  listApplications,
  summarizeApplication,
  updateApplication,
  type ApplicationInput,
  type Sort,
} from "@/features/applications/api";
import type {
  Application,
  ApplicationStatus,
  BinItem,
  TrackerSummary,
} from "@/features/applications/types";
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
  // Deleting: tick rows, delete everything, and the recycle bin (30 days).
  checked: Set<number>;
  toggleChecked: (id: number) => void;
  toggleAllChecked: () => void;
  clearChecked: () => void;
  deleteChecked: () => void;
  deleteEverything: (typed: string) => Promise<boolean>;
  bin: BinItem[];
  showBin: boolean;
  setShowBin: (show: boolean) => void;
  restore: (id: number) => void;
  deleteForever: (id: number) => void;
  emptyTheBin: () => void;
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

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showBin, setShowBin] = useState(false);
  const binQuery = useQuery({ queryKey: ["applications", "bin"], queryFn: listBin });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteApplication(id),
    onSuccess: () => {
      setSelectedId(null);
      refresh();
      toast.success("Moved to the recycle bin. You can restore it for 30 days.");
    },
    onError: (e) => setError(errorText(e)),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => bulkApplications({ application_ids: ids, action: "delete" }),
    onSuccess: (result) => {
      setChecked(new Set());
      setSelectedId(null);
      refresh();
      toast.success(
        `${result.affected} ${result.affected === 1 ? "job" : "jobs"} moved to the recycle bin.`,
      );
    },
    onError: (e) => setError(errorText(e)),
  });

  const binAction = useMutation({
    mutationFn: ({ kind, id }: { kind: "restore" | "forever" | "empty"; id?: number }) =>
      kind === "restore"
        ? restoreFromBin(id!)
        : kind === "forever"
          ? deleteFromBin(id!)
          : emptyBin(),
    onSuccess: (_result, { kind }) => {
      refresh();
      toast.success(
        kind === "restore"
          ? "Restored to your tracker."
          : kind === "empty"
            ? "Recycle bin emptied."
            : "Deleted for good.",
      );
    },
    onError: (e) => setError(errorText(e)),
  });

  const items = listQuery.data?.items ?? [];
  return {
    view,
    items,
    total: listQuery.data?.total ?? 0,
    summary: summaryQuery.data ?? null,
    isLoading: !listQuery.isSuccess,
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
      if (job && window.confirm(`Move ${job.role} at ${job.company} to the recycle bin?`)) {
        deleteMutation.mutate(id);
      }
    },
    checked,
    toggleChecked: (id) =>
      setChecked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAllChecked: () =>
      setChecked((current) =>
        items.length > 0 && items.every((a) => current.has(a.id))
          ? new Set()
          : new Set(items.map((a) => a.id)),
      ),
    clearChecked: () => setChecked(new Set()),
    deleteChecked: () => {
      const ids = [...checked];
      if (
        ids.length &&
        window.confirm(
          `Move ${ids.length} ${ids.length === 1 ? "job" : "jobs"} to the recycle bin? ` +
            "You can restore them for 30 days.",
        )
      ) {
        bulkDelete.mutate(ids);
      }
    },
    deleteEverything: async (typed) => {
      if (typed !== "DELETE") return false;
      try {
        const result = await deleteAllApplications();
        setChecked(new Set());
        setSelectedId(null);
        refresh();
        toast.success(`${result.deleted} jobs moved to the recycle bin.`, {
          description: `A full backup was saved first: ${result.backup}`,
        });
        return true;
      } catch (e) {
        setError(errorText(e));
        return false;
      }
    },
    bin: binQuery.data ?? [],
    showBin,
    setShowBin,
    restore: (id) => binAction.mutate({ kind: "restore", id }),
    deleteForever: (id) => {
      if (window.confirm("Delete this job for good? This can't be undone.")) {
        binAction.mutate({ kind: "forever", id });
      }
    },
    emptyTheBin: () => {
      if (window.confirm("Empty the recycle bin? These jobs will be gone for good.")) {
        binAction.mutate({ kind: "empty" });
      }
    },
  };
}
