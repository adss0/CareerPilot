import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "@/app/layout/AppLayout";
import { ThemeProvider } from "@/app/theme";
import { ApplicationDetailView } from "@/features/applications/ApplicationDetailView";
import { readApplying, rememberApplying } from "@/features/apply/applying";
import { MainLetterView } from "@/features/profile/MainLetterView";

import { QuickAddJob } from "./QuickAddJob";

// An in-memory localStorage (the test browser has none).
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function renderApp(ui: ReactElement, path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Add a job from the tracker", () => {
  it("adds it as Applied and stays open for the next one", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => json({ id: 5, company: "Acme Ltd", status: "sent" }, 201));
    renderApp(<QuickAddJob onClose={vi.fn()} />);
    expect(screen.getByLabelText("Status")).toHaveValue("sent");

    fireEvent.click(screen.getByRole("button", { name: "Add job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Type the company and the role.");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Company"), { target: { value: " Acme Ltd " } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add job" }));
    await waitFor(() => expect(screen.getByLabelText("Company")).toHaveValue(""));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/applications");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      company: "Acme Ltd",
      role: "Developer",
      status: "sent",
      sponsorship: "unsure",
    });
  });

  it("adds a job to apply for and opens its Apply page", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => json({ id: 9, company: "Acme Ltd", status: "imported" }));
    renderApp(
      <Routes>
        <Route path="/" element={<QuickAddJob onClose={vi.fn()} />} />
        <Route path="/applications/9/apply" element={<p>The Apply page</p>} />
      </Routes>,
    );
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme Ltd" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and build my CV" }));
    expect(await screen.findByText("The Apply page")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).status).toBe("imported");
  });
});

describe("Finding the Apply page again", () => {
  it("remembers the job being applied for and links to it from the sidebar", () => {
    expect(readApplying()).toBeNull();
    rememberApplying({ id: 7, role: "Developer", company: "Acme Ltd" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({}));
    renderApp(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/profile" element={<p>Profile</p>} />
        </Route>
      </Routes>,
      "/profile",
    );
    const link = screen.getByRole("link", { name: /Continue applying/ });
    expect(link).toHaveAttribute("href", "/applications/7/apply");
    expect(link).toHaveTextContent("Developer · Acme Ltd");

    rememberApplying(null); // forgotten once the job is applied for
    expect(readApplying()).toBeNull();
  });

  it("goes back to Apply from a job opened from the Apply page", () => {
    const vm = {
      application: { id: 7, role: "Developer", company: "Acme Ltd", status: "drafted" },
      isLoading: false,
      notFound: false,
      error: null,
      letters: [],
    } as unknown as Parameters<typeof ApplicationDetailView>[0];
    renderApp(
      <ApplicationDetailView {...vm} details={<p>Details</p>} />,
      "/?tab=details&from=apply",
    );
    expect(screen.getByRole("link", { name: "Back to Apply" })).toHaveAttribute(
      "href",
      "/applications/7/apply",
    );
  });
});

describe("Main cover letter", () => {
  it("saves the letter that new letters follow", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        json({ main_cover_letter: init?.method === "PUT" ? "Dear team, hello." : "" }),
      );
    renderApp(<MainLetterView />);
    const box = screen.getByLabelText("Main cover letter");
    const save = screen.getByRole("button", { name: "Save main cover letter" });
    expect(save).toBeDisabled();
    fireEvent.change(box, { target: { value: "Dear team, hello. " } });
    fireEvent.click(save);
    expect(await screen.findByText("In use for new letters")).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ main_cover_letter: "Dear team, hello." });
  });
});
