import { defineConfig } from "@playwright/test";

// Smoke test against the production build, served by `vite preview`.
// M11 (plan decision 8): fixture.spec.ts runs against a second build, the app
// with the test registry (`--mode fixture`, dist-fixture/), on port 4175.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: { trace: "off" },
  projects: [
    { name: "app", testIgnore: /fixture\.spec\.ts$/, use: { baseURL: "http://localhost:4173/" } },
    { name: "fixture", testMatch: /fixture\.spec\.ts$/, use: { baseURL: "http://localhost:4175/" } },
  ],
  webServer: [
    {
      command: "npx vite build && npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx vite build --mode fixture && npx vite preview --mode fixture --port 4175 --strictPort",
      url: "http://localhost:4175/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
