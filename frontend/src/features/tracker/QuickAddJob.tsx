// View + logic: add a job from anywhere in the app (Ctrl+N, or the Add job buttons). Type it
// in, or paste the job's link and let CareerPilot read the page. Warns before adding a job
// that's already in the tracker.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createApplication, findDuplicates, updateApplication } from "@/features/applications/api";
import { SPONSORSHIP_LABELS, STATUS_LABELS } from "@/features/applications/labels";
import type {
  Application,
  ApplicationStatus,
  DuplicateJob,
  Sponsorship,
} from "@/features/applications/types";
import { addPastedJob } from "@/features/jobs/api";
import { errorText } from "@/lib/apiClient";

const EMPTY = {
  company: "",
  role: "",
  job_url: "",
  status: "sent" as ApplicationStatus, // most jobs added by hand have already been applied for
  sponsorship: "unsure" as Sponsorship,
};
type Values = typeof EMPTY;
type How = "add" | "apply" | "link";

const isLink = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

export function QuickAddJob({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);
  // Jobs already in the tracker that match what's typed, shown before adding it again.
  const [duplicates, setDuplicates] = useState<DuplicateJob[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async (how: How): Promise<Application> => {
      const job = {
        ...values,
        company: values.company.trim(),
        role: values.role.trim(),
        job_url: values.job_url.trim(),
      };
      if (duplicates === null) {
        const found = await findDuplicates(job);
        if (found.length) {
          setDuplicates(found);
          throw new Error("duplicate");
        }
      }
      // Building a CV for it means it hasn't been applied for yet.
      const status = how === "apply" ? "imported" : job.status;
      if (how !== "link") return createApplication({ ...job, status });
      // The page is read for the company, role, description, deadline and sponsorship.
      const read = await addPastedJob({
        url: job.job_url,
        text: "",
        company: job.company,
        role: job.role,
      });
      return status === read.status ? read : updateApplication(read.id, { status });
    },
    onSuccess: (created, how) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      setValues(EMPTY);
      setProblem(null);
      setDuplicates(null);
      if (how === "apply") {
        onClose();
        navigate(`/applications/${created.id}/apply`);
        return;
      }
      toast.success(
        `Added ${created.role} at ${created.company} as ${STATUS_LABELS[created.status]}.`,
        { action: { label: "Open", onClick: () => navigate(`/applications/${created.id}`) } },
      );
      document.getElementById("quick-add-company")?.focus(); // ready for the next one
    },
    onError: (e) => {
      if (e.message !== "duplicate") setProblem(errorText(e));
    },
  });

  const submit = (how: How) => {
    setProblem(null);
    if (how === "link") {
      if (!isLink(values.job_url)) setProblem("Paste the job's link first (https://…).");
      else mutation.mutate(how);
    } else if (!values.company.trim() || !values.role.trim()) {
      setProblem("Type the company and the role, or paste the job's link and read it.");
    } else if (values.job_url.trim() && !isLink(values.job_url)) {
      setProblem("Links must start with http:// or https://");
    } else {
      mutation.mutate(how);
    }
  };
  const set = (changes: Partial<Values>) => {
    setValues((v) => ({ ...v, ...changes }));
    setDuplicates(null); // it's a different job now: check again
  };
  const busy = mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="Add a job"
        className="bg-card shadow-lift w-full max-w-lg space-y-4 rounded-2xl border p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit("add");
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a job</h2>
          <Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="bg-muted/60 space-y-2 rounded-xl p-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Job link
            <div className="flex gap-2">
              <Input
                className="bg-card"
                placeholder="Paste the job's link: https://…"
                maxLength={1000}
                value={values.job_url}
                onChange={(e) => set({ job_url: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || !isLink(values.job_url)}
                onClick={() => submit("link")}
              >
                {busy && mutation.variables === "link" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Link2 />
                )}
                Read the job
              </Button>
            </div>
          </label>
          <p className="text-muted-foreground text-xs">
            Read the job opens that page and fills in the company, role, description, deadline and
            sponsorship for you. Or leave it and type the details below.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Company
            <Input
              id="quick-add-company"
              autoFocus
              maxLength={200}
              value={values.company}
              onChange={(e) => set({ company: e.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Role
            <Input
              maxLength={200}
              value={values.role}
              onChange={(e) => set({ role: e.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Status
            <NativeSelect
              value={values.status}
              onChange={(e) => set({ status: e.target.value as ApplicationStatus })}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Visa sponsorship
            <NativeSelect
              value={values.sponsorship}
              onChange={(e) => set({ sponsorship: e.target.value as Sponsorship })}
            >
              {Object.entries(SPONSORSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>

        {duplicates && duplicates.length > 0 && (
          <div
            role="alert"
            className="border-warning-border bg-warning text-warning-foreground space-y-1 rounded-lg border px-3 py-2 text-sm"
          >
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4" /> You already have this job in your tracker
            </p>
            <ul>
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link to={`/applications/${d.id}`} className="underline" onClick={onClose}>
                    {d.role} at {d.company}
                  </Link>{" "}
                  ({STATUS_LABELS[d.status]}
                  {d.same_link && ", same link"})
                </li>
              ))}
            </ul>
            <p>Click again to add it anyway.</p>
          </div>
        )}
        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>
            {busy && mutation.variables === "add" ? <Loader2 className="animate-spin" /> : <Plus />}
            {duplicates?.length ? "Add anyway" : "Add job"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => submit("apply")}>
            Add and build my CV
          </Button>
          <Link
            to="/applications/new"
            className="text-primary ml-auto text-sm underline"
            onClick={onClose}
          >
            More fields
          </Link>
        </div>
        <p className="text-muted-foreground text-xs">Tip: press Ctrl+N on any page to open this.</p>
      </form>
    </div>
  );
}
