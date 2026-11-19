import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError, createClient } from "../src/api.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const health = { status: "ok", app: "CareerPilot", version: "1.9.0", ai_configured: true };
const APP = ["http://127.0.0.1:8765"];

/** A pretend CareerPilot: routes like "POST /api/jobs/paste" → a response. */
function fakeApp(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, ...init });
    const route = routes[`${init.method ?? "GET"} ${new URL(url).pathname}`];
    if (!route) throw new TypeError("fetch failed");
    return route();
  };
  return { fetchImpl, calls };
}

test("finds the app on the second address", async () => {
  const { fetchImpl, calls } = fakeApp({ "GET /api/health": () => json(health) });
  const firstIsClosed = async (url, init) => {
    if (url.startsWith("http://127.0.0.1:8765")) throw new TypeError("fetch failed");
    return fetchImpl(url, init);
  };
  const client = createClient(firstIsClosed, ["http://127.0.0.1:8765", "http://127.0.0.1:8000"]);
  assert.equal((await client.connect()).version, "1.9.0");
  assert.equal(calls[0].url, "http://127.0.0.1:8000/api/health");
});

test("says to open CareerPilot when nothing answers, or something else does", async () => {
  const nothing = createClient(async () => {
    throw new TypeError("fetch failed");
  }, APP);
  await assert.rejects(nothing.connect(), new AppError("Open CareerPilot first, then try again."));
  const other = createClient(async () => json({ app: "Something else" }), APP);
  await assert.rejects(other.connect(), AppError);
});

test("saves with the header the app requires", async () => {
  const saved = { id: 5, company: "Acme", role: "Engineer" };
  const { fetchImpl, calls } = fakeApp({
    "GET /api/health": () => json(health),
    "POST /api/jobs/paste": () => json(saved, 201),
  });
  const job = { url: "https://x.example/1", text: "An ad", company: "", role: "" };
  assert.deepEqual(await createClient(fetchImpl, APP).save(job), saved);
  const post = calls.at(-1);
  assert.equal(post.url, "http://127.0.0.1:8765/api/jobs/paste");
  assert.equal(post.headers["X-CareerPilot"], "1");
  assert.deepEqual(JSON.parse(post.body), job);
});

test("asks about duplicates by link, company and role", async () => {
  const { fetchImpl, calls } = fakeApp({
    "GET /api/health": () => json(health),
    "GET /api/applications/duplicates": () => json([]),
  });
  const client = createClient(fetchImpl, APP);
  await client.duplicates({ url: "https://x.example/1?a=b", company: "Acme", role: "Dev" });
  const query = new URL(calls.at(-1).url).searchParams;
  assert.equal(query.get("job_url"), "https://x.example/1?a=b");
  assert.equal(query.get("company"), "Acme");
  assert.equal(query.get("role"), "Dev");
});

test("shows the app's own message when it says no", async () => {
  const refused = fakeApp({
    "GET /api/health": () => json(health),
    "POST /api/jobs/paste": () => json({ detail: "Type the company and the role." }, 400),
  });
  await assert.rejects(
    createClient(refused.fetchImpl, APP).save({ url: "", text: "" }),
    new AppError("Type the company and the role."),
  );
  const invalid = fakeApp({
    "GET /api/health": () => json(health),
    "POST /api/jobs/paste": () => json({ detail: [{ msg: "Paste the job's link." }] }, 422),
  });
  await assert.rejects(
    createClient(invalid.fetchImpl, APP).save({}),
    new AppError("Paste the job's link."),
  );
});
