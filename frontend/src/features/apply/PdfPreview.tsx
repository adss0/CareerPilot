// Shows a PDF from the API inside the page. It's loaded as a blob, because the API refuses to
// be framed directly (X-Frame-Options: DENY in backend/app/core/security.py).
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function PdfPreview({
  url,
  title,
  version,
  body,
}: {
  url: string;
  title: string;
  version: string;
  body?: unknown; // sent as JSON (a POST): preview text that isn't saved yet
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payload = body === undefined ? null : JSON.stringify(body);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setObjectUrl(null);
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
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setObjectUrl(created);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, version, payload]); // reload when the document or the text changes

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!objectUrl)
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading the preview…
      </p>
    );
  return <iframe title={title} src={objectUrl} className="h-[75vh] w-full rounded-lg border" />;
}
