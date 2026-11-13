// View: paste API keys and the email password (write-only).
import { CheckCircle2, ExternalLink, KeyRound, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SecretName } from "@/features/documents/api";

import type { KeysViewModel } from "./useKeysViewModel";

const FIELDS: {
  name: SecretName;
  label: string;
  hint: string;
  link?: string;
  group: "AI" | "Job boards" | "Email";
}[] = [
  {
    group: "AI",
    name: "gemini",
    label: "Gemini API key",
    hint: "Free. Writes your cover letters and tailors your CV.",
    link: "https://aistudio.google.com/apikey",
  },
  {
    group: "AI",
    name: "groq",
    label: "Groq API key (optional)",
    hint: "Free backup AI if Gemini is busy.",
    link: "https://console.groq.com/keys",
  },
  {
    group: "Job boards",
    name: "reed",
    label: "Reed API key",
    hint: "Free. UK jobs, with a graduate filter.",
    link: "https://www.reed.co.uk/developers/jobseeker",
  },
  {
    group: "Job boards",
    name: "adzuna_id",
    label: "Adzuna App ID",
    hint: "Free. UK jobs with salaries; needs the App ID and the App Key.",
    link: "https://developer.adzuna.com/signup",
  },
  {
    group: "Job boards",
    name: "adzuna_key",
    label: "Adzuna App Key",
    hint: "The second half of your Adzuna details.",
  },
  {
    group: "Job boards",
    name: "jooble",
    label: "Jooble API key",
    hint: "Free. Jobs gathered from many UK sites. Ask for a UK key.",
    link: "https://jooble.org/api/about",
  },
  {
    group: "Email",
    name: "email",
    label: "Email App Password",
    hint: "For sending applications and reading replies. Never your normal password.",
    link: "https://myaccount.google.com/apppasswords",
  },
];

export function KeysView(vm: KeysViewModel) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Keys & passwords
        </CardTitle>
        <CardDescription>
          Saved only in the .env file on this computer. They never go into the database, a backup or
          this screen again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {vm.error && (
          <p role="alert" className="text-destructive text-sm">
            {vm.error}
          </p>
        )}
        {FIELDS.map((field, index) => {
          const isSet = vm.status?.[field.name] ?? false;
          const heading = index === 0 || FIELDS[index - 1].group !== field.group;
          const saving = vm.saving === field.name;
          return (
            <form
              key={field.name}
              className="grid gap-1.5 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                vm.save(field.name);
              }}
            >
              {heading && (
                <h3 className="text-muted-foreground border-t pt-3 text-[11px] font-bold tracking-[0.12em] uppercase first:border-t-0 first:pt-0">
                  {field.group}
                </h3>
              )}
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {field.label}
                {isSet ? (
                  <Badge variant="success">
                    <CheckCircle2 /> Saved
                  </Badge>
                ) : (
                  <Badge variant="outline">Not set</Badge>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-56 flex-1"
                  aria-label={field.label}
                  placeholder={isSet ? "Paste a new one to replace it" : "Paste it here"}
                  value={vm.drafts[field.name]}
                  onChange={(e) => vm.setDraft(field.name, e.target.value)}
                />
                <Button type="submit" disabled={saving || !vm.drafts[field.name].trim()}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save
                </Button>
                {isSet && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => vm.remove(field.name)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {field.hint}{" "}
                {field.link && (
                  <a
                    href={field.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary inline-flex items-center gap-0.5 underline"
                  >
                    Get one <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            </form>
          );
        })}
      </CardContent>
    </Card>
  );
}
