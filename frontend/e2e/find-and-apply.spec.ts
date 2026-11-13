import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const API = { "X-CareerPilot": "1" };
const documents = path.join(process.env.E2E_TMP ?? path.resolve(here, ".tmp"), "documents");

test.beforeEach(async ({ request }) => {
  await request.put("/api/profile", {
    headers: API,
    data: {
      full_name: "Jane Example",
      email: "jane@example.com",
      phone: "+44 7700 900123",
      summary: "Graduate who builds APIs in Python.",
      skills: ["Python", "SQL"],
      experience: [
        { title: "Software Developer Intern", company: "Example Ltd", summary: "Built APIs" },
      ],
      projects: [{ name: "Job tracker", summary: "A Python tool" }],
      education: [{ qualification: "BSc Computer Science", institution: "Example University" }],
    },
  });
});

test("import a tracker spreadsheet with a title and totals above the table", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Spreadsheet file").setInputFiles({
    name: "tracker.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Grad Job Application Tracker\n\nTotal Applications,2,Applied,2\n\n" +
        "Company,Role,Application Deadline,Status,Pre-assessment,Deadline\n" +
        "Initech,Tech Graduate,Rolling,Applied,Pending,25/11/2099\n" +
        "Umbrella,Software Engineer,Rolling,Rejected,Done,\n",
    ),
  });
  await expect(page.getByLabel(/^Status/)).toHaveValue("Status");
  await expect(page.getByLabel(/^Pre-assessment/)).toHaveValue("Pre-assessment");
  await expect(page.getByLabel(/^Assessment deadline/)).toHaveValue("Deadline");
  await page.getByRole("button", { name: "Import 2 rows" }).click();
  await expect(page.getByText("Import finished")).toBeVisible();

  await page.getByRole("link", { name: "Applications" }).click();
  await expect(page.getByLabel("Status for Initech – Tech Graduate")).toHaveValue("sent");
  // The sheet's Pre-assessment + Deadline became an "Online test" stage.
  await expect(page.getByRole("button", { name: /Online test, upcoming, 25 Nov/ })).toBeVisible();
  await expect(page.getByText("Do the online test by 25 Nov")).toBeVisible();
  await expect(page.getByRole("button", { name: /Online test, passed/ })).toBeVisible(); // Umbrella

  // Mark the test passed and add a video interview: the next step follows the stages.
  await page.getByRole("button", { name: /Online test, upcoming, 25 Nov/ }).click();
  await page.getByRole("radio", { name: "Passed" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Wait for news after the online test")).toBeVisible();
  await page.getByRole("button", { name: "Add a stage for Initech – Tech Graduate" }).click();
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("video");
  await page.getByLabel("Stage date").fill("2099-12-02");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Video interview on 2 Dec")).toBeVisible();
});

test("find a job → summary → tailored CV and letter → preview → save → apply", async ({ page }) => {
  await page.goto("/jobs");
  await page.getByLabel("Job title or keywords").fill("software engineer");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /^Graduate Software Engineer/ }).click();

  // The AI summary appears by itself.
  await expect(page.getByText("A two-year graduate scheme building internal tools")).toBeVisible();
  await expect(page.getByText("78 · strong")).toBeVisible();

  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/\/applications\/\d+\/apply$/);
  await expect(
    page.getByRole("heading", { name: "Apply: Graduate Software Engineer" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Build both with Gemini" }).click();
  await expect(page.getByText("Led with Python, the job's main language")).toBeVisible();
  await expect(page.getByText("v1")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Preview CV" }).click();
  await expect(page.locator('iframe[title="Tailored CV preview"]')).toBeVisible();
  await page.getByRole("button", { name: "Preview cover letter" }).click();
  await expect(page.locator('iframe[title="Cover letter preview"]')).toBeVisible();

  // Every tailored CV gets an ATS check.
  await expect(page.getByText(/ATS \d+\/100/)).toBeVisible();

  // Downloads say clearly that they worked.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CV (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe(
    "CV - Jane Example - Acme Ltd - Graduate Software Engineer.pdf",
  );
  await expect(page.getByText("CV downloaded")).toBeVisible();

  await page.getByRole("button", { name: "Save to my documents folder" }).click();
  await expect(page.getByText("Saved as Word and PDF.")).toBeVisible();
  const cvFolder = path.join(documents, "CVs", "Acme Ltd");
  expect(fs.readdirSync(cvFolder).sort()).toEqual([
    "CV - Jane Example - Acme Ltd - Graduate Software Engineer.docx",
    "CV - Jane Example - Acme Ltd - Graduate Software Engineer.pdf",
  ]);

  await expect(page.getByRole("link", { name: "Open the application page" })).toHaveAttribute(
    "href",
    "https://example.com/jobs/9001",
  );
  await expect(page.getByRole("button", { name: "Copy Email" })).toBeVisible();

  await page.getByRole("button", { name: "I've applied" }).click();
  await expect(page.getByText("Marked as applied", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back to tracker" }).click();
  await expect(page.getByLabel("Status for Acme Ltd – Graduate Software Engineer")).toHaveValue(
    "sent",
  );
  await expect(
    page.getByLabel("Application deadline for Acme Ltd – Graduate Software Engineer"),
  ).toHaveValue("30/11/2026");

  // The Tailored CV tab: the full ATS report, and a preview of unsaved edits.
  await page.getByRole("button", { name: "Acme Ltd", exact: true }).click();
  await page.getByRole("link", { name: "All details" }).click();
  await page.getByRole("tab", { name: "Tailored CV" }).click();
  await expect(page.getByRole("region", { name: "ATS check" })).toContainText("Readable by ATS");
  await page.getByLabel("Profile summary").fill("An edited summary that isn't saved yet.");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator('iframe[title="CV preview"]')).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
});
