// View + logic: your main cover letter. New letters follow its structure and voice, the same
// way tailored CVs follow your main CV.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/apiClient";

import { getProfile, saveMainLetter } from "./api";

export function MainLetterView() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const saved = profile.data?.main_cover_letter ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? saved;
  const isDirty = draft !== null && draft !== saved;

  const mutation = useMutation({
    mutationFn: () => saveMainLetter(text.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      setDraft(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4" /> Main cover letter
        </CardTitle>
        <CardDescription>
          Paste a cover letter you're happy with. Every new letter then follows its structure,
          length and voice, rewritten for each job. Leave it empty to let the AI choose.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          aria-label="Main cover letter"
          rows={10}
          className="max-h-96 overflow-y-auto"
          maxLength={10000}
          placeholder="Dear Hiring Manager, …"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
        />
        {mutation.error && (
          <p role="alert" className="text-destructive text-sm">
            {errorText(mutation.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => mutation.mutate()} disabled={!isDirty || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Save main cover letter
          </Button>
          {isDirty && (
            <Button variant="outline" onClick={() => setDraft(null)}>
              Discard
            </Button>
          )}
          {!isDirty && saved && (
            <span className="text-success flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="size-4" /> In use for new letters
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
