// Auto-fill for employers' application forms. CareerPilot can't type into your browser, so it
// makes a bookmark ("bookmarklet") holding your details: click it on an application form and it
// fills the fields it recognises. It only fills empty fields and never submits anything.
import type { Profile } from "@/features/profile/types";

export interface AutofillData {
  first: string;
  last: string;
  full: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  university: string;
  degree: string;
}

export function autofillData(profile: Profile): AutofillData {
  const names = profile.full_name.trim().split(/\s+/);
  const education = profile.education[0];
  return {
    first: names[0] ?? "",
    last: names.slice(1).join(" "),
    full: profile.full_name.trim(),
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    linkedin: profile.linkedin_url,
    github: profile.github_url,
    portfolio: profile.portfolio_url,
    university: education?.institution ?? "",
    degree: education?.qualification ?? "",
  };
}

/**
 * Fills the form on the current page and returns how many fields it filled.
 *
 * This function runs inside the employer's page, pasted there as text, so it must not use
 * anything from outside itself (no imports, no helpers).
 */
export function fillForm(data: AutofillData): number {
  // The first rule that matches a field's label, name or placeholder wins.
  const rules: [keyof AutofillData, RegExp][] = [
    ["email", /e-?mail/],
    ["first", /first.?name|given.?name|forename|\bfname\b/],
    ["last", /last.?name|sur.?name|family.?name|\blname\b/],
    ["linkedin", /linked.?in/],
    ["github", /git.?hub/],
    ["portfolio", /portfolio|personal.?(web)?site|website/],
    ["phone", /phone|mobile|\btel\b|contact.?number/],
    ["university", /university|institution|college|school/],
    ["degree", /degree|qualification|field.?of.?study|course|major/],
    ["location", /\bcity\b|\btown\b|location|where.*(live|based)/],
    ["full", /full.?name|your.?name|legal.?name|^name$|\bname\b/],
  ];
  const notAPersonsName = /company|employer|user|referr|referee|manager|emergency|file|job/;
  const skipTypes = ["hidden", "password", "file", "checkbox", "radio", "submit", "button"];
  let filled = 0;

  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  fields.forEach((field) => {
    if (field.value || field.disabled || field.readOnly || skipTypes.includes(field.type)) return;
    const labels = Array.from(field.labels ?? [], (label) => label.textContent ?? "");
    const about = [
      ...labels,
      field.getAttribute("aria-label"),
      field.getAttribute("placeholder"),
      field.getAttribute("autocomplete"),
      field.name,
      field.id,
    ]
      .join(" ")
      .replace(/([a-z])([A-Z])/g, "$1 $2") // firstName → first Name
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .trim();
    const rule = rules.find(([, pattern]) => pattern.test(about));
    if (!rule) return;
    const key = rule[0];
    if ((key === "full" || key === "first" || key === "last") && notAPersonsName.test(about)) {
      return;
    }
    const value = data[key];
    if (!value) return;
    // Set it the way typing would, so forms built with React or Angular notice the change.
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    filled += 1;
  });

  const note = document.createElement("div");
  note.textContent = filled
    ? `CareerPilot filled ${filled} field${filled === 1 ? "" : "s"}. Check them before you submit.`
    : "CareerPilot found no empty fields it recognises on this page.";
  note.setAttribute(
    "style",
    "position:fixed;top:16px;right:16px;z-index:2147483647;background:#0f5257;color:#fff;" +
      "padding:12px 16px;border-radius:10px;font:14px system-ui,sans-serif;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.25)",
  );
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 5000);
  return filled;
}

/** The bookmark's address: the fill function and your details, as one javascript: link. */
export function autofillBookmark(profile: Profile): string {
  return `javascript:void (${fillForm.toString()})(${JSON.stringify(autofillData(profile))})`;
}
