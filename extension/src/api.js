// Talks to the CareerPilot app on this computer. The desktop app listens on port 8765; a
// development backend on 8000.
export const APP_ADDRESSES = ["http://127.0.0.1:8765", "http://127.0.0.1:8000"];

// Every change needs this header: it's how the app tells its own callers from other sites.
const HEADERS = { "Content-Type": "application/json", "X-CareerPilot": "1" };

export class AppError extends Error {}

async function detail(response) {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(" ");
  } catch {
    // not JSON
  }
  return `CareerPilot answered ${response.status}.`;
}

export function createClient(fetchImpl = fetch, addresses = APP_ADDRESSES) {
  let base = null;

  /** Finds the running app. Returns its health ({ version, ai_configured, ... }). */
  async function connect() {
    for (const address of addresses) {
      try {
        const response = await fetchImpl(`${address}/api/health`);
        if (!response.ok) continue;
        const health = await response.json();
        if (health.app !== "CareerPilot") continue;
        base = address;
        return health;
      } catch {
        // not running on this port
      }
    }
    throw new AppError("Open CareerPilot first, then try again.");
  }

  async function call(method, path, body) {
    if (!base) await connect();
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new AppError(await detail(response));
    return response.json();
  }

  return {
    connect,
    /** Jobs already in the tracker with the same link (or company and role). */
    duplicates: ({ url, company, role }) =>
      call(
        "GET",
        `/api/applications/duplicates?${new URLSearchParams({ job_url: url, company, role })}`,
      ),
    /** Adds the job to the tracker; the app reads the details from the text (with AI). */
    save: (job) => call("POST", "/api/jobs/paste", job),
  };
}
