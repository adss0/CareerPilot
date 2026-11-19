import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpdatesView } from "@/features/settings/UpdatesView";
import * as updates from "@/lib/updates";

import { UpdateNotifier } from "./UpdateNotifier";

const toasts = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { loading: vi.fn(), error: vi.fn() });
  return { toast };
});
vi.mock("sonner", () => toasts);
const { toast } = toasts;

// An in-memory localStorage (the test browser has none).
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const newVersion = (install: () => Promise<void>) => ({ version: "9.9.9", notes: "", install });

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("automatic updates", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("installs a new version by itself when the app opens", async () => {
    const install = vi.fn(async () => undefined);
    vi.spyOn(updates, "checkForUpdate").mockResolvedValue(newVersion(install));
    render(<UpdateNotifier />);
    await wait(5_000);
    expect(install).toHaveBeenCalledTimes(1);
    expect(toast.loading).toHaveBeenCalledWith("Updating CareerPilot to 9.9.9…", expect.anything());
    expect(toast).not.toHaveBeenCalled();
  });

  it("only offers the update when automatic updates are off", async () => {
    updates.setAutoUpdate(false);
    const install = vi.fn(async () => undefined);
    vi.spyOn(updates, "checkForUpdate").mockResolvedValue(newVersion(install));
    render(<UpdateNotifier />);
    await wait(5_000);
    expect(install).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("CareerPilot 9.9.9 is available", expect.anything());
  });

  it("checks again every few hours, but then asks instead of restarting", async () => {
    const check = vi.spyOn(updates, "checkForUpdate").mockResolvedValueOnce(null);
    const install = vi.fn(async () => undefined);
    render(<UpdateNotifier />);
    await wait(5_000);
    check.mockResolvedValue(newVersion(install));
    await wait(6 * 60 * 60 * 1000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(install).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("CareerPilot 9.9.9 is available", expect.anything());
  });

  it("remembers the switch in Settings → Updates", () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UpdatesView desktop />
      </QueryClientProvider>,
    );
    const box = screen.getByRole("checkbox", { name: /Install updates automatically/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(updates.autoUpdateEnabled()).toBe(false);
    fireEvent.click(box);
    expect(updates.autoUpdateEnabled()).toBe(true);
  });
});
