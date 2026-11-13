// Desktop auto-updates: checks GitHub Releases for a newer, signed version and installs it.
// Only runs inside the desktop app; in a browser these do nothing.
import { isDesktop } from "@/lib/desktop";

export interface AvailableUpdate {
  version: string;
  notes: string;
  install: (onProgress?: (percent: number) => void) => Promise<void>;
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktop()) return null;
  // Loaded only in the desktop app, so the browser build never needs them.
  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? "",
    install: async (onProgress) => {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total) onProgress?.(Math.round((done / total) * 100));
        }
      });
      await relaunch(); // on Windows the installer usually restarts the app itself
    },
  };
}
