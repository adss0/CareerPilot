// The popup: read the job from the current tab, warn about duplicates, save it.
import { AppError, createClient } from "./api.js";
import { buildJob, roleFromTitle } from "./job.js";
import { htmlToText, readPage } from "./page.js";

const $ = (id) => document.getElementById(id);
const client = createClient();
let job = null;
let duplicateShown = false;

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
  return `${how} already in your tracker: ${first.role} at ${first.company} (${STATUS[first.status] ?? first.status})${more}.`;
}

async function start() {
  $("retry").hidden = true;
  show("Looking for CareerPilot…");
  let health;
  try {
    health = await client.connect();
  } catch (error) {
    return fail(error.message);
  }

  const page = await readCurrentTab();
  if (!page) return fail("Open a job's page first, then click the button.");
  job = buildJob(page, htmlToText);

  $("company").value = job.company;
  $("role").value = job.role || (health.ai_configured ? "" : roleFromTitle(page.title));
  if (health.ai_configured) {
    $("company").placeholder = "CareerPilot reads it from the ad";
    $("role").placeholder = "CareerPilot reads it from the ad";
    $("hint").textContent = "Leave a box empty and the AI fills it in from the job ad.";
  } else {
    $("company").required = true;
    $("role").required = true;
    $("hint").textContent = "AI isn't set up in CareerPilot, so check the company and role.";
  }

  try {
    const found = await client.duplicates(job);
    if (found.length) {
      $("duplicate").textContent = describe(found);
      $("duplicate").hidden = false;
      $("save").textContent = "Save anyway";
      duplicateShown = true;
    }
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
  const company = $("company").value.trim();
  const role = $("role").value.trim();
  $("save").disabled = true;
  $("save").textContent = "Saving…";
  show("Saving. Reading the ad can take a few seconds…");
  try {
    const saved = await client.save({ ...job, company, role });
    $("form").hidden = true;
    show(`Saved: ${saved.role} at ${saved.company}. It's in your CareerPilot tracker.`, "success");
  } catch (error) {
    show(error instanceof AppError ? error.message : "Couldn't reach CareerPilot.", "error");
    $("save").disabled = false;
    $("save").textContent = duplicateShown ? "Save anyway" : "Save job";
  }
}

$("form").addEventListener("submit", save);
$("retry").addEventListener("click", start);
start();
