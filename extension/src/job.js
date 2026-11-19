// Turns what was read from a job page into what CareerPilot needs. Plain functions, no
// browser APIs, so they're tested with Node (extension/tests).

export const MAX_TEXT = 29_000; // the app accepts up to 30,000 characters of job ad

const isPosting = (node) => {
  const type = node?.["@type"];
  return Array.isArray(type) ? type.includes("JobPosting") : type === "JobPosting";
};

/** The page's JobPosting record (schema.org JSON-LD), which most job boards include. */
export function findJobPosting(jsonLdTexts) {
  for (const raw of jsonLdTexts) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue; // some sites ship broken JSON-LD
    }
    const queue = [data];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) queue.push(...node);
      else if (node && typeof node === "object") {
        if (isPosting(node)) return node;
        if (node["@graph"]) queue.push(node["@graph"]);
      }
    }
  }
  return null;
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** Company and role from the JobPosting record, or empty when the page doesn't say. */
export function jobFromPosting(posting) {
  if (!posting) return { company: "", role: "" };
  const org = posting.hiringOrganization;
  const company = text(typeof org === "string" ? org : org?.name);
  return { company: company.slice(0, 200), role: text(posting.title).slice(0, 200) };
}

/** A best guess at the role from the tab title, e.g. "Graduate Engineer | Acme Careers". */
export function roleFromTitle(title) {
  const first = text(title).split(/\s+[|–—-]\s+/)[0] ?? "";
  return first.slice(0, 200);
}

/** The ad's text: tidy whitespace and stay under the app's limit. */
export function cleanText(value) {
  const lines = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

const MAX_URL = 1000; // the app's limit for a job's link
const TRACKING =
  /^(utm_.+|gclid|fbclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|trk|trackingid|refid|ref)$/i;

/** The job's own link: search pages become the job's page, tracking codes are dropped. So the
 * same job always gets the same link, and the duplicate check can recognise it. */
export function canonicalUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return String(raw ?? "").slice(0, MAX_URL);
  }
  const host = url.hostname.replace(/^www\./, "");
  // LinkedIn's search page shows a job beside the results: link to the job itself.
  if (host.endsWith("linkedin.com") && url.pathname.startsWith("/jobs")) {
    const id =
      url.searchParams.get("currentJobId") ?? url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
    if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
  }
  // Indeed: the same, with "vjk" on search pages and "jk" on the job's page.
  if (/(^|\.)indeed\./.test(host)) {
    const id = url.searchParams.get("vjk") ?? url.searchParams.get("jk");
    if (id) return `${url.origin}/viewjob?jk=${encodeURIComponent(id)}`;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  const clean = url.toString();
  return clean.length <= MAX_URL ? clean : `${url.origin}${url.pathname}`.slice(0, MAX_URL);
}

const ENOUGH = 200; // characters: less than this is a teaser, not the ad
const TOO_LITTLE = 100; // characters: not enough to be a job ad at all

const squash = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Some sites change pages without reloading and leave the last job's record behind. Only
 * trust the record if its title is on the page you're looking at. */
export function postingMatchesPage(posting, pageText) {
  const title = squash(posting?.title);
  const visible = squash(pageText);
  return Boolean(title) && (!visible || visible.includes(title));
}

const JOB_LINK =
  /\b(jobs?|careers?|vacanc(y|ies)|positions?|openings?|roles?|hiring|recruit\w*|apply|viewjob)\b/i;
const JOB_WORDS = [
  /\bresponsibilit(y|ies)\b/i,
  /\b(requirements|qualifications)\b/i,
  /\b(salary|per annum|per year|per hour|£\s?\d)/i,
  /\bapply\b/i,
  /\bexperience (in|with|of)\b/i,
  /\b(about the (role|job|position)|job description|the role)\b/i,
  /\b(closing date|deadline)\b/i,
  /\b(full[- ]time|part[- ]time|permanent|contract|internship|graduate scheme)\b/i,
  /\bwe('re| are) looking for\b/i,
  /\b(skills|benefits)\b/i,
];

/** Does the page look like a job ad? A job record says so; otherwise the link and the words
 * on the page have to. Used to warn before saving an email, a search or a news article. */
export function looksLikeJob(url, text, hasPosting) {
  if (hasPosting) return true;
  const hits = JOB_WORDS.filter((word) => word.test(text)).length;
  let path = "";
  try {
    const parsed = new URL(url);
    path = `${parsed.hostname} ${parsed.pathname} ${parsed.search}`.replace(/[-_/.?=&]/g, " ");
  } catch {
    // not a link
  }
  return hits >= 4 || (JOB_LINK.test(path) && hits >= 2);
}

/** Reads one page into what the app is sent, and says if something's wrong with it.
 *
 * - `job`: { url, text, company, role } for POST /api/jobs/paste.
 * - `source`: where the text came from: "selection", "posting", "main" or "page".
 * - `problem`: null, "no-ad" (too little text to be an ad: don't save) or "not-a-job" (it
 *   doesn't look like a job ad: ask first).
 *
 * `htmlToText` turns the posting's HTML into text. The text is, in order of preference: what
 * you selected on the page, the job record's description, the page's main area, the page. */
export function readJob(page, htmlToText) {
  const found = findJobPosting(page.jsonLd ?? []);
  const posting = found && postingMatchesPage(found, page.text) ? found : null;
  const { company, role } = jobFromPosting(posting);
  const candidates = [
    ["selection", page.selection],
    ["posting", htmlToText(posting?.description ?? "")],
    ["main", page.mainText],
    ["page", page.text],
  ].map(([where, value]) => [where, cleanText(value)]);
  // The first that's long enough; if none is, the longest there is.
  const [source, text] =
    candidates.find(([, t]) => t.length >= ENOUGH) ??
    candidates.reduce((best, c) => (c[1].length > best[1].length ? c : best), ["page", ""]);

  let problem = null;
  if (text.length < TOO_LITTLE) problem = "no-ad";
  else if (source !== "selection" && !looksLikeJob(page.url, text, Boolean(posting)))
    problem = "not-a-job";
  return { job: { url: canonicalUrl(page.url), text, company, role }, source, problem };
}
