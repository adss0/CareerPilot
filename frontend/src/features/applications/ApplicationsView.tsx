// View: the applications table or board, with filters and bulk actions.
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  Loader2,
  PenLine,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { SortKey } from "./api";
import { BoardView } from "./BoardView";
import { BulkJobView } from "./BulkJobView";
import { STATUS_LABELS, TONE_LABELS, isJobActive, scoreLabel, statusVariant } from "./labels";
import type { ApplicationStatus, Tone } from "./types";
import type { ApplicationsViewModel } from "./useApplicationsViewModel";

function SortHeader({
  vm,
  column,
  children,
}: {
  vm: ApplicationsViewModel;
  column: SortKey;
  children: string;
}) {
  const active = vm.sort === column || vm.sort === `-${column}`;
  const descending = vm.sort.startsWith("-");
  return (
    <th
      className="py-3 pr-4 font-medium"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => vm.sortBy(column)}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {children}
        {active &&
          (descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
      </button>
    </th>
  );
}

export function ApplicationsView(vm: ApplicationsViewModel) {
  const busy = isJobActive(vm.job);
  const count = vm.selected.size;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm">
            {vm.total} {vm.total === 1 ? "job" : "jobs"} in your tracker.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/import">
              <FileSpreadsheet />
              Import
            </Link>
          </Button>
          <Button asChild>
            <Link to="/applications/new">
              <Plus />
              Add job
            </Link>
          </Button>
        </div>
      </div>

      {vm.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {vm.error}
        </div>
      )}

      {vm.job && <BulkJobView job={vm.job} onCancel={vm.cancelJob} onDismiss={vm.dismissJob} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={vm.search}
            onChange={(e) => vm.setSearch(e.target.value)}
            placeholder="Search company or role"
            aria-label="Search applications"
            className="pl-9"
          />
        </div>
        {vm.view === "table" && (
          <div className="w-44">
            <NativeSelect
              value={vm.status}
              aria-label="Filter by status"
              onChange={(e) => vm.setStatus(e.target.value as ApplicationStatus | "")}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div role="radiogroup" aria-label="View" className="bg-muted flex rounded-md p-0.5">
          {(
            [
              ["table", "Table", Table2],
              ["board", "Board", Columns3],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={vm.view === value}
              onClick={() => vm.setView(value)}
              className={cn(
                "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm",
                vm.view === value ? "bg-background font-medium shadow-xs" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {vm.view === "board" ? (
        vm.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <BoardView items={vm.boardItems} truncated={vm.boardTruncated} onMove={vm.moveCard} />
        )
      ) : (
        <>
          {count > 0 && (
            <div className="bg-accent text-accent-foreground flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm">
              <span className="font-medium">{count} selected</span>
              <div className="w-40">
                <NativeSelect
                  value={vm.tone}
                  aria-label="Letter tone"
                  onChange={(e) => vm.setTone(e.target.value as Tone)}
                  className="bg-background"
                >
                  {Object.entries(TONE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} tone
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={vm.skipExisting}
                  onChange={(e) => vm.setSkipExisting(e.target.checked)}
                />
                Skip jobs that already have a letter
              </label>
              <Button size="sm" onClick={vm.writeLetters} disabled={busy || vm.isStarting}>
                {vm.isStarting ? <Loader2 className="animate-spin" /> : <PenLine />}
                Write cover letters
              </Button>
              <div className="w-40">
                <NativeSelect
                  value=""
                  aria-label="Move selected to status"
                  className="bg-background"
                  disabled={vm.isBulkBusy}
                  onChange={(e) =>
                    e.target.value && vm.setSelectedStatus(e.target.value as ApplicationStatus)
                  }
                >
                  <option value="">Move to…</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={vm.isBulkBusy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${count} ${count === 1 ? "job" : "jobs"} and their letters? This can't be undone.`,
                    )
                  ) {
                    vm.deleteSelected();
                  }
                }}
              >
                <Trash2 />
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={vm.clearSelection}>
                Clear
              </Button>
            </div>
          )}

          <Card className="py-0">
            <CardContent className="overflow-x-auto px-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 py-3 pl-4">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        className="accent-primary size-4"
                        checked={vm.allOnPageSelected}
                        onChange={vm.togglePage}
                      />
                    </th>
                    <SortHeader vm={vm} column="company">
                      Job
                    </SortHeader>
                    <SortHeader vm={vm} column="status">
                      Status
                    </SortHeader>
                    <th className="py-3 pr-4 font-medium">Letters</th>
                    <th className="py-3 pr-4 font-medium">Match</th>
                    <SortHeader vm={vm} column="created_at">
                      Added
                    </SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {vm.isLoading &&
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} className="border-b">
                        <td colSpan={6} className="px-4 py-3">
                          <Skeleton className="h-8" />
                        </td>
                      </tr>
                    ))}
                  {vm.items.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/50 border-b last:border-0">
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${a.company}`}
                          className="accent-primary size-4"
                          checked={vm.selected.has(a.id)}
                          onChange={() => vm.toggle(a.id)}
                        />
                      </td>
                      <td className="max-w-80 py-3 pr-4">
                        <Link to={`/applications/${a.id}`} className="block hover:underline">
                          <span className="block truncate font-medium">{a.company}</span>
                          <span className="text-muted-foreground block truncate">{a.role}</span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(a.status)}>{STATUS_LABELS[a.status]}</Badge>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{a.letter_count || "-"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                        {scoreLabel(a.match_score)}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 whitespace-nowrap">
                        {formatDate(a.created_at)}
                      </td>
                    </tr>
                  ))}
                  {!vm.isLoading && vm.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground px-4 py-10 text-center">
                        {vm.search || vm.status ? (
                          "No jobs match these filters."
                        ) : (
                          <>
                            No jobs yet.{" "}
                            <Link to="/import" className="text-primary underline">
                              Import a spreadsheet
                            </Link>{" "}
                            or{" "}
                            <Link to="/applications/new" className="text-primary underline">
                              add one
                            </Link>
                            .
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {vm.pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={vm.page === 0}
                onClick={() => vm.setPage(vm.page - 1)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="tabular-nums">
                Page {vm.page + 1} of {vm.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={vm.page + 1 >= vm.pageCount}
                onClick={() => vm.setPage(vm.page + 1)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
