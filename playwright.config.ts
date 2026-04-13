import { defineConfig, devices } from '@playwright/test'

const STORAGE_STATE_DIR = 'tests/e2e/.auth'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined, // 4 parallel workers in CI
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000,
  },
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['github'],
        ['json', { outputFile: 'playwright-report/results.json' }],
      ]
    : [
        ['html', { open: 'never' }],
        ['list'],
      ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'on-first-retry' : 'off',
  },

  projects: [
    // === SETUP PROJECT: Authenticate once, reuse sessions ===
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // === AUTHENTICATED PROJECTS: Use stored sessions ===
    {
      name: 'engineer-tests',
      testMatch: /journeys\/(01|02|03|06)-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `${STORAGE_STATE_DIR}/engineer.json`,
      },
    },
    {
      name: 'reviewer-tests',
      testMatch: /journeys\/(04)-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `${STORAGE_STATE_DIR}/reviewer.json`,
      },
    },
    {
      name: 'admin-tests',
      testMatch: /journeys\/(05|10)-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `${STORAGE_STATE_DIR}/admin.json`,
      },
    },
    {
      name: 'customer-tests',
      testMatch: /journeys\/(07|08|09)-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `${STORAGE_STATE_DIR}/customer.json`,
      },
    },

    // === UNAUTHENTICATED TESTS: Login page only ===
    {
      name: 'public-tests',
      testMatch: /pages\/login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // === ADMIN DASHBOARD TESTS: Requires admin auth ===
    {
      name: 'admin-dashboard-tests',
      testMatch: /pages\/dashboard\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `${STORAGE_STATE_DIR}/admin.json`,
      },
    },

    // === EVAL TESTS: Visual regression, accessibility, compliance ===
    {
      name: 'eval-tests',
      testMatch: /evals\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // Evals may need different auth states, handle in test
      },
    },

    // === CROSS-BROWSER (optional, run with --project flag) ===
    {
      name: 'firefox',
      testMatch: /pages\/login\.spec\.ts/, // Only smoke test on Firefox
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /pages\/login\.spec\.ts/, // Only smoke test on WebKit
      use: { ...devices['Desktop Safari'] },
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
