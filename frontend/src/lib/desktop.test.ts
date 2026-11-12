import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "./apiClient";
import { installDesktopLinkHandling, isDesktop } from "./desktop";

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
    const uninstall = installDesktopLinkHandling(vi.fn());
    const a = link("https://example.com/job", { target: "_blank" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    uninstall();
  });

  it("opens web links in the user's browser inside the desktop app", () => {
    const invoke = vi.fn().mockResolvedValue(null);
    (window as Win).__TAURI_INTERNALS__ = { invoke };
    const uninstall = installDesktopLinkHandling(vi.fn());

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link("https://example.com/job", { target: "_blank" }).dispatchEvent(event);

    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", {
      url: "https://example.com/job",
    });
    expect(event.defaultPrevented).toBe(true);
    uninstall();
  });

  it("saves API downloads directly inside the desktop app", async () => {
    (window as Win).__TAURI_INTERNALS__ = { invoke: vi.fn() };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("PDF", {
        headers: { "content-disposition": 'attachment; filename="Cover letter - Acme.pdf"' },
      }),
    );
    URL.createObjectURL = vi.fn().mockReturnValue("blob:1");
    URL.revokeObjectURL = vi.fn();
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    const uninstall = installDesktopLinkHandling(vi.fn());

    const url = `${new URL(API_BASE, location.href).href}/letters/1/export?format=pdf`;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link(url, { download: "" }).dispatchEvent(event);
    await vi.waitFor(() => expect(saved).toEqual(["Cover letter - Acme.pdf"]));

    expect(event.defaultPrevented).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(url);
    uninstall();
  });
});
