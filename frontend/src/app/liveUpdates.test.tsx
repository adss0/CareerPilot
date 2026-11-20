import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLiveUpdates } from "./useLiveUpdates";

afterEach(() => vi.restoreAllMocks());

let version = "run-1";
let jobs = ["Acme Ltd"];

function Screen() {
  useLiveUpdates();
  const { data } = useQuery({
    queryKey: ["applications", "tracker"],
    queryFn: async () => [...jobs],
  });
  return <p>{data?.join(", ") ?? "loading"}</p>;
}

describe("live updates", () => {
  it("refreshes the jobs list when something is saved elsewhere", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ version })),
    );
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <Screen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Acme Ltd")).toBeInTheDocument());

    // Nothing saved yet: the first answer doesn't refresh anything.
    await new Promise((resolve) => setTimeout(resolve, 2_200));
    expect(invalidate).not.toHaveBeenCalled();

    // The extension adds a job.
    jobs = ["Acme Ltd", "Globex"];
    version = "run-2";
    await waitFor(() => expect(screen.getByText("Acme Ltd, Globex")).toBeInTheDocument(), {
      timeout: 3_000,
    });
  }, 10_000);
});
