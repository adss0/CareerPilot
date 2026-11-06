import { Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { ListItem, ListName, ProfileDetails, TextField } from "./types";

interface ProfileFormViewProps {
  form: ProfileDetails;
  onSetField: (field: TextField, value: string) => void;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  onAddItem: (list: ListName) => void;
  onUpdateItem: <L extends ListName>(list: L, index: number, changes: Partial<ListItem<L>>) => void;
  onRemoveItem: (list: ListName, index: number) => void;
}

type FieldSpec<L extends ListName> = {
  key: keyof ListItem<L> & string;
  label: string;
  wide?: boolean;
  multiline?: boolean;
  placeholder?: string;
};

const LISTS: {
  [L in ListName]: { title: string; description: string; noun: string; fields: FieldSpec<L>[] };
} = {
  experience: {
    title: "Experience",
    description: "Jobs, internships and placements, newest first.",
    noun: "job",
    fields: [
      { key: "title", label: "Job title" },
      { key: "company", label: "Company" },
      { key: "start", label: "From", placeholder: "Jun 2024" },
      { key: "end", label: "To", placeholder: "Present" },
      { key: "summary", label: "What you did", wide: true, multiline: true },
    ],
  },
  education: {
    title: "Education",
    description: "Degrees, courses and qualifications.",
    noun: "qualification",
    fields: [
      { key: "qualification", label: "Qualification" },
      { key: "institution", label: "Where" },
      { key: "start", label: "From", placeholder: "2021" },
      { key: "end", label: "To", placeholder: "2024" },
      {
        key: "details",
        label: "Details",
        wide: true,
        multiline: true,
        placeholder: "Grade, modules…",
      },
    ],
  },
  projects: {
    title: "Projects",
    description: "Things you've built. Great material for cover letters.",
    noun: "project",
    fields: [
      { key: "name", label: "Name" },
      { key: "link", label: "Link", placeholder: "https://…" },
      { key: "summary", label: "Summary", wide: true, multiline: true },
    ],
  },
};

const TEXT_FIELDS: { key: TextField; label: string; type?: string; placeholder?: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "location", label: "Location", placeholder: "Leeds, UK" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
  { key: "github_url", label: "GitHub", placeholder: "https://github.com/…" },
  { key: "portfolio_url", label: "Portfolio / website" },
];

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function ProfileFormView(props: ProfileFormViewProps) {
  const { form, onSetField, onAddSkill, onRemoveSkill } = props;
  const [newSkill, setNewSkill] = useState("");

  const commitSkill = () => {
    if (newSkill.trim()) onAddSkill(newSkill);
    setNewSkill("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>Used in your cover letters and emails.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type={f.type ?? "text"}
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => onSetField(f.key, e.target.value)}
              />
            </Field>
          ))}
          <Field label="Summary" wide>
            <Textarea
              rows={4}
              value={form.summary}
              placeholder="A few sentences about who you are and what you're looking for."
              onChange={(e) => onSetField("summary", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>The AI only mentions skills listed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.skills.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Skills">
              {form.skills.map((skill) => (
                <li
                  key={skill}
                  className="bg-accent text-accent-foreground flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    className="hover:bg-background/60 rounded-full p-0.5"
                    onClick={() => onRemoveSkill(skill)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={newSkill}
              placeholder="Add skills, separated by commas"
              aria-label="New skill"
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSkill();
                }
              }}
            />
            <Button variant="outline" onClick={commitSkill} disabled={!newSkill.trim()}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <ListSection list="experience" {...props} />
      <ListSection list="education" {...props} />
      <ListSection list="projects" {...props} />
    </div>
  );
}

function ListSection<L extends ListName>({
  list,
  form,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: ProfileFormViewProps & { list: L }) {
  const config = LISTS[list] as (typeof LISTS)[L];
  const items = form[list] as ListItem<L>[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="relative rounded-lg border p-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground absolute top-2 right-2 size-8"
              aria-label={`Remove ${config.noun} ${index + 1}`}
              onClick={() => onRemoveItem(list, index)}
            >
              <Trash2 />
            </Button>
            <div className="grid gap-3 pr-8 sm:grid-cols-2">
              {config.fields.map((field) => {
                const value = String(item[field.key] ?? "");
                const update = (v: string) =>
                  onUpdateItem(list, index, { [field.key]: v } as Partial<ListItem<L>>);
                return (
                  <Field key={field.key} label={field.label} wide={field.wide}>
                    {field.multiline ? (
                      <Textarea
                        rows={3}
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => update(e.target.value)}
                      />
                    ) : (
                      <Input
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => update(e.target.value)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onAddItem(list)}>
          <Plus />
          Add {config.noun}
        </Button>
      </CardContent>
    </Card>
  );
}
