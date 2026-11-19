// Runs inside the job page when you click the button (chrome.scripting.executeScript), so it
// must not use imports or anything outside this function. It only reads the page.
export function readPage() {
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
    (s) => s.textContent ?? "",
  );
  const main = document.querySelector("main, [role=main], article");
  const text = (main ?? document.body)?.innerText ?? "";
  return { url: location.href, title: document.title, jsonLd, text };
}

/** A JobPosting description is HTML: its text, with line breaks (runs in the popup). */
export function htmlToText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  doc.querySelectorAll("br, p, li, div, h1, h2, h3, h4, tr").forEach((el) => {
    el.prepend(el.tagName === "LI" ? "\n- " : "\n");
  });
  return doc.body.textContent ?? "";
}
