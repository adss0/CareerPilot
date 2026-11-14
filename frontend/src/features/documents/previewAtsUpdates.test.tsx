import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloaded } from "@/app/downloadToasts";
import { PreviewDialog } from "@/features/apply/PreviewDialog";
import { UpdatesView } from "@/features/settings/UpdatesView";
import * as updates from "@/lib/updates";

import type { AtsReport } from "./api";
import { AtsReportView, AtsScore } from "./AtsReportView";

afterEach(() => vi.restoreAllMocks());

const withQuery = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const report: AtsReport = {
  score: 74,
  level: "ok",
  checks: [
    { id: "readable", label: "Readable by ATS", status: "pass", detail: "Every part reads." },
    { id: "keywords", label: "Job keywords", status: "warn", detail: "5 of 8 keywords." },
    { id: "contact", label: "Contact details", status: "fail", detail: "Add your email." },
  ],
  matched_keywords: ["Python"],
  missing_in_profile: ["Docker"],
  missing_gaps: ["aws"],
};

describe("ATS report", () => {
  it("shows the score, the checklist and what to add", () => {
    render(<AtsReportView report={report} />);
    const region = screen.getByRole("region", { name: "ATS check" });
    expect(region).toHaveTextContent("74");
    expect(region).toHaveTextContent("Mostly ready");
    expect(region).toHaveTextContent("Job keywords: 5 of 8 keywords.");
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Add these (they're in your profile)")).toBeInTheDocument();
    expect(screen.getByText("The job wants (only add if true)")).toBeInTheDocument();
  });

  it("has a compact score", () => {
    render(<AtsScore report={{ ...report, score: 91, level: "good" }} />);
    expect(screen.getByText(/ATS 91\/100 · Ready for ATS/)).toBeInTheDocument();
  });
});

describe("Preview", () => {
  it("previews the text on screen, unsaved edits included", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(new Blob(["%PDF"]), { status: 200 }));
    URL.createObjectURL = vi.fn().mockReturnValue("blob:preview");
    URL.revokeObjectURL = vi.fn();
    const onClose = vi.fn();
    render(
      <PreviewDialog
        title="Cover letter preview"
        kind="letter"
        content="Dear Hiring Manager, edited"
        onClose={onClose}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTitle("Cover letter preview")).toHaveAttribute("src", "blob:preview"),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/preview/letter");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ content: "Dear Hiring Manager, edited" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Updates", () => {
  it("explains updates are for the desktop app in a browser", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    withQuery(<UpdatesView desktop={false} />);
    expect(screen.getByText(/Updates are for the desktop app/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Check for updates/ })).not.toBeInTheDocument();
  });

  it("checks, then installs a new version", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const install = vi.fn(async (onProgress?: (p: number) => void) => onProgress?.(50));
    const check = vi
      .spyOn(updates, "checkForUpdate")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: "1.7.0", notes: "", install });
    withQuery(<UpdatesView desktop />);
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText("You have the latest version.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText(/Version 1.7.0 is/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Install and restart/ }));
    expect(await screen.findByText(/Downloading the update… 50%/)).toBeInTheDocument();
    expect(check).toHaveBeenCalledTimes(2);
  });
});

describe("Download message", () => {
  it("says where the file went, with Open and Show in folder", () => {
    const success = vi.spyOn(toast, "success");
    downloaded("d1", { name: "CV - Jane - Acme.pdf", path: "C:\\Users\\me\\Downloads\\x.pdf" });
    expect(success).toHaveBeenCalledWith(
      "CV downloaded",
      expect.objectContaining({
        id: "d1",
        description: "CV - Jane - Acme.pdf is in your Downloads folder.",
        action: expect.objectContaining({ label: "Open" }),
        cancel: expect.objectContaining({ label: "Show in folder" }),
      }),
    );
    downloaded("d2", { name: "Cover letter - Acme.docx", path: null });
    expect(success).toHaveBeenLastCalledWith(
      "Cover letter downloaded",
      expect.objectContaining({ description: expect.stringContaining("browser's downloads") }),
    );
  });
});
