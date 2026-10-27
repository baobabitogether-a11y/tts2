import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] || "http://127.0.0.1:4173";
const externalBaseURL = Boolean(process.env["PLAYWRIGHT_BASE_URL"]);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder:
          process.env["PLAYWRIGHT_HTML_OUTPUT_DIR"] || "docker/artifacts/playwright-report",
        open: "never",
      },
    ],
  ],
  outputDir: process.env["PLAYWRIGHT_OUTPUT_DIR"] || "docker/artifacts/test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 4173",
          url: baseURL,
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
        },
      }),
});
