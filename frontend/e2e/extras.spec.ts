import { expect, test } from "@playwright/test";

const API = { "X-CareerPilot": "1" };

test.beforeEach(async ({ request }) => {
  await request.put("/api/profile", {
    headers: API,
    data: { full_name: "Jane Example", email: "jane@example.com", skills: ["Python"] },
  });
});

test("three job boards, the shortlist, and the other-site links", async ({ page }) => {
  await page.goto("/jobs");
  await page.getByLabel("Job title or keywords").fill("engineer");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(/jobs from Reed, Jooble/)).toBeVisible();
  await expect(page.getByText("Graduate Cloud Engineer")).toBeVisible(); // from Jooble

  await page.getByRole("button", { name: "Shortlist Graduate Data Analyst" }).click();
  await expect(page.getByRole("tab", { name: "Shortlist (1)" })).toBeVisible();
  await page.getByRole("tab", { name: "Shortlist (1)" }).click();
  await expect(page.getByText("Graduate Data Analyst")).toBeVisible();
  await page.getByRole("button", { name: "Remove Graduate Data Analyst from shortlist" }).click();
  await expect(page.getByRole("tab", { name: "Shortlist (0)" })).toBeVisible();

  await expect(page.getByRole("link", { name: /The Trackr/ })).toHaveAttribute(
    "href",
    /google\.com\/search\?q=site%3Athe-trackr\.com%20engineer%20graduate/,
  );
});

test("add a job from any site, then see it due on the dashboard and tracker", async ({
  page,
  request,
}) => {
  await page.goto("/jobs");
  await page.getByLabel("Job link").fill("https://www.gradcracker.com/hub/123/initech");
  await page
    .getByLabel("Job ad text")
    .fill(
      "Initech is hiring a Graduate Software Developer in Bristol. £29,000. Closes 15/12/2099.",
    );
  await page.getByRole("button", { name: "Add and apply" }).click();
  await expect(page).toHaveURL(/\/applications\/\d+\/apply$/);
  await expect(
    page.getByRole("heading", { name: "Apply: Graduate Software Developer" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the application page" })).toHaveAttribute(
    "href",
    "https://www.gradcracker.com/hub/123/initech",
  );

  // An assessment due tomorrow and a rejected job.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await request.post("/api/applications", {
    headers: API,
    data: {
      company: "Umbrella",
      role: "Tech Graduate",
      status: "sent",
      assessment: "pending",
      assessment_due: tomorrow,
    },
  });
  await request.post("/api/applications", {
    headers: API,
    data: { company: "Hooli", role: "Graduate Analyst", status: "rejected" },
  });

  await page.goto("/");
  await expect(page.getByText("Due this week")).toBeVisible();
  await expect(page.getByText("Assessment due tomorrow")).toBeVisible();

  await page.goto("/applications");
  await expect(page.getByText("Assessment due tomorrow")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hooli" })).toBeVisible();
  await page.getByLabel("Hide closed").check();
  await expect(page.getByRole("button", { name: "Hooli" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Umbrella" })).toBeVisible();
  await page.getByLabel("Hide closed").uncheck();
});

test("every page opens without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const [path, heading] of [
    ["/", "Dashboard"],
    ["/jobs", "Find jobs"],
    ["/applications", "Applications"],
    ["/calendar", "Calendar"],
    ["/import", "Import"],
    ["/profile", "Profile"],
    ["/settings", "Settings"],
    ["/applications/new", "Add a job"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/settings");
  await expect(page.getByLabel("Jooble API key")).toBeVisible();
  expect(errors).toEqual([]);
});
