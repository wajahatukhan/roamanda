// Lighthouse CI: mobile emulation with the default simulated 4G, against the production server in fixture mode.
// Dates are computed at run time so the URLs are always valid.
const PORT = 3200;
const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
const STAY = `in=${iso(30)}&out=${iso(32)}&rooms=2`;
const base = `http://localhost:${PORT}`;

// Same environment as the Playwright web server. The values are dummies: nothing here talks to a real service.
const env = [
  "ETG_MODE=fixture",
  "ALLOW_FIXTURE_MODE=1",
  "ETG_BASE_URL=https://api-sandbox.ratehawk.com",
  "SUPABASE_URL=http://localhost:54321",
  "SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key",
].join(" ");

module.exports = {
  ci: {
    collect: {
      // The wrapper starts the server, warms the optimised lead photo of the hotel page, then prints "Ready (warm)".
      startServerCommand: `${env} node scripts/lhci-server.mjs ${PORT} "${base}/hotel/10004834?${STAY}"`,
      startServerReadyPattern: "Ready \\(warm\\)",
      startServerReadyTimeout: 60000,
      url: [`${base}/`, `${base}/search?region=2011&name=Paris&${STAY}`, `${base}/hotel/10004834?${STAY}`],
      numberOfRuns: 3,
      settings: {
        // Mobile is Lighthouse's default form factor, with simulated slow 4G and 4x CPU slowdown.
        formFactor: "mobile",
        extraHeaders: JSON.stringify({ Cookie: "residency=gb" }),
        chromeFlags: "--no-sandbox --headless=new",
        onlyCategories: ["performance", "accessibility"],
      },
    },
    assert: {
      // The spec's targets, the same on all three pages (median of the runs).
      aggregationMethod: "median",
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
