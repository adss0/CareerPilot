import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPostForm, apiSend } from "./apiClient";

afterEach(() => vi.restoreAllMocks());

describe("apiClient", () => {
  it("sends the X-CareerPilot header on every request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ ok: true })));

    await apiGet("/health");
    await apiSend("PUT", "/profile", { full_name: "Jane" });
    await apiPostForm("/cvs", new FormData());

    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Record<string, string>)["X-CareerPilot"]).toBe("1");
    }
    const jsonCall = fetchMock.mock.calls[1][1]!;
    expect((jsonCall.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("shows the backend's error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Write a cover letter first." }), { status: 400 }),
    );
    await expect(apiGet("/x")).rejects.toThrow("Write a cover letter first.");
  });
});
