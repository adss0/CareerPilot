import { afterEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "@/features/profile/types";

import { autofillBookmark, autofillData, fillForm } from "./autofill";

const profile = {
  full_name: "Jane Mary Example",
  email: "jane@example.com",
  phone: "+44 7700 900123",
  location: "Manchester, UK",
  linkedin_url: "https://linkedin.com/in/jane-example",
  github_url: "https://github.com/jane-example",
  portfolio_url: "",
  education: [{ qualification: "BSc Computer Science", institution: "Example University" }],
} as unknown as Profile;

const FORM = `
  <form>
    <label for="a">First Name</label><input id="a" />
    <label for="b">Surname</label><input id="b" />
    <label>Email address <input name="applicant_email" type="email" /></label>
    <input name="phoneNumber" />
    <input placeholder="LinkedIn profile" />
    <input aria-label="GitHub URL" />
    <input name="portfolio" />
    <label>City <input name="c1" /></label>
    <label>University <input name="u" /></label>
    <label>Degree <input name="d" /></label>
    <label>Company name <input name="company" /></label>
    <label>Your name <input name="who" value="Already typed" /></label>
    <label>Why do you want this job? <textarea name="why"></textarea></label>
    <input type="password" name="password" />
    <input type="checkbox" name="email_me" />
  </form>`;

const value = (selector: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!.value;

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("auto-fill for application forms", () => {
  it("fills the fields it recognises, and nothing else", () => {
    document.body.innerHTML = FORM;
    const changed = vi.fn();
    document.querySelector("#a")!.addEventListener("input", changed);

    const count = fillForm(autofillData(profile));
    expect(value("#a")).toBe("Jane");
    expect(value("#b")).toBe("Mary Example");
    expect(value("[name=applicant_email]")).toBe("jane@example.com");
    expect(value("[name=phoneNumber]")).toBe("+44 7700 900123");
    expect(value("[placeholder='LinkedIn profile']")).toBe("https://linkedin.com/in/jane-example");
    expect(value("[aria-label='GitHub URL']")).toBe("https://github.com/jane-example");
    expect(value("[name=c1]")).toBe("Manchester, UK");
    expect(value("[name=u]")).toBe("Example University");
    expect(value("[name=d]")).toBe("BSc Computer Science");
    expect(changed).toHaveBeenCalled(); // the form is told, as if you had typed it
    expect(count).toBe(9);

    // Not yours to fill, already filled, a written answer, or nothing in the profile for it.
    expect(value("[name=company]")).toBe("");
    expect(value("[name=who]")).toBe("Already typed");
    expect(value("[name=why]")).toBe("");
    expect(value("[name=password]")).toBe("");
    expect(value("[name=portfolio]")).toBe("");
    expect(document.body.textContent).toContain("CareerPilot filled 9 fields");
  });

  it("says so when there's nothing to fill", () => {
    document.body.innerHTML = "<input name='search' />";
    expect(fillForm(autofillData(profile))).toBe(0);
    expect(document.body.textContent).toContain("found no empty fields");
  });

  it("makes a bookmark that carries the fill function and your details", () => {
    const bookmark = autofillBookmark(profile);
    expect(bookmark.startsWith("javascript:void (")).toBe(true);
    expect(bookmark).toContain('"email":"jane@example.com"');

    // Run it the way a browser would: as text, with nothing from this app available.
    document.body.innerHTML = FORM;
    new Function(bookmark.replace(/^javascript:/, ""))();
    expect(value("#a")).toBe("Jane");
    expect(value("[name=applicant_email]")).toBe("jane@example.com");
  });
});
