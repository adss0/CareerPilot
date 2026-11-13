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
  await expect(page.getByLabel("Pre-assessment for Initech – Tech Graduate")).toHaveValue(
    "pending",
  );
  await expect(page.getByLabel("Assessment deadline for Initech – Tech Graduate")).toHaveValue(
    "2099-11-25",
  );
  await expect(page.getByRole("cell", { name: "Do the assessment by 25 Nov" })).toBeVisible();

  // Edit the sheet in place: the next step updates.
  await page.getByLabel("Pre-assessment for Initech – Tech Graduate").selectOption("done");
  await expect(page.getByRole("cell", { name: "Wait for the assessment result" })).toBeVisible();
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
});
