// View: the Import & export page. Renders the step the ViewModel is on.
import { Download, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import { exportUrl, templateUrl } from "./api";
import { MappingStepView } from "./MappingStepView";
import { ResultStepView } from "./ResultStepView";
import { UploadStepView } from "./UploadStepView";
import type { ImportViewModel } from "./useImportViewModel";

const steps = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Match columns" },
  { key: "result", label: "Done" },
] as const;

export function ImportView(vm: ImportViewModel) {
  const current = steps.findIndex((s) => s.key === vm.step);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Import & export</h1>
          <p className="text-muted-foreground text-sm">
            Add jobs from a spreadsheet, or download your tracker as Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={templateUrl} download>
              <FileDown />
              Download template
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={exportUrl} download>
              <Download />
              Export to Excel
            </a>
          </Button>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Import steps">
        {steps.map((s, i) => (
          <li
            key={s.key}
            aria-current={i === current ? "step" : undefined}
            className={
              i === current
                ? "bg-primary text-primary-foreground rounded-full px-3 py-1"
                : i < current
                  ? "bg-accent text-accent-foreground rounded-full px-3 py-1"
                  : "text-muted-foreground rounded-full border px-3 py-1"
            }
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {vm.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {vm.error}
        </div>
      )}

      {vm.step === "upload" && (
        <UploadStepView
          isPreviewing={vm.isPreviewing}
          fileName={vm.fileName}
          onSelectFile={vm.selectFile}
        />
      )}
      {vm.step === "map" && vm.preview && (
        <MappingStepView
          preview={vm.preview}
          mapping={vm.mapping}
          mappedPreview={vm.mappedPreview}
          missingRequired={vm.missingRequired}
          duplicateColumns={vm.duplicateColumns}
          canImport={vm.canImport}
          isImporting={vm.isImporting}
          isPreviewing={vm.isPreviewing}
          onChangeSheet={vm.changeSheet}
          onSetFieldColumn={vm.setFieldColumn}
          onImport={vm.startImport}
          onBack={vm.reset}
        />
      )}
      {vm.step === "result" && vm.result && (
        <ResultStepView
          result={vm.result}
          onDownloadIssues={vm.downloadIssues}
          onImportAnother={vm.reset}
        />
      )}
    </div>
  );
}
