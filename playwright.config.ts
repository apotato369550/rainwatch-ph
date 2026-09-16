import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", browserName: "chromium" },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  workers: 1,
});
