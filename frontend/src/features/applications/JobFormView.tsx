import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import type { JobFormValues } from "./jobForm";
import { STATUS_LABELS } from "./labels";
import type { ApplicationStatus } from "./types";

interface JobFormViewProps {
  values: JobFormValues;
  problems: Partial<Record<keyof JobFormValues, string>>;
  cvs: { id: number; label: string; is_default: boolean }[];
  onChange: (changes: Partial<JobFormValues>) => void;
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </label>
  );
}

const PRIORITIES = ["None", "Low", "Medium", "High"];

export function JobFormView({ values, problems, cvs, onChange }: JobFormViewProps) {
  const text = (key: keyof JobFormValues, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} error={problems[key]}>
      <Input
        value={String(values[key])}
        aria-invalid={problems[key] ? true : undefined}
        onChange={(e) => onChange({ [key]: e.target.value })}
        {...props}
      />
    </Field>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {text("company", "Company *", { maxLength: 200 })}
      {text("role", "Role *", { maxLength: 200 })}
      {text("job_url", "Job link", { placeholder: "https://…", maxLength: 1000 })}
      {text("location", "Location", { maxLength: 200 })}
      {text("contact_name", "Contact name", { maxLength: 200 })}
      {text("contact_email", "Contact email", { type: "email", maxLength: 320 })}
      {text("salary", "Salary", { maxLength: 100 })}
      <Field label="Status">
        <NativeSelect
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value as ApplicationStatus })}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Priority">
        <NativeSelect
          value={values.priority}
          onChange={(e) => onChange({ priority: Number(e.target.value) })}
        >
          {PRIORITIES.map((label, value) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="CV to send">
        <NativeSelect value={values.cv_id} onChange={(e) => onChange({ cv_id: e.target.value })}>
          <option value="">Default CV</option>
          {cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.label}
              {cv.is_default ? " (default)" : ""}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Interview">
        <Input
          type="datetime-local"
          value={values.interview_at}
          onChange={(e) => onChange({ interview_at: e.target.value })}
        />
      </Field>
      <Field label="Job description" wide>
        <Textarea
          rows={8}
          value={values.job_description}
          placeholder="Paste the job advert here. The AI uses it to tailor your letter."
          onChange={(e) => onChange({ job_description: e.target.value })}
        />
      </Field>
      <Field label="Notes" wide>
        <Textarea
          rows={3}
          value={values.notes}
          placeholder="Anything to remember: who referred you, interview dates…"
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
