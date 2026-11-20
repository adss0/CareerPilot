// Desktop auto-updates: checks GitHub Releases for a newer, signed version and installs it.
// Only runs inside the desktop app; in a browser these do nothing.
import { isDesktop } from "@/lib/desktop";

const AUTO_KEY = "careerpilot.autoUpdate";

/** Install updates without asking (on unless turned off in Settings → Updates). */
export function autoUpdateEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAutoUpdate(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, on ? "on" : "off");
  } catch {
    // storage blocked: stays on the default
  }
}

/** Why an update failed, for the message (the updater rejects with a plain string). */
export function updateErrorReason(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return text.trim().slice(0, 200);
}

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
      await update.download((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total) onProgress?.(Math.round((done / total) * 100));
        }
      });
      // The installer replaces the bundled backend's .exe, so stop it first.
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_backend_command");
      await update.install();
      await relaunch(); // on Windows the installer usually restarts the app itself
    },
  };
}
