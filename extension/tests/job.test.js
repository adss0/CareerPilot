import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_TEXT,
  canonicalUrl,
  cleanText,
  findJobPosting,
  jobFromPosting,
  looksLikeJob,
  postingMatchesPage,
  readJob,
  roleFromTitle,
} from "../src/job.js";

const posting = {
  "@type": "JobPosting",
  title: "Graduate Software Engineer",
  hiringOrganization: { "@type": "Organization", name: "Acme Ltd" },
  description: "<p>Build internal tools in Python.</p>",
};

const stripTags = (html) => html.replace(/<[^>]+>/g, "");

// A realistic job ad, as the page's visible text.
const AD = `Graduate Software Engineer
Acme Ltd · London · £32,000 per annum · Full-time
About the role
We're looking for a graduate to build internal tools in Python and SQL.
Responsibilities
- Build and test internal web tools
- Work with analysts on data pipelines
Requirements
- A degree in Computer Science or similar
- Experience with Python
Closing date: 30 November. Apply now.`;

const page = (overrides = {}) => ({
  url: "https://careers.acme.example/jobs/123",
  title: "Graduate Software Engineer | Acme Careers",
  jsonLd: [],
  selection: "",
  mainText: "",
  text: AD,
  ...overrides,
});

test("finds the JobPosting however the page nests it", () => {
  assert.equal(findJobPosting([JSON.stringify(posting)]).title, posting.title);
  const list = [{ "@type": "WebSite" }, posting];
  assert.equal(findJobPosting([JSON.stringify(list)]).title, posting.title);
  const graph = { "@context": "https://schema.org", "@graph": [{ "@type": "Org" }, posting] };
  assert.equal(findJobPosting([JSON.stringify(graph)]).title, posting.title);
  const typed = { ...posting, "@type": ["JobPosting", "Thing"] };
  assert.equal(findJobPosting([JSON.stringify(typed)]).title, posting.title);
});

test("skips broken JSON-LD and pages without a job", () => {
  assert.equal(findJobPosting(["{not json", JSON.stringify({ "@type": "WebSite" })]), null);
  assert.equal(findJobPosting([]), null);
  assert.equal(findJobPosting(["{not json", JSON.stringify(posting)]).title, posting.title);
});

test("reads the company and role from the posting", () => {
  assert.deepEqual(jobFromPosting(posting), { company: "Acme Ltd", role: posting.title });
  assert.deepEqual(jobFromPosting({ title: " Analyst ", hiringOrganization: "Initech" }), {
    company: "Initech",
    role: "Analyst",
  });
  assert.deepEqual(jobFromPosting(null), { company: "", role: "" });
  assert.deepEqual(jobFromPosting({ title: 42 }), { company: "", role: "" });
});

test("guesses the role from the tab title", () => {
  assert.equal(roleFromTitle("Graduate Engineer | Acme Careers"), "Graduate Engineer");
  assert.equal(roleFromTitle("Data Analyst - Initech - Indeed.com"), "Data Analyst");
  assert.equal(roleFromTitle("Back-end Developer"), "Back-end Developer");
  assert.equal(roleFromTitle(""), "");
});

test("tidies the text and keeps it under the app's limit", () => {
  const messy = "  Hello\u00a0  world \n\n\n\n  Next\t line  ";
  assert.equal(cleanText(messy), "Hello world\n\nNext line");
  assert.equal(cleanText("x".repeat(MAX_TEXT + 500)).length, MAX_TEXT);
  assert.equal(cleanText(undefined), "");
});

test("gives the same job the same link, so duplicates are recognised", () => {
  const linkedIn = "https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=python";
  assert.equal(canonicalUrl(linkedIn), "https://www.linkedin.com/jobs/view/4012345678/");
  assert.equal(
    canonicalUrl("https://uk.linkedin.com/jobs/view/4012345678/?refId=abc&trackingId=xyz"),
    "https://www.linkedin.com/jobs/view/4012345678/",
  );
  assert.equal(
    canonicalUrl("https://uk.indeed.com/jobs?q=graduate&l=London&vjk=7f3c2a1b"),
    "https://uk.indeed.com/viewjob?jk=7f3c2a1b",
  );
  assert.equal(
    canonicalUrl("https://careers.acme.example/jobs/123?utm_source=x&utm_medium=y&id=5#apply"),
    "https://careers.acme.example/jobs/123?id=5",
  );
  // A LinkedIn page that isn't a job keeps its link.
  assert.equal(
    canonicalUrl("https://www.linkedin.com/company/acme/"),
    "https://www.linkedin.com/company/acme/",
  );
});

test("keeps links under the app's 1,000-character limit", () => {
  const long = `https://jobs.example.com/apply/123?state=${"x".repeat(1200)}`;
  assert.equal(canonicalUrl(long), "https://jobs.example.com/apply/123");
  assert.equal(canonicalUrl("not a link"), "not a link");
});

test("uses the job record when it matches the page", () => {
  const long = "Build internal tools in Python and SQL for our analysts. ".repeat(5).trim();
  const record = JSON.stringify({ ...posting, description: `<p>${long}</p>` });
  assert.deepEqual(readJob(page({ jsonLd: [record] }), stripTags), {
    job: {
      url: "https://careers.acme.example/jobs/123",
      text: long,
      company: "Acme Ltd",
      role: posting.title,
    },
    source: "posting",
    problem: null,
  });
});

test("ignores a job record left over from another job", () => {
  // Pages that change without reloading can keep the previous job's record.
  const stale = JSON.stringify({
    ...posting,
    title: "Senior Data Scientist",
    hiringOrganization: "Initech",
  });
  const read = readJob(page({ jsonLd: [stale] }), stripTags);
  assert.equal(read.job.company, "");
  assert.equal(read.job.role, "");
  assert.equal(read.source, "page");
  assert.equal(read.problem, null);
  assert.equal(postingMatchesPage({ title: "Graduate  software\nengineer" }, AD), true);
  assert.equal(postingMatchesPage({ title: "" }, AD), false);
  assert.equal(postingMatchesPage({ title: "Anything" }, ""), true); // no visible text to check
});

test("prefers what you selected, then the record, then the main area, then the page", () => {
  const picked = readJob(page({ selection: AD, mainText: "Menu" }), stripTags);
  assert.equal(picked.source, "selection");
  assert.equal(picked.job.text, cleanText(AD));
  const main = readJob(
    page({ selection: "a few words", mainText: AD, text: `Menu\n${AD}` }),
    stripTags,
  );
  assert.equal(main.source, "main");
  assert.equal(readJob(page(), stripTags).source, "page");
});

test("refuses a page with no ad on it", () => {
  assert.equal(readJob(page({ text: "Sign in to see this job" }), stripTags).problem, "no-ad");
  assert.equal(readJob(page({ text: "" }), stripTags).problem, "no-ad");
});

test("warns before saving a page that isn't a job ad", () => {
  const email = `Inbox (3) - jane@example.com - Gmail
Hi Jane, are we still on for dinner on Friday? Let me know what time works for you and I'll
book the table. Also, did you see the photos from the weekend? Speak soon, Sam.`;
  const gmail = page({ url: "https://mail.google.com/mail/u/0/#inbox", text: email.repeat(2) });
  assert.equal(readJob(gmail, stripTags).problem, "not-a-job");

  const news = `Markets rally as inflation falls
Shares rose on Tuesday after figures showed inflation fell to 2.1% in October, the lowest
level in three years. Analysts said the fall made a cut in interest rates more likely.`;
  const article = page({ url: "https://news.example.com/business/markets", text: news.repeat(2) });
  assert.equal(readJob(article, stripTags).problem, "not-a-job");

  const search = `Google
graduate software engineer london - Google Search
All Images News Videos Maps
About 1,240,000 results (0.41 seconds)
Graduate Software Engineer jobs in London - 312 vacancies
www.example-board.com › jobs
Find the best graduate roles. Updated daily.`;
  const google = page({
    url: "https://www.google.com/search?q=graduate+software+engineer+london",
    text: search,
  });
  assert.equal(readJob(google, stripTags).problem, "not-a-job");

  // Text you select yourself is trusted: you chose it.
  assert.equal(readJob({ ...article, selection: news.repeat(2) }, stripTags).problem, null);
});

test("recognises job ads with or without a job record", () => {
  assert.equal(looksLikeJob("https://careers.acme.example/jobs/123", AD, false), true);
  assert.equal(looksLikeJob("https://example.com/p/1", AD, false), true); // the words alone
  assert.equal(looksLikeJob("https://example.com/p/1", "Anything at all", true), true);
  // A careers link with one job word isn't enough on its own.
  assert.equal(
    looksLikeJob("https://example.com/careers", "Apply for our newsletter", false),
    false,
  );
  assert.equal(looksLikeJob("not a link", "Responsibilities. Requirements. Apply.", false), false);
  assert.equal(
    looksLikeJob("https://example.com/jobs", "Responsibilities. Requirements.", false),
    true,
  );
});
