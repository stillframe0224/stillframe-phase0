import { defineConfig, devices } from "@playwright/test";

/**
 * Guard config: runs ONLY guard-e2e-off.spec.ts against a server
 * started WITHOUT NEXT_PUBLIC_E2E (uses existing build from npm run build).
 */
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "guard-*.spec.ts",
  timeout: 15_000,
  use: { baseURL },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    // NEXT_PUBLIC_E2E is intentionally NOT set here
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
