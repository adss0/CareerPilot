// View: download a backup, or restore one (applied when CareerPilot restarts).
import { Archive, Download, Loader2, Upload, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/dates";

import type { BackupViewModel } from "./useBackupViewModel";

export function BackupView(vm: BackupViewModel) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="size-4" /> Backup & restore
        </CardTitle>
        <CardDescription>
          A backup is one .zip with all your jobs, letters, emails, replies, profile and CVs. It
          never contains your API keys or email password. Keep it somewhere safe; it holds personal
          data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`${API_BASE}/backup`} download>
              <Download /> Download backup
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={vm.isRestoring}
          >
            {vm.isRestoring ? <Loader2 className="animate-spin" /> : <Upload />}
            Restore from backup…
          </Button>
          <input
            ref={input}
            type="file"
            accept=".zip"
            className="hidden"
            aria-label="Backup file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (
                file &&
                window.confirm(
                  "Restore this backup? It replaces your current data when CareerPilot restarts. " +
                    "Your current data is kept in the backups folder.",
                )
              ) {
                vm.restore(file);
              }
            }}
          />
        </div>
        {vm.pending && (
          <div
            role="status"
            className="border-warning-border bg-warning text-warning-foreground flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
          >
            <span className="flex-1">
              A backup
              {vm.pending.created_at ? ` from ${formatDateTime(vm.pending.created_at)}` : ""} is
              ready. Restart CareerPilot to finish restoring it.
            </span>
            <Button size="sm" variant="ghost" onClick={vm.cancel}>
              <X /> Cancel restore
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
