// The popup: read the job from the current tab, check it, warn about duplicates, save it.
import { AppError, createClient } from "./api.js";
import { readJob, roleFromTitle } from "./job.js";
import { htmlToText, readPage } from "./page.js";

const $ = (id) => document.getElementById(id);
const client = createClient();
let job = null;

function show(message, kind = "") {
  $("status").textContent = message;
  $("status").className = kind;
}

function fail(message) {
  show(message, "error");
  $("form").hidden = true;
  $("retry").hidden = false;
}

async function readCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPage,
    });
    return result?.result ?? null;
  } catch {
    return null; // e.g. the Chrome Web Store, where extensions can't read the page
  }
}

// How the tracker names each status.
const STATUS = {
  imported: "not applied yet",
  drafted: "letter drafted",
  ready: "ready to send",
  sent: "applied",
  followed_up: "followed up",
  replied: "replied",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

function describe(found) {
  const first = found[0];
  const more = found.length > 1 ? ` (and ${found.length - 1} more)` : "";
  const how = first.same_link ? "This link is" : "A job with this company and role is";
  const status = STATUS[first.status] ?? first.status;
  return `${how} already in your tracker: ${first.role} at ${first.company} (${status})${more}.`;
}

// Where the ad's text came from, shown so you know what's being saved.
const SOURCES = {
  selection: "the text you selected",
  posting: "the page's job details",
  main: "the page's main section",
  page: "the whole page",
};

function warn(message) {
  const item = document.createElement("p");
  item.textContent = message;
  $("warnings").append(item);
  $("warnings").hidden = false;
  $("save").textContent = "Save anyway";
}

function reset() {
  job = null;
  $("retry").hidden = true;
  $("form").hidden = true;
  $("warnings").replaceChildren();
  $("warnings").hidden = true;
  $("save").disabled = false;
  $("save").textContent = "Save job";
}

async function start() {
  reset();
  show("Looking for CareerPilot…");
  let health;
  try {
    health = await client.connect();
  } catch (error) {
    return fail(error.message);
  }

  const page = await readCurrentTab();
  if (!page) return fail("Open a job's page first, then click the button.");
  const read = readJob(page, htmlToText);
  if (read.problem === "no-ad") {
    return fail("Couldn't find a job ad on this page. Select the ad's text, then click again.");
  }
  job = read.job;

  $("company").value = job.company;
  $("role").value = job.role || (health.ai_configured ? "" : roleFromTitle(page.title));
  $("company").required = $("role").required = !health.ai_configured;
  if (health.ai_configured) {
    $("company").placeholder = $("role").placeholder = "CareerPilot reads it from the ad";
    $("hint").textContent = "Leave a box empty and the AI fills it in from the job ad.";
  } else {
    $("hint").textContent = "AI isn't set up in CareerPilot, so check the company and role.";
  }
  const size = job.text.length.toLocaleString();
  $("source").textContent = `Saving ${size} characters from ${SOURCES[read.source]}.`;
  if (read.source === "page") {
    $("source").textContent += " To save just the ad, select its text and click again.";
  }

  if (read.problem === "not-a-job") {
    warn("This page doesn't look like a job ad. Check it's the right page before saving.");
  }
  try {
    const found = await client.duplicates(job);
    if (found.length) warn(describe(found));
  } catch {
    // the check is a convenience: saving still works without it
  }

  show(`Ready to save from ${new URL(page.url).hostname}.`);
  $("form").hidden = false;
  $("save").focus();
}

async function save(event) {
  event.preventDefault();
  if (!job) return;
  const label = $("save").textContent;
  const company = $("company").value.trim();
  const role = $("role").value.trim();
  $("save").disabled = true;
  $("save").textContent = "Saving…";
  show("Saving. Reading the ad can take a few seconds (closing this won't stop it)…");
  try {
    const saved = await client.save({ ...job, company, role });
    $("form").hidden = true;
    job = null; // one click, one job: no saving it twice
    show(`Saved: ${saved.role} at ${saved.company}. It's in your CareerPilot tracker.`, "success");
  } catch (error) {
    show(error instanceof AppError ? error.message : "Couldn't reach CareerPilot.", "error");
    $("save").disabled = false;
    $("save").textContent = label;
  }
}

$("form").addEventListener("submit", save);
$("retry").addEventListener("click", start);
start();
