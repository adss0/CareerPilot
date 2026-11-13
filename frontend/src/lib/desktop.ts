// Desktop app (Tauri) glue. In a normal browser none of this runs.
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

/** Saves an API file (letter PDF, CV, Excel export) from inside the desktop window. */
export async function saveApiFile(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const blob = await response.blob();
  const name = filenameFrom(response.headers.get("content-disposition"), "download");
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/**
 * In the desktop app: web links open in the user's browser, and download links are saved
 * directly (cross-origin download links don't work inside the app window).
 */
export function installDesktopLinkHandling(onError: (message: string) => void): () => void {
  const app = tauri();
  if (!app) return () => {};
  const onClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement | null)?.closest?.("a");
    if (!link || event.defaultPrevented) return;
    const href = link.href; // always absolute
    const apiBase = new URL(API_BASE, window.location.href).href;
    if (link.hasAttribute("download") && href.startsWith(apiBase)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveApiFile(href).catch((e: Error) => onError(e.message));
    } else if (link.target === "_blank" && /^https?:\/\//i.test(href)) {
      // Stop Tauri's shell plugin from handling the click too: its "shell open" isn't
      // allowed, and it cancelled the click so web links did nothing.
      event.preventDefault();
      event.stopImmediatePropagation();
      app
        .invoke("plugin:opener|open_url", { url: href })
        .catch(() => onError("Couldn't open the link."));
    }
  };
  // Capture phase: runs before any other click handler on the page.
  window.addEventListener("click", onClick, true);
  return () => window.removeEventListener("click", onClick, true);
}
