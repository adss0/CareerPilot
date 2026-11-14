// View + logic: add a job without leaving the tracker. A button that stays in the corner of
// the screen opens it, so there's no scrolling back to the top after a long list.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createApplication } from "@/features/applications/api";
import { SPONSORSHIP_LABELS, STATUS_LABELS } from "@/features/applications/labels";
import type { ApplicationStatus, Sponsorship } from "@/features/applications/types";
import { errorText } from "@/lib/apiClient";

const EMPTY = {
  company: "",
  role: "",
  job_url: "",
  status: "sent" as ApplicationStatus, // most jobs added by hand have already been applied for
  sponsorship: "unsure" as Sponsorship,
};

export function QuickAddJob({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: (next: { thenApply: boolean }) =>
      createApplication({
        ...values,
        company: values.company.trim(),
        role: values.role.trim(),
        job_url: values.job_url.trim(),
        // Building a CV for it means it hasn't been applied for yet.
        status: next.thenApply ? "imported" : values.status,
      }),
    onSuccess: (created, next) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      setValues(EMPTY);
      setProblem(null);
      if (next.thenApply) {
        onClose();
        navigate(`/applications/${created.id}/apply`);
      } else {
        toast.success(`Added ${created.company} as ${STATUS_LABELS[created.status]}.`);
        document.getElementById("quick-add-company")?.focus(); // ready for the next one
      }
    },
    onError: (e) => setProblem(errorText(e)),
  });

  const submit = (thenApply: boolean) => {
    if (!values.company.trim() || !values.role.trim()) {
      setProblem("Type the company and the role.");
    } else if (values.job_url.trim() && !/^https?:\/\/\S+$/i.test(values.job_url.trim())) {
      setProblem("Links must start with http:// or https://");
    } else {
      mutation.mutate({ thenApply });
    }
  };
  const set = (changes: Partial<typeof EMPTY>) => setValues((v) => ({ ...v, ...changes }));

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
          submit(false);
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a job</h2>
          <Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
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
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Job link (optional)
            <Input
              placeholder="https://…"
              maxLength={1000}
              value={values.job_url}
              onChange={(e) => set({ job_url: e.target.value })}
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
        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Add job
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => submit(true)}
          >
            Add and build my CV
          </Button>
          <Link to="/applications/new" className="text-primary ml-auto text-sm underline">
            More fields
          </Link>
        </div>
      </form>
    </div>
  );
}
