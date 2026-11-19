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
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

/** Everything the app is sent for one page. `htmlToText` turns the posting's HTML into text. */
export function buildJob(page, htmlToText) {
  const posting = findJobPosting(page.jsonLd ?? []);
  const { company, role } = jobFromPosting(posting);
  // The JobPosting's own description is the cleanest text; otherwise the page's main text.
  const description = cleanText(htmlToText(posting?.description ?? ""));
  const body = description.length >= 200 ? description : cleanText(page.text);
  return { url: page.url, text: body, company, role };
}
