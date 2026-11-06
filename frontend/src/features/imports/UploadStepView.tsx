import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ACCEPTED_EXTENSIONS } from "./api";

interface UploadStepViewProps {
  isPreviewing: boolean;
  fileName: string | null;
  onSelectFile: (file: File) => void;
}

export function UploadStepView({ isPreviewing, fileName, onSelectFile }: UploadStepViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onSelectFile(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        dragging ? "border-primary bg-accent" : "border-border bg-card",
      )}
    >
      {isPreviewing ? (
        <>
          <Loader2 className="text-primary size-8 animate-spin" />
          <p className="text-sm">Reading {fileName}…</p>
        </>
      ) : (
        <>
          <FileSpreadsheet className="text-primary size-10" />
          <div>
            <p className="font-medium">Drop your spreadsheet here</p>
            <p className="text-muted-foreground text-sm">.xlsx, .xls or .csv, up to 5 MB</p>
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <Upload />
            Choose file
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        aria-label="Spreadsheet file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
