// Preview mode: the finished PDF of a CV or cover letter, made from what's on screen right
// now (unsaved edits included), in a window over the page.
import { Eye, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/apiClient";

import { PdfPreview } from "./PdfPreview";

export function PreviewDialog({
  title,
  kind,
  content,
  style,
  onClose,
}: {
  title: string;
  kind: "letter" | "cv";
  content: unknown; // the letter's text, or the CV's content
  style?: string; // the CV's layout
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-card shadow-lift flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-2xl border p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold">
            <Eye className="text-primary size-4" /> {title}
          </p>
          <p className="text-muted-foreground hidden text-xs sm:block">
            Exactly what the PDF will look like, including changes you haven't saved.
          </p>
          <Button size="icon" variant="ghost" aria-label="Close preview" onClick={onClose}>
            <X />
          </Button>
        </div>
        <PdfPreview
          title={title}
          url={`${API_BASE}/preview/${kind}`}
          version="draft"
          body={style ? { content, style } : { content }}
        />
      </div>
    </div>
  );
}
