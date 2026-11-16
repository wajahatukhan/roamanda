import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Always start our own server so TZ=UTC (and fixture mode) is guaranteed; never reuse a server
    // that may have been started in another zone, which would break the time-zone tests.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      // The server's own zone is UTC, as on a typical host, so the time-zone tests can put the browser far from it.
      TZ: "UTC",
      ETG_MODE: "fixture",
      ALLOW_FIXTURE_MODE: "1",
      ETG_BASE_URL: "https://api-sandbox.ratehawk.com",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key",
    },
  },
});
