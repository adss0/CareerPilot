// View: the folder where tailored CVs and cover letters are saved as PDFs.
import { FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { DocumentSettingsViewModel } from "./useDocumentSettingsViewModel";

export function DocumentSettingsView(vm: DocumentSettingsViewModel) {
  const s = vm.settings;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-4" /> Saved documents
        </CardTitle>
        <CardDescription>
          When you apply for a job, its CV and cover letter are saved here as PDFs, in a{" "}
          <span className="text-foreground">CVs</span> and a{" "}
          <span className="text-foreground">Cover Letters</span> folder. Nothing is saved while
          you're still drafting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {vm.error && (
          <p role="alert" className="text-destructive">
            {vm.error}
          </p>
        )}
        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            vm.saveFolder();
          }}
        >
          <span className="font-medium">Folder</span>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-64 flex-1"
              aria-label="Documents folder"
              spellCheck={false}
              value={vm.folder}
              onChange={(e) => vm.setFolder(e.target.value)}
            />
            {vm.isDirty ? (
              <Button type="submit" disabled={vm.isSaving}>
                Save
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={vm.openFolder}>
                <FolderOpen /> Open
              </Button>
            )}
          </div>
          {s && s.folder !== s.default_folder && (
            <button
              type="button"
              className="text-primary w-fit text-xs underline"
              onClick={vm.useDefault}
            >
              Use the default ({s.default_folder})
            </button>
          )}
        </form>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={s?.auto_save ?? true}
            disabled={!s || vm.isSaving}
            onChange={(e) => vm.setAutoSave(e.target.checked)}
          />
          Save the CV and cover letter when I mark a job as applied
        </label>
      </CardContent>
    </Card>
  );
}
