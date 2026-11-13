// End-to-end test: a real browser, a real backend, the fake AI and a local test mail server.
// Run with: npm run e2e   (set E2E_PYTHON to the backend's Python if it isn't "python")
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

// A fresh folder (database, received emails) for every run. The config is loaded again inside
// Playwright's worker, which inherits E2E_TMP, so only the first load cleans up and creates it.
if (!process.env.E2E_TMP) {
  const root = path.resolve(here, "e2e/.tmp");
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  process.env.E2E_TMP = path.join(root, String(Date.now()));
  fs.mkdirSync(process.env.E2E_TMP, { recursive: true });
}
const tmp = process.env.E2E_TMP;

const python = process.env.E2E_PYTHON ?? "python";
const backendPort = 8100;
const frontendPort = 5174;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${frontendPort}`, trace: "retain-on-failure" },
  webServer: [
    {
      command: `"${python}" e2e/fake_services.py`,
      url: "http://127.0.0.1:11500",
      reuseExistingServer: false,
      env: { E2E_TMP: tmp },
    },
    {
      command: `"${python}" -m uvicorn app.main:app --app-dir ../backend --port ${backendPort}`,
      url: `http://localhost:${backendPort}/api/health`,
      reuseExistingServer: false,
      env: {
        CAREERPILOT_HOME: path.join(tmp, "home"),
        CAREERPILOT_DOCUMENTS: path.join(tmp, "documents"),
        AI_PROVIDER: "ollama",
        OLLAMA_BASE_URL: "http://127.0.0.1:11500",
        REED_API_KEY: "e2e-fake-key",
        REED_API_BASE: "http://127.0.0.1:11500/reed/api/1.0",
        JOOBLE_API_KEY: "e2e-fake-key",
        JOOBLE_API_BASE: "http://127.0.0.1:11500/jooble/api",
        EMAIL_QUEUE_INTERVAL_SECONDS: "1",
        GEMINI_API_KEY: "",
        EMAIL_PASSWORD: "",
      },
    },
    {
      command: `npx vite --port ${frontendPort} --strictPort`,
      url: `http://localhost:${frontendPort}`,
      reuseExistingServer: false,
      env: { VITE_PROXY_TARGET: `http://localhost:${backendPort}` },
    },
  ],
});
