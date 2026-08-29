import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.ALBUM_CONCEPTUALIZER_WEB_BASE_URL ??
  "http://127.0.0.1:3002";

// Playwright must start the app itself. The CI job builds it and then runs
// `playwright test`, so without this every spec hit a dead port and failed
// with ERR_CONNECTION_REFUSED before asserting anything. `next start` serves
// the build the job already produced; locally an app you are already running
// is reused instead.
const serverURL = new URL(baseURL);

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `npm run start -- --hostname ${serverURL.hostname} --port ${
      serverURL.port || "3000"
    }`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
