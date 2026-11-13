import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "./apiClient";
import { installLinkHandling, isDesktop } from "./desktop";

type Win = { __TAURI_INTERNALS__?: { invoke: ReturnType<typeof vi.fn> } };

function link(href: string, attrs: Record<string, string> = {}): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = "link";
  document.body.appendChild(a);
  return a;
}

afterEach(() => {
  delete (window as Win).__TAURI_INTERNALS__;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("desktop link handling", () => {
  it("does nothing in a normal browser", () => {
    expect(isDesktop()).toBe(false);
    const uninstall = installLinkHandling({
      onError: vi.fn(),
      onDownloading: vi.fn(),
      onDownloaded: vi.fn(),
    });
    const a = link("https://example.com/job", { target: "_blank" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    uninstall();
  });

  it("opens web links in the user's browser inside the desktop app", () => {
    const invoke = vi.fn().mockResolvedValue(null);
    (window as Win).__TAURI_INTERNALS__ = { invoke };
    const uninstall = installLinkHandling({
      onError: vi.fn(),
      onDownloading: vi.fn(),
      onDownloaded: vi.fn(),
    });

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link("https://example.com/job", { target: "_blank" }).dispatchEvent(event);

    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", {
      url: "https://example.com/job",
    });
    expect(event.defaultPrevented).toBe(true);
    uninstall();
  });

  it("saves API downloads in the Downloads folder inside the desktop app", async () => {
    (window as Win).__TAURI_INTERNALS__ = { invoke: vi.fn() };
    const savedPath = "C:\\Users\\me\\Downloads\\Cover letter - Acme.pdf";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("PDF", {
          headers: { "content-disposition": 'attachment; filename="Cover letter - Acme.pdf"' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "Cover letter - Acme.pdf", path: savedPath })),
      );
    const handlers = { onError: vi.fn(), onDownloading: vi.fn(), onDownloaded: vi.fn() };
    const uninstall = installLinkHandling(handlers);

    const url = `${new URL(API_BASE, location.href).href}/letters/1/export?format=pdf`;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link(url, { download: "" }).dispatchEvent(event);
    await vi.waitFor(() =>
      expect(handlers.onDownloaded).toHaveBeenCalledWith("download-1", {
        name: "Cover letter - Acme.pdf",
        path: savedPath,
      }),
    );

    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onDownloading).toHaveBeenCalledWith("download-1");
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/downloads`);
    uninstall();
  });

  it("confirms browser downloads too", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("PDF", {
        headers: { "content-disposition": 'attachment; filename="CV - Jane.pdf"' },
      }),
    );
    URL.createObjectURL = vi.fn().mockReturnValue("blob:1");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const handlers = { onError: vi.fn(), onDownloading: vi.fn(), onDownloaded: vi.fn() };
    const uninstall = installLinkHandling(handlers);
    const url = `${new URL(API_BASE, location.href).href}/applications/1/tailored-cv/export`;
    link(url, { download: "" }).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(handlers.onDownloaded).toHaveBeenCalledWith(expect.any(String), {
        name: "CV - Jane.pdf",
        path: null,
      }),
    );
    uninstall();
  });
});

describe("links win over other click handlers", () => {
  it("opens the link even when another handler would cancel the click", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = { invoke };
    // Like Tauri's shell plugin: a bubbling handler that cancels clicks on links.
    const other = vi.fn((e: Event) => e.preventDefault());
    document.addEventListener("click", other);
    const uninstall = installLinkHandling({
      onError: vi.fn(),
      onDownloading: vi.fn(),
      onDownloaded: vi.fn(),
    });
    const a = document.createElement("a");
    a.href = "https://example.com/apply";
    a.target = "_blank";
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", {
      url: "https://example.com/apply",
    });
    expect(other).not.toHaveBeenCalled();
    uninstall();
    document.removeEventListener("click", other);
    a.remove();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });
});
