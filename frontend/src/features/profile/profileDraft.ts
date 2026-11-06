import type { ListName, ProfileDetails } from "./types";

export const EMPTY_DETAILS: ProfileDetails = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  summary: "",
  skills: [],
  experience: [],
  education: [],
  projects: [],
};

export const EMPTY_ITEMS = {
  experience: { title: "", company: "", start: "", end: "", summary: "" },
  education: { qualification: "", institution: "", start: "", end: "", details: "" },
  projects: { name: "", summary: "", link: "" },
} satisfies { [L in ListName]: ProfileDetails[L][number] };

export function toDetails(source: ProfileDetails): ProfileDetails {
  const details = { ...EMPTY_DETAILS };
  for (const key of Object.keys(EMPTY_DETAILS) as (keyof ProfileDetails)[]) {
    (details as Record<string, unknown>)[key] = source[key];
  }
  return details;
}

/**
 * Fills the form with details read from a CV without throwing away the user's work:
 * text fields and lists are only replaced when the CV had something; skills are combined.
 */
export function mergeDetails(current: ProfileDetails, parsed: ProfileDetails): ProfileDetails {
  const merged = { ...current };
  for (const key of Object.keys(EMPTY_DETAILS) as (keyof ProfileDetails)[]) {
    if (key === "skills") {
      const seen = new Set(current.skills.map((s) => s.toLowerCase()));
      merged.skills = [
        ...current.skills,
        ...parsed.skills.filter((s) => !seen.has(s.toLowerCase())),
      ];
    } else if (Array.isArray(parsed[key])) {
      if ((parsed[key] as unknown[]).length > 0)
        (merged as Record<string, unknown>)[key] = parsed[key];
    } else if (parsed[key]) {
      (merged as Record<string, unknown>)[key] = parsed[key];
    }
  }
  return merged;
}

export function sameDetails(a: ProfileDetails, b: ProfileDetails): boolean {
  return JSON.stringify(toDetails(a)) === JSON.stringify(toDetails(b));
}
