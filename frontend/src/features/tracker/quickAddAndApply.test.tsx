import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "@/app/layout/AppLayout";
import { ThemeProvider } from "@/app/theme";
import { ApplicationDetailView } from "@/features/applications/ApplicationDetailView";
import { readApplying, rememberApplying } from "@/features/apply/applying";
import { MainLetterView } from "@/features/profile/MainLetterView";

import { openAddJob, useAddJobDialog } from "./addJob";
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

const DUPLICATE = {
  id: 3,
  company: "Acme Ltd",
  role: "Developer",
  status: "sent",
  same_link: false,
};

/** A fake API: what /duplicates finds, and a record of every other request. */
function fakeApi(duplicates: unknown[] = []) {
  const sent: { url: string; method: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("/applications/duplicates")) return json(duplicates);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    sent.push({ url, method: init?.method ?? "GET", body });
    const status = url.endsWith("/jobs/paste") ? "imported" : (body.status ?? "sent");
    return json({ id: 9, company: "Acme Ltd", role: "Developer", status });
  });
  return sent;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Add a job", () => {
  it("adds it as Applied and stays open for the next one", async () => {
    const sent = fakeApi();
    renderApp(<QuickAddJob onClose={vi.fn()} />);
    expect(screen.getByLabelText("Status")).toHaveValue("sent");

    fireEvent.click(screen.getByRole("button", { name: "Add job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Type the company and the role");
    expect(sent).toEqual([]);

    type("Company", " Acme Ltd ");
    type("Role", "Developer");
    fireEvent.click(screen.getByRole("button", { name: "Add job" }));
    await waitFor(() => expect(screen.getByLabelText("Company")).toHaveValue(""));
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/applications");
    expect(sent[0].body).toMatchObject({
      company: "Acme Ltd",
      role: "Developer",
      status: "sent",
      sponsorship: "unsure",
    });
  });

  it("adds a job to apply for and opens its Apply page", async () => {
    const sent = fakeApi();
    renderApp(
      <Routes>
        <Route path="/" element={<QuickAddJob onClose={vi.fn()} />} />
        <Route path="/applications/9/apply" element={<p>The Apply page</p>} />
      </Routes>,
    );
    type("Company", "Acme Ltd");
    type("Role", "Developer");
    fireEvent.click(screen.getByRole("button", { name: "Add and build my CV" }));
    expect(await screen.findByText("The Apply page")).toBeInTheDocument();
    expect(sent[0].body.status).toBe("imported");
  });

  it("warns about a job that's already in the tracker, and adds it only if asked again", async () => {
    const sent = fakeApi([DUPLICATE]);
    renderApp(<QuickAddJob onClose={vi.fn()} />);
    type("Company", "Acme Ltd");
    type("Role", "Developer");
    fireEvent.click(screen.getByRole("button", { name: "Add job" }));

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("You already have this job in your tracker");
    expect(screen.getByRole("link", { name: "Developer at Acme Ltd" })).toHaveAttribute(
      "href",
      "/applications/3",
    );
    expect(warning).toHaveTextContent("(Applied)");
    expect(sent).toEqual([]); // nothing was added

    fireEvent.click(screen.getByRole("button", { name: "Add anyway" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].url).toBe("/api/applications");
  });

  it("reads the job from a pasted link and gives it the chosen status", async () => {
    const sent = fakeApi();
    renderApp(<QuickAddJob onClose={vi.fn()} />);
    const read = screen.getByRole("button", { name: "Read the job" });
    expect(read).toBeDisabled(); // no link yet
    type("Job link", "https://example.com/jobs/1");
    fireEvent.click(read);
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]).toMatchObject({
      url: "/api/jobs/paste",
      body: { url: "https://example.com/jobs/1", text: "" },
    });
    // The page is read as "To apply"; the dialog's status (Applied) is then set.
    expect(sent[1]).toMatchObject({
      url: "/api/applications/9",
      method: "PATCH",
      body: { status: "sent" },
    });
  });

  it("opens with Ctrl+N on any page, or from a button", () => {
    function Host() {
      const [open, close] = useAddJobDialog();
      return open ? <QuickAddJob onClose={close} /> : <p>Closed</p>;
    }
    renderApp(<Host />);
    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Add a job" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("Closed")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "n" }); // plain typing doesn't open it
    expect(screen.getByText("Closed")).toBeInTheDocument();
    act(() => openAddJob());
    expect(screen.getByRole("dialog", { name: "Add a job" })).toBeInTheDocument();
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
