import { Download, FileText, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CV_EXTENSIONS, cvFileUrl } from "./api";
import type { Cv } from "./types";

interface CvPanelViewProps {
  cvs: Cv[];
  isUploading: boolean;
  busyCvId: number | null;
  aiConfigured: boolean;
  useAi: boolean;
  onUseAiChange: (value: boolean) => void;
  onUpload: (file: File) => void;
  onReadAgain: (id: number) => void;
  onMakeDefault: (id: number) => void;
  onRename: (id: number, label: string) => void;
  onRemove: (id: number) => void;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CvPanelView({
  cvs,
  isUploading,
  busyCvId,
  aiConfigured,
  useAi,
  onUseAiChange,
  onUpload,
  onReadAgain,
  onMakeDefault,
  onRename,
  onRemove,
}: CvPanelViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your CVs</CardTitle>
        <CardDescription>
          Upload a CV to fill in your profile. Keep several versions (e.g. a data CV and a web CV)
          and choose which one to send with each application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {isUploading ? "Reading your CV…" : "Upload CV"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={CV_EXTENSIONS.join(",")}
            className="hidden"
            aria-label="CV file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <p className="text-muted-foreground text-xs">.pdf, .docx or .txt, up to 5 MB</p>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={useAi && aiConfigured}
              disabled={!aiConfigured}
              onChange={(e) => onUseAiChange(e.target.checked)}
            />
            <span>
              Read it with AI (Gemini) for better results
              <span className="text-muted-foreground block text-xs">
                {aiConfigured
                  ? "Sends your CV's text to Google. On the free tier Google may use it to improve its products."
                  : "Not set up: add GEMINI_API_KEY to backend/.env. The built-in reader works offline."}
              </span>
            </span>
          </label>
        </div>

        {cvs.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            No CVs yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {cvs.map((cv) => {
              const busy = busyCvId === cv.id;
              return (
                <li key={cv.id} className="space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <input
                        defaultValue={cv.label}
                        aria-label="CV name"
                        maxLength={100}
                        className="focus-visible:border-input w-full truncate rounded border border-transparent bg-transparent px-1 text-sm font-medium outline-none focus-visible:border"
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== cv.label) {
                            onRename(cv.id, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                      <p className="text-muted-foreground truncate px-1 text-xs">
                        {cv.original_filename} · {formatSize(cv.size_bytes)}
                        {!cv.has_text && " · no text found"}
                      </p>
                    </div>
                    {cv.is_default && <Badge variant="secondary">Default</Badge>}
                    {busy && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={cvFileUrl(cv.id)} download>
                        <Download />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || !cv.has_text}
                      onClick={() => onReadAgain(cv.id)}
                    >
                      <RefreshCw />
                      Fill profile from this
                    </Button>
                    {!cv.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onMakeDefault(cv.id)}
                      >
                        <Star />
                        Make default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${cv.label}"? This removes the file too.`)) {
                          onRemove(cv.id);
                        }
                      }}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
