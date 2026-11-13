import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as health from "@/features/health/api";
import type { DueItem } from "@/features/applications/types";

import { BackendGate } from "./BackendGate";
import { ComingUp } from "./layout/ComingUp";

// An in-memory localStorage (the test browser has none).
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BackendGate", () => {
  it("shows 'Starting…' until the backend answers, never an empty app", async () => {
    let calls = 0;
    vi.spyOn(health, "fetchHealth").mockImplementation(() => {
      calls += 1;
      return calls < 3
        ? Promise.reject(new Error("not up yet"))
        : Promise.resolve({ status: "ok" } as never);
    });
    render(
      <BackendGate>
        <p>Your jobs</p>
      </BackendGate>,
    );
    expect(screen.getByText(/Starting/)).toBeInTheDocument();
    expect(screen.queryByText("Your jobs")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Your jobs")).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(calls).toBe(3);
  });
});

describe("ComingUp", () => {
  const items: DueItem[] = [
    {
      application_id: 4,
      company: "Acme Ltd",
      role: "Graduate Developer",
      kind: "stage",
      date: "2026-11-14",
      days_left: 1,
      label: "Online test due tomorrow",
    },
  ];

  it("lists what's coming up and can be hidden until tomorrow", () => {
    const { rerender } = render(
      <MemoryRouter>
        <ComingUp items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Coming up")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Online test due tomorrow/ })).toHaveAttribute(
      "href",
      "/applications/4",
    );
    screen.getByRole("button", { name: "Hide until tomorrow" }).click();
    rerender(
      <MemoryRouter>
        <ComingUp items={items} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Coming up")).not.toBeInTheDocument();
  });

  it("shows nothing when nothing is coming up", () => {
    const { container } = render(
      <MemoryRouter>
        <ComingUp items={[]} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
