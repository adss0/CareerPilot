// All backend calls go through here. In dev, Vite proxies /api to the FastAPI server.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// FastAPI sends {"detail": "..."} or, for validation errors, {"detail": [{"msg": "..."}]}.
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      const { loc, msg } = body.detail[0];
      const field = Array.isArray(loc) ? loc.filter((p: unknown) => p !== "body").join(" › ") : "";
      return field ? `${field.replaceAll("_", " ")}: ${msg}` : msg;
    }
  } catch {
    // not JSON
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "Can't reach the CareerPilot backend. Is it running?");
  }
  if (!response.ok) {
    const method = init?.method ?? "GET";
    const fallback = `${method} ${path} failed with ${response.status}`;
    throw new ApiError(response.status, await errorMessage(response, fallback));
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: form });
}

export function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
