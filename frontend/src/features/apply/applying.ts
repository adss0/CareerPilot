// The job you're in the middle of applying for, remembered so that looking at another page
// (your profile, the tracker...) doesn't lose your place. Forgotten once you've applied.
const KEY = "careerpilot.applying";

export interface Applying {
  id: number;
  role: string;
  company: string;
}

export function readApplying(): Applying | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as Applying | null;
    return value && typeof value.id === "number" ? value : null;
  } catch {
    return null;
  }
}

export function rememberApplying(job: Applying | null): void {
  try {
    if (job) localStorage.setItem(KEY, JSON.stringify(job));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the place just isn't remembered
  }
}
