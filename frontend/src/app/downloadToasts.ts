// What the user sees when a CV, cover letter or export is downloaded.
import { toast } from "sonner";

import { installLinkHandling, isDesktop, openDownload, type DownloadResult } from "@/lib/desktop";

function kindOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("cover letter")) return "Cover letter";
  if (lower.startsWith("cv")) return "CV";
  if (lower.includes("backup")) return "Backup";
  if (lower.endsWith(".xlsx")) return "Spreadsheet";
  return "File";
}

export function downloaded(id: string, result: DownloadResult) {
  const what = kindOf(result.name);
  if (result.path) {
    const path = result.path;
    toast.success(`${what} downloaded`, {
      id,
      description: `${result.name} is in your Downloads folder.`,
      duration: 10_000,
      action: {
        label: "Open",
        onClick: () => void openDownload(path).catch((e: Error) => toast.error(e.message)),
      },
      cancel: {
        label: "Show in folder",
        onClick: () => void openDownload(path, true).catch((e: Error) => toast.error(e.message)),
      },
    });
  } else {
    toast.success(`${what} downloaded`, {
      id,
      description: `${result.name}: see your browser's downloads.`,
    });
  }
}

export function installDownloadToasts(): () => void {
  return installLinkHandling({
    onError: (message) => toast.error(message),
    onDownloading: (id) =>
      toast.loading(isDesktop() ? "Saving to your Downloads folder…" : "Downloading…", { id }),
    onDownloaded: downloaded,
  });
}
