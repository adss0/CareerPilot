import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_TEXT,
  buildJob,
  cleanText,
  findJobPosting,
  jobFromPosting,
  roleFromTitle,
} from "../src/job.js";

const posting = {
  "@type": "JobPosting",
  title: "Graduate Software Engineer",
  hiringOrganization: { "@type": "Organization", name: "Acme Ltd" },
  description: "<p>Build internal tools in Python.</p>",
};

const stripTags = (html) => html.replace(/<[^>]+>/g, "");

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
  const messy = "  Hello   world \n\n\n\n  Next\t line  ";
  assert.equal(cleanText(messy), "Hello world\n\nNext line");
  assert.equal(cleanText("x".repeat(MAX_TEXT + 500)).length, MAX_TEXT);
  assert.equal(cleanText(undefined), "");
});

test("prefers the posting's description, falling back to the page text", () => {
  const long = "Build internal tools in Python. ".repeat(10);
  const page = {
    url: "https://jobs.example.com/1",
    title: "x",
    jsonLd: [JSON.stringify({ ...posting, description: `<p>${long}</p>` })],
    text: "Menu Sign in Cookie banner",
  };
  assert.deepEqual(buildJob(page, stripTags), {
    url: page.url,
    text: long.trim(),
    company: "Acme Ltd",
    role: posting.title,
  });

  // A short description (a teaser) isn't enough: send the page's text instead.
  const teaser = { ...page, jsonLd: [JSON.stringify(posting)], text: "The full ad, all of it" };
  assert.equal(buildJob(teaser, stripTags).text, "The full ad, all of it");

  const plain = { url: page.url, title: "Job", jsonLd: [], text: "Just the page" };
  assert.deepEqual(buildJob(plain, stripTags), {
    url: page.url,
    text: "Just the page",
    company: "",
    role: "",
  });
});
