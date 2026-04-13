/**
 * Playwright config for Chromatic visual testing
 *
 * This config is used when running visual tests with Chromatic.
 * It uses Chromatic's auto-snapshotting to capture visual snapshots.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/evals',
  testMatch: 'visual-regression.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Chromatic recommends single worker for consistency
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off', // Chromatic handles screenshots
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
