// Links and downloads. In the desktop app (Tauri), web links open in the user's browser and
// downloads are saved by CareerPilot into the Downloads folder; in a browser the browser saves
// them. Either way, every download says clearly that it worked.
import { API_BASE } from "@/lib/apiClient";

type TauriInternals = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

function tauri(): TauriInternals | null {
  return (
    (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null
  );
}

export const isDesktop = () => tauri() !== null;

function filenameFrom(disposition: string | null, fallback: string): string {
  const encoded = disposition?.match(/filename\*=utf-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

/** Where a download ended up. `path` is only known in the desktop app. */
export interface DownloadResult {
  name: string;
  path: string | null;
}

/** Downloads an API file (letter, CV, Excel export, backup). */
export async function saveApiFile(url: string): Promise<DownloadResult> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const type = response.headers.get("content-type") ?? "application/octet-stream";
  // Built from the bytes so it is always this page's own Blob type.
  const blob = new Blob([await response.arrayBuffer()], { type });
  const name = filenameFrom(response.headers.get("content-disposition"), "download");

  if (isDesktop()) {
    // The app window can't show a browser's download bar, so the backend saves the file.
    const form = new FormData();
    form.append("file", blob, name);
    form.append("filename", name);
    const saved = await fetch(`${API_BASE}/downloads`, {
      method: "POST",
      headers: { "X-CareerPilot": "1" },
      body: form,
    });
    if (!saved.ok) throw new Error("The file couldn't be saved in your Downloads folder.");
    const result = (await saved.json()) as { name: string; path: string };
    return { name: result.name, path: result.path };
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  return { name, path: null };
}

/** Opens a downloaded file, or shows it in File Explorer (desktop app only). */
export async function openDownload(path: string, showInFolder = false): Promise<void> {
  const response = await fetch(`${API_BASE}/downloads/open`, {
    method: "POST",
    headers: { "X-CareerPilot": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ path, show_in_folder: showInFolder }),
  });
  if (!response.ok) throw new Error("That file isn't in your Downloads folder any more.");
}

interface LinkHandlers {
  onError: (message: string) => void;
  onDownloading: (id: string) => void;
  onDownloaded: (id: string, result: DownloadResult) => void;
}

/**
 * Download links to the API (CV, cover letter, exports) show progress and a confirmation, in
 * the desktop app and in a browser. In the desktop app, web links also open in the browser.
 */
export function installLinkHandling(handlers: LinkHandlers): () => void {
  const app = tauri();
  let count = 0;
  const onClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement | null)?.closest?.("a");
    if (!link || event.defaultPrevented) return;
    const href = link.href; // always absolute
    const apiBase = new URL(API_BASE, window.location.href).href;
    if (link.hasAttribute("download") && href.startsWith(apiBase)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = `download-${(count += 1)}`;
      handlers.onDownloading(id);
      saveApiFile(href)
        .then((result) => handlers.onDownloaded(id, result))
        .catch((e: Error) => handlers.onError(e.message));
    } else if (app && link.target === "_blank" && /^https?:\/\//i.test(href)) {
      // Stop Tauri's shell plugin from handling the click too: its "shell open" isn't
      // allowed, and it cancelled the click so web links did nothing.
      event.preventDefault();
      event.stopImmediatePropagation();
      app
        .invoke("plugin:opener|open_url", { url: href })
        .catch(() => handlers.onError("Couldn't open the link."));
    }
  };
  // Capture phase: runs before any other click handler on the page.
  window.addEventListener("click", onClick, true);
  return () => window.removeEventListener("click", onClick, true);
}
