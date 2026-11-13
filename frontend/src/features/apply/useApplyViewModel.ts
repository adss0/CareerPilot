// ViewModel: everything needed to apply for one job (tailored CV, cover letter, links, details).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { updateApplication } from "@/features/applications/api";
import {
  useApplicationDetailViewModel,
  type ApplicationDetailViewModel,
} from "@/features/applications/useApplicationDetailViewModel";
import { API_BASE, apiSend, errorText } from "@/lib/apiClient";
import { openDocumentsFolder, saveDocuments, tailoredCvExportUrl } from "@/features/documents/api";
import {
  useTailoredCvViewModel,
  type TailoredCvViewModel,
} from "@/features/documents/useTailoredCvViewModel";
import { getProfile } from "@/features/profile/api";
import type { Profile } from "@/features/profile/types";

export type PreviewTarget = "cv" | "letter" | null;

export interface ApplyViewModel {
  applicationId: number;
  letters: ApplicationDetailViewModel;
  cv: TailoredCvViewModel;
  profile: Profile | null;
  preview: PreviewTarget;
  isBuildingBoth: boolean;
  isSaving: boolean;
  isMarking: boolean;
  setPreview: (target: PreviewTarget) => void;
  buildBoth: () => void;
  saveToFolder: () => void;
  openFolder: () => void;
  useAsMainCv: () => void;
  markApplied: () => void;
  copy: (label: string, text: string) => void;
  cvPdfUrl: string;
  letterPdfUrl: string | null;
}

export function useApplyViewModel(applicationId: number): ApplyViewModel {
  const queryClient = useQueryClient();
  const letters = useApplicationDetailViewModel(applicationId);
  const cv = useTailoredCvViewModel(applicationId);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [preview, setPreview] = useState<PreviewTarget>(null);
  const [isBuildingBoth, setBuildingBoth] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const mainCvMutation = useMutation({
    mutationFn: () => apiSend("POST", `/applications/${applicationId}/tailored-cv/use-as-main`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cvs"] });
      toast.success("Saved as your main CV in Profile → Your CVs.");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const markMutation = useMutation({
    mutationFn: () => updateApplication(applicationId, { status: "sent" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Marked as applied. Good luck!");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const selected = letters.letters.find((l) => l.is_selected) ?? letters.letters[0] ?? null;

  return {
    applicationId,
    letters,
    cv,
    profile: profileQuery.data ?? null,
    preview,
    isBuildingBoth,
    isSaving,
    isMarking: markMutation.isPending,
    setPreview,
    buildBoth: async () => {
      // The CV first, then the letter: two AI calls, one after the other (free-tier friendly).
      setBuildingBoth(true);
      try {
        if (!cv.cv) await cv.tailorAsync();
        if (!selected) await letters.generateAsync();
      } catch {
        // each step shows its own error
      } finally {
        setBuildingBoth(false);
      }
    },
    saveToFolder: () => {
      setSaving(true);
      saveDocuments(applicationId)
        .then((result) =>
          toast.success("Saved as Word and PDF.", {
            description: result.folders.join("\n"),
            action: {
              label: "Open folder",
              onClick: () => void openDocumentsFolder(applicationId).catch(() => undefined),
            },
          }),
        )
        .catch((e) => toast.error(errorText(e)))
        .finally(() => setSaving(false));
    },
    openFolder: () => {
      openDocumentsFolder(applicationId).catch((e) => toast.error(errorText(e)));
    },
    useAsMainCv: () => {
      if (
        window.confirm(
          "Make this tailored CV your main CV? It's added to Profile → Your CVs and used " +
            "for jobs that don't have their own tailored CV.",
        )
      ) {
        mainCvMutation.mutate();
      }
    },
    markApplied: () => markMutation.mutate(),
    copy: (label, text) => {
      navigator.clipboard.writeText(text).then(
        () => toast.success(`${label} copied.`),
        () => toast.error("Couldn't copy. Select the text and copy it yourself."),
      );
    },
    cvPdfUrl: tailoredCvExportUrl(applicationId, "pdf"),
    letterPdfUrl: selected ? `${API_BASE}/letters/${selected.id}/export?format=pdf` : null,
  };
}
