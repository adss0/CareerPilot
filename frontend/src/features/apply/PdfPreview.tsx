// Shows a PDF from the API inside the page. It's loaded as a blob, because the API refuses to
// be framed directly (X-Frame-Options: DENY in backend/app/core/security.py).
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PdfPreview({
  url,
  title,
  version,
  body,
  live = false,
  onPages,
  className = "h-[75vh]",
}: {
  url: string;
  title: string;
  version: string;
  body?: unknown; // sent as JSON (a POST): preview text that isn't saved yet
  live?: boolean; // keep the last PDF on screen while a newer one loads (no flicker)
  onPages?: (pages: number) => void; // the page count, when the API reports it
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payload = body === undefined ? null : JSON.stringify(body);
  // Kept in a ref so a new callback on every render doesn't reload the PDF.
  const reportPages = useRef(onPages);
  reportPages.current = onPages;

  useEffect(() => {
    let cancelled = false;
    if (!live) setObjectUrl(null);
    setError(null);
    const request: RequestInit | undefined =
      payload === null
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CareerPilot": "1" },
            body: payload,
          };
    fetch(url, request)
      .then((response) => {
        if (!response.ok) throw new Error(`Couldn't load the preview (${response.status}).`);
        const pages = Number(response.headers.get("X-Pages"));
        if (pages && !cancelled) reportPages.current?.(pages);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        setObjectUrl(URL.createObjectURL(new Blob([blob], { type: "application/pdf" })));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [url, version, payload, live]); // reload when the document or the text changes

  // Free each PDF once it's replaced or the preview closes.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!objectUrl)
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading the preview…
      </p>
    );
  return (
    // #navpanes=0&view=FitH: no thumbnail strip, and the page fills the width.
    <iframe
      title={title}
      src={`${objectUrl}#navpanes=0&view=FitH`}
      className={`${className} w-full rounded-lg border`}
    />
  );
}
