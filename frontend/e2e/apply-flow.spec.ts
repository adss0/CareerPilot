import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

const API = { "X-CareerPilot": "1" };
const emailsFile = path.join(process.env.E2E_TMP ?? path.resolve(here, ".tmp"), "emails.json");

test("import a spreadsheet → write a letter → approve → send", async ({ page, request }) => {
  // Setup through the API: a profile, and email to the local test mail server in test mode.
  await request.put("/api/profile", {
    headers: API,
    data: { full_name: "Jane Example", skills: ["Python"], summary: "I build APIs in Python." },
  });
  await request.put("/api/settings/email", {
    headers: API,
    data: {
      from_name: "Jane Example",
      from_address: "jane@example.com",
      smtp_host: "localhost",
      smtp_port: 2526,
      smtp_security: "none",
      min_gap_seconds: 0,
      max_gap_seconds: 0,
      test_mode: true,
      test_address: "me@example.com",
    },
  });

  // 1. Import a spreadsheet
  await page.goto("/import");
  await page.getByLabel("Spreadsheet file").setInputFiles({
    name: "jobs.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Employer,Job Title,E-mail,Description\nAcme Ltd,Junior Developer,hiring@example.org,Python APIs\n",
    ),
  });
  await expect(page.getByText("Match your columns")).toBeVisible();
  await expect(page.getByLabel(/^Company/)).toHaveValue("Employer");
  await page.getByRole("button", { name: "Import 1 row" }).click();
  await expect(page.getByText("Import finished")).toBeVisible();

  // 2. Write the cover letter
  await page.getByRole("link", { name: "Applications" }).click();
  await page.getByRole("button", { name: "Acme Ltd" }).click();
  await page.getByRole("link", { name: "All details" }).click();
  await page.getByRole("button", { name: "Write letter" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(/Junior Developer role at Acme Ltd/);

  // 3. Approve and send (test mode: it goes to me@example.com, not the employer)
  await page.getByRole("tab", { name: "Apply" }).click();
  await expect(page.getByText("instead of hiring@example.org")).toBeVisible();
  const send = page.getByRole("button", { name: "Approve & send" });
  await expect(send).toBeDisabled();
  await page.getByLabel(/I've read the cover letter and this email/).check();
  await send.click();

  // 4. The background queue sends it
  await expect(page.getByText("Sent", { exact: true })).toBeVisible({ timeout: 30_000 });
  const emails = JSON.parse(fs.readFileSync(emailsFile, "utf8"));
  expect(emails).toHaveLength(1);
  expect(emails[0].to).toEqual(["me@example.com"]);
  expect(emails[0].subject).toBe("[TEST] Junior Developer application");
  expect(emails[0].attachments).toEqual(["Cover letter - Acme Ltd - Junior Developer.pdf"]);
});
